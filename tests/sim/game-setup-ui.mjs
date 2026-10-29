// Browser test — Juego v2, phases 6-7: «Prepara tu carpa» and germination.
// Only the decisions that apply are shown (substrate, pot, size and watering
// only with a pot; soaking time only with the glass); the tent is drawn with
// what is picked; hydroponics has no watering; a small pot can be
// transplanted; without a meter you play blind; HPS warms the tent and the
// guide explains why; the equipment is saved on the server; 4 languages; 360 px.
import { check, sleep, sql, browser, summary } from './browser.mjs';
import fs from 'fs';

const APP = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const TEXTS = (await import('file:///' + APP + '/src/game/i18n.js')).default;
const W = await import('file:///' + APP + '/src/game/why.js');
const NEWBIE = 'b0000003-0000-4000-8000-000000000000';
const open = async (b) => {
  await b.send('Page.navigate', { url: 'http://localhost:5174/' }); await sleep(5500);
  await b.ev(`document.getElementById('ageGateModal').style.display='none'; document.getElementById('mvDevPreview')?.remove(); goMore('juego'); 1`);
  for (let i = 0; i < 30; i++) { if (await b.ev(`!!document.getElementById('jgBubble')`)) break; await sleep(200); }
  await sleep(300);
};
const pick = (b, form, d, o) => b.ev(`document.querySelector('label[for="${form}-${d}-${o}"]').click(); 1`).then(() => sleep(200));
const legends = (b, form) => b.ev(`[...document.querySelectorAll('#${form} legend')].map((l) => l.textContent)`);
const gs = (b) => b.ev(`JSON.parse(JSON.stringify(window.mvGameDebug.state))`);
const fresh = async () => { await sql(`update profiles set subscription_status = 'trialing', trial_ends_at = now() + interval '20 hours', trial_started_at = now() where id = '${NEWBIE}'`); await sql(`delete from game_progress where user_id = '${NEWBIE}'`); };

// ------------------------------------------------------------ run 1: hydroponics (DWC), glass of water, phone
console.log('1. Preparar la carpa y germinar (celular 360 px)');
await fresh();
let b = await browser(NEWBIE, 'aal1', 360);
await open(b);
check('una partida nueva empieza con «Prepara tu carpa» (no con «Plantar la semilla»)', await b.ev(`!!document.getElementById('jgSetupForm') && !document.getElementById('jgStart')`)
  && (await b.ev(`document.querySelector('#jgSetupForm h3').textContent`)) === TEXTS.es.jgSetupH);
check('al principio, 4 decisiones (carpa, luz, sistema, medir)', (await legends(b, 'jgSetupForm')).length === 4);
await pick(b, 'jgSetupForm', 'sistema', 'maceta');
check('con maceta aparecen sustrato, maceta, tamaño y riego (8 decisiones)', (await legends(b, 'jgSetupForm')).length === 8);
await pick(b, 'jgSetupForm', 'sustrato', 'coco');
await pick(b, 'jgSetupForm', 'sistema', 'dwc');
check('al cambiar a hidroponía desaparecen otra vez (y el sustrato elegido no se guarda)', (await legends(b, 'jgSetupForm')).length === 4);
check('el foco vuelve a la opción tocada', await b.ev(`document.activeElement?.id`) === 'jgSetupForm-sistema-dwc');
check('la carpa ya se ve con el sistema elegido (cubo con raíces y burbujas)', await b.ev(`document.querySelector('#jgTent .jgt-hydro')?.dataset.sistema`) === 'dwc');
await b.ev(`document.getElementById('jgSetupGo').click(); 1`); await sleep(300);
check('seguir sin elegir todo -> aviso y no avanza', (await b.ev(`document.getElementById('jgSetupFormMissing').textContent`)) === TEXTS.es.jgSetupFalta && (await gs(b)).stage === 'intro');
for (const [d, o] of [['carpa', 'mediana'], ['luz', 'led'], ['medir', 'si']]) await pick(b, 'jgSetupForm', d, o);
check('360 px: sin desborde en «Prepara tu carpa»', await b.ev(`document.documentElement.scrollWidth <= innerWidth`));
await b.shot('jg67-setup-es-mobile');
await b.ev(`document.getElementById('jgSetupGo').click(); 1`); await sleep(1200);
let st = await gs(b);
check('listo -> germinación, con el equipo guardado (sin sustrato en hidroponía)', st.stage === 'germinacion' && JSON.stringify(st.setup) === JSON.stringify({ carpa: 'mediana', luz: 'led', sistema: 'dwc', medir: 'si' }), JSON.stringify(st.setup));
check('germinación: 3 decisiones', (await legends(b, 'jgGermForm')).length === 3);
await pick(b, 'jgGermForm', 'metodo', 'vaso');
check('con el vaso de agua aparece «Tiempo en el vaso» y la carpa muestra el vaso', (await legends(b, 'jgGermForm')).includes(TEXTS.es.jgGermD_tiempo)
  && await b.ev(`document.querySelector('#jgTent .jgt-germ')?.dataset.metodo`) === 'vaso' && (await b.ev(`document.getElementById('jgTentDesc').textContent`)).includes('Vaso de agua'));
for (const [d, o] of [['temperatura', 'templada'], ['humedad', 'humedo'], ['tiempo', 'varios_dias']]) await pick(b, 'jgGermForm', d, o);
await b.shot('jg67-germ-es-mobile');
await b.ev(`document.getElementById('jgGermGo').click(); 1`); await sleep(1200);
st = await gs(b);
check('varios días en el agua -> plántula más débil (96) y el guía lo dice', st.stage === 'plantula' && st.health === 96 && (await b.ev(`document.getElementById('jgBubble').innerText`)).includes(TEXTS.es.jgFb_germMal));
const whyG = await b.ev(`[...document.querySelectorAll('.jg-whys[data-gid="guia"] .jg-why')].map((x) => x.textContent)`);
check('…con su «¿Por qué? · Tiempo en el vaso»', whyG.includes('¿Por qué? · ' + TEXTS.es.jgGermD_tiempo), JSON.stringify(whyG));
check('hidroponía: no hay decisión de riego, un aviso lo explica y no hay regadera en la carpa', !(await b.ev(`!!document.querySelector('input[name="jg-riego"]')`))
  && (await b.ev(`document.getElementById('jgFixed')?.textContent`)) === TEXTS.es.jgFijoHidro && !(await b.ev(`!!document.getElementById('jgtObj-regadera')`)));
check('el equipo se ve en el estado de la planta', (await b.ev(`document.getElementById('jgEquipo')?.textContent`)).includes(TEXTS.es.jgSetupO_sistema_dwc));
await b.ev(`document.getElementById('jgNext').click(); 1`); await sleep(1200);
const row = (await sql(`select state->'setup' as setup, state->>'stage' as stage from game_progress where user_id = '${NEWBIE}'`))[0];
check('el servidor guardó el equipo y el método de germinación', row?.setup?.sistema === 'dwc' && row.setup.germinacion === 'vaso', JSON.stringify(row));
for (const [L, w] of [['en', TEXTS.en.jgSetupO_sistema_dwc], ['de', TEXTS.de.jgSetupO_sistema_dwc], ['fr', TEXTS.fr.jgSetupO_sistema_dwc]]) {
  await b.ev(`document.querySelector('#langSwitch button[data-lang=${L}]').click(); 1`); await sleep(500);
  check(`${L.toUpperCase()}: el equipo y el aviso de hidroponía traducidos`, (await b.ev(`document.getElementById('jgEquipo').textContent`)).includes(w)
    && (await b.ev(`document.getElementById('jgFixed').textContent`)) === TEXTS[L].jgFijoHidro);
}
await b.ev(`document.querySelector('#langSwitch button[data-lang=es]').click(); 1`); await sleep(400);
check('sin errores de JavaScript', b.events.filter((e) => e.method === 'Runtime.exceptionThrown').length === 0);
await b.close();

// ------------------------------------------------------------ run 2: small pot, no meter, HPS (computer)
console.log('2. Maceta pequeña, sin medidor, HPS (computadora)');
await fresh();
b = await browser(NEWBIE, 'aal1', 1280);
await open(b);
for (const [d, o] of [['sistema', 'maceta'], ['carpa', 'mediana'], ['luz', 'hps'], ['sustrato', 'tierra'], ['maceta', 'tela'], ['maceta_tam', 'pequena'], ['riego_tipo', 'goteo'], ['medir', 'no']]) await pick(b, 'jgSetupForm', d, o);
await b.ev(`document.getElementById('jgSetupGo').click(); 1`); await sleep(1000);
for (const [d, o] of [['metodo', 'taco'], ['temperatura', 'templada'], ['humedad', 'humedo']]) await pick(b, 'jgGermForm', d, o);
await b.ev(`document.getElementById('jgGermGo').click(); 1`); await sleep(1000);
check('sin medidor: el medidor de nutrientes dice «sin medir» y las opciones no muestran cifras de EC', await b.ev(`document.querySelector('#jgTent .jg-g[data-g="nutrientes"]').innerText`) === `${TEXTS.es.jgD_nutrientes}\n${TEXTS.es.jgSinMedir}`
  && !/\d/.test(await b.ev(`[...document.querySelectorAll('input[name="jg-nutrientes"] + label')].map((l) => l.innerText).join(' ')`)));
check('maceta de tela, goteo y lámpara HPS se ven en la carpa', await b.ev(`document.querySelector('#jgTent .jgt-pot').dataset.maceta`) === 'tela'
  && await b.ev(`!!document.querySelector('#jgTent .jgt-drip')`) && await b.ev(`document.querySelector('#jgTent .jgt-lamp').dataset.luz`) === 'hps');
check('maceta pequeña: aparece «Trasplantar a la maceta grande»', await b.ev(`document.getElementById('jgTrasplante')?.textContent`) === TEXTS.es.jgTrasplantar);
await b.ev(`document.getElementById('jgNext').click(); 1`); await sleep(1000);
const g = await b.ev(`[...document.querySelectorAll('.jg-whys[data-gid="guia"] .jg-why')].map((x) => x.textContent)`);
check('HPS: el guía explica que la lámpara calienta, con su «¿Por qué? · Lámpara HPS»', (await b.ev(`document.getElementById('jgBubble').innerText`)).includes(TEXTS.es['jgFb_efecto:hps']) && g.includes('¿Por qué? · ' + TEXTS.es.jgWhyN_hps), JSON.stringify(g));
await b.ev(`document.getElementById('jgTrasplante').click(); 1`); await sleep(1000);
st = await gs(b);
check('trasplantar -> queda anotado, el botón desaparece y la maceta se ve grande', st.setup.trasplante === 'si' && !(await b.ev(`!!document.getElementById('jgTrasplante')`))
  && await b.ev(`document.querySelector('#jgTent .jgt-pot').dataset.tam`) === 'grande');
await b.shot('jg67-week-es-desktop');
check('computadora: sin desborde ni errores', await b.ev(`document.documentElement.scrollWidth <= innerWidth`) && b.events.filter((e) => e.method === 'Runtime.exceptionThrown').length === 0);
check('cada fuente de «¿Por qué?» de las fases 6-7 está en docs/juego-fuentes.md', ['F9', 'F10', 'F11'].every((c) => fs.readFileSync(APP + '/docs/juego-fuentes.md', 'utf8').includes(W.SOURCES[c].url)));
await b.close();
summary();
