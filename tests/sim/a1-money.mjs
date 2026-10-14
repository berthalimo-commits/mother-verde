// Group A1 (money and access): account deletion with claims, late payment,
// notice to support on a new TXID, one access rule, live refresh helpers.
// Real migrations on PGlite, the support-claims function bundled as in
// production, SMTP simulated. Nothing is sent, no real account is used.
import { createRequire } from 'module';
import fs from 'fs';
import { makeDb, makeRest } from './fakerest.mjs';

const APP = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1').replace(/\/$/, '');
const req = createRequire(APP + '/package.json');
const { build } = req('esbuild');
let pass = 0, fail = 0; const failures = [];
const check = (n, c, d = '') => { if (c) { pass++; console.log('  ok   ', n); } else { fail++; failures.push(n); console.log('  FALLA', n, d); } };

const DEST = '0x' + '11'.repeat(20);
const env = { SUPABASE_URL: 'https://fake.supabase.co', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'svc', SUPPORT_ADDRESS: DEST,
  MAIL_PROVIDER: 'smtp', SMTP_USER: 'hello@motherverdeny.com', SMTP_PASS: 'x', MAIL_RETRY_MS: '0', APP_URL: 'https://example.test' };
globalThis.__mail = []; globalThis.__smtpFail = null;
globalThis.Deno = { env: { get: (k) => env[k] }, serve: (h) => { globalThis.__h = h; } };
const db = await makeDb();
const rest = makeRest(db);
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(typeof url === 'string' ? url : url.url);
  if (typeof url !== 'string' && !init.method) init = { method: url.method, headers: url.headers, body: await url.text() };
  if (u.hostname === 'fake.supabase.co') return rest(u.toString(), init);
  if (u.hostname === 'mainnet.base.org') return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: null }));
  throw new Error('unexpected fetch ' + u);
};
const mock = new URL('./fnbuild/a1-nodemailer.mjs', import.meta.url);
fs.writeFileSync(mock, `export default { createTransport: () => ({ sendMail: async (m) => { if (globalThis.__smtpFail) throw new Error(globalThis.__smtpFail); globalThis.__mail.push(m); return {}; } }) };`);
const out = new URL('./fnbuild/a1-claims.mjs', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
await build({ entryPoints: [`${APP}/supabase/functions/support-claims/index.ts`], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
  plugins: [{ name: 'deno', setup(b) {
    b.onResolve({ filter: /^jsr:@supabase\/supabase-js/ }, () => ({ path: req.resolve('@supabase/supabase-js') }));
    b.onResolve({ filter: /^npm:nodemailer/ }, () => ({ path: mock.pathname.replace(/^\/([A-Z]:)/, '$1') }));
  } }] });
await import('file:///' + out + '?' + Date.now());
const claimsFn = globalThis.__h;
const call = async (token, body) => { const r = await claimsFn(new Request('https://x/', { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: JSON.stringify(body) })); return { status: r.status, body: await r.json().catch(() => ({})) }; };
const q = async (s, p) => (await db.query(s, p)).rows;
const rpc = async (token, fn, args = {}) => { const r = await rest(`https://fake.supabase.co/rest/v1/rpc/${fn}`, { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: JSON.stringify(args) }); return { status: r.status, body: await r.json().catch(() => null) }; };
const tok = (u, aal = 'aal1') => `u:${u}:${aal}`;

let n = 0;
async function person(email) {
  const id = `e${String(++n).padStart(7, '0')}-0000-4000-8000-000000000000`;
  await db.query('insert into auth.users (id, email, email_confirmed_at) values ($1::uuid, $2, now())', [id, email]);
  await db.query(`update profiles set trial_ends_at = now() - interval '1 hour' where id = $1::uuid`, [id]);
  return id;
}
const ADMIN = await person('hello@motherverdeny.com');
await db.exec(fs.readFileSync(APP + '/supabase/admin/grant-admin.sql', 'utf8'));
const A2 = tok(ADMIN, 'aal2');
let txN = 0;
const tx = () => '0x' + (++txN).toString(16).padStart(64, 'a');

// ================================================================ 1
console.log('1. Borrar una cuenta con avisos de aporte');
const P = await person('paga.y.borra@example.org');
const c1 = (await rpc(tok(P), 'create_support_claim', { p_flowers: 2 })).body;
const TX1 = tx();
await rpc(tok(P), 'submit_support_claim_tx', { p_claim_id: c1.id, p_tx_hash: TX1, p_contact_name: 'María López', p_contact_phone: '+51 987 654 321' });
const R = await person('solo.reserva@example.org');
const c2 = (await rpc(tok(R), 'create_support_claim', { p_flowers: 1 })).body;
await db.query('delete from auth.users where id in ($1::uuid, $2::uuid)', [P, R]);
const kept = (await q('select * from support_claims where id = $1', [c1.id]))[0];
check('aviso con TXID: se conserva tras borrar la cuenta', !!kept && kept.tx_hash === TX1 && kept.status === 'submitted' && String(kept.amount_units) === String(c1.amount_units));
check('…separado de la persona: sin cuenta, sin nombre, sin teléfono, con fecha de borrado', kept.user_id === null && kept.contact_name === null && kept.contact_phone === null && kept.account_deleted_at !== null, JSON.stringify(kept));
check('…nada en la fila apunta a la persona (ni el correo, que nunca se guardó en el aviso)', !JSON.stringify(kept).includes('paga.y.borra') && !JSON.stringify(kept).includes('María') && !JSON.stringify(kept).includes('987'));
check('reserva sin pagar (sin TXID): se borra con la cuenta, como antes', (await q('select count(*)::int c from support_claims where id = $1', [c2.id]))[0].c === 0);
let list = (await rpc(A2, 'admin_list_claims', { p_statuses: ['submitted', 'manual_review'] })).body;
const row = (list || []).find((x) => x.id === c1.id);
check('panel: el aviso sigue en la lista, marcado «cuenta borrada», sin correo ni contacto', row && row.account_deleted === true && row.account_email === null && row.contact_name === null, JSON.stringify(row));
const csv = (await rpc(A2, 'admin_export_csv', { p_tab: 'claims', p_filters: {} })).body;
check('CSV de avisos: la fila aparece con «cuenta borrada» y el TXID', csv.csv.includes('cuenta borrada') && csv.csv.includes(TX1));
let r = await call(A2, { action: 'admin_approve', claim_id: c1.id, reason: 'Pago visto en Basescan; cuenta borrada' });
const appr = (await q('select status, user_id from support_claims where id = $1', [c1.id]))[0];
check('aprobar un aviso de cuenta borrada: queda «approved» (pago recibido), sin cuenta que activar', r.status === 200 && appr.status === 'approved' && appr.user_id === null, JSON.stringify(r));
check('…no intenta enviar correo (no hay a quién) y lo dice', r.body.email_sent === false && r.body.email_error === 'account_deleted' && globalThis.__mail.length === 0);
check('…queda en el registro con «account_deleted» y sin correo', (await q(`select target_email, details from admin_audit_log where action = 'claim_approved' order by id desc limit 1`))[0].details.account_deleted === true);
const P2 = await person('rechazo@example.org');
const c3 = (await rpc(tok(P2), 'create_support_claim', { p_flowers: 1 })).body;
await rpc(tok(P2), 'submit_support_claim_tx', { p_claim_id: c3.id, p_tx_hash: tx() });
await db.query('delete from auth.users where id = $1::uuid', [P2]);
r = await call(A2, { action: 'admin_reject', claim_id: c3.id, reason: 'Monto distinto, cuenta borrada' });
check('rechazar un aviso de cuenta borrada también funciona', r.status === 200 && (await q('select status from support_claims where id = $1', [c3.id]))[0].status === 'rejected');
check('la base no admite un aviso sin cuenta que no esté marcado como borrado', await db.query(`insert into support_claims (user_id, flowers, amount_units, expires_at) values (null, 1, 10000100, now())`).then(() => false, () => true));

// ================================================================ 2
console.log('2. Pago tardío (la reserva de 72 h venció)');
const L = await person('tarde@example.org');
const lc = (await rpc(tok(L), 'create_support_claim', { p_flowers: 1 })).body;
await db.query(`update support_claims set expires_at = now() - interval '1 hour', status = 'expired' where id = $1`, [lc.id]);
// someone else now holds the same amount
const O = await person('otra@example.org');
const oc = (await rpc(tok(O), 'create_support_claim', { p_flowers: 1 })).body;
await db.query('update support_claims set amount_units = $1 where id = $2', [lc.amount_units, oc.id]);
const LTX = tx();
r = await rpc(tok(L), 'submit_support_claim_tx', { p_claim_id: lc.id, p_tx_hash: LTX });
let lrow = (await q('select status, late, review_reason, tx_hash from support_claims where id = $1', [lc.id]))[0];
check('reserva vencida + TXID -> aceptado, en revisión manual con motivo «reserva_vencida»', r.status === 200 && lrow.status === 'manual_review' && lrow.late === true && lrow.review_reason === 'reserva_vencida' && lrow.tx_hash === LTX, JSON.stringify({ r, lrow }));
check('…aunque otra persona tenga ahora ese mismo monto reservado (su reserva sigue intacta)', (await q('select status from support_claims where id = $1', [oc.id]))[0].status === 'awaiting_payment');
const L2 = await person('tarde2@example.org');
const l2 = (await rpc(tok(L2), 'create_support_claim', { p_flowers: 3 })).body;
await db.query(`update support_claims set expires_at = now() - interval '5 minutes' where id = $1`, [l2.id]);
const l2new = (await rpc(tok(L2), 'create_support_claim', { p_flowers: 2 })).body;
r = await rpc(tok(L2), 'submit_support_claim_tx', { p_claim_id: l2.id, p_tx_hash: tx() });
check('reserva vencida aún sin marcar + una reserva nueva sin pagar -> se acepta la tardía y se cancela la nueva', r.status === 200 && (await q('select status from support_claims where id = $1', [l2.id]))[0].status === 'manual_review' && (await q('select status from support_claims where id = $1', [l2new.id]))[0].status === 'canceled', JSON.stringify(r));
const L3 = await person('tarde3@example.org');
const l3a = (await rpc(tok(L3), 'create_support_claim', { p_flowers: 1 })).body;
await db.query(`update support_claims set expires_at = now() - interval '1 hour', status = 'expired' where id = $1`, [l3a.id]);
const l3b = (await rpc(tok(L3), 'create_support_claim', { p_flowers: 1 })).body;
await rpc(tok(L3), 'submit_support_claim_tx', { p_claim_id: l3b.id, p_tx_hash: tx() });
r = await rpc(tok(L3), 'submit_support_claim_tx', { p_claim_id: l3a.id, p_tx_hash: tx() });
check('si ya tiene otro aviso en revisión -> «claim_in_review», no toca nada', r.status >= 400 && JSON.stringify(r.body).includes('claim_in_review') && (await q('select status from support_claims where id = $1', [l3a.id]))[0].status === 'expired');
check('TXID ya usado -> rechazado también en el pago tardío', JSON.stringify((await rpc(tok(L3), 'submit_support_claim_tx', { p_claim_id: l3a.id, p_tx_hash: LTX })).body).includes('tx_already_used'));
const OT = await person('a-tiempo@example.org');
const ot = (await rpc(tok(OT), 'create_support_claim', { p_flowers: 1 })).body;
await rpc(tok(OT), 'submit_support_claim_tx', { p_claim_id: ot.id, p_tx_hash: tx() });
check('a tiempo: sigue como antes («submitted», sin marca de tardío)', (await q('select status, late from support_claims where id = $1', [ot.id]))[0].status === 'submitted');
await db.exec(`update app_config set value = 1 where key = 'claim_auto_verify_enabled'`);
r = await call(tok(L), { action: 'verify', claim_id: lc.id });
check('con la verificación automática ENCENDIDA, un tardío nunca se activa solo', (await q('select status from support_claims where id = $1', [lc.id]))[0].status === 'manual_review' && (await q('select subscription_status s from profiles where id = $1', [L]))[0].s !== 'supporter', JSON.stringify(r));
await db.exec(`update app_config set value = 0 where key = 'claim_auto_verify_enabled'`);
check('aprobar un tardío sin motivo escrito -> reason_required', (await call(A2, { action: 'admin_approve', claim_id: lc.id })).body.error === 'reason_required');
r = await call(A2, { action: 'admin_approve', claim_id: lc.id, reason: 'Pago visto en Basescan, llegó tarde' });
check('…con motivo -> activado y la cuenta pasa a acceso completo', r.status === 200 && (await q('select subscription_status s from profiles where id = $1', [L]))[0].s === 'supporter', JSON.stringify(r));
const migr = fs.readFileSync(APP + '/supabase/migrations/20261014110000_late_payment.sql', 'utf8');
check('textos del pago tardío en los 4 idiomas', ['es', 'en', 'de', 'fr'].every((l) => ['dsTardeH', 'dsTardeP', 'dsTardeBtn', 'dsTardeOk', 'dsErrEnRevision'].every((k) => fs.readFileSync(APP + '/public/main.js', 'utf8').includes(`translations.${l}.${k} = `))) && migr.includes("'reserva_vencida'"));

console.log(`\nRESULTADO: ${pass} ok, ${fail} fallas${fail ? ' -> ' + failures.join(' | ') : ''}`);
process.exit(0);
