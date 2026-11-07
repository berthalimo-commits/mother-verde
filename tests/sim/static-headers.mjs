// Serves the BUILT app (dist/) on http://localhost:5175 the way Vercel does:
// the headers from vercel.json (host rules "has" / "missing" applied to the
// request's host) and dist/404.html with status 404 for any path that doesn't
// exist. For local testing only: the CSP's Supabase source points to the fake
// Supabase (http://localhost:54321) instead of https://*.supabase.co, and
// upgrade-insecure-requests is left out (it would turn http://localhost into https).
// Usage: node tests/sim/static-headers.mjs   (after: npx vite build)
import http from 'http';
import fs from 'fs';
import path from 'path';

const ROOT = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT || 5175);
const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8' };

const hostMatches = (rule, host) => new RegExp('^' + rule.value + '$').test(host);
function headersFor(urlPath, host) {
  const out = {};
  for (const h of vercel.headers || []) {
    if (!new RegExp('^' + h.source.replace('(.*)', '(.*)') + '$').test(urlPath)) continue;
    if (h.has && !h.has.every((c) => c.type === 'host' && hostMatches(c, host))) continue;
    if (h.missing && h.missing.some((c) => c.type === 'host' && hostMatches(c, host))) continue;
    for (const { key, value } of h.headers) out[key] = value;
  }
  for (const k of Object.keys(out)) if (/content-security-policy/i.test(k)) {
    out[k] = out[k].replace(/https:\/\/\*\.supabase\.co/g, 'http://localhost:54321').replace(/wss:\/\/\*\.supabase\.co/g, 'ws://localhost:54321')
      .replace(/;\s*upgrade-insecure-requests/, '');
  }
  return out;
}

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const host = (req.headers.host || '').replace(/:\d+$/, '');
  let file = path.join(DIST, decodeURIComponent(u.pathname));
  if (!file.startsWith(DIST)) { res.writeHead(400); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  let status = 200;
  if (!fs.existsSync(file)) { status = 404; file = path.join(DIST, '404.html'); }
  const h = headersFor(u.pathname, host);
  h['Content-Type'] = TYPES[path.extname(file)] || 'application/octet-stream';
  h['Cache-Control'] = 'no-cache';
  res.writeHead(status, h);
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log('static-headers on', PORT));
