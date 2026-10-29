// Zona del juego v2, phase 5 — migration 20261029100000_game_setup.
// Real migrations on PGlite: the saved game may carry "setup" (equipment and
// method, each key only with its known values) and the germination stage;
// everything else is refused; old games still save; the rollback puts back
// the previous rule and the migration can be applied again; the paste-ready
// copies in supabase/staging/ are byte-for-byte the same files.
import fs from 'fs';
import { makeDb, REPO } from './fakerest.mjs';
import * as E from '../../src/game/engine.js';

let pass = 0, fail = 0; const failures = [];
const check = (n, c, d = '') => { if (c) { pass++; console.log('  ok   ', n); } else { fail++; failures.push(n); console.log('  FALLA', n, d); } };
const db = await makeDb();
const valid = async (s) => (await db.query('select public.game_state_valid($1::jsonb) v', [JSON.stringify(s)])).rows[0].v === true;
const base = E.start(E.newGame());
const SETUP = { carpa: 'mediana', luz: 'led', sistema: 'maceta', sustrato: 'coco', maceta: 'tela', maceta_tam: 'grande', riego_tipo: 'goteo',
  medir: 'si', semilla: 'feminizada', germinacion: 'papel', trasplante: 'no', plantas: 2 };

console.log('1. La migración (ya aplicada por las migraciones en orden)');
check('una partida de antes (sin setup) se sigue aceptando', await valid(base));
check('setup completo con valores conocidos -> aceptado', await valid({ ...base, setup: SETUP }));
check('la etapa nueva «germinacion» -> aceptada', await valid({ ...base, stage: 'germinacion', setup: { germinacion: 'vaso' } }));
check('cada opción de cada clave se acepta (sistemas, sustratos, macetas, semillas, germinación…)', await (async () => {
  const fn = (await db.query(`select prosrc from pg_proc where proname = 'game_state_valid'`)).rows[0].prosrc;
  const map = JSON.parse(fn.match(/setup_ok constant jsonb := '([\s\S]*?)';/)[1]);
  for (const [k, vals] of Object.entries(map)) for (const v of vals) if (!(await valid({ ...base, setup: { [k]: v } }))) return false;
  return Object.keys(map).length === 11;
})());
let bad = 0;
for (const s of [{ color: 'rojo' }, { sistema: 'tierra_marte' }, { luz: 'LED' }, { carpa: 1 }, { medir: true }, { plantas: 0 }, { plantas: 7 },
  { plantas: 2.5 }, { plantas: '2' }, { semilla: ['regular'] }, { sustrato: 'coco', extra: 'x' }]) if (await valid({ ...base, setup: s })) bad++;
check('claves inventadas, valores desconocidos o de otro tipo, plantas fuera de 1–6 -> rechazado (11 casos)', bad === 0, String(bad));
check('setup que no es un objeto o demasiado grande -> rechazado', !(await valid({ ...base, setup: 'maceta' })) && !(await valid({ ...base, setup: ['x'] }))
  && !(await valid({ ...base, setup: Object.fromEntries(Array.from({ length: 40 }, (_, i) => ['k' + i, 'x'.repeat(20)])) })));
check('una etapa inventada sigue rechazada', !(await valid({ ...base, stage: 'clonacion' })));
check('sub-fase 8b: la etapa «material» y su bloque en el post-cosecha -> aceptados (hasta 1500 bytes)', await valid({ ...base, stage: 'material', post: { secado: {}, curado: {}, material: { c: { separacion: 'agua_hielo' }, l: {} } } })
  && await valid({ ...base, post: { material: { c: { x: 'y'.repeat(1300) } } } }) && !(await valid({ ...base, post: { material: { c: { x: 'y'.repeat(1600) } } } }))
  && !(await valid({ ...base, post: { solventes: {} } })));
check('los problemas nuevos de la fase 6 (pudrición de raíz, quemadura de luz) -> aceptados, como evento y como riesgo', await valid({ ...base, event: { id: 'pudricion_raiz', since: 3 }, risks: { quemadura_luz: 1 } })
  && await valid({ ...base, event: { id: 'quemadura_luz', since: 3 } }) && !(await valid({ ...base, event: { id: 'plaga_inventada', since: 3 } })));
check('las demás reglas no cambiaron (clave desconocida, salud fuera de rango)', !(await valid({ ...base, hack: 1 })) && !(await valid({ ...base, health: 120 })));

console.log('2. Vuelta atrás y otra vez');
await db.exec(fs.readFileSync(REPO + '/admin/rollback-20261029100000.sql', 'utf8'));
check('rollback -> setup y germinacion vuelven a rechazarse; lo de antes sigue aceptado', !(await valid({ ...base, setup: SETUP })) && !(await valid({ ...base, stage: 'germinacion' })) && await valid(base));
await db.exec(fs.readFileSync(REPO + '/migrations/20261029100000_game_setup.sql', 'utf8'));
check('aplicar la migración otra vez -> setup aceptado de nuevo', await valid({ ...base, setup: SETUP }));

console.log('3. Copias para pegar en staging');
const same = (a, b) => fs.readFileSync(REPO + a) .equals(fs.readFileSync(REPO + b));
check('supabase/staging/paso4c-juego-setup.sql = la migración, byte a byte', same('/staging/paso4c-juego-setup.sql', '/migrations/20261029100000_game_setup.sql'));
check('supabase/staging/paso4c-rollback.sql = el rollback, byte a byte', same('/staging/paso4c-rollback.sql', '/admin/rollback-20261029100000.sql'));

console.log(`\nRESULTADO: ${pass} ok, ${fail} fallas${fail ? ' -> ' + failures.join(' | ') : ''}`);
process.exit(0);
