import { put, get, list } from '@vercel/blob';

// כל שאלון בקובץ משלו בענן הפרטי: apply/<id>.json. הדף שולח את כל המצב אחרי כל תשובה.
const key = id => `apply/${id}.json`;
const ID = /^[a-z0-9]{16,32}$/;

async function read(id) {
  const r = await get(key(id), { access: 'private', useCache: false });
  return r ? JSON.parse(await new Response(r.stream).text()) : null;
}

// רק שדות שהדף באמת שולח, וכל טקסט מקוצר, כדי שאף אחד לא יכתוב לענן מה שהוא רוצה
const clip = (v, n = 300) => (typeof v === 'string' ? v.slice(0, n) : '');
function clean(b) {
  const answers = {};
  for (const [k, v] of Object.entries(b.answers || {}).slice(0, 12)) {
    // שאלה עם כמה תשובות שולחת רשימת מספרים
    const i = Array.isArray(v?.i) ? v.i.slice(0, 8).map(n => Number(n) || 0) : Number(v?.i) || 0;
    if (/^[a-z]{2,16}$/.test(k) && v && typeof v === 'object') answers[k] = { i, label: clip(v.label, 400) };
  }
  const src = {};
  for (const [k, v] of Object.entries(b.src || {}).slice(0, 12)) if (/^[a-z_]{2,24}$/.test(k)) src[k] = clip(v, 200);
  const c = b.contact || {};
  return {
    id: b.id,
    started: Number(b.started) || Date.now(),
    step: clip(b.step, 20),
    done: b.done === true,
    answers,
    link: clip(b.link, 400),
    noLink: b.noLink === true,
    contact: { name: clip(c.name, 80), email: clip(c.email, 120), phone: clip(c.phone, 30) },
    src,
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try { return await handle(req, res); } catch (e) { return res.status(500).json({ ok: false }); }
}

async function handle(req, res) {
  if (req.method === 'POST') {
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (!ID.test(String(b.id || ''))) return res.status(400).json({ ok: false });
    const rec = { ...clean(b), updated: Date.now() };
    await put(key(rec.id), JSON.stringify(rec), {
      access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 0,
    });
    return res.json({ ok: true });
  }

  if (req.method === 'GET') {
    // מי שפותח שוב את הקישור שלו מקבל את התשובות שלו בחזרה
    const id = String(req.query.id || '');
    if (ID.test(id)) {
      const rec = await read(id);
      return rec ? res.json({ ok: true, rec }) : res.status(404).json({ ok: false });
    }
    // כל השאלונים, רק עם הקוד שנמצא בהגדרות של ורסל
    const code = process.env.APPLY_CODE;
    if (!code || String(req.query.k || '') !== code) return res.status(401).json({ ok: false });
    const ids = [];
    let cursor;
    do {
      const page = await list({ prefix: 'apply/', cursor, limit: 1000 });
      for (const b of page.blobs) ids.push(b.pathname.slice(6, -5));
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    // קוראים עשרים בכל פעם, כדי שהלוח ייפתח מהר גם כשיש הרבה שאלונים
    const out = [];
    for (let n = 0; n < ids.length; n += 20) {
      const recs = await Promise.all(ids.slice(n, n + 20).map(id => read(id).catch(() => null)));
      out.push(...recs.filter(Boolean));
    }
    out.sort((a, b) => b.updated - a.updated);
    return res.json({ ok: true, count: out.length, rows: out });
  }

  res.status(405).json({ ok: false });
}
