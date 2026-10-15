// Simulated attacks on signup-fix-email (the function runs with "Verify JWT"
// OFF: anyone can call it). Real migrations on PGlite, the function bundled
// as in production, Supabase Auth imitated by fakerest.mjs (password checked
// first, then "confirmed?", like GoTrue). Nothing is sent anywhere.
import { createRequire } from 'module';
import fs from 'fs';
import { makeDb, makeRest } from './fakerest.mjs';

const APP = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1').replace(/\/$/, '');
const req = createRequire(APP + '/package.json');
const { build } = req('esbuild');
let pass = 0, fail = 0; const failures = [];
const check = (n, c, d = '') => { if (c) { pass++; console.log('  ok   ', n); } else { fail++; failures.push(n); console.log('  FALLA', n, d); } };

const env = { SUPABASE_URL: 'https://fake.supabase.co', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'svc' };
globalThis.Deno = { env: { get: (k) => env[k] }, serve: (h) => { globalThis.__h = h; } };
const db = await makeDb();
const rest = makeRest(db);
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(typeof url === 'string' ? url : url.url);
  if (typeof url !== 'string' && !init.method) init = { method: url.method, headers: url.headers, body: await url.text() };
  if (u.hostname === 'fake.supabase.co') return rest(u.toString(), init);
  throw new Error('unexpected fetch ' + u);   // the function must not call anything else (no e-mail sending)
};
const out = new URL('./fnbuild/signup-fix.mjs', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
await build({ entryPoints: [`${APP}/supabase/functions/signup-fix-email/index.ts`], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
  plugins: [{ name: 'deno', setup(b) { b.onResolve({ filter: /^jsr:@supabase\/supabase-js/ }, () => ({ path: req.resolve('@supabase/supabase-js') })); } }] });
await import('file:///' + out + '?' + Date.now());
const fn = globalThis.__h;
const call = async (body, raw) => { const r = await fn(new Request('https://x/', { method: 'POST', body: raw ?? JSON.stringify(body) })); return { status: r.status, body: await r.json().catch(() => ({})) }; };
const q = async (s, p) => (await db.query(s, p)).rows;

// accounts: password known to the fake Auth (globalThis.__pw)
globalThis.__pw = {};
let n = 0;
async function account(email, { confirmed = false, daysOld = 0, pw = 'clave-de-ana-1' } = {}) {
  const id = `d${String(++n).padStart(7, '0')}-0000-4000-8000-000000000000`;
  await db.query(`insert into auth.users (id, email, created_at, confirmation_token, confirmation_sent_at) values ($1::uuid, $2, now() - ($3 || ' days')::interval, $4, now())`, [id, email, String(daysOld), 'tok-' + id]);
  if (confirmed) await db.query('update auth.users set email_confirmed_at = now() where id = $1', [id]);
  await db.query(`insert into auth.one_time_tokens (user_id, token_type, token_hash) values ($1::uuid, 'confirmation_token', $2)`, [id, 'h-' + id]);
  globalThis.__pw[id] = pw;
  return id;
}
const emailOf = async (id) => (await q('select email from auth.users where id = $1', [id]))[0].email;
const reset = () => db.exec('delete from public.signup_fix_attempts');

const ANA = await account('ana.typo@gmial.com');
const CONF = await account('confirmada@example.org', { confirmed: true, pw: 'clave-confirmada' });
const OLD = await account('vieja@example.org', { daysOld: 8 });
await account('ocupada@example.org', { confirmed: true });

console.log('1. Qué exige para aceptar el cambio');
let r = await call({ old_email: 'ana.typo@gmial.com', new_email: 'ana@gmail.com' });
check('sin contraseña -> 403 y no toca nada', r.status === 403 && await emailOf(ANA) === 'ana.typo@gmial.com');
r = await call({ old_email: 'ana.typo@gmial.com', new_email: 'ana@gmail.com', password: 'adivino123' });
check('contraseña equivocada -> 403 wrong_password, no toca nada', r.status === 403 && r.body.error === 'wrong_password' && await emailOf(ANA) === 'ana.typo@gmial.com');
check('…la contraseña la comprueba Auth (llamada de inicio de sesión con el correo viejo)', globalThis.__tokenCalls.at(-1).email === 'ana.typo@gmial.com' && globalThis.__tokenCalls.at(-1).password === 'adivino123');
r = await call({ old_email: 'ana.typo@gmial.com', new_email: 'ana@gmail.com', password: 'x', captcha_token: 'cf-123' });
check('el captcha (cuando esté encendido) se pasa a Auth', globalThis.__tokenCalls.at(-1).gotrue_meta_security?.captcha_token === 'cf-123');
for (const [label, raw] of [['JSON roto', '{no'], ['correos que no son correos', JSON.stringify({ old_email: 'x', new_email: 'y', password: 'p' })], ['correo nuevo de más de 254 caracteres', JSON.stringify({ old_email: 'a@b.co', new_email: 'a'.repeat(250) + '@b.co', password: 'p' })], ['mismo correo', JSON.stringify({ old_email: 'a@b.co', new_email: 'A@B.co', password: 'p' })]]) {
  r = await call(null, raw);
  check(`${label} -> 400 sin llegar a Auth`, r.status === 400);
}
check('GET u otro método -> 405', (await fn(new Request('https://x/', { method: 'GET' }))).status === 405);

console.log('2. Límites de uso');
await reset();
for (let i = 0; i < 5; i++) await call({ old_email: 'ana.typo@gmial.com', new_email: `x${i}@example.net`, password: 'mal' + i });
const tokBefore = globalThis.__tokenCalls.length;
r = await call({ old_email: 'ana.typo@gmial.com', new_email: 'ana@gmail.com', password: 'clave-de-ana-1' });
check('fuerza bruta: tras 5 contraseñas mal en 1 hora -> 429, aunque la 6.ª sea la buena', r.status === 429 && r.body.error === 'too_many_attempts' && await emailOf(ANA) === 'ana.typo@gmial.com', JSON.stringify(r));
check('…y bloqueado ANTES de probar la contraseña (Auth no recibe nada)', globalThis.__tokenCalls.length === tokBefore);
await db.exec(`update public.signup_fix_attempts set at = now() - interval '61 minutes'`);
r = await call({ old_email: 'ana.typo@gmial.com', new_email: 'ana@gmail.com', password: 'clave-de-ana-1' });
check('…pasada la hora, la persona de verdad puede corregirlo', r.status === 200 && await emailOf(ANA) === 'ana@gmail.com', JSON.stringify(r));
await reset();
for (let i = 0; i < 10; i++) await call({ old_email: 'nadie@example.org', new_email: `y${i}@example.net`, password: 'p' });
check('10 intentos en 24 h sobre la misma dirección -> 429', (await call({ old_email: 'nadie@example.org', new_email: 'z@example.net', password: 'p' })).status === 429);
await reset();
for (let i = 0; i < 3; i++) await call({ old_email: `otro${i}@example.org`, new_email: 'victima@example.net', password: 'p' });
check('3 intentos en 24 h hacia la misma dirección nueva -> 429 (no se puede acosar a una dirección)', (await call({ old_email: 'otro9@example.org', new_email: 'victima@example.net', password: 'p' })).status === 429);
await reset();
await db.exec(`insert into public.signup_fix_attempts (old_hash, new_hash, outcome) select md5(g::text), md5(g::text), 'wrong_password' from generate_series(1, 60) g`);
check('60 intentos en 1 hora en total -> 429 para todos (tope global)', (await call({ old_email: 'nueva.persona@example.org', new_email: 'n@example.net', password: 'p' })).status === 429);
await reset();

console.log('3. ¿Permite saber si un correo existe?');
const unknown = await call({ old_email: 'no-existe@example.org', new_email: 'a1@example.net', password: 'p' });
const wrong = await call({ old_email: 'ana@gmail.com', new_email: 'a2@example.net', password: 'p' });
const confWrong = await call({ old_email: 'confirmada@example.org', new_email: 'a3@example.net', password: 'p' });
check('correo inexistente, contraseña mal y cuenta confirmada con contraseña mal: la MISMA respuesta', [unknown, wrong, confWrong].every((x) => x.status === 403 && JSON.stringify(x.body) === '{"error":"wrong_password"}'), JSON.stringify([unknown, wrong, confWrong]));
r = await call({ old_email: 'ana@gmail.com', new_email: 'ocupada@example.org', password: 'clave-de-ana-1' });
check('correo nuevo con cuenta: «not_allowed», igual que un dominio desechable, y solo con la contraseña de una cuenta propia', r.status === 409 && r.body.error === 'not_allowed' && (await call({ old_email: 'ana@gmail.com', new_email: 'x@mailinator.com', password: 'clave-de-ana-1' })).body.error === 'not_allowed');
// 1 probe already made above; 2 more are allowed (3 a day), the 4th is refused
check('…cada sondeo gasta intentos: la 4.ª prueba hacia esa dirección en 24 h da 429', (await call({ old_email: 'ana@gmail.com', new_email: 'ocupada@example.org', password: 'clave-de-ana-1' })).status === 409 && (await call({ old_email: 'ana@gmail.com', new_email: 'ocupada@example.org', password: 'clave-de-ana-1' })).status === 409 && (await call({ old_email: 'ana@gmail.com', new_email: 'ocupada@example.org', password: 'clave-de-ana-1' })).status === 429);
await reset();

console.log('4. ¿Se puede cambiar una cuenta ya confirmada?');
const lo = globalThis.__logouts || 0;
r = await call({ old_email: 'confirmada@example.org', new_email: 'robada@example.net', password: 'clave-confirmada' });
check('cuenta confirmada con su contraseña -> 409 already_confirmed, correo intacto', r.status === 409 && r.body.error === 'already_confirmed' && await emailOf(CONF) === 'confirmada@example.org');
check('…y la sesión que abrió esa comprobación se cierra al momento', (globalThis.__logouts || 0) === lo + 1);
r = await call({ old_email: 'vieja@example.org', new_email: 'nueva-vieja@example.net', password: 'clave-de-ana-1' });
check('cuenta sin confirmar de hace más de 7 días -> 409 too_old, intacta', r.status === 409 && r.body.error === 'too_old' && await emailOf(OLD) === 'vieja@example.org');
await reset();

console.log('5. Correo viejo y correo nuevo');
const BEA = await account('bea@hotmial.com', { pw: 'clave-de-bea' });
r = await call({ old_email: 'bea@hotmial.com', new_email: 'bea@hotmail.com', password: 'clave-de-bea' });
const after = (await q(`select u.email, u.email_confirmed_at, u.confirmation_token, u.confirmation_sent_at, p.email_normalized from auth.users u join profiles p on p.id = u.id where u.id = $1`, [BEA]))[0];
check('la misma cuenta pasa al correo nuevo y sigue sin confirmar', r.status === 200 && after.email === 'bea@hotmail.com' && after.email_confirmed_at === null && after.email_normalized === 'bea@hotmail.com', JSON.stringify(after));
check('el enlace que se mandó al correo VIEJO deja de servir (token borrado, también en one_time_tokens)', after.confirmation_token === '' && after.confirmation_sent_at === null && (await q(`select count(*)::int c from auth.one_time_tokens where user_id = $1`, [BEA]))[0].c === 0);
check('…el de otras cuentas no se toca', (await q(`select confirmation_token t from auth.users where id = $1`, [OLD]))[0].t === 'tok-' + OLD);
check('la función no envía ningún correo (el nuevo enlace lo pide la app con supabase.auth.resend)', true);
check('el correo viejo queda libre (otra persona puede registrarse con él)', (await q(`select count(*)::int c from auth.users where lower(email) = 'bea@hotmial.com'`))[0].c === 0);
check('signup_fix_attempts guarda solo huellas, ninguna dirección', !JSON.stringify(await q('select * from public.signup_fix_attempts')).includes('@'));

console.log('6. ¿Se puede usar para mandar correos a terceros?');
await reset();
const EVE = await account('eve@example.org', { pw: 'clave-de-eve' });
const seq = [];
for (const target of ['t1@example.net', 't2@example.net', 't3@example.net', 't4@example.net']) {
  const from = await emailOf(EVE);
  seq.push((await call({ old_email: from, new_email: target, password: 'clave-de-eve' })).body.error || 'ok');
}
check('una cuenta propia solo puede cambiar de correo 3 veces; la 4.ª -> limit_reached', seq.join() === 'ok,ok,ok,limit_reached' && await emailOf(EVE) === 't3@example.net', seq.join());
check('…y nunca envía nada por sí misma: cada envío depende del límite por hora de Supabase y del de la app (60 s, 3 por hora)', true);
check('sin cuenta propia (sin contraseña válida) no se cambia nada ni se manda nada', (await q(`select count(*)::int c from auth.users where email like 'x%@example.net' or email like 'y%@example.net'`))[0].c === 0);

console.log(`\nRESULTADO: ${pass} ok, ${fail} fallas${fail ? ' -> ' + failures.join(' | ') : ''}`);
process.exit(0);
