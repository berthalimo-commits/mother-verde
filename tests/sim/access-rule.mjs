// ONE access rule (migration 20261014140000): access_info() is the only place
// the rule lives. Checks that it gives exactly the same answer as the previous
// is_premium() for every combination of status and dates, that the panel and
// the app read it, and that my_access() only tells you about yourself.
import fs from 'fs';
import { makeDb, makeRest, REPO } from './fakerest.mjs';

let pass = 0, fail = 0; const failures = [];
const check = (n, c, d = '') => { if (c) { pass++; console.log('  ok   ', n); } else { fail++; failures.push(n); console.log('  FALLA', n, d); } };
const db = await makeDb();
const rest = makeRest(db);
const q = async (s, p) => (await db.query(s, p)).rows;
const editor = () => db.exec(`reset role; select set_config('request.jwt.claims', '', false)`);
const rpc = async (token, fn, args = {}) => { const r = await rest(`https://fake.supabase.co/rest/v1/rpc/${fn}`, { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: JSON.stringify(args) }); return { status: r.status, body: await r.json().catch(() => null) }; };

// the previous rule, kept under another name only inside this test
const old = fs.readFileSync(REPO + '/migrations/20261010120000_access_support_model.sql', 'utf8').replace(/\r\n/g, '\n');
const st = old.indexOf('create or replace function public.is_premium(uid uuid)');
await editor();
await db.exec(old.slice(st, old.indexOf('\n$$;', st) + 4).replace('public.is_premium(uid uuid)', 'public.old_is_premium(uid uuid)'));

console.log('1. Mismo resultado que la regla anterior, en todas las combinaciones');
const statuses = ['none', 'trialing', 'supporter', 'revoked', 'active', 'canceled', 'past_due', 'blocked'];
const times = [null, "now() - interval '2 days'", "now() + interval '2 days'"];
let n = 0, same = 0; const diffs = [];
for (const s of statuses) for (const trial of times) for (const until of times) for (const exp of times) for (const active of [false, true]) {
  const id = `a${String(++n).padStart(7, '0')}-0000-4000-8000-000000000000`;
  await db.query('insert into auth.users (id, email, email_confirmed_at) values ($1, $2, now())', [id, `r${n}@example.org`]);
  await db.exec(`update profiles set subscription_status = '${s}', trial_ends_at = ${trial ?? 'null'}, trial_started_at = ${trial ? 'now() - interval \'3 days\'' : 'null'},
    access_until = ${until ?? 'null'}, subscription_expires_at = ${exp ?? 'null'}, subscription_active = ${active} where id = '${id}'`);
  const [r] = await q('select public.is_premium($1) a, public.old_is_premium($1) b, public.access_info($1) i', [id]);
  if (r.a === r.b && r.i.full === r.a) same++; else diffs.push({ s, trial, until, exp, active, nuevo: r.a, viejo: r.b });
}
check(`${n} combinaciones de estado y fechas: misma respuesta que antes (nadie gana ni pierde acceso)`, same === n, JSON.stringify(diffs.slice(0, 3)));
const legacy = (await q(`select public.access_info(id) i from profiles where subscription_status = 'active' and subscription_expires_at is null limit 1`))[0].i;
check('cuenta antigua «active» sin fecha de fin: sin acceso (como ya decía el servidor; antes la app decía que sí)', legacy.full === false, JSON.stringify(legacy));

console.log('2. Todos leen la misma regla');
const fnSrc = (name) => q(`select pg_get_functiondef(p.oid) d from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname = $1`, [name]).then((x) => x[0].d);
check('is_premium() lee access_info()', /access_info\(uid\)/.test(await fnSrc('is_premium')));
check('has_full_access() (RLS de Comunidad, Bitácora…) pasa por is_premium()', /is_premium\(auth\.uid\(\)\)/.test(await fnSrc('has_full_access')));
check('el estado del panel (admin_access_state) lee access_info()', /access_info\(p\.id\)/.test(await fnSrc('admin_access_state')));
const app = fs.readFileSync(REPO + '/../src/auth.js', 'utf8') + fs.readFileSync(REPO + '/../public/main.js', 'utf8');
check('la app ya no tiene su propia copia de la regla (sin computeIsPremium ni comparaciones de subscription_status)', !/computeIsPremium|subscription_status ===|p\.access_until &&|trial_ends_at\)\.getTime\(\) > Date\.now/.test(app));
check('la app pide my_access() y compara con el reloj del servidor', /rpc\('my_access'\)/.test(app) && /server_now/.test(app) && /mvNow\(\)/.test(app));

console.log('3. my_access(): solo lo tuyo, con la hora del servidor');
const U = 'a0000001-0000-4000-8000-000000000000';
let r = await rpc(`u:${U}:aal1`, 'my_access');
check('devuelve estado, si hay acceso, hasta cuándo y la hora del servidor', r.status === 200 && 'state' in r.body && 'full' in r.body && 'until' in r.body && !!r.body.server_now, JSON.stringify(r.body));
check('no acepta otra cuenta como parámetro (no existe ese parámetro)', (await rpc(`u:${U}:aal1`, 'my_access', { uid: 'a0000002-0000-4000-8000-000000000000' })).status >= 400);
check('sin sesión -> nada', ((x) => x.status >= 400 || x.body === null)(await rpc('anon', 'my_access')));
check('access_info() (cualquier cuenta) no se puede llamar desde el navegador', (await rpc(`u:${U}:aal1`, 'access_info', { uid: 'a0000002-0000-4000-8000-000000000000' })).status >= 400);

console.log('4. Reversa');
await editor();
await db.exec(fs.readFileSync(REPO + '/admin/rollback-20261014140000.sql', 'utf8'));
const back = await q(`select count(*)::int c from profiles p where public.is_premium(p.id) is distinct from public.old_is_premium(p.id)`);
check('tras la reversa, is_premium() vuelve a ser la de antes (mismos resultados) y no queda access_info', back[0].c === 0
  && (await q(`select count(*)::int c from pg_proc where proname in ('access_info', 'my_access')`))[0].c === 0);

console.log(`\nRESULTADO: ${pass} ok, ${fail} fallas${fail ? ' -> ' + failures.join(' | ') : ''}`);
process.exit(0);
