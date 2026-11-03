// Purpose of the contribution + «you already have an account» (migration
// 20261104100000, Bertha's decisions 2026-11-03). Real migrations on PGlite.
// Usage: node tests/sim/purpose-db.mjs
import fs from 'fs';
import { makeDb } from './fakerest.mjs';

let pass = 0, fail = 0; const failures = [];
const check = (n, c, d = '') => { if (c) { pass++; console.log('  ok   ', n); } else { fail++; failures.push(n); console.log('  FALLA', n, d); } };
const db = await makeDb();
async function as(role, uid, sql, params = []) {
  const claims = role ? JSON.stringify({ role, ...(uid ? { sub: uid, aal: 'aal1' } : {}) }) : '';
  await db.exec(`reset role; select set_config('request.jwt.claims', '${claims.replace(/'/g, "''")}', false);${role ? ` set role ${role};` : ''}`);
  try { return { rows: (await db.query(sql, params)).rows }; } catch (e) { return { error: e.message }; } finally { await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`); }
}
const U = 'b0000000-0000-4000-8000-000000000001';
await db.exec(`insert into auth.users (id, email, email_confirmed_at, created_at) values ('${U}', 'Bertha.Limo@gmail.com', now() - interval '3 days', now() - interval '3 days');
update public.profiles set subscription_status = 'trialing', trial_started_at = now() - interval '2 days', trial_ends_at = now() - interval '1 day' where id = '${U}';`);
const me = (sql, p) => as('authenticated', U, sql, p);

let r = await me(`select * from public.create_support_claim(1)`);
check('el navegador ya no puede reservar sin la casilla (función de 1 argumento cerrada)', !!r.error && /permission denied/.test(r.error), JSON.stringify(r));
r = await me(`select * from public.create_support_claim(1, false)`);
check('casilla sin marcar -> «purpose_required», sin reserva', !!r.error && /purpose_required/.test(r.error) && (await as(null, null, `select count(*)::int n from public.support_claims`)).rows[0].n === 0, JSON.stringify(r));
r = await me(`select * from public.create_support_claim(1, null)`);
check('casilla vacía (null) -> «purpose_required»', !!r.error && /purpose_required/.test(r.error));
r = await me(`select id, flowers, purpose_accepted_at from public.create_support_claim(1, true)`);
const first = r.rows?.[0];
check('casilla marcada -> reserva creada con la hora de aceptación', !!first && first.purpose_accepted_at !== null, JSON.stringify(r));
const cols = (await as(null, null, `select column_name from information_schema.columns where table_name = 'support_claims' and column_name like 'purpose%'`)).rows.map((x) => x.column_name);
check('solo se guarda «aceptó» y cuándo (una sola columna nueva, una fecha)', cols.length === 1 && cols[0] === 'purpose_accepted_at', JSON.stringify(cols));
await new Promise((res) => setTimeout(res, 20));
r = await me(`select id, purpose_accepted_at from public.create_support_claim(1, true)`);
check('misma reserva abierta otra vez -> la misma, conserva la primera hora', r.rows?.[0]?.id === first.id && String(r.rows[0].purpose_accepted_at) === String(first.purpose_accepted_at), JSON.stringify(r));
r = await me(`select id, purpose_accepted_at, flowers from public.create_support_claim(2, true)`);
check('cambia a 2 flores -> reserva nueva, también con su aceptación', r.rows?.[0]?.id !== first.id && r.rows[0].purpose_accepted_at !== null && r.rows[0].flowers === 2, JSON.stringify(r));
r = await me(`select id, purpose_accepted_at from public.support_claims where id = ${first.id}`);
check('la persona puede leer su propia aceptación (la app la necesita al recargar)', !r.error && r.rows?.[0]?.purpose_accepted_at !== null, JSON.stringify(r));
r = await as('anon', null, `select * from public.create_support_claim(1, true)`);
check('sin sesión -> no se puede', !!r.error);

// hook: account_exists vs signup_not_allowed
const hook = async (email) => (await as(null, null, `select public.hook_before_user_created($1::jsonb) h`, [JSON.stringify({ user: { email } })])).rows[0].h;
check('mismo correo (otras mayúsculas) -> «account_exists»', (await hook('bertha.limo@gmail.com'))?.error?.message === 'account_exists');
check('variante de Gmail (puntos, +algo, googlemail) -> «account_exists»', (await hook('berthalimo+x@googlemail.com'))?.error?.message === 'account_exists');
check('dominio desechable -> sigue siendo «signup_not_allowed»', (await hook('a@mailinator.com'))?.error?.message === 'signup_not_allowed');
check('correo nuevo -> permitido', JSON.stringify(await hook('nueva.persona@gmail.com')) === '{}');

// rollback: refuses while acceptances exist; works on an empty table
const rb = fs.readFileSync(new URL('../../supabase/admin/rollback-20261104100000.sql', import.meta.url), 'utf8');
let err = ''; try { await db.exec(rb); } catch (e) { err = e.message; }
check('la reversión se niega mientras hay aceptaciones guardadas', /purpose_acceptances_exist/.test(err), err);
const db2 = await makeDb(); err = '';
try { await db2.exec(rb); } catch (e) { err = e.message; }
const back = (await db2.query(`select to_regprocedure('public.create_support_claim(integer, boolean)') f,
  (select count(*)::int from information_schema.columns where table_name = 'support_claims' and column_name = 'purpose_accepted_at') c,
  has_function_privilege('authenticated', 'public.create_support_claim(integer)', 'execute') old_ok`)).rows[0];
check('reversión vacía -> sin la función nueva ni la columna, y el navegador vuelve a la de 1 argumento', !err && back.f === null && back.c === 0 && back.old_ok === true, err || JSON.stringify(back));
console.log(`\nRESULTADO: ${pass} ok, ${fail} fallas${fail ? ' -> ' + failures.join(' | ') : ''}`);
process.exit(0);
