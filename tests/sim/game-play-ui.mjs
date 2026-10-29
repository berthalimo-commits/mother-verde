// Browser test — juego v2, fase 1: the «¡Juega ya!» buttons (src/game/entry.js).
// Top bar + Home; with access -> the game; without access -> Desbloquear with
// the note (never an error); the game is still downloaded only on entering;
// 4 languages live; phone (short label, no overflow) + computer; keyboard; 44 px.
// Needs fakeserver.mjs (fresh) + vite on 5174, like game-ui.mjs.
import { check, sleep, sql, browser, summary, PAYER } from './browser.mjs';

const NEWBIE = 'b0000003-0000-4000-8000-000000000000';
const open = async (b) => { await b.send('Page.navigate', { url: 'http://localhost:5174/' }); await sleep(5500); await b.ev(`document.getElementById('ageGateModal').style.display='none'; document.getElementById('mvDevPreview')?.remove(); 1`); };
const screen = (b) => b.ev(`document.querySelector('.screen.active')?.id`);
const gameLoaded = (b) => b.ev(`performance.getEntriesByType('resource').some((r) => /\\/src\\/game\\/game\\.js/.test(r.name))`);
const waitScreen = async (b, id) => { for (let i = 0; i < 30; i++) { if (await screen(b) === id) break; await sleep(200); } await sleep(300); };
const visible = (b, id) => b.ev(`(() => { const e = document.getElementById('${id}'); return !!e && !!e.offsetParent && getComputedStyle(e).display !== 'none'; })()`);
const box = (b, id) => b.ev(`(() => { const r = document.getElementById('${id}').getBoundingClientRect(); return { w: r.width, h: r.height, right: r.right }; })()`);
const label = (b, id) => b.ev(`document.getElementById('${id}').innerText.trim()`);
const noOverflow = (b) => b.ev(`document.documentElement.scrollWidth <= window.innerWidth + 1`);

// ------------------------------------------------------------ with access (24 h trial), computer
await sql(`update profiles set subscription_status = 'trialing', trial_ends_at = now() + interval '20 hours', trial_started_at = now() where id = '${NEWBIE}'`);
let b = await browser(NEWBIE, 'aal1', 1280);
await open(b);
check('computadora: «¡Juega ya!» en la barra de arriba, fuera del menú «Más»', await visible(b, 'jgPlayTop') && await b.ev(`!document.getElementById('jgPlayTop').closest('#tabsMore, nav.tabs') && !!document.getElementById('jgPlayTop').closest('.topbar')`));
check('computadora: texto largo «¡Juega ya!»', await label(b, 'jgPlayTop') === '¡Juega ya!', await label(b, 'jgPlayTop'));
check('portada: otro «¡Juega ya!» junto a los botones principales', await visible(b, 'jgPlayHero') && await b.ev(`document.getElementById('jgPlayHero').parentElement.classList.contains('hero-actions')`) && await label(b, 'jgPlayHero') === '¡Juega ya!');
check('los botones existen pero el juego NO se descarga hasta pulsar', await gameLoaded(b) === false);
const topBox = await box(b, 'jgPlayTop');
check('botón de arriba ≥ 44 px de alto', topBox.h >= 44, JSON.stringify(topBox));
check('contraste del texto del botón (oscuro sobre ámbar)', await b.ev(`getComputedStyle(document.getElementById('jgPlayTop')).color`) === 'rgb(4, 20, 15)');
await b.shot('jg-play-es-desktop');
await b.ev(`document.getElementById('jgPlayTop').click(); 1`);
await waitScreen(b, 'juego');
for (let i = 0; i < 30 && !(await b.ev(`!!document.getElementById('jgStart') || !!document.getElementById('jgSetupForm') || !!document.getElementById('jgNext')`)); i++) await sleep(200);
check('con acceso: «¡Juega ya!» de arriba abre el juego', await screen(b) === 'juego' && await gameLoaded(b) === true && await b.ev(`!!document.getElementById('jgStart') || !!document.getElementById('jgSetupForm') || !!document.getElementById('jgNext')`));
check('…y no queda ningún aviso de bloqueo', await b.ev(`document.getElementById('jgLockNote').hidden`) === true);
await b.ev(`showScreen('home'); 1`); await sleep(300);
await b.ev(`document.getElementById('jgPlayHero').click(); 1`);
await waitScreen(b, 'juego');
check('con acceso: «¡Juega ya!» de la portada abre el juego', await screen(b) === 'juego');

// keyboard: Tab reaches the top button, Enter opens the game
await b.ev(`showScreen('home'); document.activeElement?.blur(); 1`); await sleep(300);
let reached = false;
for (let i = 0; i < 12 && !reached; i++) {
  await b.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  reached = await b.ev(`document.activeElement?.id === 'jgPlayTop'`);
}
check('teclado: Tab llega a «¡Juega ya!» y se ve el foco', reached && await b.ev(`getComputedStyle(document.activeElement).outlineStyle !== 'none'`));
await b.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
await waitScreen(b, 'juego');
check('teclado: Enter abre el juego', await screen(b) === 'juego');

// 4 languages live
await b.ev(`showScreen('home'); 1`); await sleep(300);
const want = { es: '¡Juega ya!', en: 'Play now!', de: 'Jetzt spielen!', fr: 'Joue maintenant !' };
for (const L of ['en', 'de', 'fr', 'es']) {
  await b.ev(`document.querySelector('#langSwitch button[data-lang=${L}]').click(); 1`); await sleep(500);
  const top = await label(b, 'jgPlayTop'), hero = await label(b, 'jgPlayHero');
  check(`idioma ${L} en vivo: los dos botones dicen «${want[L]}»`, top === want[L] && hero === want[L], JSON.stringify({ top, hero }));
  if (L !== 'es') await b.shot(`jg-play-${L}-desktop`);
}
await b.close();

// ------------------------------------------------------------ phone
b = await browser(NEWBIE, 'aal1', 360);
await open(b);
const shortWant = { es: 'Jugar', en: 'Play', de: 'Spielen', fr: 'Jouer' };
for (const L of ['es', 'en', 'de', 'fr']) {
  await b.ev(`document.querySelector('#langSwitch button[data-lang=${L}]').click(); 1`); await sleep(500);
  const top = await label(b, 'jgPlayTop'), hero = await label(b, 'jgPlayHero');
  check(`celular ${L}: arriba texto corto «${shortWant[L]}» + icono; portada texto entero`, top === shortWant[L] && hero === want[L] && await b.ev(`!!document.querySelector('#jgPlayTop svg')`), JSON.stringify({ top, hero }));
  check(`celular ${L}: la barra no se rompe (nada se sale de la pantalla)`, await noOverflow(b) && (await box(b, 'jgPlayTop')).right <= 360 && (await box(b, 'jgPlayHero')).right <= 360);
  await b.shot(`jg-play-${L}-mobile`);
}
check('celular: botón de arriba ≥ 44 px de alto', (await box(b, 'jgPlayTop')).h >= 44);
await b.ev(`document.querySelector('#langSwitch button[data-lang=es]').click(); 1`); await sleep(400);
await b.ev(`document.getElementById('jgPlayTop').click(); 1`);
await waitScreen(b, 'juego');
check('celular con acceso: abre el juego', await screen(b) === 'juego');
await b.close();

// ------------------------------------------------------------ without access (trial ended, no contribution)
await sql(`update profiles set subscription_status = 'trialing', trial_ends_at = now() - interval '3 days', access_until = null where id = '${PAYER}'`);
b = await browser(PAYER, 'aal1', 390);
await open(b);
check('sin acceso: «¡Juega ya!» sigue visible arriba', await visible(b, 'jgPlayTop'));
await b.ev(`document.getElementById('jgPlayTop').click(); 1`);
await waitScreen(b, 'desbloquear');
const dsTxt = await b.ev(`document.getElementById('desbloquear').innerText`);
check('sin acceso: lleva a Desbloquear (no al bloqueo ni a un error)', await screen(b) === 'desbloquear' && !/error/i.test(dsTxt), await screen(b));
check('…con el mensaje claro «El juego es parte del acceso completo…»', await visible(b, 'jgLockNote') && /El juego es parte del acceso completo/.test(dsTxt));
check('…y el juego no se descargó', await gameLoaded(b) === false);
await b.shot('jg-play-locked-es-mobile');
for (const L of ['en', 'de', 'fr']) {
  await b.ev(`document.querySelector('#langSwitch button[data-lang=${L}]').click(); 1`); await sleep(500);
  check(`sin acceso, idioma ${L}: el mensaje cambia en vivo`, (await b.ev(`document.getElementById('jgLockNote').innerText`)).includes(want[L].replace(' ', ' ')));
  await b.shot(`jg-play-locked-${L}-mobile`);
}
await b.ev(`document.querySelector('#langSwitch button[data-lang=es]').click(); 1`); await sleep(400);
await b.ev(`showScreen('cuenta'); 1`); await sleep(300);
check('al salir de Desbloquear el mensaje se esconde', await b.ev(`document.getElementById('jgLockNote').hidden`) === true);
await b.ev(`showScreen('desbloquear'); 1`); await sleep(300);
check('entrar a Desbloquear por otro camino -> sin el mensaje del juego', await b.ev(`document.getElementById('jgLockNote').hidden`) === true);
await b.close();

// visitor (no account)
b = await browser(null, 'aal1', 1280);
await open(b);
await b.ev(`document.getElementById('jgPlayTop').click(); 1`);
await waitScreen(b, 'desbloquear');
check('visitante sin cuenta: también va a Desbloquear con el mensaje', await screen(b) === 'desbloquear' && await visible(b, 'jgLockNote') && await gameLoaded(b) === false);
await b.shot('jg-play-visitor-es-desktop');
await b.close();

summary();
