// Browser test of the "check your e-mail" screen after signing up: spam help
// in 4 languages, Gmail / Outlook hint, resend with 60 s gap and 3 an hour,
// contact line, and fixing a mistyped e-mail on the SAME account.
// Needs fakeserver.mjs (restart it first) and Vite on 5174. Nothing is sent.
import { check, sleep, sql, browser, summary } from './browser.mjs';

const APP = 'http://localhost:5174/';
const auth = async () => (await fetch('http://localhost:54322/__auth')).json();
const screenText = (b) => b.ev(`document.querySelector('.screen.active').innerText`);
const waitText = async (b, re, ms = 10000) => { for (let t = 0; t < ms; t += 250) { const s = await screenText(b); if (re.test(s)) return s; await sleep(250); } return screenText(b); };
const open = async (b) => {
  await b.send('Page.navigate', { url: APP }); await sleep(4500);
  await b.ev(`document.getElementById('ageGateModal').style.display='none'; document.getElementById('mvDevPreview')?.remove(); 1`);
};
const signup = async (b, email, pw = 'clave-segura-1') => {
  await b.ev(`showScreen('cuenta'); window.mvSetAuthMode('signup'); document.getElementById('authEmailInput').value=${JSON.stringify(email)}; document.getElementById('authPasswordInput').value=${JSON.stringify(pw)}; document.getElementById('authForm').requestSubmit(); 1`);
  return waitText(b, /Confirma tu correo para empezar/);
};
// Pretend earlier e-mails were sent N seconds ago (instead of waiting).
const age = (b, kind, secsAgo) => b.ev(`(() => { const a = JSON.parse(localStorage.getItem('mv-mail-sends') || '{}'); a[${JSON.stringify(kind)}] = ${JSON.stringify(secsAgo)}.map((s) => Date.now() - s * 1000); localStorage.setItem('mv-mail-sends', JSON.stringify(a)); mvUpdateResendCooldown(); return 1; })()`);
const resendBtn = (b) => b.ev(`(() => { const x = document.getElementById('accResendBtn'); return x ? { disabled: x.disabled } : null; })()`);

// ---------------------------------------------------------------- 1. sign up with Gmail
let b = await browser(null, null, 390);
await open(b);
let s = await signup(b, 'persona.nueva@gmail.com');
const usersBefore = (await sql(`select count(*)::int c from auth.users`))[0].c;
check('registro -> «Confirma tu correo» con la dirección escrita', /Confirma tu correo para empezar tus 24 horas/.test(s) && /persona\.nueva@gmail\.com/.test(s), s.slice(0, 300));
check('…texto de spam pedido (no es spam)', /Si no lo ves en unos minutos, revisa la carpeta de spam o correo no deseado y marca el mensaje como «no es spam»/.test(s));
check('…aviso discreto para Gmail', /Consejo para Gmail/.test(s) && !/Consejo para Outlook/.test(s));
check('…línea de contacto con enlace a hello@motherverdeny.com', /¿Sigues sin recibirlo\? Escríbenos a hello@motherverdeny\.com/.test(s) && await b.ev(`!!document.querySelector('#accesoContent a[href="mailto:hello@motherverdeny.com"]')`));
check('…el registro envió el primer correo, que vuelve a la app', (await auth()).some((x) => x.type === 'signup' && x.email === 'persona.nueva@gmail.com' && x.redirect_to === APP));
check('…«Reenviar correo» espera 60 s desde el registro', (await resendBtn(b))?.disabled === true && /Podrás reenviarlo en \d+ s/.test(await screenText(b)));
for (const [L, re] of [['en', /check your spam or junk folder and mark the message as “not spam”[\s\S]*Still haven’t received it\? Write to us at hello@motherverdeny\.com/], ['de', /schau im Spam- oder Junk-Ordner nach[\s\S]*Immer noch nichts angekommen\? Schreib uns an hello@motherverdeny\.com/], ['fr', /regarde dans le dossier spam ou courrier indésirable[\s\S]*Toujours rien reçu \? Écris-nous à hello@motherverdeny\.com/], ['es', /no es spam/]]) {
  await b.ev(`document.querySelector('#langSwitch button[data-lang=${L}]').click(); 1`); await sleep(400);
  check(`…textos de ayuda en ${L}`, re.test(await screenText(b)));
}

// ---------------------------------------------------------------- 2. resend: 60 s gap, 3 an hour
await age(b, 'signup0', [61]); await sleep(1300);
check('pasados 60 s -> se puede reenviar', (await resendBtn(b))?.disabled === false);
let n = (await auth()).filter((x) => x.type === 'resend_signup').length;
await b.ev(`document.getElementById('accResendBtn').click(); 1`); await sleep(800);
check('…reenvío 1 enviado, con «Listo»', (await auth()).filter((x) => x.type === 'resend_signup').length === n + 1 && /te enviamos el correo de nuevo/.test(await screenText(b)));
check('…y vuelve a esperar 60 s', (await resendBtn(b))?.disabled === true);
await b.ev(`document.getElementById('accResendBtn').click(); 1`); await sleep(400);
check('…clic durante la espera -> no envía', (await auth()).filter((x) => x.type === 'resend_signup').length === n + 1);
await age(b, 'signup', [300, 200]); await sleep(1300);
await b.ev(`document.getElementById('accResendBtn').click(); 1`); await sleep(800);
check('…reenvío 3 en la hora: enviado', (await auth()).filter((x) => x.type === 'resend_signup').length === n + 2);
await age(b, 'signup', [300, 200, 100]); await sleep(1300);
s = await screenText(b);
check('…después de 3 en una hora: botón bloqueado y aviso «Podrás pedir otro en N min»', (await resendBtn(b))?.disabled === true && /Ya pediste 3 reenvíos en la última hora\. Podrás pedir otro en \d+ min/.test(s), s.slice(0, 600));
await age(b, 'signup', [3700, 3650, 3620]); await sleep(1300);
check('…pasada la hora se puede otra vez', (await resendBtn(b))?.disabled === false);

// ---------------------------------------------------------------- 3. fix a mistyped e-mail on the same account
await b.ev(`document.querySelector('#accesoContent a[onclick="mvToggleFixEmail()"]').click(); 1`); await sleep(200);
check('«¿Escribiste mal tu correo? Corrígelo» abre el formulario (correo + contraseña)', !(await b.ev(`document.getElementById('accFixForm').hidden`)) && /no se crea otra/.test(await screenText(b)));
await b.ev(`document.getElementById('accFixEmail').value='persona.nueva@gmail.com'; document.getElementById('accFixPass').value='x'; document.getElementById('accFixForm').requestSubmit(); 1`); await sleep(300);
check('…el mismo correo -> lo dice, no llama a nada', /Es el mismo correo de antes/.test(await screenText(b)));
await b.ev(`document.getElementById('accFixEmail').value='persona.nueva@hotmail.com'; document.getElementById('accFixPass').value='no-es-esta'; document.getElementById('accFixForm').requestSubmit(); 1`);
s = await waitText(b, /no coincide|No pudimos|Algo/);
check('…contraseña equivocada -> «La contraseña no coincide», el correo sigue igual', /La contraseña no coincide con la de esta cuenta/.test(s) && (await sql(`select count(*)::int c from auth.users where email = 'persona.nueva@gmail.com'`))[0].c === 1, s.slice(0, 400));
await b.ev(`document.getElementById('accFixEmail').value='aportante@example.org'; document.getElementById('accFixPass').value='clave-segura-1'; document.getElementById('accFixForm').requestSubmit(); 1`);
s = await waitText(b, /No podemos usar ese correo|No pudimos|Algo/);
check('…correo que ya tiene cuenta -> «No podemos usar ese correo»', /No podemos usar ese correo/.test(s));
await b.ev(`document.getElementById('accFixEmail').value='alguien@mailinator.com'; document.getElementById('accFixPass').value='clave-segura-1'; document.getElementById('accFixForm').requestSubmit(); 1`);
s = await waitText(b, /No podemos usar ese correo|No pudimos|Algo/);
check('…dominio desechable bloqueado -> «No podemos usar ese correo»', /No podemos usar ese correo/.test(s));
n = (await auth()).filter((x) => x.type === 'resend_signup').length;
await b.ev(`document.getElementById('accFixEmail').value='Persona.Nueva@Hotmail.com'; document.getElementById('accFixPass').value='clave-segura-1'; document.getElementById('accFixForm').requestSubmit(); 1`);
s = await waitText(b, /corregimos tu correo/);
const row = await sql(`select u.email, u.email_confirmed_at, p.email_normalized from auth.users u join profiles p on p.id = u.id where u.email like 'persona.nueva@%'`);
check('…contraseña correcta -> MISMA cuenta con el correo corregido, sin confirmar', row.length === 1 && row[0].email === 'persona.nueva@hotmail.com' && row[0].email_confirmed_at === null && row[0].email_normalized === 'persona.nueva@hotmail.com', JSON.stringify(row));
check('…no se creó otra cuenta', (await sql(`select count(*)::int c from auth.users`))[0].c === usersBefore);
check('…se envió la confirmación a la dirección corregida', (await auth()).filter((x) => x.type === 'resend_signup' && x.email === 'persona.nueva@hotmail.com').length === 1 && (await auth()).filter((x) => x.type === 'resend_signup').length === n + 1);
check('…la pantalla muestra el correo nuevo, «Listo» y el aviso de Outlook/Hotmail', /persona\.nueva@hotmail\.com/.test(s) && /Listo: corregimos tu correo/.test(s) && /Consejo para Outlook y Hotmail/.test(s) && !/Consejo para Gmail/.test(s));
check('…queda en mail_events sin direcciones', (await sql(`select kind, error, ref from mail_events where kind = 'signup_email_fixed'`)).length === 1 && !JSON.stringify(await sql(`select * from mail_events`)).includes('@'));
await sql(`update auth.users set email_confirmed_at = now() where email = 'persona.nueva@hotmail.com'`);
await b.ev(`document.querySelector('#accesoContent a[onclick="mvToggleFixEmail()"]').click(); document.getElementById('accFixEmail').value='otra.vez@example.net'; document.getElementById('accFixPass').value='clave-segura-1'; document.getElementById('accFixForm').requestSubmit(); 1`);
s = await waitText(b, /ya está confirmada|No pudimos|Algo/);
check('…si la cuenta ya se confirmó -> «inicia sesión y cambia el correo en Tu cuenta», sin cambios', /Esta cuenta ya está confirmada/.test(s) && (await sql(`select email from auth.users where email like 'persona.nueva@%' or email = 'otra.vez@example.net'`)).map((r) => r.email).join() === 'persona.nueva@hotmail.com');
await b.ev(`[...document.querySelectorAll('#accesoContent button')].find((x) => /Ya lo confirmé/.test(x.textContent)).click(); 1`); await sleep(500);
check('«Ya lo confirmé: iniciar sesión» -> Cuenta en modo iniciar sesión', await b.ev(`document.getElementById('cuenta').classList.contains('active') && !document.getElementById('authForgotLink').hidden`));
await b.close();

// ---------------------------------------------------------------- 4. other domains: no extra hint
b = await browser(null, null, 390);
await open(b);
s = await signup(b, 'alguien@empresa-propia.org');
check('correo de otro dominio -> sin aviso extra de Gmail/Outlook', !/Consejo para/.test(s) && /no es spam/.test(s));
await b.close();

summary();
process.exit(0);
