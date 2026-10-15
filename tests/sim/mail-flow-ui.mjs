// End-to-end e-mail flows in the browser with one-time links like Supabase's
// (fakeserver.mjs: a link works once, within an hour): sign up -> open the
// link -> 24 h start; the same link again; an expired link; forgot password
// -> link -> new password -> link again; sign-in e-mail change -> link;
// sign-up in the 4 languages; Supabase refusing to send at sign-up.
// Needs a fresh fakeserver.mjs and Vite on 5174. Nothing is sent.
import { check, sleep, sql, browser, summary } from './browser.mjs';

const APP = 'http://localhost:5174/';
const auth = async () => (await fetch('http://localhost:54322/__auth')).json();
const authFail = (m) => fetch('http://localhost:54322/__authfail?m=' + (m || ''));
const expire = (link) => fetch('http://localhost:54322/__expire?token=' + new URL(link).searchParams.get('token'));
const lastLink = async (type, email) => (await auth()).filter((x) => x.type === type && x.email === email && x.link).at(-1)?.link;
const screenText = (b) => b.ev(`document.querySelector('.screen.active').innerText`);
const waitText = async (b, re, ms = 10000) => { for (let t = 0; t < ms; t += 250) { const s = await screenText(b); if (re.test(s)) return s; await sleep(250); } return screenText(b); };
const hide = (b) => b.ev(`document.getElementById('ageGateModal').style.display='none'; document.getElementById('mvDevPreview')?.remove(); 1`);
const go = async (b, url) => { await b.send('Page.navigate', { url }); await sleep(4500); await hide(b); };
const signup = async (b, email, pw = 'clave-segura-1') => b.ev(`showScreen('cuenta'); window.mvSetAuthMode('signup'); document.getElementById('authEmailInput').value=${JSON.stringify(email)}; document.getElementById('authPasswordInput').value=${JSON.stringify(pw)}; document.getElementById('authForm').requestSubmit(); 1`);
await authFail('');

// ---------------------------------------------------------------- 1. sign up -> link -> 24 h; same link twice
let b = await browser(null, null, 390);
await go(b, APP);
await signup(b, 'flujo@example.net');
await waitText(b, /Confirma tu correo para empezar/);
const link1 = await lastLink('signup', 'flujo@example.net');
check('registro -> correo de confirmación con enlace de un solo uso que vuelve a la app', !!link1 && new URL(link1).searchParams.get('redirect_to') === APP, link1);
await b.close();
b = await browser(null, null, 390);           // another browser / the phone: never signed in there
await go(b, link1);
for (let i = 0; i < 20 && (await b.ev('document.documentElement.dataset.access')) !== 'trial'; i++) await sleep(250);
const conf = (await sql(`select u.email_confirmed_at is not null c, p.trial_ends_at > now() t from auth.users u join profiles p on p.id = u.id where u.email = 'flujo@example.net'`))[0];
check('abrir el enlace en otro navegador (sin sesión previa) -> correo confirmado, dentro y con las 24 h corriendo', conf?.c === true && conf.t === true && (await b.ev('document.documentElement.dataset.access')) === 'trial', JSON.stringify(conf));
check('…sin restos del enlace en la barra de direcciones', !(await b.ev('location.href')).includes('access_token'));
await b.close();
b = await browser(null, null, 390);
await go(b, link1);
let s = await waitText(b, /Este enlace ya no sirve/);
check('el MISMO enlace por segunda vez -> «Este enlace ya no sirve… Si ya confirmaste tu correo, solo tienes que iniciar sesión»', /Este enlace ya no sirve/.test(s) && /Si ya confirmaste tu correo, solo tienes que iniciar sesión/.test(s), s.slice(0, 300));
await b.close();

// ---------------------------------------------------------------- 2. expired link -> ask for a new one -> it works
b = await browser(null, null, 390);
await go(b, APP);
await signup(b, 'tarde@example.net');
await waitText(b, /Confirma tu correo para empezar/);
const old = await lastLink('signup', 'tarde@example.net');
await expire(old);
await go(b, old);
s = await waitText(b, /Este enlace ya no sirve/);
check('enlace caducado (más de 1 h) -> aviso claro con forma de pedir otro', /Este enlace ya no sirve/.test(s) && /Enviar un nuevo enlace de confirmación/.test(s));
// (a link expires after an hour: by then the 60 s gap since sign-up is long over)
await b.ev(`localStorage.removeItem('mv-mail-sends'); document.getElementById('authEmailInput').value='tarde@example.net'; document.querySelector('[data-link-act=signup]').click(); 1`); await sleep(800);
const fresh = await lastLink('resend_signup', 'tarde@example.net');
check('…el enlace nuevo llega', !!fresh && fresh !== old);
await go(b, fresh);
for (let i = 0; i < 20 && (await b.ev('document.documentElement.dataset.access')) !== 'trial'; i++) await sleep(250);
check('…y funciona: cuenta confirmada y dentro', (await sql(`select email_confirmed_at is not null c from auth.users where email = 'tarde@example.net'`))[0].c === true && (await b.ev('document.documentElement.dataset.access')) === 'trial');
await b.close();

// ---------------------------------------------------------------- 3. forgot password -> link -> new password; link twice
b = await browser(null, null, 390);
await go(b, APP);
await b.ev(`showScreen('cuenta'); window.mvSetAuthMode('login'); document.getElementById('authEmailInput').value='flujo@example.net'; document.getElementById('authForgotLink').click(); 1`); await sleep(800);
const rec = await lastLink('recovery', 'flujo@example.net');
check('«¿Olvidaste tu contraseña?» -> enlace de recuperación', !!rec);
await b.ev(`localStorage.removeItem('mv-mail-sends'); document.getElementById('authEmailInput').value='nadie-tiene-esto@example.net'; document.getElementById('authForgotLink').click(); 1`); await sleep(800);
check('…para un correo sin cuenta: la misma respuesta, pero ningún enlace', /Si hay una cuenta con ese correo/.test(await screenText(b)) && !(await lastLink('recovery', 'nadie-tiene-esto@example.net')));
await b.close();
b = await browser(null, null, 390);
await go(b, rec);
s = await waitText(b, /Elige una contraseña nueva/);
check('abrir el enlace (otro navegador) -> «Elige una contraseña nueva»', /Elige una contraseña nueva/.test(s));
await b.ev(`document.getElementById('recPass1').value='otra-clave-9'; document.getElementById('recPass2').value='otra-clave-9'; document.getElementById('authRecoveryForm').requestSubmit(); 1`); await sleep(800);
check('…guardar -> contraseña cambiada y dentro', /tu contraseña cambió/.test(await screenText(b)) && (await auth()).some((x) => x.type === 'password_set' && x.email === 'flujo@example.net'));
await b.close();
b = await browser(null, null, 390);
await go(b, rec);
s = await waitText(b, /Este enlace ya no sirve/);
check('el enlace de recuperación por segunda vez -> «Este enlace ya no sirve» + «Enviar enlace para cambiar la contraseña»', /Este enlace ya no sirve/.test(s) && /Enviar enlace para cambiar la contraseña/.test(s) && await b.ev(`document.getElementById('authRecoveryCard').hidden`));
await b.close();

// ---------------------------------------------------------------- 4. change the sign-in e-mail -> link
const FL = (await sql(`select id from auth.users where email = 'flujo@example.net'`))[0].id;
b = await browser(FL, 'aal1', 390);
await go(b, APP);
await b.ev(`showScreen('cuenta'); document.getElementById('ceOpenBtn').click(); document.getElementById('ceInput').value='flujo.nuevo@example.net'; document.getElementById('ceForm').requestSubmit(); 1`); await sleep(1000);
const ch = await lastLink('email_change', 'flujo.nuevo@example.net');
check('cambio de correo -> enlace al correo nuevo; mientras no se abre, nada cambia', !!ch && (await sql(`select email from auth.users where id = '${FL}'`))[0].email === 'flujo@example.net');
await go(b, ch);
s = await waitText(b, /tu correo para iniciar sesión cambió/);
const after = (await sql(`select u.email, p.email_normalized from auth.users u join profiles p on p.id = u.id where u.id = '${FL}'`))[0];
check('…abrir el enlace -> «Listo: tu correo para iniciar sesión cambió», misma cuenta con el correo nuevo', /tu correo para iniciar sesión cambió/.test(s) && after.email === 'flujo.nuevo@example.net' && after.email_normalized === 'flujo.nuevo@example.net', JSON.stringify(after));
await go(b, ch);
check('…el mismo enlace otra vez -> «Este enlace ya no sirve»', /Este enlace ya no sirve/.test(await waitText(b, /Este enlace ya no sirve/)));
await b.close();

// ---------------------------------------------------------------- 5. sign-up in the 4 languages
for (const [L, re] of [['en', /Confirm your email to start your 24 hours/], ['de', /Bestätige deine E-Mail, um deine 24 Stunden zu starten/], ['fr', /Confirme ton e-mail pour commencer tes 24 heures/], ['es', /Confirma tu correo para empezar tus 24 horas/]]) {
  b = await browser(null, null, 390);
  await go(b, APP);
  await b.ev(`document.querySelector('#langSwitch button[data-lang=${L}]').click(); 1`); await sleep(300);
  await signup(b, `idioma.${L}@example.net`);
  s = await waitText(b, re);
  const p = (await sql(`select p.preferred_lang from profiles p join auth.users u on u.id = p.id where u.email = 'idioma.${L}@example.net'`))[0];
  check(`registro en ${L}: pantalla de confirmación en ${L} y la cuenta guarda el idioma (para el correo)`, re.test(s) && p?.preferred_lang === L && (await auth()).some((x) => x.type === 'signup' && x.email === `idioma.${L}@example.net` && x.lang === L), JSON.stringify(p));
  await b.close();
}

// ---------------------------------------------------------------- 6. Supabase can't send at sign-up
for (const [mode, re, label] of [['smtp', /No pudimos enviar el correo\..*hello@motherverdeny\.com/, 'fallo del SMTP'], ['rate', /no podemos enviar más correos/, 'límite por hora']]) {
  await authFail(mode);
  b = await browser(null, null, 390);
  await go(b, APP);
  await signup(b, `sinenvio.${mode}@example.net`);
  s = await waitText(b, re);
  check(`registro cuando Supabase no puede enviar (${label}) -> mensaje claro, no «Algo salió mal»`, re.test(s) && !/Algo salió mal/.test(s), s.slice(0, 300));
  await b.close();
}
await authFail('');

summary();
process.exit(0);
