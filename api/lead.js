import { put } from '@vercel/blob';

// מי שממלא את הטופס בדף נשמר כאן רגע לפני שהוא עובר לתשלום, קובץ לכל מילוי בענן הפרטי:
// leads/<זמן>-<מזהה>.json. לוח המעקב (asaf-dash) קורא מאותו אחסון, משווה לרשימת הרוכשים ברב מסר,
// ומראה לאסף מי לא קנה, עם כפתור וואטסאפ.
const clip = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const phone = clip(b.phone, 30);
    const email = clip(b.email, 120).toLowerCase();
    // בלי טלפון ובלי מייל אין למי לחזור
    if (phone.replace(/\D/g, '').length < 9 && !email.includes('@')) return res.status(400).json({ ok: false });
    const src = {};
    for (const [k, v] of Object.entries(b.src || {}).slice(0, 12)) if (/^[a-z_]{2,24}$/.test(k)) src[k] = clip(v, 200);
    const at = Date.now();
    const rec = { at, name: clip(b.name, 80), email, phone, form: clip(b.form, 4), src };
    await put(`leads/${at}-${Math.random().toString(36).slice(2, 10)}.json`, JSON.stringify(rec), {
      access: 'private', contentType: 'application/json', addRandomSuffix: false, cacheControlMaxAge: 0,
    });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false });
  }
}
