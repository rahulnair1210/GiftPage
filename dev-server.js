// Local development server: static files from /public, the API, the same URL rewrites as vercel.json,
// and photo files from .data/uploads. No accounts needed: run `npm run dev`.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
// tiny .env loader (no dependency)
for (const f of ['.env.local', '.env']) {
  const p = path.join(root, f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const PORT = +(process.env.PORT || 3000);
process.env.SITE_URL ||= `http://localhost:${PORT}`;
const { handle } = await import('./server/router.js');
const { config } = await import('./server/config.js');

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.txt': 'text/plain' };

function sendFile(res, file, status = 200) {
  res.writeHead(status, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}
function staticFile(urlPath) {
  const pub = path.join(root, 'public');
  const clean = path.normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '');
  for (const cand of [clean, clean + '.html', path.join(clean, 'index.html')]) {
    const f = path.join(pub, cand);
    if (f.startsWith(pub) && fs.existsSync(f) && fs.statSync(f).isFile()) return f;
  }
  return null;
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      const chunks = []; for await (const c of req) chunks.push(c);
      const body = chunks.length ? Buffer.concat(chunks) : undefined;
      const request = new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body });
      const r = await handle(request);
      res.writeHead(r.status, Object.fromEntries(r.headers));
      res.end(Buffer.from(await r.arrayBuffer()));
      return;
    }
    if (url.pathname.startsWith('/uploads/')) {
      const dir = path.resolve(config().dataDir, 'uploads');
      const f = path.join(dir, path.normalize(url.pathname.slice('/uploads/'.length)));
      if (f.startsWith(dir) && fs.existsSync(f)) return sendFile(res, f);
    }
    if (/^\/g\/[^/]+\/?$/.test(url.pathname)) return sendFile(res, path.join(root, 'public/view.html'));
    const f = staticFile(url.pathname === '/' ? '/index.html' : url.pathname);
    if (f) return sendFile(res, f);
    sendFile(res, path.join(root, 'public/404.html'), 404);
  } catch (e) {
    console.error(e); res.writeHead(500); res.end('Server error');
  }
}).listen(PORT, () => {
  const c = config();
  console.log(`\n  ${c.brand} running at http://localhost:${PORT}`);
  console.log(`  storage: ${c.supabase.url ? 'Supabase' : 'local files in ' + c.dataDir}   payments: ${c.razorpay.keyId ? 'Razorpay' : c.testPayments ? 'TEST (no real money)' : 'off'}\n`);
});
