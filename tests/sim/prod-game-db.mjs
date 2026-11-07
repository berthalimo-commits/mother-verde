// Production launch WITH the game (Bertha, 2026-11-04): the exact order of
// docs/plan-migracion.md on a real Postgres (PGlite). First every platform
// migration in order (the 3 game ones excluded) + the blocked-domain seed,
// then supabase/admin/precheck-game.sql (all rows 'ok'), then the 3 game
// migrations in order. Checks: the game tables/functions exist, the precheck
// would now say 'YA EXISTE' (so nobody pastes them twice), the manual
// contributions still give access, and pasting a game migration a second
// time does not break anything. Usage: node tests/sim/prod-game-db.mjs
import fs from 'fs';
import { PGlite } from '@electric-sql/pglite';
let pass = 0, fail = 0; const failures = [];
const check = (n, c, d = '') => { if (c) { pass++; console.log('  ok   ', n); } else { fail++; failures.push(n); console.log('  FALLA', n, d); } };
const REPO = new URL('../../supabase/', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, REPO), 'utf8');
const GAME = ['20261015100000_game_progress.sql', '20261029100000_game_setup.sql', '20261031100000_game_plants.sql'];
const db = new PGlite();
await db.exec(fs.readFileSync(new URL('./shim.sql', import.meta.url), 'utf8'));
const platform = fs.readdirSync(new URL('migrations/', REPO)).filter((f) => f.endsWith('.sql')).sort().filter((f) => !GAME.includes(f));
let err = '';
for (const f of platform) { try { await db.exec(read('migrations/' + f)); } catch (e) { err = f + ': ' + e.message; break; } }
check(`1) las ${platform.length} migraciones de la plataforma se aplican en orden`, !err, err);
for (const p of fs.readdirSync(new URL('seed-blocked-email-domains/', REPO)).sort()) await db.exec(read('seed-blocked-email-domains/' + p));
const pre = (await db.query(read('admin/precheck-game.sql'))).rows;
check('2) precheck-game.sql: todas las filas «ok»', pre.length > 0 && pre.every((r) => r.resultado === 'ok'), JSON.stringify(pre));
err = '';
for (const f of GAME) { try { await db.exec(read('migrations/' + f)); } catch (e) { err = f + ': ' + e.message; break; } }
check('3) las 3 del juego, en orden, después de la plataforma: se aplican sin error', !err, err);
const t = (await db.query(`select to_regclass('public.game_progress') g, to_regclass('public.manual_contributions') m, to_regprocedure('public.game_save(jsonb)') s`)).rows[0];
check('tabla y función de guardado del juego creadas; aportes manuales siguen ahí', t.g !== null && t.s !== null && t.m !== null, JSON.stringify(t));
const pre2 = (await db.query(read('admin/precheck-game.sql'))).rows;
check('el precheck ahora avisa «YA EXISTE» (para no pegarlas dos veces)', pre2.some((r) => r.resultado === 'YA EXISTE'), JSON.stringify(pre2));
err = '';
for (const f of GAME) { try { await db.exec(read('migrations/' + f)); } catch (e) { err = f + ': ' + e.message; break; } }
check('pegar otra vez una migración del juego no rompe nada', !err, err);
await db.exec(`insert into auth.users (id, email, email_confirmed_at) values ('c0000001-0000-4000-8000-000000000000', 'p@example.org', now())`);
await db.exec(`insert into public.profiles (id) values ('c0000001-0000-4000-8000-000000000000') on conflict do nothing`);
let e2 = '';
try { await db.query(`select public.admin_record_manual_contribution('p@example.org', 'paypal', 10, 'USD', null, 'prueba con juego', current_date, 1)`); } catch (e) { e2 = e.message; }
const st = (await db.query(`select subscription_status s, public.is_premium(id) p, public.has_full_access() h from public.profiles where id = 'c0000001-0000-4000-8000-000000000000'`)).rows[0];
check('aporte manual con el juego instalado -> acceso completo', !e2 && st.s === 'supporter' && st.p === true, e2 || JSON.stringify(st));
console.log(`\nRESULTADO: ${pass} ok, ${fail} fallas${fail ? ' -> ' + failures.join(' | ') : ''}`);
process.exit(0);
