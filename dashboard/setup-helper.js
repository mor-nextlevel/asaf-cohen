// ---------------------------------------------------------------------------
// Setup checks, run from the dashboard folder. Reads the keys from .env.local
// and never prints them.
//
//   node setup-helper.js lists [word]   Rav Messer lists, newest first. With a
//                                       word, only lists whose name has it,
//                                       with how many people are in each.
//   node setup-helper.js buyers-leave   Do buyers get removed from the leads
//                                       list? Answers leadsListDropsBuyers.
//   node setup-helper.js meta [word]    The ad account's currency and time
//                                       zone, every campaign, and which ones
//                                       Meta itself matches to the filter word.
//
// Not uploaded to Vercel (.vercelignore).
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
net.setDefaultAutoSelectFamilyAttemptTimeout(1000);   // see dev-server.js

const envFile = path.join(ROOT, '.env.local');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
  }
}
const { default: S } = await import('./api/_settings.js');
const env = process.env;
const [cmd, arg] = process.argv.slice(2);

const fail = (msg) => { console.error(msg); process.exit(1); };

/* ----------------------------- Rav Messer ------------------------------- */

const RM = 'https://graph.responder.live/v2';
let rmHeaders;
async function rm(p) {
  if (!rmHeaders) {
    if (!env.RESPONDER_CLIENT_ID || !env.RESPONDER_CLIENT_SECRET || !env.RESPONDER_USER_TOKEN) {
      fail('חסרים מפתחות של רב מסר ב־.env.local');
    }
    const res = await fetch(`${RM}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials', scope: '*',
        client_id: Number(env.RESPONDER_CLIENT_ID),
        client_secret: env.RESPONDER_CLIENT_SECRET,
        user_token: env.RESPONDER_USER_TOKEN,
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (!j.token) fail(`רב מסר דחה את המפתחות (${res.status})`);
    rmHeaders = { Authorization: 'Bearer ' + j.token };
  }
  const res = await fetch(RM + p, { headers: rmHeaders });
  if (!res.ok) fail(`רב מסר ${p} (${res.status})`);
  return res.json();
}

// the list edge ignores small page sizes and rejects a call without both params
async function members(id) {
  const out = [];
  for (let offset = 0; offset < 50000; offset += 500) {
    const j = await rm(`/lists/${id}/subscribers?offset=${offset}&size=500`);
    const rows = j.data || [];
    out.push(...rows);
    if (rows.length < 500) break;
  }
  return out;
}

async function lists() {
  const j = await rm('/lists?offset=0&size=500');
  let rows = (j.data || []).sort((a, b) => (a.created < b.created ? 1 : -1));
  if (arg) rows = rows.filter((l) => String(l.name).includes(arg));
  console.log(`${rows.length} רשימות${arg ? ` שהשם שלהן מכיל ״${arg}״` : ''}\n`);
  for (const l of rows) {
    // counting means reading the whole list, so only for a short, filtered set
    const size = arg && rows.length <= 20 ? `  ·  ${(await members(l.id)).length} אנשים` : '';
    console.log(`${l.id}  ${l.name}  ·  נפתחה ${String(l.created).slice(0, 10)}${size}`);
  }
  if (!arg) console.log('\nלספירת אנשים: node setup-helper.js lists <מילה מהשם>');
}

// A buyer who filled the landing-page form exists in the account from that
// moment, minutes before the purchase put them on the buyers list. If almost
// none of those people are still on the leads list, something removes them.
async function buyersLeave() {
  if (!S.listLeads || !S.listBuyers) fail('קודם למלא listLeads ו־listBuyers בקובץ ההגדרות');
  const ts = (s) => new Date(String(s).replace(' ', 'T') + 'Z').getTime();
  const [leads, buyers] = [await members(S.listLeads), await members(S.listBuyers)];
  const inLeads = new Set(leads.map((x) => x.subscriber_id));
  const viaForm = buyers.filter((b) => {
    const minutes = (ts(b.list_created) - ts(b.created)) / 60000;
    return minutes >= 1 && minutes <= 60;
  });
  const still = viaForm.filter((b) => inLeads.has(b.subscriber_id)).length;
  console.log(`ברשימת הרוכשים: ${buyers.length}. ברשימת הלידים: ${leads.length}.`);
  console.log(`${viaForm.length} רוכשים נכנסו לרב מסר עד שעה לפני הקנייה, כלומר כנראה דרך הטופס.`);
  console.log(`מתוכם עדיין ברשימת הלידים: ${still}.\n`);
  if (viaForm.length < 10) {
    console.log('אין מספיק רוכשים כדי לדעת. לשאול את המשתמש אם יש אוטומציה שמוציאה רוכש מהרשימה.');
  } else if (still / viaForm.length < 0.2) {
    console.log('רוכשים יוצאים מרשימת הלידים. בקובץ ההגדרות: leadsListDropsBuyers: true');
  } else if (still / viaForm.length > 0.5) {
    console.log('רוכשים נשארים ברשימת הלידים. בקובץ ההגדרות: leadsListDropsBuyers: false');
  } else {
    console.log('לא חד. לשאול את המשתמש אם יש אוטומציה שמוציאה רוכש מהרשימה.');
  }
}

/* -------------------------------- Meta ---------------------------------- */

const GRAPH = 'https://graph.facebook.com/v21.0';
async function graph(p, params) {
  if (!env.META_ACCESS_TOKEN) fail('חסר META_ACCESS_TOKEN ב־.env.local');
  if (!S.metaAdAccount) fail('חסר metaAdAccount בקובץ ההגדרות');
  const q = new URLSearchParams({ ...params, access_token: env.META_ACCESS_TOKEN });
  const res = await fetch(`${GRAPH}/${p}?${q}`);
  const j = await res.json().catch(() => ({}));
  if (!res.ok) fail(`מטא ${p} (${res.status}): ${j.error?.message || ''}`);
  return j;
}

// Campaign names copied from Ads Manager can carry invisible direction marks.
// A filter word with one inside matches nothing, so they are made visible.
const INVISIBLE = /[‎‏‪-‮⁦-⁩​-‍﻿]/g;
const shown = (s) => String(s).replace(INVISIBLE, '¤');
const hasInvisible = (s) => new RegExp(INVISIBLE.source).test(String(s));

async function meta() {
  const acc = S.metaAdAccount;
  const a = await graph(acc, { fields: 'name,currency,timezone_name' });
  console.log(`חשבון: ${a.name}  ·  מטבע ${a.currency}  ·  אזור זמן ${a.timezone_name}`);
  if (a.currency !== 'ILS') console.log('שימו לב: הלוח מניח שקלים. ההוצאה תוצג כאילו היא בשקלים.');
  if (a.timezone_name !== 'Asia/Jerusalem') console.log('שימו לב: הלוח סופר ימים בשעון ישראל, וההוצאה של מטא לפי אזור הזמן של החשבון.');

  const c = await graph(`${acc}/campaigns`, { fields: 'name,effective_status', limit: '300' });
  const word = arg || String(S.metaCampaignFilter || '').trim();
  let matched = new Set();
  if (word) {
    // ask Meta itself, with the exact filter the dashboard sends
    const ins = await graph(`${acc}/insights`, {
      level: 'campaign', date_preset: 'maximum', fields: 'campaign_id,spend', limit: '500',
      filtering: JSON.stringify([{ field: 'campaign.name', operator: 'CONTAIN', value: word }]),
    });
    matched = new Set((ins.data || []).map((r) => r.campaign_id));
  }
  console.log(`\n${(c.data || []).length} קמפיינים${word ? `. ✓ = נספר עם הסינון ״${shown(word)}״` : ''}\n`);
  for (const x of c.data || []) {
    console.log(`${word ? (matched.has(x.id) ? '✓ ' : '  ') : ''}${shown(x.name)}  ·  ${x.effective_status}`);
  }
  if (word) console.log(`\nנספרים ${matched.size}. קמפיין בלי הוצאה אף פעם לא מסומן, כי אין לו נתונים.`);
  if ((c.data || []).some((x) => hasInvisible(x.name))) {
    console.log('¤ = סימן כיוון בלתי נראה בתוך השם. מילת הסינון לא צריכה לכלול אותו.');
  }
}

/* ------------------------------------------------------------------------ */

const commands = { lists, 'buyers-leave': buyersLeave, meta };
if (!commands[cmd]) {
  fail('שימוש: node setup-helper.js lists [מילה] | buyers-leave | meta [מילה]');
}
await commands[cmd]();
