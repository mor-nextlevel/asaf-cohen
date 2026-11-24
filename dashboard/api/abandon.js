// ---------------------------------------------------------------------------
// The "contacted" mark on an abandoned cart.
//
//   POST /api/abandon?k=<code>   { key, undo }
//
// Opening WhatsApp to someone on the page marks them, so Asaf sees who he has
// already written to. The mark is an empty file in the private Blob store,
// contacted/<key>.json, and its upload time is the moment. undo removes it.
// The key is the person's key from ./data.js (last nine digits of the phone, or
// m-<email>), so the mark names nobody by itself beyond what the page shows.
// ---------------------------------------------------------------------------

import { put, del } from '@vercel/blob';

const KEY = /^(\d{9}|m-[a-z0-9._@+-]{3,120})$/;

async function body(req) {
  if (req.body !== undefined) return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
  let text = '';
  for await (const chunk of req) text += chunk;
  return JSON.parse(text || '{}');
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const url = new URL(req.url, `https://${req.headers.host}`);
  const expected = process.env.DASH_CODE;
  if (!expected || url.searchParams.get('k') !== expected) return res.status(401).json({ ok: false });
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(503).json({ ok: false });
  try {
    const b = await body(req);
    const key = String(b.key || '');
    if (!KEY.test(key)) return res.status(400).json({ ok: false });
    const path = `contacted/${key}.json`;
    if (b.undo) await del(path);
    else await put(path, '{}', { access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 0 });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('abandon:', e.message);
    return res.status(500).json({ ok: false });
  }
}
