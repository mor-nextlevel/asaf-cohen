// ---------------------------------------------------------------------------
// One endpoint, everything the dashboard needs.
//
//   GET /api/data?k=<code>&since=YYYY-MM-DD&until=YYYY-MM-DD
//
// Three sources, deliberately kept apart:
//   Cardcom    -> what was actually charged, declined and refunded. The money truth.
//   Rav Messer -> who reached the checkout, and who bought (list membership).
//   Meta       -> what was spent, and which ad spent it.
//
// Meta's own purchase value is reported too, but it is NOT used as revenue
// while the terminal is connected: a thank-you page pixel usually never sees
// the real charged amount (an order bump, a coupon), so the headline revenue
// comes from the terminal. With Meta alone connected, the pixel is all there is,
// and the page counts sales, revenue, forms and checkouts from it.
//
// Every business-specific value lives in ./_settings.js. Every key lives in an
// environment variable. With no source connected at all, the page runs on demo data.
// ---------------------------------------------------------------------------

import S from './_settings.js';
import { demoPayload } from './_demo.js';

const RM_BASE = process.env.RESPONDER_BASE_URL || 'https://graph.responder.live/v2';
const GRAPH = 'https://graph.facebook.com/v21.0';
const CC_BASE = 'https://secure.cardcom.solutions/api/v11';

const n = (v) => Number(v) || 0;

const LIST_LEADS = n(S.listLeads);    // הגיעו לתשלום
const LIST_BUYERS = n(S.listBuyers);  // רכשו
const LIST_BUMP = n(S.listBump);      // לקחו גם את האפסייל

const PRICE_MAIN = n(S.priceMain);
const PRICE_BUMP = n(S.priceBump);

// The prices are what the buyer pays, VAT included, so net revenue is
// gross / (1 + rate) — not gross × (1 - rate). An exempt dealer sets 0.
const VAT_RATE = S.vatRate === undefined || S.vatRate === null || S.vatRate === '' ? 0.18 : n(S.vatRate);

const AD_ACCOUNT = String(S.metaAdAccount || '').trim();

// An ad account is rarely dedicated to one product: it usually carries years of
// older campaigns to other pages, and over a long range that spend swamps the
// product's own. Every insights call is filtered by campaign name, so the
// dashboard only reports the campaigns that belong here.
const CAMPAIGN_FILTER = String(S.metaCampaignFilter || '').trim();
const CAMPAIGN_FILTERING = CAMPAIGN_FILTER
  ? JSON.stringify([{ field: 'campaign.name', operator: 'CONTAIN', value: CAMPAIGN_FILTER }])
  : '';

const CC_TERMINAL = n(S.cardcomTerminal);
// A transaction below this is a test, not a sale.
const MIN_REAL_AMOUNT = S.minRealAmount === undefined ? 50 : n(S.minRealAmount);
const ONLY_THIS_PRODUCT = !!S.terminalOnlyThisProduct;
const LEADS_DROP_BUYERS = !!S.leadsListDropsBuyers;

// A clearing terminal usually clears the business's other products too, and
// Cardcom's ListTransactions returns no product name, so a transaction has to be
// identified as this product's by other means. Two signals, either is enough:
//
//   1. The payer joined the Rav Messer buyers list within an hour of the charge.
//      That list is fed only by the product's payment page, so membership proves
//      origin and keeps working if the price ever changes.
//   2. The amount is one of the product's prices. This is the fallback that keeps
//      working if the payment page ever stops writing to the list.
const PRODUCT_AMOUNTS = (Array.isArray(S.productAmounts) && S.productAmounts.length
  ? S.productAmounts
  : [PRICE_MAIN, PRICE_BUMP ? PRICE_MAIN + PRICE_BUMP : 0]
).map(n).filter(Boolean);

const HAS_CC = !!(process.env.CARDCOM_API_NAME && process.env.CARDCOM_API_PASSWORD && CC_TERMINAL);
const HAS_RM = !!(process.env.RESPONDER_CLIENT_ID && process.env.RESPONDER_CLIENT_SECRET && process.env.RESPONDER_USER_TOKEN);
const HAS_META = !!(process.env.META_ACCESS_TOKEN && AD_ACCOUNT);
const DEMO = !HAS_CC && !HAS_RM && !HAS_META;

// Serverless instances stay warm; a short cache keeps a page refresh from
// re-walking all three APIs. 90s is well under how fast any number moves.
const TTL_MS = 90 * 1000;
const cache = new Map();
// The promise itself is stored, so a request that arrives while the first one
// is still waiting joins it instead of calling the source a second time. That
// matters for Cardcom, which fails one of two calls made on one key at once. A
// failure is dropped from the cache, so the next refresh tries again.
function cached(key, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const value = fn();
  cache.set(key, { at: Date.now(), value });
  value.catch(() => { if (cache.get(key)?.value === value) cache.delete(key); });
  return value;
}

// A bare "fetch failed" does not say which of the three systems broke, and
// that is the first thing anyone fixing it needs to know.
function labelled(source, promise) {
  return promise.catch((e) => { throw new Error(`${source}: ${e.message}`); });
}

/* ------------------------------ time ------------------------------------ */

const IL_FMT = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Jerusalem',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
});

/**
 * Rav Messer stamps `list_created` in **UTC**, not Israel time — proven by
 * matching buyers against their Cardcom transactions, every pair exactly three
 * hours apart. Left raw, a purchase made after 21:00 Israel time lands on the
 * previous day and "today" is wrong for the first three hours of the day.
 * Cardcom, by contrast, already reports Israel local time.
 */
function utcToIsrael(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';
  const d = new Date(text.replace(' ', 'T') + (/[zZ]|[+-]\d{2}:?\d{2}$/.test(text) ? '' : 'Z'));
  if (isNaN(d)) return text;
  return IL_FMT.format(d);
}

/* ----------------------------- Rav Messer ------------------------------- */

let rmToken = { token: null, expire: 0 };

async function rmAuth() {
  const res = await fetch(`${RM_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      scope: '*',
      client_id: Number(process.env.RESPONDER_CLIENT_ID),
      client_secret: process.env.RESPONDER_CLIENT_SECRET,
      user_token: process.env.RESPONDER_USER_TOKEN,
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Rav Messer auth ${res.status}: ${text.slice(0, 200)}`);
  const parsed = JSON.parse(text);
  if (!parsed.token) throw new Error('Rav Messer returned no token');
  rmToken = { token: parsed.token, expire: parsed.expire };
  return rmToken.token;
}

async function rmBearer() {
  if (!rmToken.token || rmToken.expire - 300 <= Date.now() / 1000) return rmAuth();
  return rmToken.token;
}

// The list edge rejects a request without both offset and size — always send the pair.
async function rmList(listId) {
  if (!HAS_RM || !listId) return [];
  const out = [];
  const size = 500;
  for (let offset = 0; offset < 20000; offset += size) {
    const url = `${RM_BASE}/lists/${listId}/subscribers?offset=${offset}&size=${size}`;
    let res = await fetch(url, { headers: { Authorization: `Bearer ${await rmBearer()}` } });
    if (res.status === 401) {
      res = await fetch(url, { headers: { Authorization: `Bearer ${await rmAuth()}` } });
    }
    const text = await res.text();
    if (!res.ok) throw new Error(`Rav Messer list ${listId} (${res.status}): ${text.slice(0, 200)}`);
    const parsed = JSON.parse(text);
    const rows = parsed.data || [];
    for (const r of rows) {
      out.push({
        email: (r.email || '').toLowerCase(),
        name: r.name || [r.first, r.last].filter(Boolean).join(' ') || '',
        phone: r.phone || '',
        // list_created is the moment this person joined THIS list — not the
        // moment the contact record was born. That distinction is the whole
        // reason a date range on this dashboard means anything.
        at: utcToIsrael(r.list_created || r.created || ''),
        unsubscribed: !!Number(r.unsubscribed),
      });
    }
    if (out.length >= (parsed.total || 0) || rows.length < size) break;
  }
  out.sort((a, b) => (a.at < b.at ? 1 : -1));
  return out;
}

/* ------------------------------- Cardcom -------------------------------- */

function ddmmyyyy(iso) {
  const [y, m, d] = String(iso).split('-');
  return `${d}${m}${y}`;
}

async function cardcomTransactions(since, until) {
  if (!HAS_CC) return null;

  const out = [];
  // Cardcom spends ~5 seconds answering a wide date range whatever the page size,
  // so the cost is per round trip, not per row. 2000 is the documented maximum.
  const pageSize = 2000;
  for (let page = 1; page <= 10; page++) {
    const res = await fetch(`${CC_BASE}/Transactions/ListTransactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ApiName: process.env.CARDCOM_API_NAME,
        ApiPassword: process.env.CARDCOM_API_PASSWORD,
        FromDate: ddmmyyyy(since),
        ToDate: ddmmyyyy(until),
        // 'All' brings declines too — a declined card is a buyer who tried,
        // which is worth seeing next to the abandons.
        TranStatus: 'All',
        Page: page,
        Page_size: pageSize,
        LimitForTerminal: CC_TERMINAL,
      }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Cardcom (${res.status}): ${text.slice(0, 200)}`);
    const parsed = JSON.parse(text);
    if (parsed.ResponseCode !== 0) throw new Error(`Cardcom: ${parsed.Description || parsed.ResponseCode}`);
    const rows = parsed.Tranzactions || [];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }

  return out.map((t) => ({
    id: t.TranzactionId,
    // Cardcom already reports Israel local time; only the shape is normalised.
    at: String(t.CreateDate || '').replace('T', ' ').slice(0, 19),
    amount: num(t.Amount),
    ok: Number(t.ResponseCode) === 0,
    refund: !!t.IsRefund,
    name: t.CardOwnerName || '',
    email: (t.CardOwnerEmail || '').toLowerCase(),
    phone: t.CardOwnerPhone || '',
    payments: num(t.NumberOfPayments),
    doc: t.DocumentNumber || null,
    last4: t.Last4CardDigitsString || '',
    responseCode: Number(t.ResponseCode),
    reason: t.Description || '',
  })).sort((a, b) => (a.at < b.at ? 1 : -1));
}

const phoneKey = (p) => {
  const d = String(p || '').replace(/\D/g, '');
  return d.length >= 9 ? d.slice(-9) : '';
};

/**
 * Label every transaction with exactly one `kind`, so the page never guesses:
 *   failed — the card was declined
 *   refund — money went back out
 *   test   — a real charge, too small to be a sale
 *   other  — a real sale on this terminal, but not of this product
 *   sale   — a product sale
 */
// The payment page writes the buyer into the list within seconds of the charge,
// so a list membership vouches for the transaction that CREATED it and for no
// other. Matching on the person alone is wrong: a buyer of this product who also
// bought other products of the same business months earlier would have all of
// those purchases counted as sales of this one.
const LIST_MATCH_WINDOW_MS = 60 * 60 * 1000;

const stamp = (s) => {
  const d = new Date(String(s || '').replace(' ', 'T') + 'Z');  // both sides are Israel time
  return isNaN(d) ? null : d.getTime();
};

// `opts.amounts` replaces the product amounts — the demo prices its own data.
export function classify(transactions, buyers, opts) {
  const amounts = (opts && opts.amounts) || PRODUCT_AMOUNTS;
  const joins = new Map();
  const remember = (key, at) => {
    if (!key || at === null) return;
    if (!joins.has(key)) joins.set(key, []);
    joins.get(key).push(at);
  };
  for (const b of buyers) {
    const at = stamp(b.at);
    remember(b.email, at);
    remember(phoneKey(b.phone), at);
  }
  const joinedAround = (key, at) => {
    const times = joins.get(key);
    if (!times || at === null) return false;
    return times.some((j) => Math.abs(j - at) <= LIST_MATCH_WINDOW_MS);
  };

  return transactions.map((t) => {
    const at = stamp(t.at);
    const viaList = joinedAround(t.email, at) || joinedAround(phoneKey(t.phone), at);
    const viaAmount = amounts.some((x) => Math.abs(x - Math.abs(t.amount)) < 0.5);
    const course = ONLY_THIS_PRODUCT || viaList || viaAmount;

    let kind;
    if (!t.ok) kind = 'failed';
    else if (t.refund) kind = 'refund';
    else if (Math.abs(t.amount) < MIN_REAL_AMOUNT) kind = 'test';
    else kind = course ? 'sale' : 'other';

    return { ...t, kind, course, test: kind === 'test', viaList, viaAmount };
  });
}

/* -------------------------------- Meta ---------------------------------- */

async function graph(path, params) {
  const q = new URLSearchParams({ ...params, access_token: process.env.META_ACCESS_TOKEN });
  const res = await fetch(`${GRAPH}/${path}?${q}`);
  const text = await res.text();
  if (!res.ok) throw new Error(`Meta ${path} (${res.status}): ${text.slice(0, 250)}`);
  return JSON.parse(text);
}

const num = (v) => (v === undefined || v === null || v === '' ? 0 : Number(v) || 0);
// The first of the names that Meta reports. The short name is the one Ads
// Manager shows; the pixel's own name is the fallback for an account that
// reports only that one.
const act = (rows, ...types) => {
  for (const type of types) {
    const hit = (rows || []).find((a) => a.action_type === type);
    if (hit) return num(hit.value);
  }
  return 0;
};

function metaRow(r) {
  return {
    spend: num(r.spend),
    impressions: num(r.impressions),
    clicks: num(r.clicks),
    linkClicks: act(r.actions, 'link_click'),
    landingViews: act(r.actions, 'landing_page_view'),
    purchases: act(r.actions, 'purchase', 'offsite_conversion.fb_pixel_purchase'),
    // With no terminal and no mailing list, these two are the only way to see
    // who filled the form and who reached the payment page.
    leads: act(r.actions, 'lead', 'offsite_conversion.fb_pixel_lead'),
    checkouts: act(r.actions, 'initiate_checkout', 'offsite_conversion.fb_pixel_initiate_checkout'),
    // the revenue only when the terminal is not connected — see the header comment
    metaRevenue: act(r.action_values, 'purchase', 'offsite_conversion.fb_pixel_purchase'),
  };
}

async function metaInsights(level, since, until, extraFields, increment) {
  if (!HAS_META) return [];
  const params = {
    level,
    time_range: JSON.stringify({ since, until }),
    fields: ['spend', 'impressions', 'clicks', 'actions', 'action_values', ...extraFields].join(','),
    limit: '500',
  };
  if (CAMPAIGN_FILTERING) params.filtering = CAMPAIGN_FILTERING;
  if (!increment) return insightsPages(params);

  // Day by day, some accounts answer spend 0 on every day whenever actions are
  // asked in the same call, while the actions themselves come back right (seen
  // on Lena's new account, 21.10.2026). So the money and the actions are asked
  // apart and joined by day.
  params.time_increment = '1';
  const [money, acts] = await Promise.all([
    insightsPages({ ...params, fields: ['spend', 'impressions', 'clicks', ...extraFields].join(',') }),
    insightsPages({ ...params, fields: 'actions,action_values' }),
  ]);
  const byDay = new Map(money.map((r) => [r.date_start, { ...r }]));
  for (const r of acts) {
    const day = byDay.get(r.date_start) || { date_start: r.date_start, date_stop: r.date_stop };
    byDay.set(r.date_start, { ...day, actions: r.actions, action_values: r.action_values });
  }
  return [...byDay.values()].sort((a, b) => a.date_start.localeCompare(b.date_start));
}

async function insightsPages(params) {
  const out = [];
  const res = await graph(`${AD_ACCOUNT}/insights`, params);
  out.push(...(res.data || []));
  // insights paginates by full URL; follow it directly rather than rebuilding
  let next = res.paging?.next;
  let guard = 0;
  while (next && guard++ < 10) {
    const r = await fetch(next);
    if (!r.ok) break;
    const j = await r.json();
    out.push(...(j.data || []));
    next = j.paging?.next;
  }
  return out;
}

// Meta cuts its days in the ad account's own time zone, which is set once when
// the account is opened and is not always Israel. The page says so when it isn't.
async function metaAccount() {
  if (!HAS_META) return {};
  const a = await graph(AD_ACCOUNT, { fields: 'timezone_name,currency' });
  return { timezone: a.timezone_name || '', currency: a.currency || '' };
}

async function metaCreatives() {
  if (!HAS_META) return {};
  const res = await graph(`${AD_ACCOUNT}/ads`, {
    fields: 'id,name,effective_status,creative{thumbnail_url}',
    limit: '300',
  });
  const map = {};
  for (const a of res.data || []) {
    map[a.id] = {
      status: a.effective_status || '',
      // 64px as Meta serves it. The size lives inside the URL's signed stp
      // segment, so editing it up to p200x200 makes the CDN answer 403.
      thumb: a.creative?.thumbnail_url || '',
    };
  }
  return map;
}

/* -------------------------------- handler -------------------------------- */

function isoDay(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default async function handler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host}`);
  const expected = process.env.DASH_CODE;

  // The page shows buyers' names, emails and phones, so a connected dashboard
  // never opens without a code. Demo data is invented, so the demo may.
  if (!expected && !DEMO) {
    return res.status(500).json({ ok: false, error: 'חסר קוד כניסה. צריך להגדיר DASH_CODE בוורסל, כי הלוח מציג פרטים של קונים' });
  }
  if (expected && url.searchParams.get('k') !== expected) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  // The login screen only needs to know whether the code is right. Answering
  // here, before any upstream call, turns a 6-second wait into an instant one.
  if (url.searchParams.get('probe')) return res.status(200).json({ ok: true, demo: DEMO });

  // Everything on this dashboard is counted in Israel time, because that is
  // what Cardcom reports in and what the ad account is normally set to.
  const nowIL = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
  const today = isoDay(nowIL);
  const back = (k) => {
    const d = new Date(nowIL);
    d.setDate(d.getDate() - k);
    return isoDay(d);
  };

  const re = /^\d{4}-\d{2}-\d{2}$/;
  let since = url.searchParams.get('since');
  let until = url.searchParams.get('until');
  if (!re.test(since || '')) since = back(6);
  if (!re.test(until || '')) until = today;
  if (since > until) [since, until] = [until, since];

  // since/until is the CHART window — the client widens a one-day pick to a week
  // so "יום אחר יום" still has context. vsince/vuntil is what the user actually
  // picked, and the pre-aggregated ad and campaign rows are cut to that, because
  // unlike the daily rows they cannot be narrowed in the browser.
  let vsince = url.searchParams.get('vsince');
  let vuntil = url.searchParams.get('vuntil');
  if (!re.test(vsince || '') || vsince < since || vsince > until) vsince = since;
  if (!re.test(vuntil || '') || vuntil > until || vuntil < vsince) vuntil = until;

  const base = {
    ok: true,
    generatedAt: new Date().toISOString(),
    today,
    range: { since, until },
    view: { since: vsince, until: vuntil },
    display: {
      business: String(S.businessName || '').trim(),
      product: String(S.productName || '').trim(),
    },
    demo: DEMO,
    sources: { cardcom: HAS_CC, ravmesser: HAS_RM, meta: HAS_META },
    prices: { main: PRICE_MAIN, bump: PRICE_BUMP },
    hasBump: PRICE_BUMP > 0,
    vat: VAT_RATE,
    currency: 'ILS',
    campaignFilter: CAMPAIGN_FILTER,
    lists: { leads: LIST_LEADS, buyers: LIST_BUYERS, bump: LIST_BUMP },
    minRealAmount: MIN_REAL_AMOUNT,
    courseAmounts: PRODUCT_AMOUNTS,
    onlyThisProduct: ONLY_THIS_PRODUCT,
    leadsDropBuyers: LEADS_DROP_BUYERS,
  };

  if (DEMO) {
    return res.status(200).json({ ...base, ...demoPayload({
      since, until, vsince, vuntil, today, classify, prices: { main: PRICE_MAIN, bump: PRICE_BUMP },
    }) });
  }

  try {
    const [leads, buyers, bump, daily, ads, campaigns, creatives, account, cardcom] = await Promise.all([
      labelled('רב מסר', cached('rm-leads', () => rmList(LIST_LEADS))),
      labelled('רב מסר', cached('rm-buyers', () => rmList(LIST_BUYERS))),
      labelled('רב מסר', cached('rm-bump', () => rmList(LIST_BUMP))),
      labelled('מטא', cached(`m-daily-${since}-${until}`, () => metaInsights('account', since, until, [], true))),
      labelled('מטא', cached(`m-ads-${vsince}-${vuntil}`, () =>
        metaInsights('ad', vsince, vuntil, ['ad_id', 'ad_name', 'adset_name', 'campaign_name', 'ctr', 'cpc'], false)
      )),
      labelled('מטא', cached(`m-camp-${vsince}-${vuntil}`, () =>
        metaInsights('campaign', vsince, vuntil, ['campaign_id', 'campaign_name'], false)
      )),
      labelled('מטא', cached('m-creatives', () => metaCreatives())),
      labelled('מטא', cached('m-account', () => metaAccount())),
      labelled('קארדקום', cached(`cc-${since}-${until}`, () => cardcomTransactions(since, until))).catch((e) => {
        console.error(e.message);
        return { error: e.message };
      }),
    ]);

    return res.status(200).json({
      ...base,
      ravmesser: { leads, buyers, bump },
      cardcom: Array.isArray(cardcom)
        ? { ok: true, transactions: classify(cardcom, buyers) }
        : { ok: false, error: (cardcom && cardcom.error) || 'not configured' },
      meta: {
        timezone: account.timezone || '',
        daily: daily.map((r) => ({ date: r.date_start, ...metaRow(r) })),
        ads: ads.map((r) => ({
          id: r.ad_id,
          name: r.ad_name,
          adset: r.adset_name,
          campaign: r.campaign_name,
          ctr: num(r.ctr),
          cpc: num(r.cpc),
          status: creatives[r.ad_id]?.status || '',
          thumb: creatives[r.ad_id]?.thumb || '',
          ...metaRow(r),
        })),
        campaigns: campaigns.map((r) => ({
          id: r.campaign_id,
          name: r.campaign_name,
          ...metaRow(r),
        })),
      },
    });
  } catch (error) {
    console.error('dashboard:', error.message);
    return res.status(502).json({ ok: false, error: error.message });
  }
}
