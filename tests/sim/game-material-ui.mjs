// Browser test — Juego v2, sub-phase 8b: preparing the starting material
// without solvents (docs/juego-decisiones.md 8.2). Only the chosen method's
// decisions show; the drawing follows (sieve / ice water, purity, mould);
// «¿Por qué?» cites community practice (C1–C4) as such; the press gets the
// material and purity; you can stop here without rosin; 4 languages; 360 px.
import { check, sleep, sql, browser, summary, startGame } from './browser.mjs';
import fs from 'fs';

const APP = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const TEXTS = (await import('file:///' + APP + '/src/game/i18n.js')).default;
const W = await import('file:///' + APP + '/src/game/why.js');
const NEWBIE = 'b0000003-0000-4000-8000-000000000000';
const gs = (b) => b.ev(`JSON.parse(JSON.stringify(window.mvGameDebug.state))`);
const pick = (b, d, o) => b.ev(`document.querySelector('label[for="jgp-' + window.mvGameDebug.state.stage + '-${d}-${o}"]').click(); 1`).then(() => sleep(200));
const legends = (b) => b.ev(`document.querySelectorAll('#jgPostForm fieldset').length`);
const look = (b) => b.ev(`(() => { const g = document.querySelector('#jgTent .jgt-post'); return g ? { ...g.dataset, desc: document.getElementById('jgTentDesc').textContent } : null; })()`);
async function toMaterial(b) {
  await sql(`update profiles set subscription_status = 'trialing', trial_ends_at = now() + interval '20 hours', trial_started_at = now() where id = '${NEWBIE}'`);
  await sql(`delete from game_progress where user_id = '${NEWBIE}'`);
  await b.send('Page.navigate', { url: 'http://localhost:5174/' }); await sleep(5500);
  await b.ev(`document.getElementById('ageGateModal').style.display='none'; document.getElementById('mvDevPreview')?.remove(); goMore('juego'); 1`);
  for (let i = 0; i < 30; i++) { if (await b.ev(`!!document.getElementById('jgBubble')`)) break; await sleep(200); }
  await startGame(b);
  for (let i = 0; i < 16 && (await gs(b)).stage !== 'floracion'; i++) {
    if (await b.ev(`!!document.querySelector('.jg-answer')`)) { await b.ev(`document.querySelector('.jg-answer').click(); 1`); await sleep(500); }
    await b.ev(`document.getElementById('jgNext').click(); 1`); await sleep(700);
  }
  await b.ev(`document.getElementById('jgHarvest').click(); 1`); await sleep(1000);
  for (const st of ['secado', 'curado']) {
    await b.ev(`(() => { document.querySelectorAll('#jgPostForm fieldset').forEach((f) => f.querySelector('label').click()); return 1; })()`); await sleep(300);
    await b.ev(`document.getElementById('jgPostNext').click(); 1`); await sleep(1000);
  }
}

console.log('1. Agua y hielo (celular 360 px)');
let b = await browser(NEWBIE, 'aal1', 360);
await toMaterial(b);
check('después del curado: «Preparar el material (opcional)» con 2 decisiones y la opción de terminar sin rosin', (await gs(b)).stage === 'material' && await legends(b) === 2
  && await b.ev(`!!document.getElementById('jgSkipRosin')`) && (await b.ev(`document.querySelector('#jgPostForm h3').textContent`)) === TEXTS.es.jgPostDecide_material);
check('ningún método con solventes entre las opciones', !/solvent|butan|CO₂|CO2/i.test(await b.ev(`document.getElementById('jgPostForm').innerText`)));
await pick(b, 'partida', 'flor_congelada');
await pick(b, 'separacion', 'agua_hielo');
check('agua y hielo: aparecen sus 5 decisiones (7 en total) y el foco sigue en la opción tocada', await legends(b) === 7 && await b.ev(`document.activeElement?.id`) === 'jgp-material-separacion-agua_hielo');
await pick(b, 'separacion', 'tamiz_seco');
check('al cambiar a tamizado en seco, aparecen las del tamiz (6 en total)', await legends(b) === 6);
await pick(b, 'separacion', 'agua_hielo');
for (const [d, o] of [['agua_temp', 'templada'], ['agua_agitar', 'fuerte'], ['agua_lavados', 'varios'], ['agua_bolsa', 'fina'], ['agua_secado', 'bola_humeda']]) await pick(b, d, o);
let p = await look(b);
check('el dibujo sigue en vivo: cubo de agua, restos de planta y moho en el hachís húmedo; la descripción lo cuenta', p.separacion === 'agua_hielo' && p.restos === '1' && p.moho === '1'
  && p.desc.includes(TEXTS.es.jgTentX_moho_material) && p.desc.includes(TEXTS.es.jgTentX_restos_material), JSON.stringify(p));
check('360 px: sin desborde', await b.ev(`document.documentElement.scrollWidth <= innerWidth`));
await b.shot('jg8b-agua-es-mobile');
await b.ev(`document.getElementById('jgPostNext').click(); 1`); await sleep(1200);
let st = await gs(b);
check('3 errores -> pureza baja; el guía lo dice y pasa a la prensa', st.stage === 'rosin' && (await b.ev(`document.getElementById('jgBubble').innerText`)).includes(TEXTS.es['jgFb_pureza:baja']));
const whys = await b.ev(`[...document.querySelectorAll('.jg-whys[data-gid="guia"] .jg-why')].map((x) => x.textContent)`);
check('un «¿Por qué?» por cada error (agua, agitación, secado)', ['agua_temp', 'agua_agitar', 'agua_secado'].every((d) => whys.includes('¿Por qué? · ' + TEXTS.es['jgPD_material_' + d])), JSON.stringify(whys));
await b.ev(`[...document.querySelectorAll('.jg-whys[data-gid="guia"] .jg-why')].find((x) => x.textContent.includes(${JSON.stringify(TEXTS.es.jgPD_material_agua_secado)})).click(); 1`); await sleep(300);
const wp = await b.ev(`(() => { const p = document.querySelector('.jg-whys[data-gid="guia"] .jg-why-panel'); return { text: p.innerText, hrefs: [...p.querySelectorAll('a')].map((a) => a.href) }; })()`);
check('…el del secado cita el manual como «práctica de la comunidad», nunca como estudio ni respaldo', /práctica de la comunidad/.test(wp.text) && /no es un estudio ni un respaldo/.test(wp.text)
  && !/estudio publicado/.test(wp.text) && wp.hrefs.join() === W.SOURCES.C3.url, JSON.stringify(wp));
check('la prensa ya no pregunta el material (10 decisiones) y dibuja el hachís impuro con restos', await legends(b) === 10 && (await look(b)).material === 'hachis' && (await look(b)).restos === '1');
for (const [L, w] of [['en', 'community practice'], ['de', 'Praxis der Community'], ['fr', 'pratique de la communauté']]) {
  await b.ev(`document.querySelector('#langSwitch button[data-lang=${L}]').click(); 1`); await sleep(500);
  check(`${L.toUpperCase()}: el nivel dice «${w}»`, (await b.ev(`document.querySelector('.jg-whys[data-gid="guia"] .jg-why-panel')?.innerText || ''`)).includes(w)
    || await (async () => { await b.ev(`document.querySelector('.jg-whys[data-gid="guia"] .jg-why').click(); 1`); await sleep(200); return (await b.ev(`document.querySelector('.jg-whys[data-gid="guia"] .jg-why-panel').innerText`)).includes(w); })());
}
await b.ev(`document.querySelector('#langSwitch button[data-lang=es]').click(); 1`); await sleep(400);
await b.ev(`(() => { document.querySelectorAll('#jgPostForm fieldset').forEach((f) => f.querySelector('label').click()); return 1; })()`); await sleep(300);
await b.ev(`document.getElementById('jgPostNext').click(); 1`); await sleep(1200);
st = await gs(b);
check('resultado: los errores de la preparación cuentan en el veredicto del rosin, no en la nota del cogollo', st.stage === 'fin' && st.result.rosin.causes.includes('material_agua_secado')
  && st.result.final === st.result.score - [st.post.secado, st.post.curado].reduce((n, x) => n + Object.values(x.l).reduce((a, v) => a + v, 0), 0), JSON.stringify(st.result));
await sleep(1500);
const row = (await sql(`select state->'post'->'material' as m, state->'post'->'rosin'->'c'->>'material' as rm from game_progress where user_id = '${NEWBIE}'`))[0];
check('el servidor guardó la preparación y el material que llegó a la prensa', row?.m?.c?.separacion === 'agua_hielo' && row.rm === 'hachis', JSON.stringify(row));
check('sin errores de JavaScript', b.events.filter((e) => e.method === 'Runtime.exceptionThrown').length === 0);
await b.close();

console.log('2. Tamizado en seco bien hecho, y terminar sin rosin (computadora)');
b = await browser(NEWBIE, 'aal1', 1280);
await toMaterial(b);
for (const [d, o] of [['partida', 'flor_curada'], ['separacion', 'tamiz_seco'], ['tamiz_frio', 'congelado'], ['tamiz_malla', 'fina'], ['tamiz_frotar', 'suave'], ['tamiz_tiempo', 'corto']]) await pick(b, d, o);
p = await look(b);
check('tamizado en seco bien hecho: kief limpio, con escarcha del material congelado (C4)', p.separacion === 'tamiz_seco' && p.restos === '0' && await b.ev(`!!document.querySelector('#jgTent .jgt-frost')`));
await b.shot('jg8b-tamiz-es-desktop');
await b.ev(`document.getElementById('jgSkipRosin').click(); 1`); await sleep(1200);
st = await gs(b);
check('«Terminar sin hacer rosin» desde la preparación -> final sin veredicto de rosin', st.stage === 'fin' && st.result.rosin === null);
check('cada fuente C de «¿Por qué?» está en docs/juego-fuentes.md', ['C1', 'C3', 'C4'].every((c) => fs.readFileSync(APP + '/docs/juego-fuentes.md', 'utf8').includes(W.SOURCES[c].url)));
check('computadora: sin desborde ni errores', await b.ev(`document.documentElement.scrollWidth <= innerWidth`) && b.events.filter((e) => e.method === 'Runtime.exceptionThrown').length === 0);
await b.close();
summary();
