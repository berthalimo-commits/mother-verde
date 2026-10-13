// Browser test: what a person sees when coming back from an e-mail link
// (expired / already used, reset password, e-mail change) and the "forgot
// password" and "change sign-in e-mail" forms. Needs fakeserver.mjs (restart
// it first) and Vite on 5174. Auth e-mails are only recorded, never sent.
import { check, sleep, browser, summary } from './browser.mjs';

const APP = 'http://localhost:5174/';
const NEWBIE = 'b0000003-0000-4000-8000-000000000000';
const auth = async () => (await fetch('http://localhost:54322/__auth')).json();
const authFail = (m) => fetch('http://localhost:54322/__authfail?m=' + (m || ''));
const screenText = (b) => b.ev(`document.querySelector('.screen.active').innerText`);
const waitText = async (b, re, ms = 10000) => { for (let t = 0; t < ms; t += 250) { const s = await screenText(b); if (re.test(s)) return s; await sleep(250); } return screenText(b); };
const open = async (b, url) => {
  await b.send('Page.navigate', { url }); await sleep(4500);
  await b.ev(`document.getElementById('ageGateModal').style.display='none'; document.getElementById('mvDevPreview')?.remove(); 1`);
};
const lang = async (b, L) => { await b.ev(`document.querySelector('#langSwitch button[data-lang=${L}]').click(); 1`); await sleep(400); };
await authFail('');

// ---------------------------------------------------------------- 1. expired / already used link
let b = await browser(null, null, 390);
await open(b, APP + '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
let s = await waitText(b, /Este enlace ya no sirve/);
check('enlace caducado o ya usado -> Cuenta con «Este enlace ya no sirve» y la explicación', /Este enlace ya no sirve/.test(s) && /cada enlace sirve una sola vez/.test(s) && await b.ev(`document.getElementById('cuenta').classList.contains('active')`), s.slice(0, 300));
check('…el error ya no queda en la barra de direcciones', (await b.ev('location.hash')) === '');
check('…ofrece pedir otro: confirmación y contraseña', /Enviar un nuevo enlace de confirmación/.test(s) && /Enviar enlace para cambiar la contraseña/.test(s));
await b.ev(`document.querySelector('[data-link-act=signup]').click(); 1`); await sleep(300);
check('…sin correo escrito -> pide escribirlo, no envía nada', /Escribe primero tu correo/.test(await screenText(b)) && (await auth()).length === 0);
await b.ev(`document.getElementById('authEmailInput').value='caducado@example.org'; document.querySelector('[data-link-act=signup]').click(); 1`); await sleep(800);
let a = await auth();
check('…«Enviar un nuevo enlace de confirmación» -> reenvío de tipo signup que vuelve a la app', a.length === 1 && a[0].type === 'resend_signup' && a[0].email === 'caducado@example.org' && a[0].redirect_to === APP, JSON.stringify(a));
check('…respuesta neutra (no dice si la cuenta existe)', /Si hay una cuenta con ese correo, te enviamos un enlace nuevo/.test(await screenText(b)));
await b.ev(`document.querySelector('[data-link-act=signup]').click(); 1`); await sleep(500);
check('…segundo clic enseguida -> «Espera N s», no envía', /Espera \d+ s antes de pedir otro correo/.test(await screenText(b)) && (await auth()).length === 1);
for (const [L, re] of [['en', /This link no longer works/], ['de', /Dieser Link funktioniert nicht mehr/], ['fr', /Ce lien ne fonctionne plus/], ['es', /Este enlace ya no sirve/]]) {
  await lang(b, L);
  check(`…aviso de enlace caducado en ${L}`, re.test(await screenText(b)));
}
await b.ev(`document.querySelector('[data-link-act=close]').click(); 1`); await sleep(200);
check('…«Cerrar» quita el aviso', await b.ev(`document.getElementById('authLinkCard').hidden`));
await b.close();

// ---------------------------------------------------------------- 2. forgot password
b = await browser(null, null, 390);
await open(b, APP);
await b.ev(`showScreen('cuenta'); window.mvSetAuthMode('signup'); 1`); await sleep(200);
check('«¿Olvidaste tu contraseña?» no aparece al crear cuenta…', await b.ev(`document.getElementById('authForgotLink').hidden`));
await b.ev(`window.mvSetAuthMode('login'); 1`); await sleep(200);
check('…y sí al iniciar sesión', !(await b.ev(`document.getElementById('authForgotLink').hidden`)));
await b.ev(`document.getElementById('authForgotLink').click(); 1`); await sleep(300);
check('sin correo -> pide escribirlo', /Escribe primero tu correo/.test(await screenText(b)));
await b.ev(`document.getElementById('authEmailInput').value='olvido@example.org'; document.getElementById('authForgotLink').click(); 1`); await sleep(800);
a = (await auth()).filter((x) => x.type === 'recovery');
check('con correo -> enlace de recuperación que vuelve a la app', a.length === 1 && a[0].email === 'olvido@example.org' && a[0].redirect_to === APP, JSON.stringify(a));
check('…mensaje neutro con aviso de spam', /Si hay una cuenta con ese correo, te enviamos un enlace para elegir una contraseña nueva/.test(await screenText(b)) && /spam/.test(await screenText(b)));
await b.close();
// Supabase refuses: rate limit and SMTP failure are told apart from "something went wrong"
for (const [mode, re, label] of [['rate', /no podemos enviar más correos/, 'límite de envío'], ['smtp', /No pudimos enviar el correo.*hello@motherverdeny\.com/, 'fallo del SMTP']]) {
  await authFail(mode);
  b = await browser(null, null, 390);
  await open(b, APP);
  await b.ev(`showScreen('cuenta'); window.mvSetAuthMode('login'); document.getElementById('authEmailInput').value='x${mode}@example.org'; document.getElementById('authForgotLink').click(); 1`); await sleep(1000);
  check(`Supabase rechaza (${label}) -> mensaje claro, no «Algo salió mal»`, re.test(await screenText(b)), (await screenText(b)).slice(0, 400));
  await b.close();
}
await authFail('');

// ---------------------------------------------------------------- 3. reset-password link -> new password
b = await browser(null, null, 390);
const exp = Math.floor(Date.now() / 1000) + 3600;
await open(b, APP + `#access_token=u:${NEWBIE}:aal1&expires_at=${exp}&expires_in=3600&refresh_token=r:${NEWBIE}:aal1&token_type=bearer&type=recovery`);
s = await waitText(b, /Elige una contraseña nueva/);
check('enlace de recuperación (en otro navegador, sin sesión previa) -> «Elige una contraseña nueva»', /Elige una contraseña nueva/.test(s) && !(await b.ev(`document.getElementById('authRecoveryCard').hidden`)), s.slice(0, 300));
check('…los datos del enlace salen de la barra de direcciones', !(await b.ev('location.href')).includes('access_token'));
await b.ev(`document.getElementById('recPass1').value='nueva-clave-1'; document.getElementById('recPass2').value='otra-clave-2'; document.getElementById('authRecoveryForm').requestSubmit(); 1`); await sleep(300);
check('…si no coinciden, lo dice y no guarda', /no coinciden/.test(await screenText(b)) && !(await auth()).some((x) => x.type === 'password_set'));
await b.ev(`document.getElementById('recPass2').value='nueva-clave-1'; document.getElementById('authRecoveryForm').requestSubmit(); 1`); await sleep(800);
check('…si coinciden, guarda y confirma', (await auth()).some((x) => x.type === 'password_set') && /tu contraseña cambió/.test(await screenText(b)) && await b.ev(`document.getElementById('authRecoveryCard').hidden`));
await b.close();

// ---------------------------------------------------------------- 4. change the sign-in e-mail
b = await browser(NEWBIE, 'aal1', 390);
await open(b, APP);
await b.ev(`showScreen('cuenta'); 1`);
s = await waitText(b, /nueva@example\.org/);
check('Cuenta muestra el correo para iniciar sesión', /Correo para iniciar sesión/.test(s) && /nueva@example\.org/.test(s));
await b.ev(`document.getElementById('ceOpenBtn').click(); document.getElementById('ceInput').value='NUEVA@example.org'; document.getElementById('ceForm').requestSubmit(); 1`); await sleep(400);
check('…el mismo correo -> «Ese ya es tu correo», no envía', /Ese ya es tu correo/.test(await screenText(b)) && !(await auth()).some((x) => x.type === 'email_change'));
await b.ev(`document.getElementById('ceInput').value='Cambiada@Example.org'; document.getElementById('ceForm').requestSubmit(); 1`); await sleep(800);
a = (await auth()).filter((x) => x.type === 'email_change');
check('…correo nuevo -> enlace de confirmación al nuevo, que vuelve a la app (sin crear otra cuenta)', a.length === 1 && a[0].email === 'cambiada@example.org' && a[0].from === 'nueva@example.org' && a[0].redirect_to === APP, JSON.stringify(a));
check('…explica que el cambio se hace al abrir el enlace', /Te enviamos un enlace a cambiada@example\.org/.test(await screenText(b)));
await b.close();
b = await browser(null, null, 390);
await open(b, APP + '#message=Confirmation+link+accepted.+Please+proceed+to+confirm+link+sent+to+the+other+email');
check('cambio de correo a medias -> pide abrir el otro enlace', /abre también el que enviamos a la otra dirección/.test(await waitText(b, /otra dirección/)));
await b.close();

summary();
process.exit(0);
