// ---------------------------------------------------------------------------
// Local preview, no install needed:   node dev-server.js   then open
// http://localhost:4321
//
// Serves the page and runs api/data.js exactly as Vercel would. Keys, if any,
// are read from .env.local in this folder (KEY=value per line). With no keys
// the page runs on demo data.
//
// The server reads the settings and the keys only when it starts, so after any
// change to api/_settings.js or .env.local it has to be stopped and started
// again. Another port: PORT=4322 node dev-server.js
// ---------------------------------------------------------------------------

import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 4321;

// On a network with no IPv6 route, Node tries IPv6 first and gives it 250ms
// before moving on to IPv4. Meta and Cardcom often take longer than that to
// answer from abroad, and every such call ended in "fetch failed". A second is
// enough. Vercel does not have this problem.
net.setDefaultAutoSelectFamilyAttemptTimeout(1000);

// The env has to be in place before api/data.js is loaded: it decides which
// sources are connected at load time.
const envFile = path.join(ROOT, '.env.local');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
  }
}
const { default: handler } = await import('./api/data.js');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/data') {
    // the two helpers Vercel adds to the response
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (body) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(body));
    };
    try { await handler(req, res); } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
    return;
  }

  // like Vercel: the api folder and dotfiles are never served as files
  const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
  if (rel.startsWith('api/') || rel.split('/').some((p) => p.startsWith('.')) || rel.includes('..')) {
    res.statusCode = 404; res.end('not found'); return;
  }
  const file = path.join(ROOT, rel);
  fs.readFile(file, (err, buf) => {
    if (err) { res.statusCode = 404; res.end('not found'); return; }
    res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
    res.end(buf);
  });
});
server.on('error', (e) => {
  if (e.code !== 'EADDRINUSE') throw e;
  console.error(`הפורט ${PORT} תפוס, כנראה השרת כבר רץ. לעצור אותו, או להריץ על פורט אחר: PORT=${PORT + 1} node dev-server.js`);
  process.exit(1);
});
server.listen(PORT, () => {
  console.log(`לוח המעקב רץ: http://localhost:${PORT}`);
});
