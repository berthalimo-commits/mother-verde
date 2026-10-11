// Local imitation of Supabase on http://localhost:54321 for browser tests:
// PostgREST + Auth (incl. TOTP MFA, simulated) + the three Edge Functions,
// on PGlite with the real migrations. Base, DeepL and e-mail are simulated.
// Nothing here talks to production.
import http from 'http';
import fs from 'fs';
import { createRequire } from 'module';
import { makeDb, makeRest } from './fakerest.mjs';

const APP = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1').replace(/\/$/, '');
const req = createRequire(APP + '/package.json');
const { build } = req('esbuild');
const BASE = 'http://localhost:54321';
export const DEST = '0x63bbacca9add146c93d5e3e4f77eb053809792d0';
const USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const env = { SUPABASE_URL: BASE, SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'svc', SUPPORT_ADDRESS: DEST,
  MAIL_PROVIDER: 'smtp', SMTP_USER: 'hello@motherverdeny.com', SMTP_PASS: 'x', RETRANSLATE_SECRET: 'r'.repeat(40), DEEPL_API_KEY: 'k:fx' };
globalThis.__mail = [];
const chain = { head: 1000, receipts: {} , blocks: {} };
let current = null; const H = {};
globalThis.Deno = { env: { get: (k) => env[k] }, serve: (h) => { current = h; } };

const db = await makeDb();
const rest = makeRest(db);
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(typeof url === 'string' ? url : url.url);
  if (u.origin === BASE) return rest(u.toString(), init);
  if (u.hostname === 'mainnet.base.org') {
    const { method, params } = JSON.parse(init.body);
    const r = (result) => new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result }));
    if (method === 'eth_getTransactionReceipt') return r(chain.receipts[params[0]] ?? null);
    if (method === 'eth_blockNumber') return r('0x' + chain.head.toString(16));
    if (method === 'eth_getBlockByNumber') return r(chain.blocks[params[0]] ?? null);
  }
  return realFetch(url, init);
};
const mock = new URL('./nodemailer-mock.mjs', import.meta.url);
fs.writeFileSync(mock, `export default { createTransport: () => ({ sendMail: async (m) => { globalThis.__mail.push(m); return {}; } }) };`);
const plugin = { name: 'deno', setup(b) {
  b.onResolve({ filter: /^jsr:@supabase\/supabase-js/ }, () => ({ path: req.resolve('@supabase/supabase-js') }));
  b.onResolve({ filter: /^npm:nodemailer/ }, () => ({ path: mock.pathname.replace(/^\/([A-Z]:)/, '$1') }));
} };
for (const dir of ['admin-send-gift-code', 'support-claims', 'community-retranslate']) {
  const out = new URL(`./fnbuild/srv-${dir}.mjs`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
  await build({ entryPoints: [`${APP}/supabase/functions/${dir}/index.ts`], bundle: true, format: 'esm', platform: 'node', outfile: out, plugins: [plugin], logLevel: 'error' });
  await import('file:///' + out + '?' + Date.now()); H[dir] = current;
}

// ---- seed: admin + a person with a submitted claim whose transfer is on "Base"
const q = async (s, p) => (await db.query(s, p)).rows;
export const ADMIN = 'b0000001-0000-4000-8000-000000000000', PAYER = 'b0000002-0000-4000-8000-000000000000', NEWBIE = 'b0000003-0000-4000-8000-000000000000';
await db.exec(`insert into auth.users (id, email) values ('${ADMIN}', 'berthalimo@gmail.com'), ('${PAYER}', 'aportante@example.org'), ('${NEWBIE}', 'nueva@example.org');
  update auth.users set email_confirmed_at = now();
  update profiles set trial_ends_at = now() - interval '1 hour' where id in ('${PAYER}', '${NEWBIE}');`);
await db.exec(fs.readFileSync(APP + '/supabase/admin/grant-admin.sql', 'utf8').split('\n').filter((l) => l.startsWith('insert')).join('\n'));
const asU = (uid, fn, args) => rest(`${BASE}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { Authorization: `Bearer u:${uid}:aal1` }, body: JSON.stringify(args) }).then((r) => r.json());
const claim = await asU(PAYER, 'create_support_claim', { p_flowers: 2 });
const TX = '0x' + 'ab'.repeat(32);
await asU(PAYER, 'submit_support_claim_tx', { p_claim_id: claim.id, p_tx_hash: TX });
chain.receipts[TX] = { status: '0x1', blockNumber: '0x384', logs: [{ address: USDC, topics: [TOPIC, '0x' + '0'.repeat(24) + '22'.repeat(20), '0x' + '0'.repeat(24) + DEST.slice(2)], data: '0x' + BigInt(claim.amount_units).toString(16).padStart(64, '0') }] };
chain.blocks['0x384'] = { timestamp: '0x' + Math.floor(Date.now() / 1000).toString(16) };

// ---- simulated MFA (TOTP): any 6 digits "123456" are accepted
const factors = {}; // uid -> [{id, status}]
const users = { [ADMIN]: 'berthalimo@gmail.com', [PAYER]: 'aportante@example.org', [NEWBIE]: 'nueva@example.org' };
const session = (uid, aal) => ({ access_token: `u:${uid}:${aal}`, refresh_token: `r:${uid}:${aal}`, token_type: 'bearer', expires_in: 360000, expires_at: Math.floor(Date.now() / 1000) + 360000, user: userObj(uid) });
const userObj = (uid) => ({ id: uid, aud: 'authenticated', role: 'authenticated', email: users[uid], email_confirmed_at: new Date().toISOString(), app_metadata: {}, user_metadata: {}, factors: (factors[uid] || []).map((f) => ({ id: f.id, factor_type: 'totp', status: f.status, friendly_name: 'Mother Verde admin', created_at: '', updated_at: '' })), created_at: '' });

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS', 'Access-Control-Expose-Headers': '*' };
http.createServer(async (rq, rs) => {
  try {
    if (rq.method === 'OPTIONS') { rs.writeHead(204, CORS); rs.end(); return; }
    const chunks = []; for await (const c of rq) chunks.push(c);
    const body = Buffer.concat(chunks).toString();
    const url = BASE + rq.url; const u = new URL(url);
    const tok = (rq.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const [, uid, aal] = tok.split(':');
    let res;
    const J = (d, st = 200) => new Response(JSON.stringify(d), { status: st, headers: { 'content-type': 'application/json' } });
    if (u.pathname === '/auth/v1/user' && rq.method === 'GET') res = users[uid] ? J(userObj(uid)) : J({ msg: 'bad jwt' }, 401);
    else if (u.pathname === '/auth/v1/factors' && rq.method === 'POST') {
      const id = 'f-' + Math.random().toString(16).slice(2, 10);
      (factors[uid] ||= []).push({ id, status: 'unverified' });
      res = J({ id, type: 'totp', friendly_name: 'Mother Verde admin', totp: { qr_code: 'data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="184" height="184"><rect width="184" height="184" fill="#ddd"/><text x="20" y="96" font-size="16">QR simulado</text></svg>', secret: 'JBSWY3DPEHPK3PXP', uri: 'otpauth://totp/x' } });
    } else if (/^\/auth\/v1\/factors\/[^/]+$/.test(u.pathname) && rq.method === 'DELETE') {
      const id = u.pathname.split('/').pop(); factors[uid] = (factors[uid] || []).filter((f) => f.id !== id); res = J({ id });
    } else if (/\/challenge$/.test(u.pathname)) res = J({ id: 'c-1', expires_at: Math.floor(Date.now() / 1000) + 300 });
    else if (/\/verify$/.test(u.pathname)) {
      const { code } = JSON.parse(body);
      const id = u.pathname.split('/')[4];
      if (code !== '123456') res = J({ code: 'mfa_verification_failed', msg: 'Invalid TOTP code entered' }, 422);
      else { (factors[uid] || []).forEach((f) => { if (f.id === id) f.status = 'verified'; }); res = J(session(uid, 'aal2')); }
    } else if (u.pathname.startsWith('/auth/v1/token')) res = J(session(uid || ADMIN, aal || 'aal1'));
    else if (u.pathname.startsWith('/auth/v1/logout')) res = new Response(null, { status: 204 });
    else if (u.pathname.startsWith('/functions/v1/')) {
      const name = u.pathname.split('/')[3];
      res = await H[name](new Request(url, { method: rq.method, headers: rq.headers, body }));
    } else res = await rest(url, { method: rq.method, headers: rq.headers, body: body || undefined });
    const out = Buffer.from(await res.arrayBuffer());
    rs.writeHead(res.status, { ...CORS, 'content-type': res.headers.get('content-type') || 'application/json' });
    rs.end(out);
  } catch (e) { rs.writeHead(500, CORS); rs.end(JSON.stringify({ message: e.message })); }
}).listen(54321, () => console.log('fake supabase on 54321; mails:', 'GET /__mail'));
// expose sent mail + a seed helper for the test driver
http.createServer(async (rq, rs) => {
  if (rq.url === '/__mail') { rs.end(JSON.stringify(globalThis.__mail.map((m) => ({ to: m.to, subject: m.subject, text: m.text })))); return; }
  if (rq.url.startsWith('/__sql')) { const sql = decodeURIComponent(rq.url.split('?q=')[1]); try { rs.end(JSON.stringify((await db.query(sql)).rows, (k, v) => typeof v === 'bigint' ? Number(v) : v)); } catch (e) { rs.end(JSON.stringify({ error: e.message })); } return; }
  if (rq.url.startsWith('/__chain')) { const tx = decodeURIComponent(rq.url.split('tx=')[1].split('&')[0]); const units = rq.url.split('units=')[1]; chain.receipts[tx] = { status: '0x1', blockNumber: '0x384', logs: [{ address: USDC, topics: [TOPIC, '0x' + '0'.repeat(24) + '22'.repeat(20), '0x' + '0'.repeat(24) + DEST.slice(2)], data: '0x' + BigInt(units).toString(16).padStart(64, '0') }] }; rs.end('ok'); return; }
  rs.end('?');
}).listen(54322);
