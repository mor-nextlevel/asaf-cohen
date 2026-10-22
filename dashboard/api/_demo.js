// ---------------------------------------------------------------------------
// Demo data: what the page shows while no source is connected yet.
//
// Everything here is invented, and the page says so in a banner. It has exactly
// the shape the real sources produce, so every panel, tab and chart can be seen
// working before a single key is entered. The numbers are seeded by date, so
// they stay the same across refreshes instead of jumping around.
// ---------------------------------------------------------------------------

const CAMPAIGN_DAYS = 60;

const FIRST = ['עומר', 'איתי', 'נועם', 'יונתן', 'דניאל', 'אורי', 'רועי', 'תומר', 'עידו', 'אלון', 'גיא',
  'שחר', 'ליאור', 'נדב', 'עמית', 'יואב', 'אריאל', 'מאיה', 'נועה', 'יעל', 'שירה', 'עדי', 'תמר', 'רותם'];
const LAST = ['כהן', 'לוי', 'מזרחי', 'פרץ', 'ביטון', 'אברהם', 'פרידמן', 'שפירא', 'אזולאי', 'גבאי',
  'דהן', 'חדד', 'רוזן', 'קפלן', 'ברק', 'גולן', 'שמעוני', 'נחום'];

// המודעות של ההדגמה, עם תמונות מהאינסטגרם של אסף. השמות מומצאים, והפס בראש הלוח אומר את זה
const ADS = [
  { id: 'demo-1', name: 'סולומון מנגן את הטראק בפאשה', w: 0.34, conv: 1.25, status: 'ACTIVE', img: '/img/ad1.jpg' },
  { id: 'demo-2', name: 'מהחדר לרחבה, תלמיד באולפן', w: 0.26, conv: 1.05, status: 'ACTIVE', img: '/img/ad2.jpg' },
  { id: 'demo-3', name: 'השיר שהגיע לברנינג מן', w: 0.2, conv: 0.9, status: 'ACTIVE', img: '/img/ad3.jpg' },
  { id: 'demo-4', name: 'הסמפל פק במתנה', w: 0.12, conv: 0.7, status: 'ACTIVE', img: '/img/ad4.jpg' },
  { id: 'demo-5', name: 'קהל של עשרת אלפים איש', w: 0.08, conv: 0.45, status: 'PAUSED', img: '/img/ad5.jpg' },
];
const CAMPAIGN = { id: 'demo-campaign', name: 'DROP 21, הדגמה' };

function seeded(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  let a = h >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (x) => String(x).padStart(2, '0');
function isoOf(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function addDays(iso, k) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + k);
  return isoOf(d);
}
function at(day, rnd, minHour) {
  const h = (minHour || 8) + Math.floor(rnd() * (23 - (minHour || 8)));
  return `${day} ${pad(h)}:${pad(Math.floor(rnd() * 60))}:${pad(Math.floor(rnd() * 60))}`;
}
function later(ts, seconds) {
  const d = new Date(ts.replace(' ', 'T') + 'Z');
  d.setUTCSeconds(d.getUTCSeconds() + seconds);
  return d.toISOString().replace('T', ' ').slice(0, 19);
}
// A whole number whose average is `mean`, without a library.
function count(mean, rnd) {
  const base = Math.floor(mean);
  return base + (rnd() < mean - base ? 1 : 0);
}
const r2 = (v) => Math.round(v * 100) / 100;

function person(rnd, i) {
  const name = FIRST[Math.floor(rnd() * FIRST.length)] + ' ' + LAST[Math.floor(rnd() * LAST.length)];
  const email = `demo${1000 + i}@example.com`;
  const phone = '05' + Math.floor(rnd() * 9) + '-' + String(Math.floor(1000000 + rnd() * 8999999));
  return { name, email, phone };
}

function buildDay(day, index, prices, serial) {
  const rnd = seeded('demo|' + day);
  const ramp = Math.min(1, 0.55 + index / 30);           // the campaign warms up over a month
  const weekend = [5, 6].indexOf(new Date(day + 'T12:00:00').getDay()) !== -1 ? 0.8 : 1;
  const spend = r2((150 + 45 * Math.sin(index / 4) + rnd() * 40) * ramp * weekend);
  const views = Math.round(spend / 3.2 * (0.85 + rnd() * 0.3));
  const impressions = Math.round(spend * (28 + rnd() * 10));
  const linkClicks = Math.round(views * (1.25 + rnd() * 0.2));
  const clicks = Math.round(linkClicks * 1.3);

  const leads = [], buyers = [], bump = [], tx = [];
  const nLeads = count(views * (0.08 + rnd() * 0.04), rnd);
  const nSales = Math.min(nLeads, count(nLeads * (0.18 + rnd() * 0.1), rnd));

  for (let i = 0; i < nLeads; i++) {
    const p = person(rnd, serial.n++);
    const leadAt = at(day, rnd);
    leads.push({ ...p, at: leadAt, unsubscribed: false });
    if (i >= nSales) continue;
    // the email typed at checkout often differs from the one in the form
    const payer = rnd() < 0.45 ? p : { ...p, email: `pay${serial.n++}@example.com` };
    const paidAt = later(leadAt, 120 + Math.floor(rnd() * 900));
    const tookBump = prices.bump > 0 && rnd() < 0.3;
    tx.push({
      id: 'demo-' + serial.n++, at: paidAt, amount: prices.main + (tookBump ? prices.bump : 0),
      ok: true, refund: false, ...payer, payments: rnd() < 0.3 ? 3 : 1,
      doc: 10000 + serial.n, last4: String(1000 + Math.floor(rnd() * 8999)), responseCode: 0, reason: '',
    });
    buyers.push({ ...payer, at: later(paidAt, 4), unsubscribed: false });
    if (tookBump) bump.push({ ...payer, at: later(paidAt, 5), unsubscribed: false });
  }

  // a declined card now and then, someone else's product on the same terminal,
  // one refund and one test charge, so every tab has something to show
  if (rnd() < 0.3) {
    const p = person(rnd, serial.n++);
    tx.push({ id: 'demo-' + serial.n++, at: at(day, rnd), amount: prices.main, ok: false, refund: false, ...p,
      payments: 1, doc: null, last4: '', responseCode: 5, reason: rnd() < 0.5 ? 'כרטיס חסום' : 'אין אישור מחברת האשראי' });
  }
  if (rnd() < 0.22) {
    const p = person(rnd, serial.n++);
    tx.push({ id: 'demo-' + serial.n++, at: at(day, rnd), amount: [350, 480, 720][Math.floor(rnd() * 3)], ok: true,
      refund: false, ...p, payments: 1, doc: 10000 + serial.n, last4: '', responseCode: 0, reason: '' });
  }
  return { spend, views, impressions, linkClicks, clicks, leads, buyers, bump, tx, sales: nSales };
}

export function demoPayload({ since, until, vsince, vuntil, today, classify, prices: given }) {
  const prices = given && given.main > 0 ? given : { main: 497, bump: 347 };
  const start = addDays(today, -(CAMPAIGN_DAYS - 1));
  const serial = { n: 0 };

  const days = [];
  for (let i = 0; i < CAMPAIGN_DAYS; i++) {
    const day = addDays(start, i);
    days.push({ day, ...buildDay(day, i, prices, serial) });
  }
  // one refund and one test charge, placed so the default seven-day view has both
  const refundDay = days[CAMPAIGN_DAYS - 4];
  const refundOf = days[CAMPAIGN_DAYS - 9].tx.find((t) => t.ok && !t.refund);
  if (refundOf) {
    refundDay.tx.push({ ...refundOf, id: 'demo-refund', at: at(refundDay.day, seeded('refund'), 10), refund: true, amount: prices.main });
  }
  const testDay = days[CAMPAIGN_DAYS - 3];
  testDay.tx.push({ id: 'demo-test', at: testDay.day + ' 09:12:40', amount: 1, ok: true, refund: false,
    name: 'בדיקה', email: 'test@example.com', phone: '', payments: 1, doc: null, last4: '', responseCode: 0, reason: '' });

  const inRange = (d, a, b) => d >= a && d <= b;
  const pick = (key) => days.filter((d) => inRange(d.day, since, until)).flatMap((d) => d[key]);
  const byNewest = (a, b) => (a.at < b.at ? 1 : -1);

  // the buyers list is not cut to the range, like Rav Messer's: the client filters it
  const allBuyers = days.flatMap((d) => d.buyers).sort(byNewest);
  const leads = days.flatMap((d) => d.leads).sort(byNewest);
  const bump = days.flatMap((d) => d.bump).sort(byNewest);
  const amounts = [prices.main, prices.bump ? prices.main + prices.bump : 0].filter(Boolean);
  const transactions = classify(pick('tx').sort(byNewest), allBuyers, { amounts });

  const daily = days.filter((d) => inRange(d.day, since, until)).map((d) => ({
    date: d.day, spend: d.spend, impressions: d.impressions, clicks: d.clicks,
    linkClicks: d.linkClicks, landingViews: d.views,
    purchases: d.sales, metaRevenue: d.sales * prices.main,
  }));

  // ads and campaigns are pre-aggregated over the picked view, as Meta returns them
  const viewDays = days.filter((d) => inRange(d.day, vsince, vuntil));
  const ads = viewDays.length ? ADS.map((ad) => {
    const rnd = seeded('ad|' + ad.id + '|' + vsince + '|' + vuntil);
    const sum = (k) => viewDays.reduce((s, d) => s + d[k] * ad.w, 0);
    const spend = r2(sum('spend'));
    const impressions = Math.round(sum('impressions'));
    const linkClicks = Math.round(sum('linkClicks'));
    const purchases = Math.round(viewDays.reduce((s, d) => s + d.sales, 0) * ad.w * ad.conv * (0.9 + rnd() * 0.25));
    return {
      id: ad.id, name: ad.name, adset: 'קהל רחב', campaign: CAMPAIGN.name,
      ctr: impressions ? r2((linkClicks / impressions) * 100) : 0,
      cpc: linkClicks ? r2(spend / linkClicks) : 0,
      status: ad.status, thumb: ad.img,
      spend, impressions, clicks: Math.round(sum('clicks')), linkClicks,
      landingViews: Math.round(sum('views')), purchases, metaRevenue: purchases * prices.main,
    };
  }).filter((a) => a.spend > 0) : [];

  const total = (k) => ads.reduce((s, a) => s + a[k], 0);
  const campaigns = ads.length ? [{
    id: CAMPAIGN.id, name: CAMPAIGN.name,
    spend: r2(total('spend')), impressions: total('impressions'), clicks: total('clicks'),
    linkClicks: total('linkClicks'), landingViews: total('landingViews'),
    purchases: total('purchases'), metaRevenue: total('metaRevenue'),
  }] : [];

  return {
    prices,
    hasBump: prices.bump > 0,
    courseAmounts: amounts,
    ravmesser: { leads, buyers: allBuyers, bump },
    cardcom: { ok: true, transactions },
    meta: { daily, ads, campaigns },
  };
}
