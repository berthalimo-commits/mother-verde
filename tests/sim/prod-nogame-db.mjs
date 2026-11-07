// Production launch without the game: every migration EXCEPT the three game
// ones (20261015100000, 20261029100000, 20261031100000) applies in order on a
// real Postgres (PGlite), the manual contributions work, and the game tables
// do not exist. Usage: node tests/sim/prod-nogame-db.mjs
import fs from 'fs';
import path from 'path';
import { PGlite } from '@electric-sql/pglite';
let pass = 0, fail = 0; const failures = [];
const check = (n, c, d = '') => { if (c) { pass++; console.log('  ok   ', n); } else { fail++; failures.push(n); console.log('  FALLA', n, d); } };
const REPO = new URL('../../supabase/', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, REPO), 'utf8');
const GAME = ['20261015100000_game_progress.sql', '20261029100000_game_setup.sql', '20261031100000_game_plants.sql'];
const db = new PGlite();
await db.exec(fs.readFileSync(new URL('./shim.sql', import.meta.url), 'utf8'));
const files = fs.readdirSync(new URL('migrations/', REPO)).filter((f) => f.endsWith('.sql')).sort().filter((f) => !GAME.includes(f));
let err = '';
for (const f of files) { try { await db.exec(read('migrations/' + f)); } catch (e) { err = f + ': ' + e.message; break; } }
check(`las ${files.length} migraciones sin las 3 del juego se aplican en orden`, !err, err);
for (const p of fs.readdirSync(new URL('seed-blocked-email-domains/', REPO)).sort()) await db.exec(read('seed-blocked-email-domains/' + p));
const t = (await db.query(`select to_regclass('public.game_progress') g, to_regclass('public.manual_contributions') m`)).rows[0];
check('sin tablas del juego; con la tabla de aportes manuales', t.g === null && t.m !== null, JSON.stringify(t));
// a manual contribution from the SQL Editor (no jwt claims = is_sql_editor)
await db.exec(`insert into auth.users (id, email, email_confirmed_at) values ('c0000001-0000-4000-8000-000000000000', 'p@example.org', now())`);
await db.exec(`insert into public.profiles (id) values ('c0000001-0000-4000-8000-000000000000') on conflict do nothing`);
let e2 = '';
try { await db.query(`select public.admin_record_manual_contribution('p@example.org', 'paypal', 10, 'USD', null, 'prueba sin juego', current_date, 1)`); } catch (e) { e2 = e.message; }
const st = (await db.query(`select subscription_status s, public.is_premium(id) p from public.profiles where id = 'c0000001-0000-4000-8000-000000000000'`)).rows[0];
check('aporte manual sin el juego -> acceso completo', !e2 && st.s === 'supporter' && st.p === true, e2 || JSON.stringify(st));
console.log(`\nRESULTADO: ${pass} ok, ${fail} fallas${fail ? ' -> ' + failures.join(' | ') : ''}`);
process.exit(0);
