// Database tests for the e-mail delivery migrations (20261013100000,
// 20261013110000) on PGlite with every real migration: who may call what,
// addresses blanked in errors, the rules for correcting a sign-up e-mail,
// email_normalized following e-mail changes, and the panel counters.
import { makeDb, makeRest } from './fakerest.mjs';
let pass = 0, fail = 0; const failures = [];
const check = (n, c, d = '') => { if (c) { pass++; console.log('  ok   ', n); } else { fail++; failures.push(n); console.log('  FALLA', n, d); } };
const db = await makeDb();
const rest = makeRest(db);
const q = async (s, p) => (await db.query(s, p)).rows;
const rpc = async (token, fn, args = {}) => { const r = await rest(`https://x/rest/v1/rpc/${fn}`, { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: JSON.stringify(args) }); return { status: r.status, body: await r.json().catch(() => null) }; };

const A = 'c0000001-0000-4000-8000-000000000000', B = 'c0000002-0000-4000-8000-000000000000', N = 'c0000003-0000-4000-8000-000000000000';
await db.exec(`insert into auth.users (id, email) values ('${A}', 'hello@motherverdeny.com'), ('${B}', 'otra@example.org'), ('${N}', 'Pendiente.Uno@Gmail.com');
  update auth.users set email_confirmed_at = now() where id in ('${A}', '${B}');`);
await db.exec((await import('fs')).readFileSync(new URL('../../supabase/admin/grant-admin.sql', import.meta.url), 'utf8'));

// permissions
for (const [fn, args] of [['svc_mail_event', { p_kind: 'x', p_ok: true, p_provider: 'smtp', p_attempts: 1, p_error: null }], ['svc_signup_email_fix', { p_old: 'a@b.co', p_new: 'c@d.co' }]]) {
  check(`${fn}: ni anónimo ni una cuenta normal pueden llamarla`, (await rpc('anon', fn, args)).status >= 400 && (await rpc(`u:${B}:aal2`, fn, args)).status >= 400);
}
check('mail_events: nadie la lee desde el navegador (ni la propia cuenta)', (await rest(`https://x/rest/v1/mail_events?select=*`, { headers: { Authorization: `Bearer u:${A}:aal2` } })).status >= 400 || (await (await rest(`https://x/rest/v1/mail_events?select=*`, { headers: { Authorization: `Bearer u:${A}:aal2` } })).json()).length === 0);
for (const fn of ['admin_mail_failures_24h', 'admin_list_mail_events']) {
  check(`${fn}: admin sin MFA no, cuenta normal no, admin con MFA sí`, (await rpc(`u:${A}:aal1`, fn)).status >= 400 && (await rpc(`u:${B}:aal2`, fn)).status >= 400 && (await rpc(`u:${A}:aal2`, fn)).status === 200);
}

// addresses blanked
check('redact_emails: quita direcciones en distintos formatos', (await q(`select redact_emails('550 <ana.p+1@sub.example.org>: no; to=bob@x.io, (c@d.es)') r`))[0].r === '550 <<correo>>: no; to=<correo>, (<correo>)');
await rpc('svc', 'svc_mail_event', { p_kind: 'gift_code', p_ok: false, p_provider: 'smtp,resend', p_attempts: 4, p_error: 'smtp#1: 550 <persona@example.org> unknown', p_user: null, p_ref: 'gift:1' });
const ev = (await q(`select * from mail_events order by id desc limit 1`))[0];
check('svc_mail_event (service_role): guarda tipo, salida, intentos y el error SIN la dirección', ev.kind === 'gift_code' && ev.attempts === 4 && ev.error.includes('<correo>') && !ev.error.includes('persona@'), JSON.stringify(ev));
await rpc('svc', 'svc_mail_event', { p_kind: 'activation', p_ok: true, p_provider: 'smtp', p_attempts: 1, p_error: null, p_user: B, p_ref: 'claim:1' });
await db.exec(`insert into mail_events (at, kind, ok, attempts) values (now() - interval '2 days', 'test', false, 2)`);
check('admin_mail_failures_24h: solo los fallos de las últimas 24 h', (await rpc(`u:${A}:aal2`, 'admin_mail_failures_24h')).body === 1);
const sm = (await rpc(`u:${A}:aal2`, 'admin_summary')).body;
check('admin_summary: sigue con todo lo de antes y añade fallidos/enviados en 24 h', sm.accounts === 3 && 'usdc_activated' in sm && 'claims' in sm && sm.mail_failed_24h === 1 && sm.mail_sent_24h === 1, JSON.stringify(sm));
const ml = (await rpc(`u:${A}:aal2`, 'admin_list_mail_events')).body;
check('admin_list_mail_events: más reciente primero, con el correo de la cuenta cuando hay una', ml[0].kind === 'activation' && ml[0].account_email === 'otra@example.org' && ml.length === 3);

// correcting a sign-up e-mail
const fix = (o, n) => rpc('svc', 'svc_signup_email_fix', { p_old: o, p_new: n });
check('corrección: cuenta sin confirmar, correo nuevo libre -> devuelve la cuenta', (await fix('pendiente.uno@gmail.com', 'pendiente.uno@hotmail.com')).body === N);
check('…correo mal formado -> bad_email', /bad_email/.test(JSON.stringify((await fix('pendiente.uno@gmail.com', 'no-es-correo')).body)));
check('…cuenta ya confirmada -> not_found (no se toca)', /not_found/.test(JSON.stringify((await fix('otra@example.org', 'nueva@example.org')).body)));
check('…el correo nuevo ya tiene cuenta -> not_allowed', /not_allowed/.test(JSON.stringify((await fix('pendiente.uno@gmail.com', 'OTRA@example.org')).body)));
const blocked = (await q('select domain from blocked_email_domains limit 1'))[0].domain;
check('…dominio desechable -> not_allowed', /not_allowed/.test(JSON.stringify((await fix('pendiente.uno@gmail.com', 'x@' + blocked)).body)));
await db.exec(`insert into auth.users (id, email) values ('c0000004-0000-4000-8000-000000000000', 'p.e.r.s.o.n.a@gmail.com')`);
check('…la misma dirección de Gmail escrita de otra forma -> not_allowed (una cuenta por persona)', /not_allowed/.test(JSON.stringify((await fix('pendiente.uno@gmail.com', 'persona+x@gmail.com')).body)));
await db.exec(`update auth.users set created_at = now() - interval '8 days' where id = '${N}'`);
check('…cuenta de hace más de 7 días -> not_found', /not_found/.test(JSON.stringify((await fix('pendiente.uno@gmail.com', 'otro.correo@example.org')).body)));
await db.exec(`update auth.users set created_at = now() where id = '${N}'`);

// email_normalized follows the sign-in e-mail
await db.exec(`update auth.users set email = 'Pendiente.Uno+x@googlemail.com' where id = '${N}'`);
check('email_normalized sigue al correo de inicio de sesión (Gmail normalizado)', (await q(`select email_normalized e from profiles where id = '${N}'`))[0].e === 'pendienteuno@gmail.com');
await db.exec(`update auth.users set last_sign_in_at = now() where id = '${N}'`);
check('…y no cambia si se toca otra columna', (await q(`select email_normalized e from profiles where id = '${N}'`))[0].e === 'pendienteuno@gmail.com');

console.log(`\nRESULTADO: ${pass} ok, ${fail} fallas${fail ? ' -> ' + failures.join(' | ') : ''}`);
process.exit(0);
