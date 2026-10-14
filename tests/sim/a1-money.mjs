// Group A1 (money and access): account deletion with claims, late payment
// checked on Base, TXID conflicts (stolen public TXIDs).
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
const chain = { head: 2000, receipts: {}, blocks: {} };
globalThis.Deno = { env: { get: (k) => env[k] }, serve: (h) => { globalThis.__h = h; } };
const db = await makeDb();
const rest = makeRest(db);
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(typeof url === 'string' ? url : url.url);
  if (typeof url !== 'string' && !init.method) init = { method: url.method, headers: url.headers, body: await url.text() };
  if (u.hostname === 'fake.supabase.co') return rest(u.toString(), init);
  if (u.hostname === 'mainnet.base.org') {
    const { method, params } = JSON.parse(init.body);
    const res = method === 'eth_getTransactionReceipt' ? chain.receipts[params[0]] ?? null
      : method === 'eth_blockNumber' ? '0x' + chain.head.toString(16) : method === 'eth_getBlockByNumber' ? chain.blocks[params[0]] ?? null : null;
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: res }));
  }
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
console.log('2. Pago tardío comprobado en Base + conflictos (20261014120000)');
const USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
let blockN = 900;
function putTx(hash, amount, { to = DEST, ts = Date.now() } = {}) {
  const bn = '0x' + (++blockN).toString(16);
  chain.receipts[hash] = { status: '0x1', blockNumber: bn, logs: [{ address: USDC, topics: [TOPIC, '0x' + '0'.repeat(24) + '22'.repeat(20), '0x' + '0'.repeat(24) + to.slice(2)], data: '0x' + BigInt(amount).toString(16).padStart(64, '0') }] };
  chain.blocks[bn] = { timestamp: '0x' + Math.floor(ts / 1000).toString(16) };
}
const late = (u, claim, hash) => call(tok(u), { action: 'submit_late', claim_id: claim.id, tx_hash: hash });
const crow = async (id) => (await q('select status, late, tx_hash, review_reason, review_history from support_claims where id = $1', [id]))[0];
const expire = (id) => db.query(`update support_claims set expires_at = now() - interval '1 hour', status = 'expired' where id = $1`, [id]);
const conflicts = (id) => q(`select * from support_claim_conflicts where (claim_id = $1 or other_claim_id = $1) and status = 'open'`, [id]);

// a) only your own expired reservation, only the exact amount
const L = await person('tarde@example.org');
const lc = (await rpc(tok(L), 'create_support_claim', { p_flowers: 1 })).body;
await expire(lc.id);
check('el navegador ya no puede poner un TXID en una reserva vencida (va por la comprobación en Base)', JSON.stringify((await rpc(tok(L), 'submit_support_claim_tx', { p_claim_id: lc.id, p_tx_hash: tx() })).body).includes('expired'));
const W = tx(); putTx(W, BigInt(lc.amount_units) - 100n);
r = await late(L, lc, W);
check('monto distinto al de SU reserva -> «late_amount_mismatch» y no se guarda nada', r.status === 400 && r.body.error === 'late_amount_mismatch' && (await crow(lc.id)).tx_hash === null && (await crow(lc.id)).status === 'expired', JSON.stringify(r));
r = await late(L, lc, tx());
check('TXID que no está en Base -> «late_tx_not_found» (puede reintentar), nada guardado', r.body.error === 'late_tx_not_found' && (await crow(lc.id)).status === 'expired');
const X = await person('ajena@example.org');
r = await late(X, lc, W);
check('la reserva vencida de OTRA persona -> not_found', r.status === 404);
const OT = await person('vigente@example.org');
const otc = (await rpc(tok(OT), 'create_support_claim', { p_flowers: 1 })).body;
r = await late(OT, otc, tx());
check('una reserva todavía vigente no usa el camino tardío (not_late)', r.body.error === 'not_late');
const LT = tx(); putTx(LT, lc.amount_units);
r = await late(L, lc, LT);
let lrow = await crow(lc.id);
check('monto exacto de SU reserva -> aceptado, revisión manual «reserva_vencida», respuesta neutra', r.status === 200 && r.body.review === 'manual' && lrow.status === 'manual_review' && lrow.late && lrow.tx_hash === LT && lrow.review_reason === 'reserva_vencida', JSON.stringify({ r, lrow }));
await db.exec(`update app_config set value = 1 where key = 'claim_auto_verify_enabled'`);
await call(tok(L), { action: 'verify', claim_id: lc.id });
check('con la verificación automática ENCENDIDA, un tardío nunca se activa solo', (await crow(lc.id)).status === 'manual_review' && (await q('select subscription_status s from profiles where id = $1', [L]))[0].s !== 'supporter');
await db.exec(`update app_config set value = 0 where key = 'claim_auto_verify_enabled'`);

// N2: "Comprobar en Base" adds, never erases
r = await call(A2, { action: 'admin_check', claim_id: lc.id });
lrow = await crow(lc.id);
check('«Comprobar en Base» NO borra «reserva_vencida»: los motivos se suman', lrow.review_reason.startsWith('reserva_vencida') && lrow.review_reason.includes('solicitud_no_vigente'), lrow.review_reason);
check('…y queda un historial con cada paso (solo para el panel)', Array.isArray(lrow.review_history) && lrow.review_history.length === 2 && lrow.review_history[1].by === 'comprobacion', JSON.stringify(lrow.review_history));
check('el navegador no puede leer el historial de motivos', (await rest(`https://fake.supabase.co/rest/v1/support_claims?select=review_history`, { method: 'GET', headers: { Authorization: 'Bearer ' + tok(L) } })).status >= 400);
let clist = (await rpc(A2, 'admin_list_claims')).body;
check('el panel recibe la marca «tardío» y el historial', clist.find((x) => x.id === lc.id)?.late === true && clist.find((x) => x.id === lc.id)?.review_history?.length === 2);
check('aprobar un tardío sin motivo -> reason_required', (await call(A2, { action: 'admin_approve', claim_id: lc.id })).body.error === 'reason_required');
r = await call(A2, { action: 'admin_approve', claim_id: lc.id, reason: 'Pago visto en Basescan, llegó tarde' });
check('…con motivo -> activado', r.status === 200 && (await q('select subscription_status s from profiles where id = $1', [L]))[0].s === 'supporter', JSON.stringify(r));

// d) ATTACK 1: the thief registers the victim's public TXID BEFORE the victim does
console.log('   Ataque 1: el TXID ajeno se registra ANTES que su dueño');
const THIEF = await person('ladron@example.org');
const th = (await rpc(tok(THIEF), 'create_support_claim', { p_flowers: 1 })).body;
await expire(th.id);
const VIC = await person('victima@example.org');
const vc = (await rpc(tok(VIC), 'create_support_claim', { p_flowers: 1 })).body;
await db.query('update support_claims set amount_units = $1 where id = $2', [th.amount_units, vc.id]); // the expired amount was given again
const VT = tx(); putTx(VT, th.amount_units);                                                       // the victim pays: public on Base
r = await late(THIEF, th, VT);
const thiefAnswer = JSON.stringify(r.body);
check('el ladrón recibe solo «lo revisaremos a mano» (nada sobre otro aviso)', r.status === 200 && r.body.review === 'manual' && !thiefAnswer.includes(String(vc.id)) && !/victima|conflict/i.test(thiefAnswer), thiefAnswer);
check('…queda un conflicto «mismo monto» con la reserva de la víctima, visible solo en el panel', (await conflicts(th.id)).some((k) => k.kind === 'mismo_monto' && k.other_claim_id === vc.id));
r = await rpc(tok(VIC), 'submit_support_claim_tx', { p_claim_id: vc.id, p_tx_hash: VT });
check('la víctima envía su TXID: NO recibe «ya usado»; su aviso queda en revisión manual', r.status === 200 && r.body.status === 'manual_review' && !JSON.stringify(r.body).includes('tx_already_used'), JSON.stringify(r.body));
check('…y su respuesta no dice nada del otro aviso ni de otra persona', r.body.id === vc.id && !/ladron|conflicto|other_claim/.test(JSON.stringify(r.body)) && JSON.stringify(r.body.review_history) === '[]', JSON.stringify(r.body));
{
  const own = await rest(`https://fake.supabase.co/rest/v1/support_claims?select=status,review_reason`, { method: 'GET', headers: { Authorization: 'Bearer ' + tok(VIC) } }).then((x) => x.json());
  const thiefOwn = await rest(`https://fake.supabase.co/rest/v1/support_claims?select=status,review_reason`, { method: 'GET', headers: { Authorization: 'Bearer ' + tok(THIEF) } }).then((x) => x.json());
  check('al leer su propio aviso, ninguna de las dos personas ve «conflicto» (solo «revision_manual»)', !/conflicto/.test(JSON.stringify(own) + JSON.stringify(thiefOwn)) && /revision_manual/.test(JSON.stringify(own)), JSON.stringify({ own, thiefOwn }));
}
check('…conflicto «mismo TXID» entre los dos avisos', (await conflicts(vc.id)).some((k) => k.kind === 'mismo_txid' && k.tx_hash === VT));
check('nadie tiene acceso todavía', (await q(`select count(*)::int c from profiles where id in ($1, $2) and subscription_status = 'supporter'`, [THIEF, VIC]))[0].c === 0);
r = await call(A2, { action: 'admin_approve', claim_id: th.id, reason: 'Parece correcto' });
check('el panel no deja aprobar mientras haya un conflicto abierto (conflict_open)', r.body.error === 'conflict_open', JSON.stringify(r));
let ks = (await rpc(A2, 'admin_list_claim_conflicts')).body;
const k1 = ks.find((k) => k.kind === 'mismo_txid' && k.tx_hash === VT);
check('el panel ve los dos avisos lado a lado (correos y fechas solo para la admin)', k1 && k1.a?.id && k1.b?.id && [k1.a.account_email, k1.b.account_email].sort().join() === 'ladron@example.org,victima@example.org', JSON.stringify(k1));
check('una cuenta normal no puede ver la lista de conflictos', JSON.stringify((await rpc(tok(VIC), 'admin_list_claim_conflicts')).body).includes('not_allowed'));
r = await rpc(A2, 'admin_resolve_claim_conflict', { p_conflict_id: k1.id, p_winner_claim_id: vc.id, p_reason: 'La víctima reservó ese monto vigente cuando pagó (Basescan)' });
check('resuelto a favor de quien pagó: recibe el TXID; el del ladrón queda rechazado', r.status === 200 && (await crow(vc.id)).tx_hash === VT && (await crow(th.id)).status === 'rejected', JSON.stringify(r.body));
for (const k of (await rpc(A2, 'admin_list_claim_conflicts')).body.filter((x) => [x.a?.id, x.b?.id].includes(vc.id))) {
  await rpc(A2, 'admin_resolve_claim_conflict', { p_conflict_id: k.id, p_winner_claim_id: vc.id, p_reason: 'Mismo caso: el pago es de la víctima' });
}
r = await call(A2, { action: 'admin_approve', claim_id: vc.id, reason: 'Pago de la víctima comprobado en Basescan' });
check('…y la admin puede activar a quien pagó (con motivo); el ladrón sin acceso', r.status === 200 && (await q('select subscription_status s from profiles where id = $1', [VIC]))[0].s === 'supporter' && (await q('select subscription_status s from profiles where id = $1', [THIEF]))[0].s !== 'supporter', JSON.stringify(r));
check('todo queda en el registro de auditoría', (await q(`select count(*)::int c from admin_audit_log where action = 'claim_conflict_resolved'`))[0].c >= 1);

// d) ATTACK 2: the thief tries AFTER the owner registered it
console.log('   Ataque 2: el TXID ajeno se registra DESPUÉS que su dueño');
const T2 = await person('ladron2@example.org');
const t2 = (await rpc(tok(T2), 'create_support_claim', { p_flowers: 2 })).body;
await expire(t2.id);
const V2 = await person('victima2@example.org');
const v2 = (await rpc(tok(V2), 'create_support_claim', { p_flowers: 2 })).body;
await db.query('update support_claims set amount_units = $1 where id = $2', [t2.amount_units, v2.id]);
const V2T = tx(); putTx(V2T, t2.amount_units);
r = await rpc(tok(V2), 'submit_support_claim_tx', { p_claim_id: v2.id, p_tx_hash: V2T });
check('la dueña registra su TXID a tiempo (submitted)', r.body.status === 'submitted');
r = await late(T2, t2, V2T);
check('el ladrón llega después: respuesta neutra, sin «ya usado»', r.status === 200 && r.body.review === 'manual' && !JSON.stringify(r.body).includes('used'), JSON.stringify(r.body));
check('…el TXID sigue en el aviso de la dueña y hay conflicto', (await crow(v2.id)).tx_hash === V2T && (await crow(t2.id)).tx_hash === null && (await conflicts(v2.id)).some((k) => k.kind === 'mismo_txid'));
await db.exec(`update app_config set value = 1 where key = 'claim_auto_verify_enabled'`);
await call(tok(V2), { action: 'verify', claim_id: v2.id });
check('con la verificación automática encendida, el aviso en conflicto NO se activa solo', (await crow(v2.id)).status === 'manual_review' && (await q('select subscription_status s from profiles where id = $1', [V2]))[0].s !== 'supporter');
await db.exec(`update app_config set value = 0 where key = 'claim_auto_verify_enabled'`);
check('quien pagó nunca queda sin salida: su aviso sigue abierto en revisión y en el panel', ['manual_review', 'submitted'].includes((await crow(v2.id)).status) && (await rpc(A2, 'admin_list_claims')).body.some((x) => x.id === v2.id && x.conflict_open));
for (const k of (await rpc(A2, 'admin_list_claim_conflicts')).body.filter((x) => [x.a?.id, x.b?.id].includes(v2.id))) {
  await rpc(A2, 'admin_resolve_claim_conflict', { p_conflict_id: k.id, p_winner_claim_id: v2.id, p_reason: 'El TXID es de la dueña: lo registró a tiempo' });
}
r = await call(A2, { action: 'admin_approve', claim_id: v2.id, reason: 'Comprobado en Basescan tras el conflicto' });
check('resuelto: la dueña se activa; el ladrón queda rechazado', r.status === 200 && (await crow(t2.id)).status === 'rejected' && (await q('select subscription_status s from profiles where id = $1', [V2]))[0].s === 'supporter');

// one open claim per person (from step 2) still holds
const L3 = await person('tarde3@example.org');
const l3a = (await rpc(tok(L3), 'create_support_claim', { p_flowers: 3 })).body;
await expire(l3a.id);
const l3b = (await rpc(tok(L3), 'create_support_claim', { p_flowers: 3 })).body;
await rpc(tok(L3), 'submit_support_claim_tx', { p_claim_id: l3b.id, p_tx_hash: tx() });
const L3T = tx(); putTx(L3T, l3a.amount_units);
r = await late(L3, l3a, L3T);
check('si ya tiene otro aviso en revisión -> «claim_in_review», no toca nada', r.body.error === 'claim_in_review' && (await crow(l3a.id)).status === 'expired', JSON.stringify(r));
check('textos nuevos en los 4 idiomas', ['es', 'en', 'de', 'fr'].every((l) => ['dsTardeH', 'dsTardeP', 'dsTardeBtn', 'dsTardeOk', 'dsErrEnRevision', 'dsErrTardeMonto', 'dsErrTardeNoEncontrada', 'dsRevisionManual'].every((k) => fs.readFileSync(APP + '/public/main.js', 'utf8').includes(`translations.${l}.${k} = `))));

console.log(`\nRESULTADO: ${pass} ok, ${fail} fallas${fail ? ' -> ' + failures.join(' | ') : ''}`);
process.exit(0);
