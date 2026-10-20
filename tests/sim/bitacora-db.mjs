// Bitácora read-only without access, on the server (migration 20261020100000).
// Through the same REST door the app uses: an account with access writes;
// expired, revoked and never-started accounts can still READ their own log
// (read-only screen + PDF) but can no longer insert, edit or delete; nobody
// touches someone else's log; the rollback puts the old rules back.
import fs from 'fs';
import { makeDb, makeRest, REPO } from './fakerest.mjs';

let pass = 0, fail = 0; const failures = [];
const check = (n, c, d = '') => { if (c) { pass++; console.log('  ok   ', n); } else { fail++; failures.push(n); console.log('  FALLA', n, d); } };
const db = await makeDb();
const rest = makeRest(db);
const editor = () => db.exec(`reset role; select set_config('request.jwt.claims', '', false)`);
const T = 'https://fake.supabase.co/rest/v1/bitacora_entries';
const call = async (uid, method, url, body) => {
  const r = await rest(url, { method, headers: { Authorization: `Bearer u:${uid}:aal1`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => null);
  return { status: r.status, rows: Array.isArray(j) ? j : [], body: j };
};
const ins = (uid, nota) => call(uid, 'POST', T, { user_id: uid, entry_date: '2026-10-20', etapa: 'veg', nota });
const count = async (uid) => Number((await db.query('select count(*) n from public.bitacora_entries where user_id = $1', [uid])).rows[0].n);

// accounts: with access (trial running), expired trial, revoked, never started
const ids = { con: 'c1000001-0000-4000-8000-000000000000', vencida: 'c1000002-0000-4000-8000-000000000000', revocada: 'c1000003-0000-4000-8000-000000000000', sinprueba: 'c1000004-0000-4000-8000-000000000000' };
await editor();
for (const [k, id] of Object.entries(ids)) await db.query('insert into auth.users (id, email, email_confirmed_at) values ($1, $2, now())', [id, `bit.${k}@example.org`]);
await db.exec(`update profiles set subscription_status = 'trialing', trial_started_at = now() - interval '2 hours', trial_ends_at = now() + interval '20 hours' where id = '${ids.con}'`);
await db.exec(`update profiles set subscription_status = 'trialing', trial_started_at = now() - interval '3 days', trial_ends_at = now() - interval '2 days' where id = '${ids.vencida}'`);
await db.exec(`update profiles set subscription_status = 'revoked' where id = '${ids.revocada}'`);
// entries written while they still had access (directly, as the SQL editor)
for (const id of Object.values(ids)) await db.query(`insert into public.bitacora_entries (user_id, entry_date, etapa, nota) values ($1, '2026-10-01', 'veg', 'antes')`, [id]);

console.log('1. Con acceso: todo funciona como antes');
let r = await ins(ids.con, 'nueva');
check('con acceso (prueba activa): añadir una entrada', r.status < 300 && await count(ids.con) === 2, JSON.stringify(r.body));
const own = (await db.query('select id from public.bitacora_entries where user_id = $1 order by created_at limit 1', [ids.con])).rows[0].id;
r = await call(ids.con, 'PATCH', `${T}?id=eq.${own}`, { nota: 'editada' });
check('con acceso: editar una entrada', r.status < 300 && r.rows.length === 1);
r = await call(ids.con, 'DELETE', `${T}?id=eq.${own}`);
check('con acceso: borrar una entrada', r.status < 300 && await count(ids.con) === 1);

console.log('2. Sin acceso: solo lectura también en la base');
for (const k of ['vencida', 'revocada', 'sinprueba']) {
  const id = ids[k];
  const read = await call(id, 'GET', `${T}?user_id=eq.${id}&select=*`);
  check(`${k}: puede LEER su bitácora (pantalla de solo lectura y PDF)`, read.status === 200 && read.rows.length === 1);
  r = await ins(id, 'intento');
  check(`${k}: NO puede añadir entradas (lo rechaza el servidor)`, r.status >= 400 && await count(id) === 1, `${r.status} ${JSON.stringify(r.body)}`);
  const eid = read.rows[0]?.id;
  r = await call(id, 'PATCH', `${T}?id=eq.${eid}`, { nota: 'cambiada' });
  const still = (await db.query('select nota from public.bitacora_entries where id = $1', [eid])).rows[0]?.nota;
  check(`${k}: NO puede editar (la nota sigue igual)`, still === 'antes' && r.rows.length === 0, `${r.status} ${still}`);
  r = await call(id, 'DELETE', `${T}?id=eq.${eid}`);
  check(`${k}: NO puede borrar entradas`, await count(id) === 1, `${r.status}`);
}

console.log('3. Nadie toca la bitácora de otra persona');
const other = (await db.query('select id from public.bitacora_entries where user_id = $1 limit 1', [ids.vencida])).rows[0].id;
r = await call(ids.con, 'PATCH', `${T}?id=eq.${other}`, { nota: 'ajena' });
const r2 = await call(ids.con, 'DELETE', `${T}?id=eq.${other}`);
const r3 = await call(ids.con, 'GET', `${T}?user_id=eq.${ids.vencida}&select=*`);
const r4 = await call(ids.con, 'POST', T, { user_id: ids.vencida, entry_date: '2026-10-20', nota: 'ajena' });
check('con acceso tampoco: ni leer, ni editar, ni borrar, ni escribir en la bitácora de otra persona', r3.rows.length === 0 && r.rows.length === 0 && await count(ids.vencida) === 1 && r4.status >= 400);
const anon = await rest(T, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: ids.con, nota: 'x' }) });
check('sin sesión: rechazado', anon.status >= 400);

console.log('4. Al recuperar el acceso vuelve a poder escribir; reversa');
await editor();
await db.exec(`update profiles set subscription_status = 'supporter' where id = '${ids.vencida}'`);
r = await ins(ids.vencida, 'tras el aporte');
check('tras un aporte verificado: vuelve a poder añadir', r.status < 300 && await count(ids.vencida) === 2);
await editor();
await db.exec(fs.readFileSync(REPO + '/admin/rollback-20261020100000.sql', 'utf8'));
r = await ins(ids.revocada, 'tras la reversa');
check('la reversa devuelve las reglas anteriores (sin acceso vuelve a poder escribir)', r.status < 300);
await editor();
await db.exec(fs.readFileSync(REPO + '/migrations/20261020100000_bitacora_read_only_without_access.sql', 'utf8'));
r = await ins(ids.revocada, 'otra vez');
check('…y volver a aplicar la migración la cierra otra vez', r.status >= 400);

console.log(`\nRESULTADO: ${pass} ok, ${fail} fallas${fail ? ' -> ' + failures.join(' | ') : ''}`);
process.exit(0);
