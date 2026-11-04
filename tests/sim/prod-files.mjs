// supabase/produccion/ (independent review, point 5): the launch-day SQL files,
// applied IN FILE ORDER on a real Postgres (PGlite) that looks like production
// today (every migration before 20261010 + Bertha's two accounts). Checks:
// the folder is exactly what tools/build-produccion.mjs generates (nobody
// edited it by hand, no migration forgotten); the read-only files say «ok» at
// their moment; every change file applies; the final read-only-checks.sql
// says «ok» on every row (platform, manual contributions, purpose, trial once
// per person, game) and «FALTA» on today's production (it really checks).
// Usage: node tests/sim/prod-files.mjs
import fs from 'fs';
import path from 'path';
import { PGlite } from '@electric-sql/pglite';
let pass = 0, fail = 0; const failures = [];
const check = (n, c, d = '') => { if (c) { pass++; console.log('  ok   ', n); } else { fail++; failures.push(n); console.log('  FALLA', n, d); } };
const APP = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const DIR = path.join(APP, 'supabase/produccion');
const { build, ORDER } = await import('file:///' + path.join(APP, 'tools/build-produccion.mjs'));

console.log('1. La carpeta está al día');
const want = build(), have = fs.readdirSync(DIR).sort();
check('supabase/produccion/ = lo que genera tools/build-produccion.mjs (sin cambios a mano, sin archivos de más)', have.join() === Object.keys(want).sort().join() && have.every((f) => fs.readFileSync(path.join(DIR, f), 'utf8') === want[f]), 'vuelve a ejecutar: node tools/build-produccion.mjs');
const migs = fs.readdirSync(path.join(APP, 'supabase/migrations')).filter((f) => f >= '20261010' && f.endsWith('.sql'));
const listed = ORDER.map(([s]) => path.basename(s));
check(`ninguna migración olvidada: las ${migs.length} desde 20261010 están en la lista, una vez cada una`, migs.every((m) => listed.filter((x) => x === m).length === 1), migs.filter((m) => !listed.includes(m)).join(', '));
check('las 3 del juego van después del precheck del juego, en orden', listed.indexOf('precheck-game.sql') < listed.indexOf('20261015100000_game_progress.sql') && listed.indexOf('20261015100000_game_progress.sql') < listed.indexOf('20261029100000_game_setup.sql') && listed.indexOf('20261029100000_game_setup.sql') < listed.indexOf('20261031100000_game_plants.sql'));

console.log('2. Aplicados en orden sobre una copia de cómo está producción hoy');
const db = new PGlite();
await db.exec(fs.readFileSync(new URL('./shim.sql', import.meta.url), 'utf8'));
for (const f of fs.readdirSync(path.join(APP, 'supabase/migrations')).filter((f) => f < '20261010' && f.endsWith('.sql')).sort()) await db.exec(fs.readFileSync(path.join(APP, 'supabase/migrations', f), 'utf8'));
// Bertha's two accounts, as in production (supporters-betian file)
await db.exec(`insert into auth.users (id, email, email_confirmed_at) values ('a1000000-0000-4000-8000-000000000001', 'berthalimo@gmail.com', now()), ('5bcf51c6-db9d-4965-906e-c1fb426eb0b3', 'berthalimo@proton.me', now())`);
await db.exec(`insert into public.community_members (user_id, display_name) values ('a1000000-0000-4000-8000-000000000001', 'Betian') on conflict (user_id) do update set display_name = 'Betian'`).catch(async () => { await db.exec(`update public.community_members set display_name = 'Betian' where user_id = 'a1000000-0000-4000-8000-000000000001'`); });
const finalName = have.find((f) => f.endsWith('read-only-checks.sql'));
const finalSql = fs.readFileSync(path.join(DIR, finalName), 'utf8');
let before = null, e0 = '';
try { before = (await db.query(finalSql)).rows; } catch (e) { e0 = e.message; }
check('la comprobación final, sobre producción de hoy: no da error y marca FALTA (de verdad comprueba)', !e0 && before.some((r) => r.resultado === 'FALTA'), e0 || JSON.stringify(before?.filter((r) => r.resultado === 'ok').map((r) => r.orden)));
const bad = [];
for (const f of have.filter((f) => f.endsWith('.sql') && f !== finalName)) {
  const sql = fs.readFileSync(path.join(DIR, f), 'utf8');
  try {
    if (/SOLO LECTURA/.test(sql.split('\n')[1])) {
      const res = await db.query(sql);
      const rows = Array.isArray(res) ? res.flatMap((r) => r.rows) : res.rows;
      if (!rows.length || rows.some((r) => r.resultado !== 'ok')) bad.push(`${f}: ${JSON.stringify(rows.filter((r) => r.resultado !== 'ok')).slice(0, 200)}`);
    } else await db.exec(sql);
  } catch (e) { bad.push(`${f}: ${e.message}`); }
}
check(`los ${have.length - 2} archivos, en orden: los de lectura dicen «ok» y los de cambio se aplican sin error`, bad.length === 0, '\n      ' + bad.join('\n      '));
const fin = (await db.query(finalSql)).rows;
check(`${finalName}: las ${fin.length} filas dicen «ok» (plataforma, aportes manuales, propósito, prueba una vez, juego, RLS, tus cuentas)`, fin.length === 23 && fin.every((r) => r.resultado === 'ok'), JSON.stringify(fin.filter((r) => r.resultado !== 'ok')));
const acc = (await db.query(`select u.email, p.subscription_status s from auth.users u join public.profiles p on p.id = u.id order by 1`)).rows;
check('tus dos cuentas quedan con acceso completo (supporter)', acc.length === 2 && acc.every((r) => r.s === 'supporter'), JSON.stringify(acc));
check('cada archivo de cambio es una sola transacción (begin … commit)', have.filter((f) => /^\d\d-\d{14}_/.test(f) || /dominios-bloqueados/.test(f)).every((f) => { const s = fs.readFileSync(path.join(DIR, f), 'utf8'); return /^begin;$/m.test(s) && /^commit;$/m.test(s); }));
console.log(`\nRESULTADO: ${pass} ok, ${fail} fallas${fail ? ' -> ' + failures.join(' | ') : ''}`);
process.exit(0);
