// api/ad-inquiry.js limits (independent review): 10 KB body, per-field
// maximums, 5 sends per IP every 10 minutes; valid sends still work.
// Runs the real handler with a fake request/response (no network: without
// RESEND_API_KEY a valid send answers 503 + mailto fallback, as today).
// Usage: node tests/sim/ad-inquiry.mjs
const { default: handler, _test } = await import('../../api/ad-inquiry.js');
let pass = 0, fail = 0; const failures = [];
const check = (n, c, d = '') => { if (c) { pass++; console.log('  ok   ', n); } else { fail++; failures.push(n); console.log('  FALLA', n, d); } };
delete process.env.RESEND_API_KEY;
const send = async (body, ip = '1.1.1.1', headers = {}) => {
  let status = 0, json = null;
  const res = { status(s) { status = s; return this; }, json(j) { json = j; return this; } };
  await handler({ method: 'POST', body, headers: { 'x-forwarded-for': ip, ...headers } }, res);
  return { status, json };
};
const ok = { nombre: 'Ana', empresa: 'Semillas', correo: 'ana@example.org', mensaje: 'Hola', lang: 'es' };
check('envío válido: pasa los límites (503 + mailto mientras no haya Resend)', (await send(ok, '9.9.9.1')).status === 503);
check('cuerpo de más de 10 KB -> 413', (await send({ ...ok, mensaje: 'x'.repeat(11000) }, '9.9.9.2')).status === 413);
check('Content-Length declarado de más de 10 KB -> 413', (await send(ok, '9.9.9.3', { 'content-length': '20000' })).status === 413);
check('mensaje de más de 3000 caracteres -> 400', (await send({ ...ok, mensaje: 'x'.repeat(3001) }, '9.9.9.4')).status === 400);
check('nombre de más de 100 -> 400', (await send({ ...ok, nombre: 'x'.repeat(101) }, '9.9.9.5')).status === 400);
check('campo que no es texto (objeto) -> 400', (await send({ ...ok, empresa: { a: 1 } }, '9.9.9.6')).status === 400);
const r = []; for (let i = 0; i < 7; i++) r.push((await send(ok, '7.7.7.7')).status);
check('6.º y 7.º envío desde la misma IP en 10 minutos -> 429', r.slice(0, 5).every((s) => s === 503) && r[5] === 429 && r[6] === 429, JSON.stringify(r));
check('otra IP sigue pudiendo enviar', (await send(ok, '8.8.8.8')).status === 503);
const now = Date.now(); _test.hits.set('7.7.7.7', _test.hits.get('7.7.7.7').map((t) => t - 11 * 60 * 1000));
check('pasados 10 minutos, la misma IP puede volver a enviar', (await send(ok, '7.7.7.7')).status === 503);
check('GET -> 405', await (async () => { let s = 0; await handler({ method: 'GET', headers: {} }, { status(x) { s = x; return this; }, json() { return this; } }); return s === 405; })());
console.log(`\nRESULTADO: ${pass} ok, ${fail} fallas${fail ? ' -> ' + failures.join(' | ') : ''}`);
process.exit(0);
