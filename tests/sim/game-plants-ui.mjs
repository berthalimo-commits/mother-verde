// Browser test — several plants, regular seeds (males) and autoflowers.
// Played by touch against the local copy of staging (fakeserver: same
// migrations, including 20261031100000_game_plants). Each screen goes through
// the full-run audit (nothing locked without explanation, a way forward, no
// console errors, every «¿Por qué?» with its backing, 4 languages, no
// overflow). Screenshots: tests/sim/out/jgplantas-*.png.
import { summary, check } from './browser.mjs';
import { RULES, E, TEXTS, IDEAL, NEUTRAL, session, audit, setup, germ, week, click, gs, gameAt, growToHarvest, shots, reload, report, GERM_OK } from './game-full-lib.mjs';

const tes = TEXTS.es;
const POL = RULES.semillas.regular.resta_polinizacion;
const caption = (b) => b.ev(`document.getElementById('jgTentDesc')?.textContent || ''`);
const bubble = (b) => b.ev(`document.getElementById('jgBubble')?.innerText || ''`);
const tentAttr = (b, a) => b.ev(`document.querySelector('#jgTent svg.jgt-svg')?.getAttribute('data-${a}')`);
const plantOpts = (b) => b.ev(`[...document.querySelectorAll('input[name="jgSetupForm-plantas"]')].map((i) => i.value).join()`);
const picked = (b, d) => b.ev(`document.querySelector('input[name="jgSetupForm-${d}"]:checked')?.value || ''`);
const whys = (b, gid) => b.ev(`[...document.querySelectorAll('.jg-whys[data-gid="${gid}"] .jg-why')].map((x) => x.dataset.why)`);
const REG = (n, extra = {}) => ({ ...NEUTRAL, carpa: 'grande', semilla: 'regular', plantas: String(n), ...extra });

// ------------------------------------------------------------ 1. the setup screen
console.log('1. Prepara tu carpa: semilla y número de plantas (celular)');
let b = await session(390);
check('las dos preguntas nuevas aparecen ya marcadas: feminizada y 1 planta', await picked(b, 'semilla') === 'feminizada' && await picked(b, 'plantas') === '1');
await click(b, 'label[for="jgSetupForm-carpa-pequena"]');
check('carpa pequeña: solo 1 o 2 plantas', await plantOpts(b) === '1,2');
await click(b, 'label[for="jgSetupForm-carpa-grande"]');
check('carpa grande: de 1 a 6', await plantOpts(b) === '1,2,3,4,5,6');
await click(b, 'label[for="jgSetupForm-plantas-6"]');
await click(b, 'label[for="jgSetupForm-carpa-mediana"]');
check('6 plantas y luego carpa mediana: se queda en 4 (las que caben)', await picked(b, 'plantas') === '4' && await plantOpts(b) === '1,2,3,4');
check('la carpa dibuja las 4 macetas y lo dice', await tentAttr(b, 'plantas') === '4' && (await caption(b)).includes(tes.jgTentMacetas.replace('{n}', 4)));
await audit(b, 'preparar la carpa con semilla y plantas', { langs: true });
await shots(b, 'jgplantas-setup');
await setup(b, { sistema: 'maceta', carpa: 'grande', luz: 'led', sustrato: 'tierra', maceta: 'plastico', maceta_tam: 'grande', riego_tipo: 'mano', medir: 'si', semilla: 'regular', plantas: '4' });
await germ(b, GERM_OK);
let s = await gs(b);
check('se guarda: regular, 4 plantas (número)', s.stage === 'plantula' && s.setup.semilla === 'regular' && s.setup.plantas === 4, JSON.stringify(s.setup));
check('el estado de la planta muestra la semilla y las plantas', (await b.ev(`document.getElementById('jgEquipo')?.textContent || ''`)).includes(tes.jgSetupO_semilla_regular)
  && (await b.ev(`document.getElementById('jgEquipo').textContent`)).includes(tes.jgSetupO_plantas_4));
await b.close();

// ------------------------------------------------------------ 2. males removed in time
console.log('2. Semillas regulares: retirar los machos a tiempo');
b = await session(390, gameAt('floracion', 1, REG(4)));
check('1.ª semana de floración: 2 de 4 plantas con sacos de polen, el guía lo dice', await tentAttr(b, 'machos') === '2'
  && await b.ev(`document.querySelectorAll('#jgTent [data-sexo="macho"]').length`) === 2 && (await bubble(b)).includes(tes.jgGuia_machos.replace('{n}', 2)));
check('botón «Retirar los machos (2)» y su «¿Por qué? · Machos en la carpa»', await b.ev(`document.getElementById('jgMachos')?.textContent`) === tes.jgRetirarMachos.replace('{n}', 2)
  && (await whys(b, 'guia')).includes('polen'));
check('el texto de la carpa lo cuenta', (await caption(b)).includes(tes.jgTentMachos.replace('{n}', 2)));
await audit(b, 'machos a la vista', { langs: true });
await shots(b, 'jgplantas-machos');
await click(b, '#jgMachos');
s = await gs(b);
check('retirarlos: quedan 2 hembras, sin sacos, y se guarda «retirados»', s.setup.machos === 'retirados' && await tentAttr(b, 'machos') === '0'
  && await b.ev(`document.querySelectorAll('#jgTent .jgt-one').length`) === 2 && !(await b.ev(`!!document.getElementById('jgMachos')`)) && (await bubble(b)).includes(tes.jgFb_machosRetirados));
await reload(b);
check('al volver a abrir siguen fuera', (await gs(b)).setup.machos === 'retirados' && await tentAttr(b, 'machos') === '0');
s = await growToHarvest(b);
check('cosecha sin semillas: «Plantas hembra cosechadas: 2», sin resta por polen', s.stage === 'secado' && !s.result.polen && s.result.hembras === 2);
await audit(b, 'cosecha de 2 hembras');
await b.close();

// ------------------------------------------------------------ 3. males left in the tent
console.log('3. Semillas regulares: los machos se quedan y sueltan el polen (computadora)');
b = await session(1280, gameAt('floracion', 1, REG(3)));
check('3 plantas en la partida 1: 1 macho', await tentAttr(b, 'machos') === '1');
await week(b, IDEAL('floracion'));
check('pasar la 1.ª semana: todavía nada', !(await gs(b)).setup.machos && await b.ev(`!!document.getElementById('jgMachos')`));
await week(b, IDEAL('floracion'));
s = await gs(b);
check('pasar la 2.ª: sueltan el polen; el guía lo dice y el «¿Por qué?» aparece', s.setup.machos === 'tarde' && (await bubble(b)).includes(tes.jgFb_polinizado) && (await whys(b, 'guia')).includes('polen'));
check('la carpa muestra semillas en los cogollos y lo cuenta', await b.ev(`document.querySelectorAll('#jgTent .jgt-seeds').length`) > 0 && (await caption(b)).includes(tes.jgTentPolen));
await audit(b, 'cogollos polinizados', { langs: true });
await shots(b, 'jgplantas-polen');
s = await growToHarvest(b);
await click(b, '#jgSkipRosin');
const fin = async () => { for (const st of ['secado', 'curado']) { const g = await gs(b); if (g.stage !== st) continue; await b.ev(`(() => { for (const f of document.querySelectorAll('#jgPostForm fieldset')) f.querySelector('input').click(); })(); 1`); await click(b, '#jgPostNext'); } await click(b, '#jgSkipRosin'); };
await fin();
s = await gs(b);
check(`final: «Cogollos con semillas: −${POL}» y 2 hembras cosechadas`, s.stage === 'fin' && s.result.polen === POL && await b.ev(`document.getElementById('jgFinPolen')?.textContent`) === tes.jgFinPolen.replace('{n}', POL)
  && await b.ev(`document.getElementById('jgFinPlantas')?.textContent`) === tes.jgFinPlantas.replace('{n}', 2), JSON.stringify(s.result));
const rvTxt = await b.ev(`document.querySelector('#juego .jg-rv-item[data-rv="polen"]')?.innerText || ''`);
check(`el repaso explica la polinización: semana, −${POL}, qué funciona mejor (no única) y su «¿Por qué?»`, rvTxt.includes(tes.jgRv_polenNota.replace('{n}', POL)) && rvTxt.includes(tes.jgRv_mejorPolen)
  && rvTxt.includes(tes.jgRv_noUnica) && await b.ev(`!!document.querySelector('#juego .jg-rv-item[data-rv="polen"] .jg-why[data-why="polen"]')`), rvTxt.slice(0, 300));
await shots(b, 'jgplantas-final-polen');
await audit(b, 'final con polinización');
await audit(b, 'final con polinización (idiomas)', { langs: true });
await b.close();

// ------------------------------------------------------------ 4. autoflower
console.log('4. Autofloreciente: florece por edad (celular)');
b = await session(390);
await setup(b, { sistema: 'maceta', carpa: 'mediana', luz: 'led', sustrato: 'tierra', maceta: 'plastico', maceta_tam: 'grande', riego_tipo: 'mano', medir: 'si', semilla: 'autofloreciente', plantas: '2' });
await germ(b, GERM_OK);
for (let i = 0; i < 2; i++) await week(b, IDEAL('plantula'));
s = await gs(b);
check('vegetativo: el guía de la autofloreciente (sin cambiar a 12/12)', s.stage === 'vegetativo' && (await bubble(b)).includes(tes.jgGuia_vegetativo_auto));
await week(b, { ...IDEAL('vegetativo'), fotoperiodo: '12/12' });
s = await gs(b);
check('12/12 en vegetativo: no florece, el guía lo explica con su «¿Por qué? · Autofloreciente»', s.stage === 'vegetativo' && (await bubble(b)).includes(tes.jgFb_autoNo1212) && (await whys(b, 'guia')).includes('auto'));
await audit(b, 'autofloreciente con 12/12 en vegetativo', { langs: true });
await week(b, IDEAL('vegetativo'));
s = await gs(b);
check('tras 2 semanas de vegetativo florece sola', s.stage === 'floracion' && (await bubble(b)).includes(tes.jgFb_flipEdad) && (await bubble(b)).includes(tes.jgGuia_floracion_auto));
for (let i = 0; i < 4; i++) await week(b, { ...IDEAL('floracion'), fotoperiodo: '18/6' });
s = await gs(b);
check('5.ª semana de floración con 18/6: tricomas en su punto (mezcla) y sin resta por la luz', s.stageWeek === 5 && s.trich === 'mezcla' && !s.log.filter((l) => l.s === 'floracion').some((l) => l.l.fotoperiodo));
await shots(b, 'jgplantas-auto');
await click(b, '#jgHarvest');
s = await gs(b);
check('cosecha a las 9 semanas desde la semilla con +20 de tricomas', s.stage === 'secado' && s.result.pts === 20 && s.week === 9);
await audit(b, 'cosecha de la autofloreciente');
await b.close();

// ------------------------------------------------------------ 5. a save from before
console.log('5. Partida guardada antes de esta etapa');
const old = gameAt('vegetativo', 2, NEUTRAL);
delete old.setup.semilla; delete old.setup.plantas;
b = await session(390, old);
check('carga, 1 planta, el equipo sin «undefined»', (await gs(b)).stage === 'vegetativo' && await tentAttr(b, 'plantas') === '1'
  && !(await b.ev(`document.getElementById('jgEquipo').textContent`)).includes('jgSetup') && !(await b.ev(`document.getElementById('jgEquipo').textContent`)).includes('undefined'));
await week(b, IDEAL('vegetativo'));
check('sigue jugando y guardando', (await gs(b)).stageWeek === 3);
await audit(b, 'partida de antes');
await b.close();

report('game-plants-ui');
summary();
