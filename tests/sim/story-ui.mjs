// Browser test (2026-11-03): welcome story «Nuestra historia» (once after the
// age gate, Más/footer link, Esc, swipe, reduced motion, 4 languages, 320 and
// 1920 px), the person-icon menu (Mi cuenta / Mi perfil / Cerrar sesión), «Ya
// tienes cuenta: entra o recupera tu contraseña», the purpose box with its
// tick (Desbloquear) and the short notice on the lock screen.
// Needs Vite on 5174 + a fresh fakeserver.
import { check, sleep, sql, browser, summary } from './browser.mjs';
import path from 'path';
const APP = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const { PURPOSE_TEXTS: T } = await import('file:///' + path.join(APP, 'src/purposeTexts.js'));
const NEWBIE = 'b0000003-0000-4000-8000-000000000000';
const L = ['es', 'en', 'de', 'fr'];
const lang = (b, l) => b.ev(`document.querySelector('#langSwitch button[data-lang=${l}]').click(); 1`).then(() => sleep(400));
const st = (b) => b.ev(`(() => { const m = document.getElementById('storyModal'); return m ? { open: true, step: document.getElementById('storyStep').textContent, h: document.querySelector('.story-slide[aria-hidden=false] h2')?.textContent, focus: document.activeElement?.id || '', next: document.getElementById('storyNext').textContent, skip: document.getElementById('storySkip').textContent, modal: m.getAttribute('aria-modal'), role: m.getAttribute('role') } : { open: false }; })()`);

// ---------------------------------------------------------------- A. visitor, phone
let b = await browser(null, 'aal1', 390);
await b.send('Page.navigate', { url: 'http://localhost:5174/' }); await sleep(5000);
check('sin confirmar la edad no hay historia', !(await st(b)).open);
await b.ev(`document.querySelector('#ageGateModal button[onclick="ageGateConfirm(true)"]').click(); 1`); await sleep(900);
let s = await st(b);
check('al confirmar la edad se abre la historia (diálogo modal), pantalla 1 de 6 con el foco en su título', s.open && s.role === 'dialog' && s.modal === 'true' && s.step === 'Pantalla 1 de 6' && s.h === T.story1H.es && s.focus === 'storyH1', JSON.stringify(s));
check('«Saltar e ir a la plataforma» y «Continuar» siempre visibles', s.skip === T.storySkip.es && s.next === T.storyNext.es && await b.ev(`[...document.querySelectorAll('#storySkip, #storyNext')].every((x) => x.getBoundingClientRect().bottom <= innerHeight && x.offsetParent !== null)`));
check('foto de la pantalla 1: hasta tu «APRUEBO» se ve el marcador con su texto alternativo', await b.ev(`(() => { const f = document.querySelector('#storySlide1 .story-photo'); const soon = f.querySelector('.story-photo-soon'); return !!f && !soon.hidden && soon.innerText.includes(${JSON.stringify(T.storyAlt1.es)}) && f.querySelector('img').alt === ${JSON.stringify(T.storyAlt1.es)}; })()`));
check('pantalla 2: dos fotos (07 y 05) con sus textos alternativos; las fotos de las pantallas 2 a 5 se cargan «perezosamente»', await b.ev(`document.querySelectorAll('#storySlide2 .story-photo').length === 2 && [...document.querySelectorAll('#storySlide2 img, #storySlide3 img, #storySlide4 img, #storySlide5 img')].every((i) => i.loading === 'lazy' && i.alt.length > 10)`));
await b.shot('story-1-movil');
for (let n = 2; n <= 6; n++) { await b.ev(`document.getElementById('storyNext').click(); 1`); await sleep(500); }
s = await st(b);
check('«Continuar» hasta la 6: «Gracias», «Entrar a la plataforma» y «Mother Verde es un proyecto independiente…»', s.step === 'Pantalla 6 de 6' && s.h === T.story6H.es && s.next === T.storyEnter.es && await b.ev(`document.querySelector('#storySlide6 .story-independent').textContent === ${JSON.stringify(T.storyIndependent.es)}`), JSON.stringify(s));
check('pantalla 5: calculadoras (17), viajes, juego y comunidad', await b.ev(`(() => { const t = document.getElementById('storySlide5').innerText; return t.includes(${JSON.stringify(T.story5Calc.es)}) && t.includes(${JSON.stringify(T.story5Viaje.es)}) && t.includes(${JSON.stringify(T.story5Comunidad.es)}) && (t.includes(${JSON.stringify(T.story5Juego.es)}) || t.includes(${JSON.stringify(T.story5JuegoPronto.es)})); })()`));
await b.shot('story-6-movil');
await b.ev(`document.getElementById('storyNext').click(); 1`); await sleep(300);
check('«Entrar a la plataforma» la cierra y queda marcada como vista', !(await st(b)).open && await b.ev(`localStorage.getItem('mv-story-seen') === '1'`));
await b.send('Page.reload'); await sleep(5000);
check('al recargar no vuelve a salir', !(await st(b)).open);
// Más -> Nuestra historia; swipe; Esc
await b.ev(`document.getElementById('tabsMoreBtn').click(); 1`); await sleep(200);
check('«Más ▾» tiene «Mi cuenta» y «Nuestra historia»', await b.ev(`!!document.getElementById('moreCuenta') && document.getElementById('moreHistoria').textContent === ${JSON.stringify(T.navHistoria.es)}`));
await b.ev(`document.getElementById('moreHistoria').click(); 1`); await sleep(500);
check('«Más ▾ → Nuestra historia» la vuelve a abrir', (await st(b)).open);
await b.ev(`(() => { const t = document.getElementById('storyTrack'); t.scrollLeft = t.clientWidth * 2; })(); 1`); await sleep(600);
check('deslizar (scroll horizontal) cambia de pantalla: «Pantalla 3 de 6»', (await st(b)).step === 'Pantalla 3 de 6');
await b.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await sleep(300);
check('Esc = saltar: se cierra', !(await st(b)).open);
check('el pie de página tiene «Nuestra historia» y la abre', await b.ev(`(() => { document.getElementById('footerHistoria').click(); return !!document.getElementById('storyModal'); })()`));
await b.ev(`document.getElementById('storySkip').click(); 1`); await sleep(200);
// 4 languages
const langs = {};
for (const l of L) { await lang(b, l); await b.ev(`window.mvOpenStory(); 1`); await sleep(300); const x = await st(b); langs[l] = x.h === T.story1H[l] && x.skip === T.storySkip[l] && x.next === T.storyNext[l]; await b.ev(`document.getElementById('storySkip').click(); 1`); await sleep(200); }
check('la historia en los 4 idiomas (título, «Saltar…», «Continuar»)', L.every((l) => langs[l]), JSON.stringify(langs));
await lang(b, 'es');
// reduced motion
await b.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
await b.ev(`window.mvOpenStory(); 1`); await sleep(200);
const jump = await b.ev(`(() => { document.getElementById('storyNext').click(); const t = document.getElementById('storyTrack'); return Math.abs(t.scrollLeft - t.clientWidth) < 2; })()`);
check('con «reducir movimiento» cambia de pantalla sin animación (salto inmediato)', jump);
await b.ev(`document.getElementById('storySkip').click(); 1`);
// person icon, signed out -> Entrar
await b.ev(`document.getElementById('accountBtn').click(); 1`); await sleep(400);
check('icono de persona sin sesión -> «Cuenta» para entrar, con su nombre para lectores de pantalla', await b.ev(`document.getElementById('cuenta').classList.contains('active') && document.getElementById('accountBtn').getAttribute('aria-label') === ${JSON.stringify(T.acctBtnOut.es)}`));
// «Ya tienes cuenta»
await sql(`insert into auth.users (id, email, email_confirmed_at) values ('c0000099-0000-4000-8000-000000000000', 'bertha.limo@gmail.com', now()) on conflict do nothing`);
const signup = async (email) => { await b.ev(`window.mvSetAuthMode('signup'); document.getElementById('authEmailInput').value = ${JSON.stringify(email)}; document.getElementById('authPasswordInput').value = 'Prueba-1234-segura'; document.getElementById('authSubmitBtn').click(); 1`); await sleep(1500); return b.ev(`document.getElementById('authMsg').innerText`); };
let msg = await signup('hello@motherverdeny.com');
check('«Crear cuenta» con un correo que ya existe -> «Ya tienes cuenta: entra o recupera tu contraseña» con «Entrar» y «Olvidé mi contraseña»', msg.startsWith(T.authErrAccountExists.es) && await b.ev(`!!document.getElementById('authExistsLogin') && !!document.getElementById('authExistsForgot')`), msg);
msg = await signup('Berthalimo+otra@googlemail.com');
check('…también con una variante de un Gmail que ya tiene cuenta', msg.startsWith(T.authErrAccountExists.es), msg);
check('…y no se crea ninguna cuenta', (await sql(`select count(*)::int n from auth.users where lower(email) like 'berthalimo+otra%'`))[0].n === 0);
msg = await signup('alguien@mailinator.com');
check('un dominio desechable sigue con su propio mensaje (no dice «Ya tienes cuenta»)', !msg.startsWith(T.authErrAccountExists.es) && msg.length > 10, msg);
await signup('hello@motherverdeny.com');
await b.ev(`document.getElementById('authExistsForgot').click(); 1`); await sleep(1500);
const rec = await (await fetch('http://localhost:54322/__auth')).json();
check('«Olvidé mi contraseña» pasa a «Entrar» y envía el enlace de recuperación', await b.ev(`document.getElementById('authSubmitBtn').textContent`) !== '' && rec.some((m) => /recover/.test(m.type) && m.email === 'hello@motherverdeny.com'), JSON.stringify(rec)?.slice(0, 200));
for (const [w, name] of [[320, 'story-320'], [1920, 'story-1920']]) {
  await b.send('Emulation.setDeviceMetricsOverride', { width: w, height: w < 600 ? 640 : 1000, deviceScaleFactor: 1, mobile: w < 600 });
  await b.ev(`window.mvOpenStory(); 1`); await sleep(400);
  check(`historia a ${w} px: sin desbordar y con los botones a la vista`, await b.ev(`document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('#storySkip, #storyNext')].every((x) => x.getBoundingClientRect().bottom <= innerHeight)`));
  await b.shot(name);
  await b.ev(`document.getElementById('storySkip').click(); 1`);
}
await b.close();

// ---------------------------------------------------------------- B. signed in (trial over)
b = await browser(NEWBIE, 'aal1', 390);
await b.send('Page.navigate', { url: 'http://localhost:5174/' }); await sleep(5000);
await b.ev(`document.getElementById('ageGateModal').style.display='none'; document.getElementById('mvDevPreview')?.remove(); 1`);
check('pantalla de bloqueo: el aviso corto del motivo', (await b.ev(`document.getElementById('accAvisoCorto')?.textContent`)) === T.dsAvisoCorto.es);
await b.ev(`document.getElementById('accountBtn').click(); 1`); await sleep(300);
const menu = await b.ev(`({ open: !document.getElementById('acctMenu').hidden, exp: document.getElementById('accountBtn').getAttribute('aria-expanded'), items: [...document.querySelectorAll('#acctMenu [role=menuitem]')].map((x) => x.textContent), label: document.getElementById('accountBtn').getAttribute('aria-label'), focus: document.activeElement?.id })`);
check('icono de persona con sesión -> menú «Mi cuenta», «Mi perfil en la Comunidad», «Cerrar sesión» (foco en el primero)', menu.open && menu.exp === 'true' && menu.items.join('|') === [T.acctMenuCuenta.es, T.acctMenuPerfil.es, T.acctMenuSalir.es].join('|') && menu.label === T.acctBtnIn.es && menu.focus === 'acctMenuCuenta', JSON.stringify(menu));
await b.ev(`document.getElementById('acctMenuCuenta').click(); 1`); await sleep(500);
check('«Mi cuenta» abre Cuenta (correo de inicio de sesión y código de regalo) en 2 toques', await b.ev(`document.getElementById('cuenta').classList.contains('active') && document.getElementById('acctMenu').hidden`));
const menuL = {};
for (const l of L) { await lang(b, l); await b.ev(`document.getElementById('accountBtn').click(); 1`); await sleep(200); menuL[l] = await b.ev(`document.getElementById('acctMenuCuenta').textContent === ${JSON.stringify(T.acctMenuCuenta)}[${JSON.stringify(l)}] && document.getElementById('accountBtn').getAttribute('aria-label') === ${JSON.stringify(T.acctBtnIn)}[${JSON.stringify(l)}]`); await b.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await sleep(100); }
check('el menú de la cuenta en los 4 idiomas, y Esc lo cierra', L.every((l) => menuL[l]) && await b.ev(`document.getElementById('acctMenu').hidden`), JSON.stringify(menuL));
await lang(b, 'es');
// Desbloquear: purpose + tick
await sql(`delete from support_claims where user_id = '${NEWBIE}'`);
await b.ev(`showScreen('desbloquear'); 1`); await sleep(800);
const box = await b.ev(`({ h: document.querySelector('#dsPurpose h3')?.textContent, items: [...document.querySelectorAll('#dsPurpose li')].map((x) => x.innerText), check: !!document.getElementById('dsPurposeOk'), checked: document.getElementById('dsPurposeOk')?.checked, btn: document.getElementById('dsReservarBtn')?.disabled, aviso: document.getElementById('dsAvisoCorto')?.textContent, wallet: document.querySelector('#dsPurpose .ds-wallet')?.textContent })`);
check('Desbloquear: «Antes de aportar: para qué es tu aporte» con los 6 puntos, la billetera de Bertha y el aviso corto', box.h === T.dsPropH3.es && box.items.length === 6 && box.items[0] === T.dsProp1.es && box.items[2] === T.dsProp3.es && /billetera personal de cripto de Bertha Limo/.test(box.wallet) && box.aviso === T.dsAvisoCorto.es, JSON.stringify(box));
check('sin marcar la casilla, «Reservar» está desactivado', box.check && !box.checked && box.btn === true);
await b.ev(`document.getElementById('dsReservarBtn').click(); 1`); await sleep(800);
check('…y no se reserva nada', (await sql(`select count(*)::int n from support_claims where user_id = '${NEWBIE}'`))[0].n === 0);
await b.ev(`(() => { const c = document.getElementById('dsPurposeOk'); c.checked = true; c.dispatchEvent(new Event('change')); })(); 1`); await sleep(300);
check('al marcarla, «Reservar» se activa', (await b.ev(`document.getElementById('dsReservarBtn').disabled`)) === false);
await b.ev(`document.getElementById('dsReservarBtn').click(); 1`); await sleep(1500);
const row = (await sql(`select purpose_accepted_at from support_claims where user_id = '${NEWBIE}' and status = 'awaiting_payment'`))[0];
check('reservar guarda solo que aceptó y cuándo; aparecen el monto y la dirección', !!row?.purpose_accepted_at && await b.ev(`!!document.getElementById('dsAmount') && !!document.getElementById('dsAddr')`), JSON.stringify(row));
check('el enlace a los Términos abre los Términos', await b.ev(`(() => { document.getElementById('dsTermsLink').click(); return document.getElementById('terminos').classList.contains('active'); })()`));
await b.ev(`showScreen('desbloquear'); 1`); await sleep(400);
const pl = {};
for (const l of L) { await lang(b, l); pl[l] = await b.ev(`document.querySelector('#dsPurpose h3').textContent === ${JSON.stringify(T.dsPropH3)}[${JSON.stringify(l)}] && document.querySelector('#dsPurpose .ds-purpose-check span')?.textContent === ${JSON.stringify(T.dsPropCheck)}[${JSON.stringify(l)}]`); }
check('la pantalla de aporte en los 4 idiomas', L.every((l) => pl[l]), JSON.stringify(pl));
await lang(b, 'es');
await b.shot('desbloquear-proposito');
await b.ev(`showScreen('negocio'); 1`); await sleep(300);
check('«La fundadora estudia en esta institución» junto a SUNY Morrisville', await b.ev(`(() => { const p = document.querySelector('[data-i18n="eduSunyFundadora"]'); return !!p && p.closest('.edu-card')?.querySelector('h4')?.textContent === 'SUNY Morrisville'; })()`));
await b.close();
summary();
process.exit(0);
