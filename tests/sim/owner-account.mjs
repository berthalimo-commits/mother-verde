// hello@motherverdeny.com = admin + full access with no end date
// (supabase/admin/grant-admin.sql). Checks, on the real migrations (PGlite)
// and the Edge Functions bundled as in production (SMTP simulated):
//   a) full access everywhere the server decides, even with the trial over;
//   b) the panel's data and admin actions only with MFA (aal2), enforced by
//      the database and the functions, not by the screen;
//   c) both permissions survive signing out and in, a language change and a
//      password change;
//   d) still no way to see or export secrets or gift codes in clear.
// Nothing is sent, no real account is used.
import { createRequire } from 'module';
import fs from 'fs';
import { makeDb, makeRest } from './fakerest.mjs';

const APP = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1').replace(/\/$/, '');
const req = createRequire(APP + '/package.json');
const { build } = req('esbuild');
let pass = 0, fail = 0; const failures = [];
const check = (n, c, d = '') => { if (c) { pass++; console.log('  ok   ', n); } else { fail++; failures.push(n); console.log('  FALLA', n, d); } };

const SECRETS = { SMTP_PASS: 'smtp-SECRETO-NO-DEBE-SALIR', RESEND_API_KEY: 're_SECRETO_NO_DEBE_SALIR' };
const env = { SUPABASE_URL: 'https://fake.supabase.co', SUPABASE_ANON_KEY: 'anon', SUPPORT_ADDRESS: '0x' + '11'.repeat(20),
  MAIL_PROVIDER: 'smtp', SMTP_USER: 'hello@motherverdeny.com', MAIL_RETRY_MS: '0', APP_URL: 'https://example.test', SUPABASE_SERVICE_ROLE_KEY: 'svc', ...SECRETS };
globalThis.__mail = [];
globalThis.Deno = { env: { get: (k) => env[k] }, serve: (h) => { globalThis.__h = h; } };
const db = await makeDb();
const rest = makeRest(db);
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(typeof url === 'string' ? url : url.url);
  if (typeof url !== 'string' && !init.method) init = { method: url.method, headers: url.headers, body: await url.text() };
  if (u.hostname === 'fake.supabase.co') return rest(u.toString(), init);
  if (u.hostname === 'mainnet.base.org') return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: null }));
  throw new Error('unexpected fetch ' + u);
};
const mock = new URL('./fnbuild/owner-nodemailer.mjs', import.meta.url);
fs.writeFileSync(mock, `export default { createTransport: () => ({ sendMail: async (m) => { globalThis.__mail.push(m); return {}; } }) };`);
const fns = {};
for (const dir of ['support-claims', 'admin-send-gift-code']) {
  const out = new URL(`./fnbuild/owner-${dir}.mjs`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
  await build({ entryPoints: [`${APP}/supabase/functions/${dir}/index.ts`], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
    plugins: [{ name: 'deno', setup(b) {
      b.onResolve({ filter: /^jsr:@supabase\/supabase-js/ }, () => ({ path: req.resolve('@supabase/supabase-js') }));
      b.onResolve({ filter: /^npm:nodemailer/ }, () => ({ path: mock.pathname.replace(/^\/([A-Z]:)/, '$1') }));
    } }] });
  await import('file:///' + out + '?' + Date.now());
  fns[dir] = globalThis.__h;
}
const callFn = async (dir, token, body) => { const r = await fns[dir](new Request('https://x/', { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: JSON.stringify(body) })); return { status: r.status, text: await r.text() }; };
const q = async (s, p) => (await db.query(s, p)).rows;
const api = async (token, path, method = 'GET', body) => { const r = await rest(`https://fake.supabase.co/rest/v1/${path}`, { method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json().catch(() => null) }; };
const rpc = (token, fn, args = {}) => api(token, 'rpc/' + fn, 'POST', args);
const tok = (u, aal = 'aal1') => `u:${u}:${aal}`;
const errOf = (r) => JSON.stringify(r.body || '');

// ---- setup: hello@ registered and confirmed, 24 h trial already over; a payer with a claim
const OWNER = 'c0000001-0000-4000-8000-000000000000', PAYER = 'c0000002-0000-4000-8000-000000000000';
const grant = async () => { try { await db.exec(fs.readFileSync(APP + '/supabase/admin/grant-admin.sql', 'utf8')); return 'ok'; } catch (e) { try { await db.exec('rollback'); } catch {} return e.message; } };

console.log('0. El SQL único (grant-admin.sql)');
await db.query(`insert into auth.users (id, email) values ($1, 'hello@motherverdeny.com')`, [OWNER]);
await db.query(`delete from profiles where id = $1`, [OWNER]);
await db.query(`update auth.users set email_confirmed_at = now() where id = $1`, [OWNER]);
let g = await grant();
check('cuenta sin fila en profiles -> se detiene con mensaje claro, sin cambiar nada', g.includes('no tiene fila en profiles') && (await q('select count(*)::int c from admin_users'))[0].c === 0, g);
await db.query(`insert into profiles (id) values ($1)`, [OWNER]);
await db.query(`update profiles set subscription_status = 'trialing', trial_ends_at = now() - interval '1 hour' where id = $1`, [OWNER]);
await db.query(`insert into auth.users (id, email, email_confirmed_at) values ($1, 'aportante@example.org', now())`, [PAYER]);
g = await grant();
check('con la cuenta confirmada -> admin + supporter en una sola pasada', g === 'ok' && (await q('select subscription_status s from profiles where id = $1', [OWNER]))[0].s === 'supporter'
  && (await q('select count(*)::int c from admin_users where user_id = $1', [OWNER]))[0].c === 1, g);
const claim = (await rpc(tok(PAYER), 'create_support_claim', { p_flowers: 1 })).body;
await rpc(tok(PAYER), 'submit_support_claim_tx', { p_claim_id: claim.id, p_tx_hash: '0x' + 'ab'.repeat(32) });
const O1 = tok(OWNER, 'aal1'), O2 = tok(OWNER, 'aal2');

// ================================================================ a
console.log('a) Acceso completo en todas las zonas (lo decide el servidor)');
check('has_full_access() de hello@ = true aunque su prueba de 24 h terminó', (await rpc(O1, 'has_full_access')).body === true);
check('is_premium (usado por las funciones de publicar) = true', (await q('select is_premium($1) v', [OWNER]))[0].v === true);
check('Comunidad: lee publicaciones y miembros (RLS con acceso completo)', (await api(O1, 'community_posts?select=id')).status === 200 && (await api(O1, 'community_members?select=user_id')).status === 200);
const cm = await api(O1, 'community_members', 'POST', { user_id: OWNER, display_name: 'Mother Verde (admin)', country: 'PE', profile_type: 'otro' });
check('Comunidad: puede crear su perfil del directorio', cm.status < 300 && (await q('select count(*)::int c from community_members where user_id = $1', [OWNER]))[0].c === 1, JSON.stringify(cm));
const be = await api(O1, 'bitacora_entries', 'POST', { user_id: OWNER, etapa: 'vegetativo', nota: 'prueba de la dueña' });
check('Bitácora: puede escribir y leer sus entradas', be.status < 300 && (await api(O1, 'bitacora_entries?select=id')).body?.length === 1, JSON.stringify(be));
check('Desbloquear: no necesita aportar (already_supporter)', errOf(await rpc(O1, 'create_support_claim', { p_flowers: 1 })).includes('already_supporter'));
check('ningún vencimiento: sin fecha de fin (access_until vacío y estado supporter)', (await q('select access_until from profiles where id = $1', [OWNER]))[0].access_until === null);
check('la tarea diaria no toca a un supporter (solo active/past_due/none)', !/'supporter'/.test(fs.readFileSync(APP + '/api/subscription-cron.js', 'utf8').match(/\.in\('subscription_status'[^)]*\)|\.eq\('subscription_status'[^)]*\)/g)?.join() ?? ''));

// ================================================================ b
console.log('b) Panel completo, pero SOLO con MFA (comprobado en el servidor)');
const adminCalls = [
  ['admin_list_claims', {}], ['admin_list_users', {}], ['admin_get_user', { p_user_id: PAYER }], ['admin_summary', {}],
  ['admin_list_gift_codes', { p_limit: 10 }], ['admin_list_audit', { p_limit: 10 }], ['admin_list_mail_events', { p_limit: 10 }],
  ['admin_export_csv', { p_tab: 'users' }],
];
for (const [fn, args] of adminCalls) {
  const r1 = await rpc(O1, fn, args), r2 = await rpc(O2, fn, args);
  check(`${fn}: sin MFA (aal1) -> not_allowed · con MFA (aal2) -> responde`, r1.status >= 400 && errOf(r1).includes('not_allowed') && r2.status === 200, `${r1.status} ${errOf(r1).slice(0, 80)} | ${r2.status} ${errOf(r2).slice(0, 80)}`);
}
const wr = await rpc(O1, 'admin_whoami');
check('admin_whoami sin MFA: admin = true pero aal1 (el panel pide activar la verificación)', wr.body?.admin === true && wr.body?.aal === 'aal1');
check('acciones de admin sin MFA (aprobar, dar días) -> not_allowed', errOf(await rpc(O1, 'admin_approve_claim', { p_claim_id: claim.id, p_reason: 'x'.repeat(20) })).includes('not_allowed')
  && errOf(await rpc(O1, 'admin_grant_days', { p_email: 'aportante@example.org', p_days: 7, p_reason: 'prueba' })).includes('not_allowed'));
let f = await callFn('support-claims', O1, { action: 'admin_check', claim_id: claim.id });
check('función support-claims (admin_check) sin MFA -> 403', f.status === 403, f.text);
f = await callFn('support-claims', O2, { action: 'config' });
check('…con MFA -> responde', f.status === 200, f.text);
f = await callFn('admin-send-gift-code', O1, { action: 'send', email: 'regalo@example.org' });
check('función admin-send-gift-code sin MFA -> 403 y no envía nada', f.status === 403 && globalThis.__mail.length === 0, f.text);
check('una cuenta normal con MFA NO entra al panel', errOf(await rpc(tok(PAYER, 'aal2'), 'admin_list_claims')).includes('not_allowed'));

// ================================================================ c
console.log('c) Los dos permisos se mantienen');
const both = async (t) => (await rpc(t, 'has_full_access')).body === true && (await rpc(t, 'admin_whoami')).body?.admin === true;
check('tras cerrar sesión y volver a entrar (sesión nueva, mismo usuario)', await both(`u:${OWNER}:aal1`) && (await rpc(`u:${OWNER}:aal2`, 'admin_list_claims')).status === 200);
const lang = await api(O1, `profiles?id=eq.${OWNER}`, 'PATCH', { preferred_lang: 'de' });
check('tras cambiar el idioma (es -> de)', lang.status < 300 && (await q('select preferred_lang l from profiles where id = $1', [OWNER]))[0].l === 'de' && await both(O1), JSON.stringify(lang));
// A password change is an UPDATE of auth.users (as Supabase does it), so every trigger on that table runs.
await db.exec(`alter table auth.users add column if not exists encrypted_password text; alter table auth.users add column if not exists updated_at timestamptz`);
await db.query(`update auth.users set encrypted_password = 'otra-contraseña-cifrada', updated_at = now(), last_sign_in_at = now() where id = $1`, [OWNER]);
check('tras cambiar la contraseña', await both(O1) && (await q('select subscription_status s from profiles where id = $1', [OWNER]))[0].s === 'supporter');
check('ella misma no puede quitarse ni cambiarse el estado desde el navegador', (await api(O1, `profiles?id=eq.${OWNER}`, 'PATCH', { subscription_status: 'none' })).status >= 400
  && (await q('select subscription_status s from profiles where id = $1', [OWNER]))[0].s === 'supporter');
check('pegar grant-admin.sql otra vez no cambia nada ni duplica el registro', await grant() === 'ok'
  && (await q(`select count(*)::int c from admin_audit_log where action in ('admin_granted', 'owner_full_access')`))[0].c === 2);

// ================================================================ d
console.log('d) Sigue sin ver ni exportar datos sensibles');
await db.exec(`reset role; select set_config('request.jwt.claims', '', false)`); // back to "SQL Editor"
const created = (await q(`select * from admin_create_gift_codes(2, 7, 30)`)); // SQL Editor: the only moment a code is shown
const codes = created.map((r) => r.code);
await callFn('admin-send-gift-code', O2, { action: 'send', email: 'regalo@example.org' });
const sentCode = (globalThis.__mail.at(-1)?.text || '').match(/[A-Z0-9]{4}-[A-Z0-9]{4}(-[A-Z0-9]{4})*/)?.[0];
const allCodes = [...codes, sentCode].filter(Boolean);
check('hay códigos guardados (2 creados + 1 enviado) para la prueba', allCodes.length === 3 && (await q('select count(*)::int c from gift_codes'))[0].c === 3, JSON.stringify(allCodes));
check('tabla gift_codes cerrada al navegador, incluso con MFA', (await api(O2, 'gift_codes?select=*')).status >= 400 || (await api(O2, 'gift_codes?select=*')).body?.length === 0);
const listed = JSON.stringify((await rpc(O2, 'admin_list_gift_codes', { p_limit: 50 })).body);
const csv = JSON.stringify((await rpc(O2, 'admin_export_csv', { p_tab: 'gifts' })).body);
const hashes = (await q('select code_hash from gift_codes')).map((r) => r.code_hash);
check('la lista del panel no trae el código ni su huella', !allCodes.some((c) => listed.includes(c)) && !hashes.some((h) => listed.includes(h)) && !/code_hash/.test(listed));
check('el CSV de códigos no trae el código ni su huella', csv.length > 50 && !allCodes.some((c) => csv.includes(c)) && !hashes.some((h) => csv.includes(h)));
const sendResp = await callFn('admin-send-gift-code', O2, { action: 'send', email: 'otra@example.org' });
const newCode = (globalThis.__mail.at(-1)?.text || '').match(/[A-Z0-9]{4}-[A-Z0-9]{4}(-[A-Z0-9]{4})*/)?.[0];
check('enviar un código: la respuesta al panel NO incluye el código (solo va en el correo)', sendResp.status === 200 && !!newCode && !sendResp.text.includes(newCode), sendResp.text);
check('gift_code_hash no se puede llamar desde el navegador', (await rpc(O2, 'gift_code_hash', { p_code: 'X' })).status >= 400);
const everything = [];
for (const [fn, args] of [...adminCalls, ['admin_export_csv', { p_tab: 'claims' }], ['admin_export_csv', { p_tab: 'audit' }]]) everything.push(JSON.stringify((await rpc(O2, fn, args)).body));
for (const action of ['config']) everything.push((await callFn('support-claims', O2, { action })).text);
const blob = everything.join('\n');
check('ninguna respuesta del panel ni de las funciones contiene secretos (SMTP, Resend)', !Object.values(SECRETS).some((s) => blob.includes(s)));
check('config solo dice SI la dirección está puesta (true/false), no claves', /"support_address_set":true/.test(everything.at(-1)) && !everything.at(-1).includes(env.SUPPORT_ADDRESS));
check('tablas internas cerradas incluso con MFA (admin_users, app_config, mail_events, admin_audit_log)',
  (await Promise.all(['admin_users', 'app_config', 'mail_events', 'admin_audit_log'].map((t) => api(O2, `${t}?select=*`)))).every((r) => r.status >= 400 || (Array.isArray(r.body) && r.body.length === 0)));

console.log(`\nRESULTADO: ${pass} ok, ${fail} fallas${fail ? ' -> ' + failures.join(' | ') : ''}`);
process.exit(0);
