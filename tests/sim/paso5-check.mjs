// Staging step 5 files, tried on PGlite before anyone pastes them:
// the read-only check gives «ok» on every row after the migration, and the
// rollback leaves no trace (and refuses while records exist — manual-db.mjs).
// Usage: node tests/sim/paso5-check.mjs
import fs from 'fs';
import { makeDb } from './fakerest.mjs';
let pass = 0, fail = 0; const failures = [];
const check = (n, c, d = '') => { if (c) { pass++; console.log('  ok   ', n); } else { fail++; failures.push(n); console.log('  FALLA', n, d); } };
const read = (p) => fs.readFileSync(new URL('../../supabase/' + p, import.meta.url), 'utf8');

const db = await makeDb(); // all migrations, 20261103100000 included
const rows = (await db.query(read('staging/paso5-comprobacion.sql'))).rows;
check(`comprobación de solo lectura: ${rows.length} filas, todas «ok»`, rows.length === 9 && rows.every((r) => r.resultado === 'ok'), JSON.stringify(rows.filter((r) => r.resultado !== 'ok')));
const n = (await db.query(`select count(*)::int n from pg_proc where proname like '%manual_contribution%'`)).rows[0].n;
check('la comprobación no cambió nada', n === 4);
let err = '';
try { await db.exec(read('staging/paso5-rollback.sql')); } catch (e) { err = e.message; }
const gone = (await db.query(`select to_regclass('public.manual_contributions') t, to_regprocedure('public.svc_grant_full_access(uuid)') f,
  pg_get_functiondef('public.svc_approve_claim(bigint, uuid, text, text)'::regprocedure) like '%svc_grant_full_access%' uses`)).rows[0];
check('la reversión (vacía) quita la tabla y la función común y devuelve la aprobación USDC a como estaba', !err && gone.t === null && gone.f === null && gone.uses === false, err || JSON.stringify(gone));
let reapplyErr = '';
try { await db.exec(read('staging/paso5-aportes-manuales.sql')); } catch (e) { reapplyErr = e.message; }
check('después de revertir se puede volver a aplicar', !reapplyErr, reapplyErr);
console.log(`\nRESULTADO: ${pass} ok, ${fail} fallas${fail ? ' -> ' + failures.join(' | ') : ''}`);
process.exit(0);
