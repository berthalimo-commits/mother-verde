// Zona del juego — memoria en la base (migration 20261015100000_game_progress).
// Real migrations on PGlite + the fake REST layer (RLS as in Supabase).
// Access rule, RLS, server-side validation, size, rate limit, other device,
// lock/unlock without losing anything, account deletion, rollback, precheck.
import fs from 'fs';
import { makeDb, makeRest, REPO } from './fakerest.mjs';

let pass = 0, fail = 0; const failures = [];
const check = (n, c, d = '') => { if (c) { pass++; console.log('  ok   ', n); } else { fail++; failures.push(n); console.log('  FALLA', n, d); } };
const db = await makeDb();
const rest = makeRest(db);
const q = async (s, p) => (await db.query(s, p)).rows;
const sqlEditor = () => db.exec(`reset role; select set_config('request.jwt.claims', '', false)`);
const api = async (token, path, method = 'GET', body) => {
  const r = await rest(`https://fake.supabase.co/rest/v1/${path}`, { method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const tok = (u) => `u:${u}:aal1`;
const save = (u, state) => api(tok(u), 'rpc/game_save', 'POST', { p_state: state });
const err = (r) => JSON.stringify(r.body || '');
let n = 0;
async function person(kind) {
  const id = `d${String(++n).padStart(7, '0')}-0000-4000-8000-000000000000`;
  await sqlEditor();
  await db.query('insert into auth.users (id, email, email_confirmed_at) values ($1, $2, now())', [id, `jugador${n}@example.org`]);
  const set = {
    trial: `subscription_status = 'trialing', trial_ends_at = now() + interval '20 hours'`,
    expired: `subscription_status = 'trialing', trial_ends_at = now() - interval '1 hour'`,
    supporter: `subscription_status = 'supporter'`,
    gift: `subscription_status = 'trialing', trial_ends_at = now() - interval '3 days', access_until = now() + interval '7 days'`,
    revoked: `subscription_status = 'revoked', access_until = now() + interval '7 days'`,
  }[kind];
  await db.query(`update profiles set ${set} where id = $1`, [id]);
  return id;
}
const st = (seq, extra = {}) => ({ v: 1, seq, run: 1, stage: 'vegetativo', week: 4, stageWeek: 2, health: 92,
  risks: { oidio: 1 }, event: null, log: [{ w: 3, d: 'x' }], lessons: ['sistemas'], result: null, last: { riego: 'moderado' }, trich: null, ...extra });

console.log('1. Regla de acceso en el servidor (la misma has_full_access() de la Comunidad)');
const T = await person('trial'), E = await person('expired'), S = await person('supporter'), G = await person('gift'), R = await person('revoked');
check('prueba de 24 h activa -> guarda', (await save(T, st(1))).body?.ok === true);
check('aporte (supporter) -> guarda', (await save(S, st(1))).body?.ok === true);
check('código de regalo (días vigentes) -> guarda', (await save(G, st(1))).body?.ok === true);
let r = await save(E, st(1));
check('prueba vencida sin aporte -> el servidor rechaza (no_access) y no guarda nada', r.status >= 400 && err(r).includes('no_access') && (await q('select count(*)::int c from game_progress where user_id = $1', [E]))[0].c === 0, err(r));
r = await save(R, st(1));
check('acceso retirado (aunque tenga días) -> no_access', err(r).includes('no_access'));
r = await api('anon', 'rpc/game_save', 'POST', { p_state: st(1) });
check('sin sesión -> rechazado', r.status >= 400);

console.log('2. RLS: cada persona solo ve su fila; nadie escribe la tabla directamente');
r = await api(tok(T), 'game_progress?select=user_id,seq,state');
check('ve solo su propia fila', r.status === 200 && r.body.length === 1 && r.body[0].user_id === T, JSON.stringify(r.body));
check('no ve la de otra persona aunque la pida por id', (await api(tok(T), `game_progress?select=user_id&user_id=eq.${S}`)).body?.length === 0);
check('anónimo: 0 filas o error', ((x) => x.status >= 400 || x.body?.length === 0)(await api('anon', 'game_progress?select=user_id')));
check('INSERT directo -> rechazado', (await api(tok(E), 'game_progress', 'POST', { user_id: E, state: st(1), seq: 1 })).status >= 400);
check('UPDATE directo (saltarse la validación) -> rechazado', (await api(tok(T), `game_progress?user_id=eq.${T}`, 'PATCH', { seq: 999999, state: { hack: true } })).status >= 400
  && (await q('select seq from game_progress where user_id = $1', [T]))[0].seq === 1);
check('DELETE directo -> rechazado', (await api(tok(T), `game_progress?user_id=eq.${T}`, 'DELETE')).status >= 400 && (await q('select count(*)::int c from game_progress where user_id = $1', [T]))[0].c === 1);
check('no se leen las columnas internas del límite', (await api(tok(T), 'game_progress?select=saves_in_window')).status >= 400);

console.log('3. Validación del formato y del tamaño en el servidor');
const bad = [
  ['clave desconocida', st(2, { premio: 1 })],
  ['etapa inventada', st(2, { stage: 'cosecha_infinita' })],
  ['salud 101', st(2, { health: 101 })],
  ['salud con decimales', st(2, { health: 50.5 })],
  ['semana como texto', st(2, { week: '4' })],
  ['versión distinta', st(2, { v: 2 })],
  ['riesgo de un evento inexistente', st(2, { risks: { dragones: 1 } })],
  ['evento desconocido', st(2, { event: { id: 'meteorito' } })],
  ['historial de más de 60 semanas', st(2, { log: Array.from({ length: 61 }, (_, i) => ({ w: i })) })],
  ['no es un objeto', [1, 2, 3]],
];
for (const [label, s] of bad) { const x = await save(S, s); check(`${label} -> bad_state`, x.status >= 400 && err(x).includes('bad_state'), err(x)); }
const big = await save(S, st(2, { notes: Array.from({ length: 40 }, () => 'x'.repeat(500)) }));
check('más de 16 KB -> too_large', big.status >= 400 && err(big).includes('too_large'), err(big));
check('…y lo guardado sigue intacto', (await q('select seq from game_progress where user_id = $1', [S]))[0].seq === 1);

console.log('4. Otro dispositivo y no retroceder');
check('dispositivo A avanza (seq 5) -> guardado', (await save(S, st(5, { week: 6 }))).body?.ok === true);
r = await save(S, st(3, { week: 5 }));
check('dispositivo B atrasado (seq 3) -> no pisa nada y recibe el progreso más nuevo', r.body?.ok === false && r.body?.stale === true && r.body?.seq === 5 && r.body?.state?.week === 6, JSON.stringify(r.body));
check('…mismo seq -> tampoco pisa', (await save(S, st(5, { week: 1 }))).body?.stale === true && (await q(`select state->>'week' w from game_progress where user_id = $1`, [S]))[0].w === '6');

console.log('5. Límite de guardados por minuto');
const L = await person('supporter');
let lastOk = 0, limited = null;
for (let i = 1; i <= 21; i++) { const x = await save(L, st(i)); if (x.body?.ok) lastOk = i; else limited = x; }
check('20 por minuto pasan; el 21 -> rate_limited', lastOk === 20 && limited && err(limited).includes('rate_limited'), `${lastOk} ${limited && err(limited)}`);
await sqlEditor();
await db.query(`update game_progress set window_start = now() - interval '61 seconds' where user_id = $1`, [L]);
check('pasado el minuto vuelve a guardar', (await save(L, st(22))).body?.ok === true);

console.log('6. Bloqueo y desbloqueo sin perder nada');
const B = await person('trial');
await save(B, st(7, { stage: 'floracion', week: 9, health: 77 }));
await sqlEditor();
await db.query(`update profiles set trial_ends_at = now() - interval '1 minute' where id = $1`, [B]);
r = await save(B, st(8));
check('vence la prueba: el servidor ya no guarda', err(r).includes('no_access'));
r = await api(tok(B), 'game_progress?select=seq,state');
check('…pero el progreso sigue guardado y lo puede leer', r.body?.[0]?.seq === 7 && r.body[0].state.health === 77, JSON.stringify(r.body));
await sqlEditor();
await db.query(`update profiles set subscription_status = 'supporter' where id = $1`, [B]);
r = await save(B, st(8, { stage: 'floracion', week: 10, health: 77 }));
check('tras el aporte sigue exactamente donde estaba (seq 7 -> 8)', r.body?.ok === true && (await q('select seq from game_progress where user_id = $1', [B]))[0].seq === 8);

console.log('7. Borrar la cuenta borra el progreso');
await sqlEditor();
await db.query('delete from auth.users where id = $1', [B]);
check('la fila del juego desaparece con la cuenta', (await q('select count(*)::int c from game_progress where user_id = $1', [B]))[0].c === 0);

console.log('8. Reversa y precheck propio');
const pre = async () => { await sqlEditor(); return q(fs.readFileSync(REPO + '/admin/precheck-game.sql', 'utf8')); };
let rows = await pre();
check('precheck-game con la migración ya puesta -> «YA EXISTE» (no pegarla dos veces)', rows.filter((x) => x.resultado === 'YA EXISTE').length === 3 && rows.filter((x) => x.resultado === 'FALTA').length === 0, JSON.stringify(rows));
await db.exec(fs.readFileSync(REPO + '/admin/rollback-20261015100000.sql', 'utf8'));
rows = await pre();
check('reversa -> no queda nada del juego y el precheck sale todo «ok»', rows.every((x) => x.resultado === 'ok') && (await q(`select count(*)::int c from information_schema.tables where table_name = 'game_progress'`))[0].c === 0, JSON.stringify(rows));
await db.exec(fs.readFileSync(REPO + '/migrations/20261015100000_game_progress.sql', 'utf8'));
check('volver a pegar la migración funciona (independiente del resto)', (await save(S, st(1))).body?.ok === true);

console.log(`\nRESULTADO: ${pass} ok, ${fail} fallas${fail ? ' -> ' + failures.join(' | ') : ''}`);
process.exit(0);
