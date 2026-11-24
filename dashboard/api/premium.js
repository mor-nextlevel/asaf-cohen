// The premium questionnaires (nl-asaf-cohen.vercel.app/apply). They are kept in that
// site's private storage; this only asks for them with APPLY_CODE and hands them on
// to whoever typed the dashboard code, the same check as api/data.js.

const SOURCE = process.env.APPLY_SOURCE || 'https://nl-asaf-cohen.vercel.app/api/apply';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const url = new URL(req.url, `https://${req.headers.host}`);
  const expected = process.env.DASH_CODE;
  if (!expected) return res.status(500).json({ ok: false, error: 'חסר קוד כניסה. צריך להגדיר DASH_CODE בוורסל' });
  if (url.searchParams.get('k') !== expected) return res.status(401).json({ ok: false, error: 'unauthorized' });

  const code = process.env.APPLY_CODE;
  if (!code) return res.status(200).json({ ok: true, missing: true, rows: [] });
  try {
    const r = await fetch(`${SOURCE}?k=${encodeURIComponent(code)}`, { signal: AbortSignal.timeout(9000) });
    if (!r.ok) return res.status(502).json({ ok: false, error: 'השאלונים לא נטענו' });
    const d = await r.json();
    return res.status(200).json({ ok: true, rows: d.rows || [], generatedAt: new Date().toISOString() });
  } catch (e) {
    return res.status(502).json({ ok: false, error: 'השאלונים לא נטענו' });
  }
}
