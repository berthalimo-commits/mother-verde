// Browser test: hello@motherverdeny.com after grant-admin.sql (fakeserver.mjs
// runs it) = full access with no end date in the app + panel only with MFA.
// Also the dev-preview button "Ver como persona con prueba vencida".
import { check, sleep, browser, summary, ADMIN } from './browser.mjs';

const ZONES = ['home', 'cultivo', 'elaboracion', 'legal', 'ciencia', 'seguridad', 'negocio', 'comunidad', 'perfil', 'variedades',
  'calculadoras', 'bitacora', 'glosario', 'historia', 'cuenta', 'desbloquear', 'terminos', 'privacidad'];
const state = (b) => b.ev(`({ access: document.documentElement.dataset.access, locked: document.documentElement.classList.contains('mv-locked'),
  screen: document.querySelector('.screen.active')?.id, lang: document.documentElement.lang })`);
const fullAccess = (s) => s.access === 'supporter' && !s.locked;

let b = await browser(ADMIN, 'aal1', 420);
await b.send('Page.navigate', { url: 'http://localhost:5174/' }); await sleep(5000);
await b.ev(`document.getElementById('ageGateModal').style.display='none'; 1`);
let s = await state(b);
check('hello@ (prueba de 24 h terminada) entra con acceso completo, sin pantalla de bloqueo', fullAccess(s) && s.screen !== 'acceso', JSON.stringify(s));

// a) every zone, no lock
const blocked = [];
for (const z of ZONES) {
  await b.ev(`showScreen('${z}'); 1`); await sleep(250);
  const st = await state(b);
  // locked content = blurred (.blur-gate) with the unlock button (.gate-cta) on top
  const gated = await b.ev(`[...document.querySelectorAll('#${z} .blur-gate, #${z} .gate-cta')].filter((e) => e.offsetParent !== null).length`);
  if (st.screen !== z || st.locked || gated) blocked.push(`${z}->${st.screen}${gated ? ' (candado)' : ''}`);
}
check(`a) entra a las ${ZONES.length} zonas sin bloqueo ni candados`, blocked.length === 0, blocked.join(', '));
await b.ev(`showScreen('cultivo'); showSub && showSub('cultivo','cosecha'); 1`); await sleep(300);
check('…también a una subsección de pago (Cultivo → Cosecha)', (await state(b)).screen === 'cultivo' && !(await state(b)).locked);
await b.ev(`showScreen('cuenta'); 1`); await sleep(400);
const acc = await b.ev(`document.getElementById('cuenta').innerText`);
check('Cuenta → «Tu acceso» dice acceso completo (sin fecha de fin)', /acceso completo/i.test(acc) && !/te quedan/i.test(acc), acc.slice(0, 300));
check('Desbloquear no le pide aportar', /ya tienes|acceso completo/i.test(await b.ev(`showScreen('desbloquear'); document.getElementById('desbloquear').innerText`)));

// c) language changes and reload
const langs = {};
for (const L of ['en', 'de', 'fr', 'es']) { await b.ev(`document.querySelector('#langSwitch button[data-lang=${L}]').click(); 1`); await sleep(500); langs[L] = fullAccess(await state(b)); }
check('c) cambiar de idioma (EN, DE, FR, ES) no cambia el acceso', Object.values(langs).every(Boolean), JSON.stringify(langs));
await b.send('Page.reload'); await sleep(5000);
check('…ni recargar la página', fullAccess(await state(b)));

// c) password change (same call as the new-password form) then reload
const pw = await b.ev(`window.mvSupabase.auth.updateUser({ password: 'NuevaClave-2026' }).then((r) => !r.error)`);
await b.send('Page.reload'); await sleep(5000);
check('c) tras cambiar la contraseña sigue con acceso completo', pw === true && fullAccess(await state(b)));

// c) sign out, then sign in again with the form
await b.ev(`document.getElementById('authLogoutBtn').click(); 1`); await sleep(1500);
s = await state(b);
check('cerrar sesión -> queda como visitante (bloqueado)', s.access === 'visitor' && s.locked, JSON.stringify(s));
await b.ev(`showScreen('cuenta'); document.getElementById('authEmailInput').value='hello@motherverdeny.com'; document.getElementById('authPasswordInput').value='NuevaClave-2026';
  document.getElementById('authForm').requestSubmit(); 1`);
for (let i = 0; i < 20 && !fullAccess(await state(b)); i++) await sleep(300);
check('c) volver a entrar -> acceso completo otra vez', fullAccess(await state(b)), JSON.stringify(await state(b)));

// 3) dev preview: "Ver como persona con prueba vencida" and back
check('vista previa de dev: botón «Ver como persona con prueba vencida»', await b.ev(`!!document.getElementById('mvDpExpired') && document.getElementById('mvDpExpired').textContent === 'Ver como persona con prueba vencida'`));
await b.ev(`document.getElementById('mvDpExpired').click(); 1`); await sleep(500);
s = await state(b);
const lockText = await b.ev(`document.getElementById('acceso').innerText`);
check('…muestra la pantalla de bloqueo como la ve una persona con la prueba vencida', s.access === 'expired' && s.locked && s.screen === 'acceso' && /Tu prueba gratis terminó/.test(lockText), JSON.stringify(s));
await b.ev(`showScreen('ciencia'); 1`); await sleep(300);
check('…y las zonas de pago la mandan al bloqueo', (await state(b)).screen === 'acceso');
await b.ev(`document.getElementById('mvDpReal').click(); 1`); await sleep(500);
s = await state(b);
check('«Volver a mi cuenta real» -> acceso completo otra vez, en Inicio', fullAccess(s) && s.screen === 'home', JSON.stringify(s));
await b.close();

// b) panel only with MFA
b = await browser(ADMIN, 'aal1', 420);
await b.send('Page.navigate', { url: 'http://localhost:5174/panel-mv.html' });
let p = await b.waitFor(/Activa la verificación|Escribe el código|Avisos de aporte/);
check('b) panel sin MFA -> pide activar la verificación en dos pasos, sin datos', /Activa la verificación en dos pasos/.test(p) && !/aportante@example\.org/.test(p), p.slice(0, 200));
await b.ev(`document.getElementById('code').value='123456'; document.getElementById('go').click(); 1`);
p = await b.waitFor(/Avisos de aporte/);
check('…con el código correcto -> panel completo (Resumen, Usuarios, Avisos, Códigos, Registro)', ['Resumen', 'Usuarios', 'Avisos de aporte', 'Códigos de regalo', 'Registro'].every((x) => p.includes(x)), p.slice(0, 300));
await b.close();
b = await browser(ADMIN, 'aal2', 420);
await b.send('Page.navigate', { url: 'http://localhost:5174/' }); await sleep(5000);
check('con la sesión MFA (aal2) la app sigue con acceso completo', fullAccess(await state(b)));
await b.close();
summary();
