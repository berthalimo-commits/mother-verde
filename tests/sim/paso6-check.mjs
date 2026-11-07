// Staging step 6 files, tried on PGlite before anyone pastes them: the copies
// are exact, the read-only check gives «ok» on every row, the empty rollback
// leaves no trace and the migration can be applied again.
// Usage: node tests/sim/paso6-check.mjs
import fs from 'fs';
import { makeDb } from './fakerest.mjs';
let pass = 0, fail = 0; const failures = [];
const check = (n, c, d = '') => { if (c) { pass++; console.log('  ok   ', n); } else { fail++; failures.push(n); console.log('  FALLA', n, d); } };
const read = (p) => fs.readFileSync(new URL('../../supabase/' + p, import.meta.url), 'utf8');
const body = (p) => read(p).split('\n').slice(2).join('\n');
check('paso6-proposito.sql = la migración 20261104100000 (más 2 líneas de encabezado)', body('staging/paso6-proposito.sql') === read('migrations/20261104100000_purpose_and_signup_message.sql'));
check('paso6-rollback.sql = rollback-20261104100000.sql (más 2 líneas de encabezado)', body('staging/paso6-rollback.sql') === read('admin/rollback-20261104100000.sql'));
const db = await makeDb();
const rows = (await db.query(read('staging/paso6-comprobacion.sql'))).rows;
check(`comprobación de solo lectura: ${rows.length} filas, todas «ok»`, rows.length === 7 && rows.every((r) => r.resultado === 'ok'), JSON.stringify(rows.filter((r) => r.resultado !== 'ok')));
let err = '';
try { await db.exec(read('staging/paso6-rollback.sql')); } catch (e) { err = e.message; }
const back = (await db.query(`select to_regprocedure('public.create_support_claim(integer, boolean)') f,
  pg_get_functiondef('public.hook_before_user_created(jsonb)'::regprocedure) like '%account_exists%' hook`)).rows[0];
check('la reversión (sin aceptaciones) quita la función nueva y devuelve la regla de registro a como estaba', !err && back.f === null && back.hook === false, err || JSON.stringify(back));
let e2 = '';
try { await db.exec(read('staging/paso6-proposito.sql')); } catch (e) { e2 = e.message; }
check('después de revertir se puede volver a aplicar', !e2, e2);
console.log(`\nRESULTADO: ${pass} ok, ${fail} fallas${fail ? ' -> ' + failures.join(' | ') : ''}`);
process.exit(0);
