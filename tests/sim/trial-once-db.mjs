// The 24-hour trial, once per person (migration 20261105100000, independent
// review point 4). On a real Postgres (PGlite) with every migration applied:
// alias normalization; a deleted account leaves ONLY a fingerprint (no id, no
// e-mail in clear); the same person (or an alias) gets no second trial, live
// or after deleting; other people still get theirs; nothing is readable from
// the browser; the read-only check says ok; the rollback refuses while
// fingerprints exist and, once emptied, restores the previous behaviour.
// Usage: node tests/sim/trial-once-db.mjs
import fs from 'fs';
import { makeDb, makeRest, REPO } from './fakerest.mjs';
let pass = 0, fail = 0; const failures = [];
const check = (n, c, d = '') => { if (c) { pass++; console.log('  ok   ', n); } else { fail++; failures.push(n); console.log('  FALLA', n, d); } };
const db = await makeDb();
const rest = makeRest(db);
const q = async (s, p) => (await db.query(s, p)).rows;
let n = 0;
const signup = async (email) => {
  const id = `d${String(++n).padStart(7, '0')}-0000-4000-8000-000000000000`;
  await db.query('insert into auth.users (id, email) values ($1, $2)', [id, email]);
  await db.query('update auth.users set email_confirmed_at = now() where id = $1', [id]);
  const [p] = await q('select subscription_status s, trial_started_at is not null t from profiles where id = $1', [id]);
  return { id, trial: p.s === 'trialing' && p.t };
};
const del = (id) => db.query('delete from auth.users where id = $1', [id]);

console.log('1. Normalización de alias');
const K = { 'A.Na+x@GoogleMail.com': 'ana@gmail.com', 'ana+promo@outlook.com': 'ana@outlook.com', 'ana+1@hotmail.es': 'ana@hotmail.es', 'ana+x@live.co.uk': 'ana@live.co.uk', 'ana+x@msn.com': 'ana@msn.com',
  'ana+x@icloud.com': 'ana@icloud.com', 'ana+x@me.com': 'ana@icloud.com', 'ana@mac.com': 'ana@icloud.com', 'ana+x@proton.me': 'ana@proton.me', 'ana+x@protonmail.com': 'ana@proton.me', 'ana@pm.me': 'ana@proton.me',
  ' Ana.Maria@Example.org ': 'ana.maria@example.org', 'ana+x@example.org': 'ana+x@example.org', 'a.n.a@outlook.com': 'a.n.a@outlook.com' };
const got = {}; for (const k of Object.keys(K)) got[k] = (await q('select public.trial_email_key($1) k', [k]))[0].k;
check('Gmail (puntos y +), Outlook/Hotmail/Live/MSN, iCloud/me/mac y Proton/pm.me (+): misma persona; otros dominios sin tocar', Object.keys(K).every((k) => got[k] === K[k]), JSON.stringify(Object.keys(K).filter((k) => got[k] !== K[k]).map((k) => [k, got[k]])));

console.log('2. Una vez por persona');
const a = await signup('ana.perez@gmail.com');
check('primera cuenta: prueba de 24 h', a.trial);
check('alias de una cuenta viva que ya la usó (anaperez+2@gmail.com): sin prueba', !(await signup('anaperez+2@gmail.com')).trial);
await del(a.id);
const h = await q('select * from trial_email_hashes');
check('al borrar la cuenta queda SOLO una huella de 64 caracteres (sin id ni correo)', h.length === 1 && /^[0-9a-f]{64}$/.test(h[0].hash) && Object.keys(h[0]).sort().join() === 'created_at,hash' && !JSON.stringify(h).includes('ana'), JSON.stringify(h));
check('la huella no es el SHA-256 simple del correo (lleva pimienta secreta)', h[0].hash !== (await q(`select encode(sha256(convert_to('anaperez@gmail.com','UTF8')),'hex') x`))[0].x);
check('vuelve a registrarse con el mismo correo tras borrar: sin prueba', !(await signup('ana.perez@gmail.com')).trial);
check('…ni con un alias (Ana.Perez+nuevo@googlemail.com): sin prueba', !(await signup('Ana.Perez+nuevo@googlemail.com')).trial);
const o = await signup('luis+a@outlook.com'); await del(o.id);
check('Outlook: borra luis+a@ y vuelve como luis+b@ -> sin prueba', !(await signup('luis+b@outlook.com')).trial);
const i = await signup('eva@me.com'); await del(i.id);
check('iCloud: borra eva@me.com y vuelve como eva+x@icloud.com -> sin prueba', !(await signup('eva+x@icloud.com')).trial);
const p = await signup('teo+1@protonmail.com'); await del(p.id);
check('Proton: borra teo+1@protonmail.com y vuelve como teo@proton.me -> sin prueba', !(await signup('teo@proton.me')).trial);
check('otra persona: prueba normal (y juan+x / juan+y en un dominio sin alias: dos personas)', (await signup('otra.persona@gmail.com')).trial && (await signup('juan+x@example.org')).trial && (await signup('juan+y@example.org')).trial);
const nt = await signup('nunca@example.org');
await db.query(`update profiles set subscription_status = 'none', trial_started_at = null, trial_ends_at = null where id = $1`, [nt.id]); await del(nt.id);
check('cuenta borrada que nunca usó la prueba: no deja huella; al volver, prueba normal', (await q('select count(*)::int c from trial_email_hashes'))[0].c === 4 && (await signup('nunca@example.org')).trial);
const sinPrueba = (await q(`select public.access_info(p.id) i from profiles p join auth.users u on u.id = p.id where u.email = 'ana.perez@gmail.com'`))[0].i;
check('quien no recibe prueba ve «sin acceso» (no_trial) con la opción de aporte', sinPrueba.state === 'no_trial' && sinPrueba.full === false, JSON.stringify(sinPrueba));

console.log('3. Nada visible desde el navegador');
const uid = (await q(`select id from auth.users where email = 'otra.persona@gmail.com'`))[0].id;
const tok = 'u:' + uid + ':aal1';
const call = async (path, method = 'GET', body) => { const r = await rest('https://fake.supabase.co/rest/v1/' + path, { method, headers: { Authorization: 'Bearer ' + tok }, body }); const t = await r.text(); return { s: r.status, t }; };
const r1 = await call('trial_email_hashes?select=*'), r2 = await call('trial_pepper?select=*');
const r3 = await call('rpc/trial_email_hash', 'POST', JSON.stringify({ p_email: 'x@example.org' })), r4 = await call('rpc/trial_email_used', 'POST', JSON.stringify({ p_uid: uid, p_email: 'x@example.org' }));
const blocked = (r) => r.s >= 400 || r.t === '[]';
check('huellas, pimienta y funciones internas: bloqueadas para una cuenta normal', [r1, r2, r3, r4].every(blocked), JSON.stringify([r1, r2, r3, r4].map((r) => [r.s, r.t.slice(0, 80)])));
await db.exec('reset role');

console.log('4. Comprobación y reversión');
const chk = await q(fs.readFileSync(REPO + '/admin/check-20261105100000.sql', 'utf8'));
check('check-20261105100000.sql: todas las filas «ok»', chk.length === 6 && chk.every((r) => r.resultado === 'ok'), JSON.stringify(chk));
const rb = fs.readFileSync(REPO + '/admin/rollback-20261105100000.sql', 'utf8');
let e = ''; try { await db.exec(rb); } catch (x) { e = x.message; } await db.exec('rollback').catch(() => {});
check('la reversión se niega mientras haya huellas (no se pierden sin querer)', /trial_fingerprints_exist/.test(e) && (await q(`select to_regclass('public.trial_email_hashes') t`))[0].t !== null, e);
await db.exec('delete from public.trial_email_hashes');
e = ''; try { await db.exec(rb); } catch (x) { e = x.message; }
check('vaciadas las huellas, la reversión se aplica y deja la regla anterior', !e && (await q(`select to_regclass('public.trial_email_hashes') t`))[0].t === null && !(await q(`select pg_get_functiondef('public.start_trial_on_email_confirmed()'::regprocedure) d`))[0].d.includes('trial_email_used'), e);
check('…después de revertir, el registro vuelve a dar prueba', (await signup('ana.perez+z@gmail.com')).trial);
const mig = fs.readFileSync(REPO + '/migrations/20261105100000_trial_once_per_person.sql', 'utf8');
e = ''; try { await db.exec(mig); await db.exec(mig); } catch (x) { e = x.message; }
check('la migración se puede volver a aplicar (y pegar dos veces) sin error; una sola pimienta', !e && (await q('select count(*)::int c from trial_pepper'))[0].c === 1, e);
console.log(`\nRESULTADO: ${pass} ok, ${fail} fallas${fail ? ' -> ' + failures.join(' | ') : ''}`);
process.exit(0);
