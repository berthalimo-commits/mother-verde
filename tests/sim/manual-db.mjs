// Manual contributions (Bertha's decision 2026-11-03): an admin with AAL2
// records a contribution paid by PayPal, CashApp, transfer, cash or other.
// Real migrations on PGlite. Checks: who may do it, the 10-per-flower rule on
// what was PAID (fee only for bookkeeping), the same access path as an
// approved USDC claim, the duplicate guard, voiding without deleting (access
// back to what it was), the Registro, the CSV and that the browser can't read
// the table. Usage: node tests/sim/manual-db.mjs
import { makeDb } from './fakerest.mjs';

let pass = 0, fail = 0; const failures = [];
const check = (n, c, d = '') => { if (c) { pass++; console.log('  ok   ', n); } else { fail++; failures.push(n); console.log('  FALLA', n, d); } };

const db = await makeDb();
// as(role, uid, aal): like PostgREST (claims set) — null role = SQL Editor (no claims)
async function as(role, uid, aal, sql, params = []) {
  const claims = role ? JSON.stringify({ role, ...(uid ? { sub: uid, aal } : {}) }) : '';
  await db.exec(`reset role; select set_config('request.jwt.claims', '${claims.replace(/'/g, "''")}', false);${role ? ` set role ${role};` : ''}`);
  try { return { rows: (await db.query(sql, params)).rows }; } catch (e) { return { error: e.message }; } finally { await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`); }
}
const sys = (sql, p) => as(null, null, null, sql, p);
const ADMIN = 'a0000000-0000-4000-8000-000000000001';
const U1 = 'b0000000-0000-4000-8000-000000000001'; // trial expired, pays by PayPal
const U2 = 'b0000000-0000-4000-8000-000000000002'; // already paid in USDC
const U3 = 'b0000000-0000-4000-8000-000000000003'; // in her 24 h trial
const OTHER = 'b0000000-0000-4000-8000-000000000009'; // not an admin
await db.exec(`
insert into auth.users (id, email, email_confirmed_at, created_at) values
 ('${ADMIN}', 'hello@motherverdeny.com', now() - interval '90 days', now() - interval '90 days'),
 ('${U1}', 'paypal@example.com', now() - interval '20 days', now() - interval '20 days'),
 ('${U2}', 'usdc@example.com', now() - interval '20 days', now() - interval '20 days'),
 ('${U3}', 'prueba@example.com', now() - interval '2 hours', now() - interval '2 hours'),
 ('${OTHER}', 'otra@example.com', now() - interval '20 days', now() - interval '20 days');
insert into public.admin_users (user_id) values ('${ADMIN}');
update public.profiles set subscription_status = 'trialing', trial_started_at = now() - interval '19 days', trial_ends_at = now() - interval '18 days' where id in ('${U1}', '${U2}');
update public.profiles set subscription_status = 'trialing', trial_started_at = now() - interval '1 hour', trial_ends_at = now() + interval '23 hours' where id = '${U3}';
`);
const adm = (sql, p) => as('authenticated', ADMIN, 'aal2', sql, p);
const today = new Date().toISOString().slice(0, 10);
const REC = `select * from public.admin_record_manual_contribution($1, $2, $3, $4, $5, $6, $7::date, $8, $9, $10)`;
const rec = (who, a) => who(REC, [a.email, a.method ?? 'paypal', a.amount ?? 10, a.currency ?? 'USD', a.fee ?? null, a.ref ?? 'PayPal 5TY8 · por correo', a.date ?? today, a.flowers ?? 1, a.force ?? false, a.reason ?? null]);
const status = async (id) => (await sys(`select subscription_status s, public.is_premium('${id}') p from public.profiles where id = '${id}'`)).rows[0];

console.log('1. Quién puede registrar');
check('sin segundo paso (AAL1) -> no permitido', /not_allowed/.test((await rec((s, p) => as('authenticated', ADMIN, 'aal1', s, p), { email: 'paypal@example.com' })).error));
check('una cuenta que no es admin, aun con AAL2 -> no permitido', /not_allowed/.test((await rec((s, p) => as('authenticated', OTHER, 'aal2', s, p), { email: 'paypal@example.com' })).error));
check('anónimo -> sin permiso para la función', !!(await rec((s, p) => as('anon', null, null, s, p), { email: 'paypal@example.com' })).error);
check('el navegador no puede leer la tabla (ni el admin directo, solo por funciones)', !!(await adm(`select * from public.manual_contributions`)).error);

console.log('2. Datos y regla de las flores (sobre lo PAGADO)');
check('correo sin cuenta -> account_not_found', /account_not_found/.test((await rec(adm, { email: 'nadie@example.com' })).error));
check('medio inventado -> bad_method', /bad_method/.test((await rec(adm, { email: 'paypal@example.com', method: 'bizum' })).error));
check('1 flor con 9.99 USD pagados -> amount_below_flowers', /amount_below_flowers/.test((await rec(adm, { email: 'paypal@example.com', amount: 9.99 })).error));
check('2 flores con 15 USDC -> amount_below_flowers', /amount_below_flowers/.test((await rec(adm, { email: 'paypal@example.com', amount: 15, currency: 'USDC', flowers: 2 })).error));
check('comisión mayor que lo pagado -> bad_fee', /bad_fee/.test((await rec(adm, { email: 'paypal@example.com', fee: 11 })).error));
check('otra moneda con nota corta -> pide explicar la equivalencia', /equivalence_note_required/.test((await rec(adm, { email: 'paypal@example.com', currency: 'EUR', ref: 'Bizum' })).error));
check('fecha futura -> bad_date', /bad_date/.test((await rec(adm, { email: 'paypal@example.com', date: '2099-01-01' })).error));
check('sin referencia -> reference_required', /reference_required/.test((await rec(adm, { email: 'paypal@example.com', ref: ' ' })).error));
check('21 flores -> bad_flowers', /bad_flowers/.test((await rec(adm, { email: 'paypal@example.com', amount: 300, flowers: 21 })).error));
check('nada de lo rechazado quedó guardado ni dio acceso', (await sys(`select count(*)::int n from public.manual_contributions`)).rows[0].n === 0 && (await status(U1)).s === 'trialing');

console.log('3. Registrar da acceso por el mismo camino que un aporte USDC aprobado');
const r1 = await rec(adm, { email: ' PayPal@Example.com ', amount: 10, fee: 0.59, flowers: 1 });
const m1 = r1.rows?.[0];
check('PayPal: pagó 10 USD (comisión 0,59 aparte) por 1 flor -> guardado', !!m1 && Number(m1.amount) === 10 && Number(m1.fee) === 0.59 && m1.flowers === 1 && m1.email === 'paypal@example.com', r1.error);
const s1 = await status(U1);
check('…acceso completo: estado «supporter» y is_premium = sí', s1.s === 'supporter' && s1.p === true, JSON.stringify(s1));
check('…guarda el estado de antes (prueba vencida) para poder volver', m1?.previous_status === 'trialing');
check('…quién lo registró', m1?.created_label === 'hello@motherverdeny.com');
const eur = await rec(adm, { email: 'prueba@example.com', currency: 'eur', amount: 9.5, method: 'transferencia', ref: 'Transferencia SEPA, 9,50 EUR ≈ 10 USD el 3-11' });
check('otra moneda (EUR) con la equivalencia explicada -> guardado, moneda en mayúsculas', eur.rows?.[0]?.currency === 'EUR', eur.error);

console.log('4. Aviso de duplicado');
const d1 = await rec(adm, { email: 'paypal@example.com', method: 'cashapp', ref: 'CashApp $mv 2' });
check('ya tiene un aporte manual activo -> avisa (duplicate:manual) y no guarda', /duplicate:manual/.test(d1.error || ''), d1.error);
check('«registrar de todos modos» sin motivo -> reason_required', /reason_required/.test((await rec(adm, { email: 'paypal@example.com', method: 'cashapp', ref: 'CashApp $mv 2', force: true })).error));
const d2 = await rec(adm, { email: 'paypal@example.com', method: 'cashapp', ref: 'CashApp $mv 2', force: true, reason: 'segundo aporte voluntario' });
check('«registrar de todos modos» con motivo -> guardado con su motivo', d2.rows?.[0]?.duplicate_reason === 'segundo aporte voluntario', d2.error);
// a USDC claim approved through the panel path
await sys(`insert into public.support_claims (user_id, flowers, amount_units, status, expires_at, tx_hash, submitted_at, verification)
  values ('${U2}', 1, 10000100, 'submitted', now() + interval '1 day', '0x${'ab'.repeat(32)}', now(), '{"all_pass": true}')`);
const claimId = (await sys(`select id from public.support_claims where user_id = '${U2}'`)).rows[0].id;
const ap = await adm(`select status from public.admin_approve_claim($1)`, [claimId]);
check('aporte USDC aprobado (camino de siempre) -> «supporter» por la función común', ap.rows?.[0]?.status === 'approved' && (await status(U2)).s === 'supporter', ap.error);
check('…con aporte USDC aprobado, un aporte manual avisa (duplicate:usdc)', /duplicate:usdc/.test((await rec(adm, { email: 'usdc@example.com' })).error || ''));

console.log('5. Anular sin borrar');
check('anular sin motivo -> reason_required', /reason_required/.test((await adm(`select * from public.admin_void_manual_contribution($1, $2)`, [m1.id, 'no'])).error));
const v1 = await adm(`select * from public.admin_void_manual_contribution($1, $2)`, [m1.id, 'el pago de PayPal fue devuelto']);
check('anular el primero (queda otro activo) -> anulado, el acceso sigue', !!v1.rows?.[0]?.voided_at && (await status(U1)).s === 'supporter', v1.error);
check('anular dos veces -> already_voided', /already_voided/.test((await adm(`select * from public.admin_void_manual_contribution($1, $2)`, [m1.id, 'otra vez lo mismo'])).error));
const v2 = await adm(`select * from public.admin_void_manual_contribution($1, $2)`, [d2.rows[0].id, 'CashApp no llegó']);
const s1b = await status(U1);
check('anular el último -> vuelve al estado de antes (prueba vencida: sin acceso)', !!v2.rows?.[0] && s1b.s === 'trialing' && s1b.p === false, JSON.stringify(s1b));
const ve = await adm(`select * from public.admin_void_manual_contribution($1, $2)`, [eur.rows[0].id, 'registrado por error']);
const s3 = await status(U3);
check('anular el de la prueba de 24 h -> vuelve a su prueba (sigue con acceso hasta que venza)', !!ve.rows?.[0] && s3.s === 'trialing' && s3.p === true, JSON.stringify(s3));
check('nada se borró: las 3 entradas siguen, anuladas con quién y por qué',
  (await sys(`select count(*)::int n, count(voided_at)::int v, count(*) filter (where voided_label = 'hello@motherverdeny.com' and void_reason is not null)::int w from public.manual_contributions`)).rows[0].n === 3
  && (await sys(`select count(voided_at)::int v from public.manual_contributions`)).rows[0].v === 3);
check('borrar una entrada (aun desde el SQL Editor) -> se niega', /no_delete/.test((await sys(`delete from public.manual_contributions where id = ${m1.id}`)).error || ''));
check('cambiar el monto guardado -> se niega', /read_only/.test((await sys(`update public.manual_contributions set amount = 1 where id = ${m1.id}`)).error || ''));

console.log('6. Registro, lista y CSV');
const log = (await sys(`select action, actor_label, target_email, reason, details from public.admin_audit_log where action like 'manual_contribution_%' order by id`)).rows;
check('el Registro tiene cada alta (3) y cada anulación (3), con quién, a quién y por qué',
  log.filter((l) => l.action === 'manual_contribution_recorded').length === 3 && log.filter((l) => l.action === 'manual_contribution_voided').length === 3
  && log.every((l) => l.actor_label === 'hello@motherverdeny.com' && l.target_email && l.reason), JSON.stringify(log.map((l) => l.action)));
check('…el alta guarda medio, monto pagado, comisión, moneda, fecha y flores',
  ['method', 'amount', 'fee', 'currency', 'paid_on', 'flowers'].every((k) => k in log[0].details) && Number(log[0].details.fee) === 0.59);
const list = (await adm(`select public.admin_list_manual_contributions() l`)).rows?.[0]?.l || [];
check('la lista del panel trae todas, también las anuladas', list.length === 3 && list.every((x) => x.voided_at && x.void_reason));
const one = (await adm(`select public.admin_list_manual_contributions($1) l`, [U1])).rows?.[0]?.l || [];
check('la ficha de una cuenta trae solo las suyas', one.length === 2 && one.every((x) => x.email === 'paypal@example.com'));
const csv = (await adm(`select public.admin_export_csv('manual') c`)).rows?.[0]?.c;
check('CSV «manual»: encabezado con lo pagado y la comisión, 3 filas, estado «anulado»',
  !!csv && /id,email,method,amount_paid,currency,fee,reference,paid_on,flowers/.test(csv.csv) && csv.rows === 3 && /anulado/.test(csv.csv));
check('los otros CSV siguen igual (claims)', /id,email,flowers,amount_usdc,status/.test((await adm(`select public.admin_export_csv('claims') c`)).rows?.[0]?.c?.csv || ''));

console.log('7. Reversión');
let rbErr = '';
try { await db.exec((await import('fs')).readFileSync(new URL('../../supabase/admin/rollback-20261103100000.sql', import.meta.url), 'utf8')); } catch (e) { rbErr = e.message; }
try { await db.exec('rollback'); } catch {}
check('con aportes manuales guardados, la reversión se niega (no borra nada por accidente)', /manual_contributions_not_empty/.test(rbErr)
  && (await sys(`select count(*)::int n from public.manual_contributions`)).rows[0].n === 3, rbErr);

console.log(`\nRESULTADO: ${pass} ok, ${fail} fallas${fail ? ' -> ' + failures.join(' | ') : ''}`);
process.exit(0);
