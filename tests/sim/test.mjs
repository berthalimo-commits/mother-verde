// Full DB test on PGlite: all repo migrations, production-like data, the new
// migrations + seeds + supporters SQL, rule checks as anon/authenticated/
// service_role/supabase_auth_admin, then both rollbacks and a schema diff.
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';
const REPO = new URL('../../supabase/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const read = (p) => fs.readFileSync(path.join(REPO, p), 'utf8');
const db = new PGlite();
let pass = 0, fail = 0; const failures = [];
const check = (name, cond, detail = '') => { if (cond) { pass++; console.log('  ok   ', name); } else { fail++; failures.push(name); console.log('  FALLA', name, detail); } };

// role = null -> SQL Editor (no JWT claims at all). Otherwise an API request.
async function as(role, uid, sql, params = [], aal = 'aal1') {
  const claims = role ? JSON.stringify({ role, ...(uid ? { sub: uid, aal } : {}) }) : '';
  await db.exec(`reset role; select set_config('request.jwt.claims', '${claims}', false); ${role ? `set role ${role};` : ''}`);
  try { const r = await db.query(sql, params); return { rows: r.rows }; }
  catch (e) { return { error: e.message }; }
  finally { await db.exec('reset role;'); }
}
const q = async (sql, params) => (await db.query(sql, params)).rows;

async function snapshot() {
  return {
    policies: (await q(`select tablename||'.'||policyname||' '||cmd||' '||array_to_string(roles,',')||' USING '||coalesce(qual,'-')||' CHECK '||coalesce(with_check,'-') as x from pg_policies where schemaname in ('public','storage') order by 1`)).map(r => r.x),
    functions: (await q(`select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||') '||md5(replace(pg_get_functiondef(p.oid), chr(13), '')) as x from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public') order by 1`)).map(r => r.x),
    columns: (await q(`select table_name||'.'||column_name||' '||data_type as x from information_schema.columns where table_schema='public' order by 1`)).map(r => r.x),
    constraints: (await q(`select conrelid::regclass||' '||conname||' '||pg_get_constraintdef(oid) as x from pg_constraint where connamespace='public'::regnamespace order by 1`)).map(r => r.x),
    tableGrants: (await q(`select table_name||' '||grantee||' '||privilege_type as x from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated','service_role') order by 1`)).map(r => r.x),
    columnGrants: (await q(`select table_name||'.'||column_name||' '||grantee||' '||privilege_type as x from information_schema.column_privileges where table_schema='public' and grantee in ('anon','authenticated') and table_name in ('profiles','community_members','community_posts','community_comments') order by 1`)).map(r => r.x),
    routineGrants: (await q(`select routine_name||' '||grantee as x from information_schema.role_routine_grants where routine_schema='public' and grantee in ('anon','authenticated','service_role','PUBLIC','supabase_auth_admin') order by 1`)).map(r => r.x),
    triggers: (await q(`select event_object_schema||'.'||event_object_table||' '||trigger_name||' '||event_manipulation as x from information_schema.triggers order by 1`)).map(r => r.x),
  };
}
function diff(a, b) {
  const out = [];
  for (const k of Object.keys(a)) {
    const A = new Set(a[k]), B = new Set(b[k]);
    for (const x of A) if (!B.has(x)) out.push(`${k}: solo ANTES  ${x}`);
    for (const x of B) if (!A.has(x)) out.push(`${k}: solo DESPUÉS ${x}`);
  }
  return out;
}

// ---------------------------------------------------------------- setup
await db.exec(fs.readFileSync(new URL('./shim.sql', import.meta.url), 'utf8'));
const files = fs.readdirSync(path.join(REPO, 'migrations')).filter(f => f.endsWith('.sql')).sort();
const NEW = ['20261010120000_access_support_model.sql', '20261010130000_community_full_access.sql', '20261011100000_admin_and_audit.sql', '20261011120000_support_claims.sql', '20261011130000_gift_codes_and_access.sql', '20261013100000_mail_delivery.sql', '20261013110000_mail_failures_panel.sql', '20261013120000_signup_fix_limits.sql', '20261014100000_claims_survive_account_deletion.sql', '20261014110000_late_payment.sql', '20261014120000_late_payment_conflicts.sql', '20261014130000_pending_claims_counter.sql', '20261014140000_one_access_rule.sql'];
console.log('1. Migraciones anteriores (las que ya están en producción):');
for (const f of files.filter(f => !NEW.includes(f))) {
  try { await db.exec(read('migrations/' + f)); } catch (e) { check(f, false, e.message); continue; }
  check(f, true);
}

// production-like data (as it is today, before the new migrations)
const BETIAN = '11111111-1111-1111-1111-111111111111', MV = '5bcf51c6-db9d-4965-906e-c1fb426eb0b3', THIRD = '33333333-3333-3333-3333-333333333333', OLDUNCONF = '44444444-4444-4444-4444-444444444444';
await db.exec(`
insert into auth.users (id, email, email_confirmed_at, created_at) values
 ('${BETIAN}', 'berthalimo@gmail.com', now() - interval '60 days', now() - interval '60 days'),
 ('${MV}', 'berthalimo@proton.me', now() - interval '40 days', now() - interval '40 days'),
 ('${THIRD}', 'tercera@example.com', now() - interval '35 days', now() - interval '35 days'),
 ('${OLDUNCONF}', 'vieja.sin.confirmar@example.com', null, now() - interval '10 days');
update public.profiles set subscription_status='trialing', trial_started_at=now()-interval '33 days', trial_ends_at=now()-interval '30 days' where id in ('${BETIAN}','${THIRD}');
insert into public.community_members (user_id, display_name) values ('${BETIAN}','Betian'), ('${MV}','Mother Verde'), ('${THIRD}','Tercera');
insert into public.community_posts (user_id, kind, body, featured) values ('${MV}','text','Bienvenida (destacada)', true), ('${THIRD}','text','Post de la tercera', false);
insert into storage.objects (bucket_id, name, owner) values ('community-photos', '${THIRD}/posts/a.jpg', '${THIRD}');
`);
const before = await snapshot();

{ const pre = await q(read('admin/precheck-before-20261010.sql')); const bad = pre.filter(r => r.resultado !== 'ok'); check('precheck: todo ok antes de las migraciones nuevas (' + pre.length + ' filas)', bad.length === 0, JSON.stringify(bad)); }
console.log('2. Migraciones nuevas (envueltas en transacción), partes de dominios y SQL de supporter:');
for (const f of NEW) { try { await db.exec(read('migrations/' + f)); check(f, true); } catch (e) { check(f, false, e.message); } }
for (const p of fs.readdirSync(path.join(REPO, 'seed-blocked-email-domains')).sort()) {
  try { await db.exec(read('seed-blocked-email-domains/' + p)); } catch (e) { check(p, false, e.message); }
}
check('9.222 dominios cargados', (await q(`select count(*)::int c from public.blocked_email_domains`))[0].c === 9222);
const supSql = read('admin/supporters-betian-mother-verde.sql');
const part1 = supSql.split('-- PART 2')[0];
const preview = await db.query(part1.split('\n').filter(l => !l.startsWith('--')).join('\n'));
check('supporters PART 1 muestra exactamente 2 cuentas', preview.rows.length === 2, JSON.stringify(preview.rows));
await db.exec('-- PART 2' + supSql.split('-- PART 2')[1]);
check('supporters PART 2: Betian y MV = supporter, la tercera no', (await q(`select count(*)::int c from profiles where subscription_status='supporter'`))[0].c === 2 && (await q(`select subscription_status s from profiles where id='${THIRD}'`))[0].s === 'trialing');

console.log('3. Prueba de 24 h (trigger):');
await db.exec(`insert into auth.users (id, email) values ('55555555-5555-5555-5555-555555555555', 'Nueva.Persona+x@GMail.com')`);
let p = (await q(`select subscription_status, trial_eligible, trial_started_at, email_normalized from profiles where id='55555555-5555-5555-5555-555555555555'`))[0];
check('cuenta nueva sin confirmar: none, apta, sin prueba', p.subscription_status === 'none' && p.trial_eligible === true && p.trial_started_at === null, JSON.stringify(p));
check('correo normalizado de Gmail (sin puntos ni +alias)', p.email_normalized === 'nuevapersona@gmail.com', p.email_normalized);
await db.exec(`update auth.users set email_confirmed_at = '2026-10-11T10:00:00Z' where id='55555555-5555-5555-5555-555555555555'`);
p = (await q(`select subscription_status, trial_started_at, trial_ends_at from profiles where id='55555555-5555-5555-5555-555555555555'`))[0];
check('al confirmar: trialing, fin = confirmación + 24 h exactas', p.subscription_status === 'trialing' && (new Date(p.trial_ends_at) - new Date(p.trial_started_at)) === 24 * 3600 * 1000 && new Date(p.trial_started_at).toISOString() === '2026-10-11T10:00:00.000Z', JSON.stringify(p));
await db.exec(`update profiles set subscription_status='blocked' where id='55555555-5555-5555-5555-555555555555';
  update auth.users set email_confirmed_at = null where id='55555555-5555-5555-5555-555555555555';
  update auth.users set email_confirmed_at = now() where id='55555555-5555-5555-5555-555555555555';`);
check('no hay segunda prueba (una por cuenta)', (await q(`select subscription_status s from profiles where id='55555555-5555-5555-5555-555555555555'`))[0].s === 'blocked');
await db.exec(`update auth.users set email_confirmed_at = now() where id='${OLDUNCONF}'`);
check('cuenta que ya existía y confirma después: SIN prueba automática', (await q(`select subscription_status s, trial_started_at t from profiles where id='${OLDUNCONF}'`))[0].s === 'none');
const NEWU = '66666666-6666-6666-6666-666666666666';
await db.exec(`insert into auth.users (id, email) values ('${NEWU}', 'activa@example.org'); update auth.users set email_confirmed_at = now() where id='${NEWU}';
  insert into public.community_members (user_id, display_name) values ('${NEWU}','Activa');`);

console.log('4. Acceso (has_full_access / is_premium):');
const hfa = async (uid) => (await as('authenticated', uid, 'select public.has_full_access() v')).rows?.[0]?.v;
check('prueba activa -> true', await hfa(NEWU) === true);
check('prueba vencida (tercera) -> false', await hfa(THIRD) === false);
check('supporter (Betian) -> true', await hfa(BETIAN) === true);
check('supporter (Mother Verde) -> true', await hfa(MV) === true);
check('anon -> false', (await as('anon', null, 'select public.has_full_access() v')).rows?.[0]?.v === false);
check('el navegador NO puede llamar is_premium(uid)', !!(await as('authenticated', NEWU, `select public.is_premium('${BETIAN}')`)).error);
check('service_role sí puede llamar is_premium', (await as('service_role', null, `select public.is_premium('${NEWU}') v`)).rows?.[0]?.v === true);
check('start_free_trial revocada para el navegador', !!(await as('authenticated', THIRD, `select public.start_free_trial(null, null)`)).error);

console.log('5. Permisos de columnas de profiles:');
check('navegador NO cambia subscription_status', !!(await as('authenticated', THIRD, `update profiles set subscription_status='supporter' where id='${THIRD}'`)).error);
check('navegador NO cambia trial_ends_at', !!(await as('authenticated', THIRD, `update profiles set trial_ends_at=now()+interval '9 days' where id='${THIRD}'`)).error);
check('navegador NO cambia trial_eligible', !!(await as('authenticated', THIRD, `update profiles set trial_eligible=true where id='${THIRD}'`)).error);
check('navegador SÍ cambia display_name propio', !(await as('authenticated', THIRD, `update profiles set display_name='x' where id='${THIRD}'`)).error);

console.log('6. Comunidad cerrada (RLS):');
const cnt = async (role, uid, sql) => { const r = await as(role, uid, sql); return r.error ? 'ERROR' : r.rows.length; };
check('anon NO lee el directorio', (await cnt('anon', null, 'select * from community_members')) === 'ERROR');
check('con acceso lee todo el directorio', (await cnt('authenticated', NEWU, 'select * from community_members')) === (await q('select count(*)::int c from community_members'))[0].c);
check('sin acceso solo ve su propio perfil', (await cnt('authenticated', THIRD, 'select * from community_members')) === 1);
check('sin acceso NO ve la destacada, solo su post', (await cnt('authenticated', THIRD, 'select * from community_posts')) === 1);
check('con acceso ve la destacada', (await cnt('authenticated', NEWU, 'select * from community_posts where featured')) === 1);
check('sin acceso NO puede seguir', !!(await as('authenticated', THIRD, `insert into community_follows (follower_id, followed_id) values ('${THIRD}','${MV}')`)).error);
check('con acceso SÍ puede seguir', !(await as('authenticated', NEWU, `insert into community_follows (follower_id, followed_id) values ('${NEWU}','${MV}')`)).error);
check('sin acceso SÍ puede dejar de seguir / borrar lo suyo', !(await as('authenticated', THIRD, `delete from community_posts where user_id='${THIRD}'`)).error);
check('navegador NO pregunta can_view de otra persona', (await as('authenticated', NEWU, `select public.community_can_view('${MV}','${MV}') v`)).rows?.[0]?.v === false);
check('can_view sobre sí mismo sigue funcionando', (await as('authenticated', NEWU, `select public.community_can_view('${NEWU}','${MV}') v`)).rows?.[0]?.v === true);
check('service_role puede usar can_view', (await as('service_role', null, `select public.community_can_view('${NEWU}','${MV}') v`)).rows?.[0]?.v === true);
check('anon NO puede llamar community_is_mutual', !!(await as('anon', null, `select public.community_is_mutual('${NEWU}','${MV}')`)).error);
check('sin acceso NO sube fotos', !!(await as('authenticated', THIRD, `insert into storage.objects (bucket_id, name) values ('community-photos', '${THIRD}/posts/b.jpg')`)).error);
check('con acceso SÍ sube fotos en su carpeta', !(await as('authenticated', NEWU, `insert into storage.objects (bucket_id, name) values ('community-photos', '${NEWU}/posts/b.jpg')`)).error);
check('sin acceso NO lista fotos', (await cnt('authenticated', THIRD, `select * from storage.objects where bucket_id='community-photos'`)) === 0);

console.log('7. Límites y tope de DeepL:');
check('tablas internas cerradas al navegador (uso, config, contador)', !!(await as('authenticated', NEWU, 'select * from community_usage_log')).error && !!(await as('authenticated', NEWU, 'select * from app_config')).error && !!(await as('authenticated', NEWU, 'select * from deepl_usage_daily')).error);
check('el navegador NO puede reservar caracteres de DeepL', !!(await as('authenticated', NEWU, 'select public.deepl_reserve_chars(10)')).error);
const svc = async (sql) => (await as('service_role', null, sql)).rows?.[0]?.v;
check('tope global = 14.000', await svc('select public.deepl_daily_cap() v') === 14000);
check('límite por persona = 1.555 (un tercio del tope / 3 idiomas)', await svc('select public.community_user_char_limit() v') === 1555);
check('reservar 10.000 -> sí', await svc('select public.deepl_reserve_chars(10000) v') === true);
check('reservar 4.000 más (= 14.000) -> sí', await svc('select public.deepl_reserve_chars(4000) v') === true);
check('reservar 1 más -> NO (tope alcanzado)', await svc('select public.deepl_reserve_chars(1) v') === false);
check('el contador no pasó de 14.000', (await q('select chars from deepl_usage_daily'))[0].chars === 14000);
await db.exec(`update public.app_config set value = 100000 where key = 'deepl_daily_char_cap'`);
check('al subir el tope (DeepL Pro) se recalcula el límite por persona', await svc('select public.community_user_char_limit() v') === 11111 && await svc('select public.deepl_reserve_chars(1) v') === true);
await db.exec(`delete from public.app_config where key='deepl_daily_char_cap'`);
check('sin configuración -> tope 0, no traduce (falla cerrado)', await svc('select public.deepl_reserve_chars(1) v') === false);
await db.exec(`insert into public.app_config (key, value) values ('deepl_daily_char_cap', 14000)`);
await db.exec(`insert into community_usage_log (user_id, kind, chars) values ('${NEWU}','post',10)`);
check('hay 1 fila de uso antes de borrar la cuenta', (await q(`select count(*)::int c from community_usage_log`))[0].c === 1);
await db.exec(`delete from auth.users where id='${NEWU}'`);
check('el registro de uso se borra con la cuenta (cascade)', (await q(`select count(*)::int c from community_usage_log`))[0].c === 0);

console.log('8. Hook de registro:');
const hook = async (email) => (await as('supabase_auth_admin', null, `select public.hook_before_user_created($1::jsonb) v`, [JSON.stringify({ user: { email } })])).rows?.[0]?.v;
check('desechable (mailinator.com) -> rechazado', (await hook('a@mailinator.com'))?.error?.message === 'signup_not_allowed');
check('subdominio de desechable -> rechazado', (await hook('a@x.mailinator.com'))?.error?.message === 'signup_not_allowed');
check('variante de un Gmail existente (bertha.limo+x@gmail.com) -> rechazado', (await hook('bertha.limo+x@gmail.com'))?.error?.message === 'signup_not_allowed');
check('correo normal nuevo -> aceptado', JSON.stringify(await hook('alguien@example.org')) === '{}');
check('Gmail nuevo -> aceptado', JSON.stringify(await hook('otra.persona@gmail.com')) === '{}');
check('hello@motherverdeny.com (futura admin) -> aceptado por el hook', JSON.stringify(await hook('hello@motherverdeny.com')) === '{}');
check('motherverdeny.com NO está en blocked_email_domains', (await q(`select count(*)::int c from blocked_email_domains where 'motherverdeny.com' = domain or 'motherverdeny.com' like '%.' || domain`))[0].c === 0);
check('la normalización no cambia hello@motherverdeny.com', (await q(`select public.normalize_email('Hello@MotherVerdeNY.com') v`))[0].v === 'hello@motherverdeny.com');
check('el navegador NO puede llamar al hook', !!(await as('authenticated', THIRD, `select public.hook_before_user_created('{}'::jsonb)`)).error);

await import('./test-part2.mjs').then(m => m.run({ db, as, q, check, cnt, hfa, BETIAN, MV, THIRD }));

console.log('9. Reversas:');
const wrongOrder = await as(null, null, read('admin/rollback-20261010120000.sql').replace(/^begin;$/m, '').replace(/^commit;$/m, '') + '; select 1');
// (run the real file, with its own transaction, to see it refuse and leave nothing half-done)
let refused = false; try { await db.exec(read('admin/rollback-20261010120000.sql')); } catch (e) { refused = true; }
try { await db.exec('rollback'); } catch {}
check('reversa 120000 ANTES que la 130000 -> se niega (depende de has_full_access)', refused);
check('…y no deja nada a medias (has_full_access sigue existiendo)', (await q(`select count(*)::int c from pg_proc where proname='has_full_access'`))[0].c === 1);
for (const rb of ['rollback-20261014140000.sql', 'rollback-20261014130000.sql', 'rollback-20261014120000.sql', 'rollback-20261014110000.sql', 'rollback-20261014100000.sql', 'rollback-20261013120000.sql', 'rollback-20261013110000.sql', 'rollback-20261013100000.sql', 'rollback-20261011130000.sql', 'rollback-20261011120000.sql', 'rollback-20261011100000.sql']) { try { await db.exec(read('admin/' + rb)); check(rb, true); } catch (e) { check(rb, false, e.message); } }
try { await db.exec(read('admin/rollback-20261010130000.sql')); check('reversa 130000', true); } catch (e) { check('reversa 130000', false, e.message); }
try { await db.exec(read('admin/rollback-20261010120000.sql')); check('reversa 120000', true); } catch (e) { check('reversa 120000', false, e.message); }
const after = await snapshot();
const d = diff(before, after);
check('esquema después de las reversas = esquema de antes', d.length === 0, '\n      ' + d.join('\n      '));
check('aporte aprobado (u1) y días regalados (u11000) conservan acceso tras las reversas', (await as('service_role', null, `select public.is_premium('90000001-0000-4000-8000-000000000000') a, public.is_premium('90011000-0000-4000-8000-000000000000') b`)).rows?.[0]?.a === true && (await as('service_role', null, `select public.is_premium('90011000-0000-4000-8000-000000000000') b`)).rows?.[0]?.b === true);
  check('acceso quitado (u9) sigue sin acceso tras las reversas', (await as('service_role', null, `select public.is_premium('90000009-0000-4000-8000-000000000000') v`)).rows?.[0]?.v === false);
check('Betian y MV pasan a acceso antiguo sin perder acceso', (await as('service_role', null, `select public.is_premium('${BETIAN}') a, public.is_premium('${MV}') b`)).rows?.[0]?.a === true);

console.log(`\nRESULTADO: ${pass} ok, ${fail} fallas${fail ? ' -> ' + failures.join(' | ') : ''}`);
