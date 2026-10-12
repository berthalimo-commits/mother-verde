// End-to-end tests of the Edge Functions and the Vercel cron, against the real
// migrations on PGlite. Base chain, DeepL, SMTP and Resend are simulated:
// nothing leaves this machine, no real account or e-mail is used.
import { createRequire as cr0 } from 'module';
const { build } = cr0(new URL('../../package.json', import.meta.url))('esbuild');
import { createRequire } from 'module';
import fs from 'fs';
import { makeDb, makeRest } from './fakerest.mjs';

const APP = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1').replace(/\/$/, '');
const OUT = new URL('./fnbuild/', import.meta.url);
fs.mkdirSync(OUT, { recursive: true });
const req = createRequire(APP + '/package.json');
let pass = 0, fail = 0; const failures = [];
const check = (name, cond, detail = '') => { if (cond) { pass++; console.log('  ok   ', name); } else { fail++; failures.push(name); console.log('  FALLA', name, detail); } };

// ---------------------------------------------------------------- mocks
const DEST = '0x' + '11'.repeat(20);
const USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const env = {
  SUPABASE_URL: 'https://fake.supabase.co', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'svc',
  DEEPL_API_KEY: 'k:fx', RETRANSLATE_SECRET: 'r'.repeat(40), SUPPORT_ADDRESS: DEST,
  MAIL_PROVIDER: 'smtp', SMTP_USER: 'hello@motherverdeny.com', SMTP_PASS: 'x', MAIL_FROM: 'Mother Verde <hello@motherverdeny.com>',
  RESEND_API_KEY: 're_test', APP_URL: 'https://example.test',
};
globalThis.__mail = []; globalThis.__smtpFail = null; globalThis.__smtpCfg = null;
const handlers = {}; let current = null;
globalThis.Deno = { env: { get: (k) => env[k] }, serve: (h) => { current = h; } };

const chain = { head: 1000, receipts: {}, blocks: {}, fail: null, calls: 0 };
const deepl = { mode: 'ok', calls: 0 };
const resend = { calls: [], status: 200 };
const db = await makeDb();
const rest = makeRest(db);
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(typeof url === 'string' ? url : url.url);
  if (typeof url !== 'string' && !init.method) init = { method: url.method, headers: url.headers, body: await url.text() };
  if (u.hostname === 'fake.supabase.co' && u.pathname === '/functions/v1/community-retranslate') {
    return handlers.retranslate(new Request(u, { method: 'POST', headers: init.headers, body: init.body }));
  }
  if (u.hostname === 'fake.supabase.co') return rest(u.toString(), init);
  if (u.hostname === 'mainnet.base.org') {
    chain.calls++;
    if (chain.fail) return new Response('rate limited', { status: chain.fail });
    const { method, params } = JSON.parse(init.body);
    const r = (result) => new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result }), { headers: { 'content-type': 'application/json' } });
    if (method === 'eth_getTransactionReceipt') return r(chain.receipts[params[0]] ?? null);
    if (method === 'eth_blockNumber') return r('0x' + chain.head.toString(16));
    if (method === 'eth_getBlockByNumber') return r(chain.blocks[params[0]] ?? null);
  }
  if (u.hostname === 'api.resend.com') { resend.calls.push({ headers: init.headers, body: JSON.parse(init.body) }); return new Response(JSON.stringify(resend.status === 200 ? { id: 'x' } : { message: 'domain not verified' }), { status: resend.status }); }
  if (u.hostname.includes('deepl')) {
    deepl.calls++;
    if (deepl.mode === '456') return new Response('quota', { status: 456 });
    if (deepl.mode === '500') return new Response('boom', { status: 500 });
    const b = JSON.parse(init.body);
    return new Response(JSON.stringify({ translations: [{ text: '[' + b.target_lang + '] ' + b.text[0], detected_source_language: 'ES' }] }), { headers: { 'content-type': 'application/json' } });
  }
  throw new Error('unexpected fetch ' + u);
};

// ---------------------------------------------------------------- bundle
const mailerMock = new URL('./nodemailer-mock.mjs', import.meta.url);
fs.writeFileSync(mailerMock, `export default { createTransport: (cfg) => { globalThis.__smtpCfg = cfg; return { sendMail: async (m) => { if (globalThis.__smtpFail) throw new Error(globalThis.__smtpFail); globalThis.__mail.push(m); return { messageId: 'x' }; } }; } };`);
const plugin = { name: 'deno', setup(b) {
  b.onResolve({ filter: /^jsr:@supabase\/supabase-js/ }, () => ({ path: req.resolve('@supabase/supabase-js') }));
  b.onResolve({ filter: /^npm:nodemailer/ }, () => ({ path: mailerMock.pathname.replace(/^\/([A-Z]:)/, '$1') }));
} };
for (const [name, dir] of [['gift', 'admin-send-gift-code'], ['claims', 'support-claims'], ['retranslate', 'community-retranslate']]) {
  const outfile = new URL(`./${name}.mjs`, OUT).pathname.replace(/^\/([A-Z]:)/, '$1');
  await build({ entryPoints: [`${APP}/supabase/functions/${dir}/index.ts`], bundle: true, format: 'esm', platform: 'node', outfile, plugins: [plugin], logLevel: 'error' });
  await import('file:///' + outfile + '?' + Date.now()); handlers[name] = current;
}
const call = async (name, token, body, headers = {}) => {
  const r = await handlers[name](new Request('https://x/', { method: 'POST', headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...headers }, body: JSON.stringify(body) }));
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const q = async (sql, p) => (await db.query(sql, p)).rows;
const uid = (n) => `a${String(n).padStart(7, '0')}-0000-4000-8000-000000000000`;
async function user(n, email) {
  await db.exec(`insert into auth.users (id, email) values ('${uid(n)}', '${email}'); update auth.users set email_confirmed_at = now() where id = '${uid(n)}';`);
  return uid(n);
}
const ADMIN = await user(1, 'hello@motherverdeny.com');
await db.exec(fs.readFileSync(APP + '/supabase/admin/grant-admin.sql', 'utf8'));
const NORMAL = await user(2, 'normal@example.org');
const tok = (u, aal = 'aal1') => `u:${u}:${aal}`;
const A2 = tok(ADMIN, 'aal2');
const BANNED = ['7.10', '7.99', '19.99', 'Payment Nerds', 'Stripe', 'App Store', 'Google Play', 'suscripción', 'subscription', 'Abo', 'abonnement', '$'];

// ================================================================ gift codes
console.log('A. admin-send-gift-code:');
check('sin sesión -> 401', (await call('gift', null, { action: 'send', email: 'a@example.org' })).status === 401);
check('usuario normal (aunque tenga MFA) -> 403', (await call('gift', tok(NORMAL, 'aal2'), { action: 'send', email: 'a@example.org' })).status === 403);
check('admin SIN MFA (aal1) -> 403', (await call('gift', tok(ADMIN, 'aal1'), { action: 'send', email: 'a@example.org' })).status === 403);
check('admin sin MFA tampoco puede enviar correo de prueba', (await call('gift', tok(ADMIN, 'aal1'), { action: 'test_email' })).status === 403);
const codesBefore = (await q('select count(*)::int c from gift_codes'))[0].c;
let r = await call('gift', A2, { action: 'test_email' });
check('correo de prueba al propio correo del admin', r.status === 200 && globalThis.__mail.at(-1)?.to === 'hello@motherverdeny.com', JSON.stringify(r));
check('…sin crear ningún código', (await q('select count(*)::int c from gift_codes'))[0].c === codesBefore);
check('…SMTP: smtp.hostinger.com, puerto 465 con SSL', globalThis.__smtpCfg?.host === 'smtp.hostinger.com' && globalThis.__smtpCfg.port === 465 && globalThis.__smtpCfg.secure === true);
check('…queda en el registro de auditoría', (await q(`select count(*)::int c from admin_audit_log where action = 'test_email_sent'`))[0].c === 1);
r = await call('gift', A2, { action: 'send', email: 'Amiga@Example.org' });
const mail = globalThis.__mail.at(-1);
const code = (mail?.text.match(/[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}/) || [])[0];
check('envío válido -> 200, un solo correo a la dirección (minúsculas)', r.status === 200 && mail.to === 'amiga@example.org' && !!code, JSON.stringify(r));
check('correo en 4 idiomas, español primero, con la instrucción exacta', ['«Tengo un código de regalo»', '“I have a gift code”', '„Ich habe einen Geschenkcode“', '« J\'ai un code cadeau »'].every((s) => mail.text.includes(s)) && mail.text.indexOf('Tienes un código') < mail.text.indexOf('You have a gift code'));
check('correo con versión HTML (estilos en línea, sin imágenes externas) y texto plano', mail.html.includes('style=') && !/<img|src=|<link/i.test(mail.html) && mail.text.length > 200);
check('correo sin precios ni suscripción ni procesadores', !BANNED.some((b) => mail.html.includes(b) || mail.text.includes(b) || mail.subject.includes(b)), BANNED.filter((b) => mail.text.includes(b)).join(','));
const stored = await q(`select * from gift_codes where sent_to_email = 'amiga@example.org'`);
check('en la base: solo la huella, estado enviado, 7 días', stored.length === 1 && stored[0].send_status === 'sent' && stored[0].days === 7 && !JSON.stringify(stored).includes(code) && !JSON.stringify(stored).includes(code.replace(/-/g, '')));
check('el código no aparece en la auditoría', !JSON.stringify(await q('select * from admin_audit_log')).includes(code.replace(/-/g, '').slice(0, 8)));
const RED = await user(3, 'canjea@example.org');
const red = await rest('https://fake.supabase.co/rest/v1/rpc/redeem_gift_code', { method: 'POST', headers: { Authorization: 'Bearer ' + tok(RED) }, body: JSON.stringify({ p_code: code }) }).then((x) => x.json());
check('el código del correo funciona (canje por otra cuenta)', red.ok === true && red.days === 7, JSON.stringify(red));
const red2 = await rest('https://fake.supabase.co/rest/v1/rpc/redeem_gift_code', { method: 'POST', headers: { Authorization: 'Bearer ' + tok(NORMAL) }, body: JSON.stringify({ p_code: code }) }).then((x) => x.json());
check('código reutilizado -> error genérico', red2.error === 'invalid_code');
const blocked = (await q('select domain from blocked_email_domains limit 1'))[0].domain;
let n = globalThis.__mail.length;
r = await call('gift', A2, { action: 'send', email: 'x@' + blocked });
check('dominio desechable -> blocked_domain, sin correo', r.body.error === 'blocked_domain' && globalThis.__mail.length === n);
check('correo mal escrito -> bad_email', (await call('gift', A2, { action: 'send', email: 'no-es-correo' })).body.error === 'bad_email');
await call('gift', A2, { action: 'send', email: 'amiga@example.org' }); await call('gift', A2, { action: 'send', email: 'amiga@example.org' });
check('4.º código al mismo correo -> email_limit_3', (await call('gift', A2, { action: 'send', email: 'amiga@example.org' })).body.error === 'email_limit_3');
globalThis.__smtpFail = 'Invalid login: 535 authentication failed';
r = await call('gift', A2, { action: 'send', email: 'falla@example.org' });
globalThis.__smtpFail = null;
const failed = (await q(`select status, send_status, revoked_reason from gift_codes where sent_to_email = 'falla@example.org'`))[0];
check('SMTP falla -> error mostrado y código ANULADO', r.status === 502 && r.body.error === 'email_failed' && r.body.detail.includes('535') && failed.status === 'revoked' && failed.send_status === 'failed', JSON.stringify(r));
env.MAIL_PROVIDER = 'resend';
r = await call('gift', A2, { action: 'send', email: 'resend@example.org' });
check('plan B Resend: envía por HTTPS con la clave y remitente', r.status === 200 && resend.calls.length === 1 && resend.calls[0].headers.Authorization === 'Bearer re_test' && resend.calls[0].body.from.includes('hello@motherverdeny.com') && resend.calls[0].body.text.includes('Tengo un código de regalo'));
resend.status = 403;
r = await call('gift', A2, { action: 'send', email: 'resend2@example.org' });
check('Resend rechaza -> código anulado y error mostrado', r.status === 502 && (await q(`select status from gift_codes where sent_to_email = 'resend2@example.org'`))[0].status === 'revoked');
resend.status = 200; env.MAIL_PROVIDER = 'smtp';
const today = (await q(`select count(*)::int c from gift_codes where created_at >= date_trunc('day', now())`))[0].c;
for (let i = today; i < 20; i++) await call('gift', A2, { action: 'send', email: `lote${i}@example.org` });
n = globalThis.__mail.length;
r = await call('gift', A2, { action: 'send', email: 'veintiuno@example.org' });
check('21.º código del día -> daily_limit_20, sin correo', r.body.error === 'daily_limit_20' && globalThis.__mail.length === n, JSON.stringify(r));
check('auditoría de envíos: quién y a quién (sin el código)', (await q(`select count(*)::int c from admin_audit_log where action = 'gift_code_sent' and actor_label = 'hello@motherverdeny.com' and target_email = 'amiga@example.org'`))[0].c === 3);

// ================================================================ claims
console.log('B. support-claims (verificación en Base):');
const asUser = (u, fn, args) => rest(`https://fake.supabase.co/rest/v1/rpc/${fn}`, { method: 'POST', headers: { Authorization: 'Bearer ' + tok(u) }, body: JSON.stringify(args) }).then((x) => x.json());
let txN = 0;
async function payer(n, flowers = 1) {
  const u = await user(n, `pago${n}@example.org`);
  await db.exec(`update profiles set trial_ends_at = now() - interval '1 hour' where id = '${u}'`);
  const c = await asUser(u, 'create_support_claim', { p_flowers: flowers });
  const tx = '0x' + (++txN).toString(16).padStart(64, '0');
  await asUser(u, 'submit_support_claim_tx', { p_claim_id: c.id, p_tx_hash: tx });
  return { u, c, tx };
}
function putTx(tx, { amount, to = DEST, contract = USDC, status = '0x1', block = 900, ts = Date.now() }) {
  const bn = '0x' + block.toString(16);
  chain.receipts[tx] = { status, blockNumber: bn, logs: [{ address: contract, topics: [TOPIC, '0x' + '0'.repeat(24) + '22'.repeat(20), '0x' + '0'.repeat(24) + to.slice(2)], data: '0x' + BigInt(amount).toString(16).padStart(64, '0') }] };
  chain.blocks[bn] = { timestamp: '0x' + Math.floor(ts / 1000).toString(16) };
}
const P1 = await payer(10, 2);
putTx(P1.tx, { amount: P1.c.amount_units });
r = await call('claims', tok(P1.u), { action: 'verify', claim_id: P1.c.id });
check('auto OFF (por defecto): verify -> "manual", no consulta la red', r.body.mode === 'manual' && chain.calls === 0, JSON.stringify(r));
check('otra persona no puede verificar ese aviso', (await call('claims', tok(NORMAL), { action: 'verify', claim_id: P1.c.id })).status === 404);
check('usuario normal -> admin_check 403', (await call('claims', tok(NORMAL, 'aal2'), { action: 'admin_check', claim_id: P1.c.id })).status === 403);
check('admin sin MFA -> admin_check / approve 403', (await call('claims', tok(ADMIN), { action: 'admin_check', claim_id: P1.c.id })).status === 403 && (await call('claims', tok(ADMIN), { action: 'admin_approve', claim_id: P1.c.id, reason: 'xxxxxxx' })).status === 403);
r = await call('claims', A2, { action: 'config' });
check('panel: config dice verificación automática apagada y tope 201', r.body.auto_enabled === false && r.body.auto_max_usdc === 201 && r.body.support_address_set === true);
r = await call('claims', A2, { action: 'admin_check', claim_id: P1.c.id });
check('transferencia correcta -> todas las comprobaciones pasan', r.body.result?.all_pass === true && Object.entries(r.body.result.checks).every(([, v]) => v), JSON.stringify(r.body));
check('…admin_check nunca activa (sigue submitted, sin acceso)', (await q(`select status from support_claims where id = ${P1.c.id}`))[0].status === 'submitted');
n = globalThis.__mail.length;
r = await call('claims', A2, { action: 'admin_approve', claim_id: P1.c.id });
check('"Activar acceso completo" (todo pasó) -> approved sin motivo + correo enviado', r.body.status === 'approved' && r.body.email_sent === true && globalThis.__mail.length === n + 1, JSON.stringify(r));
const am = globalThis.__mail.at(-1);
check('correo de activación: a la cuenta, 4 idiomas, 2 flores, sin precios', am.to === 'pago10@example.org' && ['Tu acceso completo está activo', 'Your full access is active', 'Dein Vollzugriff ist aktiv', 'Ton accès complet est actif', '2 flores'].every((s) => am.text.includes(s)) && !BANNED.some((b) => am.text.includes(b)));
check('…la cuenta pasa a supporter', (await q(`select subscription_status s from profiles where id = '${P1.u}'`))[0].s === 'supporter');
const cases = [
  ['monto incorrecto', (p) => putTx(p.tx, { amount: BigInt(p.c.amount_units) - 100n }), 'monto_distinto'],
  ['destino incorrecto', (p) => putTx(p.tx, { amount: p.c.amount_units, to: '0x' + '33'.repeat(20) }), 'destino_distinto'],
  ['otro token (no USDC oficial)', (p) => putTx(p.tx, { amount: p.c.amount_units, contract: '0x' + '44'.repeat(20) }), 'no_es_usdc'],
  ['transacción fallida', (p) => putTx(p.tx, { amount: p.c.amount_units, status: '0x0' }), 'tx_fallida'],
  ['transacción inexistente', () => {}, 'tx_no_encontrada'],
  ['transferencia anterior a la reserva', (p) => putTx(p.tx, { amount: p.c.amount_units, ts: Date.now() - 3600000 }), 'tx_anterior_a_la_reserva'],
];
let k = 20;
for (const [name, setup, why] of cases) {
  const p = await payer(k++);
  setup(p);
  r = await call('claims', A2, { action: 'admin_check', claim_id: p.c.id });
  const row = (await q(`select status, review_reason from support_claims where id = ${p.c.id}`))[0];
  check(`${name} -> revisión manual con motivo (${why})`, row.status === 'manual_review' && row.review_reason.includes(why), JSON.stringify(row));
  if (name === 'monto incorrecto') {
    check('…"Activar" sin motivo -> reason_required', (await call('claims', A2, { action: 'admin_approve', claim_id: p.c.id })).body.error === 'reason_required');
    r = await call('claims', A2, { action: 'admin_approve', claim_id: p.c.id, reason: 'Pagó 0,0001 menos por redondeo de la billetera; verificado a mano.' });
    check('…activación manual con motivo -> approved y auditado', r.body.status === 'approved' && (await q(`select count(*)::int c from admin_audit_log where action = 'claim_approved' and reason like 'Pagó%'`))[0].c === 1);
  }
  if (name === 'destino incorrecto') {
    check('…rechazar sin motivo -> reason_required', (await call('claims', A2, { action: 'admin_reject', claim_id: p.c.id })).body.error === 'reason_required');
    check('…rechazar con motivo -> rejected', (await call('claims', A2, { action: 'admin_reject', claim_id: p.c.id, reason: 'La transferencia fue a otra dirección.' })).body.status === 'rejected');
  }
}
const PC = await payer(40); putTx(PC.tx, { amount: PC.c.amount_units, block: 990 });
await call('claims', A2, { action: 'admin_check', claim_id: PC.c.id });
check('pocas confirmaciones (11 < 30) -> sigue submitted, se reintenta', (await q(`select status from support_claims where id = ${PC.c.id}`))[0].status === 'submitted');

console.log('C. Verificación AUTOMÁTICA (solo en esta simulación):');
await db.exec(`update app_config set value = 1 where key = 'claim_auto_verify_enabled'`);
const PA = await payer(50, 3); putTx(PA.tx, { amount: PA.c.amount_units });
n = globalThis.__mail.length;
r = await call('claims', tok(PA.u), { action: 'verify', claim_id: PA.c.id });
check('auto ON + todo correcto -> activada sola + correo', r.body.status === 'approved' && r.body.email_sent === true && globalThis.__mail.length === n + 1, JSON.stringify(r));
check('…auditada como auto-verify', (await q(`select count(*)::int c from admin_audit_log where action = 'claim_approved' and actor_label = 'auto-verify' and target_email = 'pago50@example.org'`))[0].c === 1);
const PT = await payer(51, 10); putTx(PT.tx, { amount: PT.c.amount_units });
r = await call('claims', tok(PT.u), { action: 'verify', claim_id: PT.c.id });
check('10 flores (100,00xx USDC), tope por defecto 201 -> automática', r.body.status === 'approved', JSON.stringify(r));
check('tope por defecto en app_config: claim_auto_max_usdc = 201', (await q(`select value from app_config where key = 'claim_auto_max_usdc'`))[0].value === 201);
for (const [n, k] of [[1, 56], [11, 57], [20, 58]]) {
  const P = await payer(k, n); putTx(P.tx, { amount: P.c.amount_units });
  r = await call('claims', tok(P.u), { action: 'verify', claim_id: P.c.id });
  check(`${n} flor(es) (${(P.c.amount_units / 1e6).toFixed(4)} USDC), todo exacto -> activada automáticamente`, r.body.status === 'approved', JSON.stringify(r));
}
await db.exec(`update app_config set value = 50 where key = 'claim_auto_max_usdc'`);
const PB = await payer(52, 6); putTx(PB.tx, { amount: PB.c.amount_units });
r = await call('claims', tok(PB.u), { action: 'verify', claim_id: PB.c.id });
check('monto por encima del tope (60,00xx con tope 50) y todo exacto -> revisión manual «monto_alto»', r.body.status === 'manual_review' && (await q(`select review_reason from support_claims where id = ${PB.c.id}`))[0].review_reason === 'monto_alto');
const PB2 = await payer(59, 6); putTx(PB2.tx, { amount: BigInt(PB2.c.amount_units) + 100n });
r = await call('claims', tok(PB2.u), { action: 'verify', claim_id: PB2.c.id });
check('por encima del tope Y monto distinto -> revisión manual «monto_distinto, monto_alto»', r.body.status === 'manual_review' && (await q(`select review_reason from support_claims where id = ${PB2.c.id}`))[0].review_reason === 'monto_distinto, monto_alto');
await db.exec(`update app_config set value = 201 where key = 'claim_auto_max_usdc'`);
const PW = await payer(53); putTx(PW.tx, { amount: BigInt(PW.c.amount_units) + 1000000n });
r = await call('claims', tok(PW.u), { action: 'verify', claim_id: PW.c.id });
check('auto ON + monto incorrecto -> revisión manual «monto_distinto», nunca activa', r.body.status === 'manual_review' && (await q(`select review_reason from support_claims where id = ${PW.c.id}`))[0].review_reason === 'monto_distinto' && (await q(`select subscription_status s from profiles where id = '${PW.u}'`))[0].s !== 'supporter');
const PR = await payer(54); putTx(PR.tx, { amount: PR.c.amount_units });
chain.fail = 429;
r = await call('claims', tok(PR.u), { action: 'verify', claim_id: PR.c.id });
chain.fail = null;
const prr = (await q(`select status, review_reason from support_claims where id = ${PR.c.id}`))[0];
check('endpoint de Base agotado (429) -> revisión manual "red_no_disponible", nunca activa', prr.status === 'manual_review' && prr.review_reason.startsWith('red_no_disponible') && (await q(`select subscription_status s from profiles where id = '${PR.u}'`))[0].s !== 'supporter', JSON.stringify(prr));
const PS = await payer(55); putTx(PS.tx, { amount: PS.c.amount_units, block: 995 });
await call('claims', tok(PS.u), { action: 'verify', claim_id: PS.c.id });
check('volver a pedir verificación antes de 1 minuto -> too_soon', (await call('claims', tok(PS.u), { action: 'verify', claim_id: PS.c.id })).body.error === 'too_soon');
await db.exec(`update app_config set value = 0 where key = 'claim_auto_verify_enabled'`);

// ================================================================ retranslate
console.log('D. community-retranslate:');
check('sin clave -> 401', (await call('retranslate', null, {})).status === 401);
check('clave incorrecta -> 401', (await call('retranslate', null, {}, { 'x-retranslate-secret': 'r'.repeat(39) + 's' })).status === 401);
await db.exec(`insert into community_members (user_id, display_name) values ('${NORMAL}', 'Normal') on conflict do nothing`);
const mk = async (body, attempts = 0) => (await q(`insert into community_posts (user_id, kind, body, source_lang, body_i18n, translation_status, translation_attempts) values ('${NORMAL}', 'text', $1, 'es', jsonb_build_object('es', $1::text), 'failed', ${attempts}) returning id`, [body]))[0].id;
const p1 = await mk('Primera publicación sin traducir'), p2 = await mk('Segunda publicación sin traducir', 4);
const SEC = { 'x-retranslate-secret': env.RETRANSLATE_SECRET };
deepl.mode = '500';
r = await call('retranslate', null, {}, SEC);
const rows = await q(`select id, translation_status s, translation_attempts a from community_posts where id in ('${p1}', '${p2}')`);
check('fallo de DeepL -> intentos +1; al 5.º -> gave_up', rows.find((x) => x.id === p1).a === 1 && rows.find((x) => x.id === p1).s === 'failed' && rows.find((x) => x.id === p2).s === 'gave_up', JSON.stringify(rows));
deepl.mode = '456';
r = await call('retranslate', null, {}, SEC);
check('DeepL 456 (cuota) -> se detiene y NO cuenta como intento', r.body.stopped === 'quota' && (await q(`select translation_attempts a from community_posts where id = '${p1}'`))[0].a === 1);
const capBefore = (await q(`select value from app_config where key = 'deepl_daily_char_cap'`))[0].value;
await db.exec(`update app_config set value = 0 where key = 'deepl_daily_char_cap'`); deepl.mode = 'ok'; deepl.calls = 0;
r = await call('retranslate', null, {}, SEC);
check('tope diario global alcanzado -> se detiene sin llamar a DeepL', r.body.stopped === 'cap' && deepl.calls === 0);
await db.exec(`update app_config set value = ${capBefore} where key = 'deepl_daily_char_cap'`);
r = await call('retranslate', null, {}, SEC);
const done = (await q(`select translation_status s, body_i18n b from community_posts where id = '${p1}'`))[0];
check('DeepL responde -> done con los 4 idiomas', done.s === 'done' && Object.keys(done.b).length === 4, JSON.stringify(r.body));
check('gave_up no se reintenta', (await q(`select translation_status s from community_posts where id = '${p2}'`))[0].s === 'gave_up');
for (let i = 0; i < 25; i++) await mk('Lote ' + i);
deepl.calls = 0;
r = await call('retranslate', null, {}, SEC);
check('máximo 20 filas por pasada', r.body.done === 20, JSON.stringify(r.body));

// ================================================================ cron
console.log('E. api/subscription-cron.js (Vercel, 23:00 UTC):');
process.env.CRON_SECRET = 'c'.repeat(32); process.env.SUPABASE_URL = env.SUPABASE_URL; process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc';
process.env.VITE_SUPABASE_ANON_KEY = 'anon'; process.env.RETRANSLATE_SECRET = env.RETRANSLATE_SECRET;
const cronOut = new URL('./cron.mjs', OUT).pathname.replace(/^\/([A-Z]:)/, '$1');
await build({ entryPoints: [`${APP}/api/subscription-cron.js`], bundle: true, format: 'esm', platform: 'node', outfile: cronOut, logLevel: 'error' });
const cron = (await import('file:///' + cronOut)).default;
const runCron = async (auth) => { let st, out; await cron({ headers: { authorization: auth } }, { status: (s) => ({ json: (j) => { st = s; out = j; } }) }); return { st, out }; };
check('sin CRON_SECRET correcto -> 401', (await runCron('Bearer nope')).st === 401);
const EXP = await user(60, 'vence@example.org');
const ec = await asUser(EXP, 'create_support_claim', { p_flowers: 1 });
await db.exec(`update support_claims set expires_at = now() - interval '1 minute' where id = ${ec.id}`);
const OLD = await user(61, 'vieja@example.org');
await db.exec(`update profiles set subscription_status = 'active', subscription_active = true, subscription_expires_at = now() - interval '1 day' where id = '${OLD}'`);
const trialBefore = (await q(`select count(*)::int c from profiles where subscription_status = 'trialing'`))[0].c;
const cr = await runCron('Bearer ' + process.env.CRON_SECRET);
check('cron: 200 y queda en cron_runs', cr.st === 200 && (await q(`select count(*)::int c from cron_runs where job = 'subscription-cron' and ok`))[0].c === 1, JSON.stringify(cr.out));
check('cron: reserva vencida -> expired', (await q(`select status from support_claims where id = ${ec.id}`))[0].status === 'expired');
check('cron: suscripción vieja vencida -> canceled (sin cobros)', (await q(`select subscription_status s from profiles where id = '${OLD}'`))[0].s === 'canceled');
check('cron: no toca pruebas, supporters ni accesos', (await q(`select count(*)::int c from profiles where subscription_status = 'trialing'`))[0].c === trialBefore && (await q(`select count(*)::int c from profiles where subscription_status = 'blocked'`))[0].c === 0);
check('cron: llamó al reintento de traducciones', cr.out.retranslate && typeof cr.out.retranslate.done === 'number');
const cronSrc = fs.readFileSync(`${APP}/api/subscription-cron.js`, 'utf8');
check('cron: sin precios ni cobros en el código', !/7\.10|7\.99|19\.99|charge|PRICE|payment-nerds|Payment Nerds|Stripe/i.test(cronSrc));
check('vercel.json: 23:00 UTC', JSON.parse(fs.readFileSync(`${APP}/vercel.json`, 'utf8')).crons[0].schedule === '0 23 * * *');

// ================================================================ shared block
const blk = (f) => { const s = fs.readFileSync(`${APP}/supabase/functions/${f}/index.ts`, 'utf8'); return s.slice(s.indexOf('// ===== '.slice(0, 5)), s.length) && s.match(/\/\/ =+ MAIL\n[\s\S]*?\/\/ =+ \/MAIL/)[0]; };
check('bloque MAIL idéntico en las dos funciones', blk('admin-send-gift-code') === blk('support-claims'));

console.log(`\nRESULTADO: ${pass} ok, ${fail} fallas${fail ? ' -> ' + failures.join(' | ') : ''}`);
process.exit(0);
