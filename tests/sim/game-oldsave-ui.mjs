// Browser test — saved games from before phases 6-7-8b, and the locked week.
// Case reported by Bertha (2026-10-29): with an open problem every decision
// and «Pasar la semana» are disabled. That is the game's rule (answer «¿Qué
// haces?» first) — the screen now says so and takes you to the question.
// Old saves (no equipment; curing -> press without the 8b preparation) load,
// play on and save with migration 20261029100000, without errors.
import { check, sleep, sql, browser, summary } from './browser.mjs';
import fs from 'fs';
import * as E from '../../src/game/engine.js';

const APP = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const RULES = JSON.parse(fs.readFileSync(APP + '/src/game/rules.json', 'utf8'));
const TEXTS = (await import('file:///' + APP + '/src/game/i18n.js')).default;
const NEWBIE = 'b0000003-0000-4000-8000-000000000000';
const ideal = (st) => Object.fromEntries(E.DECISIONS.map((d) => [d, [].concat(RULES.etapas[st].ideal[d]?.valor ?? RULES.opciones[d][1])[0]]));
const gs = (b) => b.ev(`JSON.parse(JSON.stringify(window.mvGameDebug.state))`);
const errors = (b) => b.events.filter((e) => e.method === 'Runtime.exceptionThrown').length;
async function loadSaved(state, w = 390) {
  await sql(`update profiles set subscription_status = 'trialing', trial_ends_at = now() + interval '20 hours', trial_started_at = now() where id = '${NEWBIE}'`);
  await sql(`delete from game_progress where user_id = '${NEWBIE}'`);
  await sql(`insert into game_progress (user_id, state, seq) values ('${NEWBIE}', '${JSON.stringify(state).replace(/'/g, "''")}'::jsonb, ${state.seq})`);
  const b = await browser(NEWBIE, 'aal1', w);
  await b.send('Page.navigate', { url: 'http://localhost:5174/' }); await sleep(5500);
  await b.ev(`document.getElementById('ageGateModal').style.display='none'; document.getElementById('mvDevPreview')?.remove(); goMore('juego'); 1`);
  for (let i = 0; i < 30; i++) { if (await b.ev(`!!document.getElementById('jgBubble')`)) break; await sleep(200); }
  await sleep(400);
  return b;
}

// an old game (no equipment), vegetative, nitrogen deficiency not answered
let old = E.start(E.newGame());
old = E.applyWeek(old, ideal('plantula'), RULES); old = E.applyWeek(old, ideal('plantula'), RULES);
for (let i = 0; i < 2; i++) old = E.applyWeek(old, { ...ideal('vegetativo'), nutrientes: 'bajo' }, RULES);

console.log('1. Partida antigua con un problema sin responder (el caso de Bertha)');
let b = await loadSaved(old);
check('carga sin errores: vegetativo, carencia de nitrógeno abierta, sin equipo', (await gs(b)).stage === 'vegetativo' && (await gs(b)).event?.id === 'carencia_n' && !(await gs(b)).setup && errors(b) === 0);
check('las decisiones y «Pasar la semana» están bloqueadas (regla del juego)', await b.ev(`document.getElementById('jgNext').disabled && [...document.querySelectorAll('#jgForm input')].every((i) => i.disabled)`));
check('…y la pantalla explica por qué, encima de las decisiones', (await b.ev(`document.getElementById('jgBloqueo')?.innerText || ''`)).includes(TEXTS.es.jgBloqueo)
  && await b.ev(`(() => { const n = document.getElementById('jgBloqueo'), f = document.querySelector('#jgForm fieldset'); return !!n && !!f && (n.compareDocumentPosition(f) & Node.DOCUMENT_POSITION_FOLLOWING) > 0; })()`));
check('la tarjeta del problema dice que hay que elegir una respuesta (leer la lección no basta)', (await b.ev(`document.querySelector('.jg-event').innerText`)).includes(TEXTS.es.jgEvElige));
await b.ev(`document.getElementById('jgIrPregunta').click(); 1`); await sleep(400);
check('«Ir a la pregunta» lleva el foco a la primera respuesta', await b.ev(`document.activeElement?.classList.contains('jg-answer')`));
await b.ev(`document.getElementById('jgtObj-nutrientes').click(); 1`); await sleep(300);
check('el panel de la carpa también lo explica', (await b.ev(`document.querySelector('#jgtPanel .jgt-bloqueo')?.textContent || ''`)) === TEXTS.es.jgBloqueo);
await b.ev(`document.getElementById('jgtClose').click(); 1`); await sleep(200);
await b.ev(`document.querySelector('.jg-whys[data-gid="evento"] .jg-why').click(); 1`); await sleep(300);
await b.ev(`document.querySelector('.jg-event .jg-lesson').click(); 1`); await sleep(800);
await b.ev(`goMore('juego'); 1`); await sleep(1200);
check('abrir la lección y volver: sigue bloqueado y el aviso sigue ahí (no es «lee primero»)', await b.ev(`document.getElementById('jgNext').disabled && !!document.getElementById('jgBloqueo')`));
await b.shot('jg-bloqueo-es-mobile');
for (const L of ['en', 'de', 'fr']) {
  await b.ev(`document.querySelector('#langSwitch button[data-lang=${L}]').click(); 1`); await sleep(500);
  check(`${L.toUpperCase()}: el aviso y el botón traducidos`, (await b.ev(`document.getElementById('jgBloqueo').innerText`)).includes(TEXTS[L].jgBloqueo) && (await b.ev(`document.getElementById('jgIrPregunta').textContent`)) === TEXTS[L].jgIrPregunta);
}
await b.ev(`document.querySelector('#langSwitch button[data-lang=es]').click(); 1`); await sleep(400);
await b.ev(`document.querySelector('.jg-answer[data-answer="ajustar_nutricion"]').click(); 1`); await sleep(1200);
check('responder -> el problema se resuelve, el aviso desaparece y todo se desbloquea', !(await gs(b)).event && !(await b.ev(`!!document.getElementById('jgBloqueo')`)) && !(await b.ev(`document.getElementById('jgNext').disabled`)));
await b.ev(`document.getElementById('jgNext').click(); 1`); await sleep(1500);
const row = (await sql(`select seq, state->>'week' as week from game_progress where user_id = '${NEWBIE}'`))[0];
check('la partida antigua sigue y el servidor la guarda (con la migración nueva)', row && row.seq === (await gs(b)).seq && Number(row.week) === (await gs(b)).week, JSON.stringify(row));
check('sin errores de JavaScript', errors(b) === 0);
await b.close();

console.log('2. Partidas antiguas en el post-cosecha (antes de la 8b)');
let h = old; h = E.answerEvent(h, 'ajustar_nutricion', RULES);
h = E.applyWeek(h, { ...ideal('vegetativo'), fotoperiodo: '12/12' }, RULES);
for (let i = 0; i < 8; i++) h = E.applyWeek(h, ideal('floracion'), RULES);
h = E.harvest(h, RULES);
const pick = (st) => Object.fromEntries(Object.entries(RULES.post[st].decisiones).map(([d, v]) => [d, [].concat(v.ideal.valor ?? v.opciones[0])[0]]));
h = E.applyPost(h, pick('secado'), RULES);
const oldPress = { ...h, stage: 'rosin', post: { ...h.post, curado: { c: {}, l: {} } } };
b = await loadSaved(oldPress, 1280);
check('guardada en la prensa antes de la 8b: carga y la prensa pregunta el material (11 decisiones)', (await gs(b)).stage === 'rosin' && await b.ev(`document.querySelectorAll('#jgPostForm fieldset').length`) === 11 && errors(b) === 0);
await b.ev(`(() => { document.querySelectorAll('#jgPostForm fieldset').forEach((f) => f.querySelector('label').click()); return 1; })()`); await sleep(300);
await b.ev(`document.getElementById('jgPostNext').click(); 1`); await sleep(1500);
check('…se termina y el servidor la guarda', (await gs(b)).stage === 'fin' && (await sql(`select state->>'stage' as s from game_progress where user_id = '${NEWBIE}'`))[0]?.s === 'fin');
await b.close();
b = await loadSaved(h, 1280);
check('guardada en el curado: al terminarlo pasa a preparar el material (8b)', (await gs(b)).stage === 'curado');
await b.ev(`(() => { document.querySelectorAll('#jgPostForm fieldset').forEach((f) => f.querySelector('label').click()); return 1; })()`); await sleep(300);
await b.ev(`document.getElementById('jgPostNext').click(); 1`); await sleep(1500);
check('…y llega a «Preparar el material» sin errores', (await gs(b)).stage === 'material' && errors(b) === 0);
await b.close();
summary();
