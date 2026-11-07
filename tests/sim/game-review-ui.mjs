// Browser test — the final review (src/game/review.js) on the real screen.
// Bertha's case (2026-10-30): the plant dies from watering «Mucho»; the end
// says why (main cause + chain with weeks), what usually works better, the
// «¿Por qué?» with its source, the lessons, «Empezar de nuevo» (same
// equipment) and «Probar otro sistema de cultivo». A harvest with mould while
// drying gets the same kind of explanation. ES / EN / DE / FR, mobile and desktop.
import { check, sleep, sql, browser, summary } from './browser.mjs';
import fs from 'fs';
import * as E from '../../src/game/engine.js';
import { SOURCES } from '../../src/game/why.js';

const APP = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const RULES = JSON.parse(fs.readFileSync(APP + '/src/game/rules.json', 'utf8'));
const TEXTS = (await import('file:///' + APP + '/src/game/i18n.js')).default;
const NEWBIE = 'b0000003-0000-4000-8000-000000000000';
const ideal = (st) => Object.fromEntries(E.DECISIONS.map((d) => [d, [].concat(RULES.etapas[st].ideal[d]?.valor ?? RULES.opciones[d][1])[0]]));
const PI = (st) => Object.fromEntries(Object.entries(RULES.post[st].decisiones).map(([d, v]) => [d, [].concat(v.ideal.valor ?? v.opciones[0])[0]]));
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

// a plant with equipment, watered «Mucho» every week, the problem answered «Esperar»
const SETUP = { carpa: 'mediana', luz: 'led', sistema: 'maceta', sustrato: 'tierra', maceta: 'plastico', maceta_tam: 'grande', riego_tipo: 'mano', medir: 'si' };
let dead = E.applyGerm(E.start(E.setSetup(E.newGame(), SETUP, RULES)), { metodo: 'taco', temperatura: 'templada', humedad: 'humedo' }, RULES);
for (let i = 0; i < 40 && dead.stage !== 'fin'; i++) {
  if (dead.event && !dead.event.answered) { dead = E.answerEvent(dead, 'esperar', RULES); continue; }
  dead = E.applyWeek(dead, { ...ideal(dead.stage), riego: 'mucho' }, RULES);
}

console.log('1. La planta muere por exceso de riego');
let b = await loadSaved(dead);
check('carga la partida terminada sin errores (planta muerta)', (await gs(b)).result?.dead === true && errors(b) === 0);
const txt = await b.ev(`document.querySelector('#juego .jg-review')?.innerText || ''`);
check('el repaso dice el título y la causa principal', txt.includes(TEXTS.es.jgRv_tituloMuerta) && /Causa principal: Exceso de riego/.test(txt), txt.slice(0, 300));
check('…la cadena con semanas: riego «Mucho» -> apareció el exceso de riego -> respuesta «Esperar» -> semanas sin resolver',
  /Semanas \d+–\d+: Riego «Mucho»/.test(txt) && /apareció «Exceso de riego»/.test(txt) && txt.includes('Respondiste «Esperar a ver qué pasa»') && /Siguió sin resolver/.test(txt), txt);
check('…qué habría funcionado mejor, sin darlo como única respuesta', txt.includes(TEXTS.es.jgRv_mejorTitulo) && txt.includes(TEXTS.es.jgRv_noUnicaEvento) && txt.includes(TEXTS.es.jgRv_noUnica));
await b.ev(`document.querySelector('.jg-review .jg-why[data-why="exceso_riego"]').click(); 1`); await sleep(300);
const why = await b.ev(`(() => { const p = [...document.querySelectorAll('.jg-review .jg-why-panel')].find((x) => !x.hidden); return { text: p?.innerText || '', hrefs: [...(p?.querySelectorAll('a') || [])].map((a) => a.href) }; })()`);
check('«¿Por qué? · Exceso de riego» abre la razón con su fuente (UC IPM, F3) y su lección', why.hrefs.includes(SOURCES.F3.url) && why.text.includes(TEXTS.es.jgWhy_exceso_riego), JSON.stringify(why));
check('lecciones relacionadas de la plataforma (Diagnóstico)', await b.ev(`[...document.querySelectorAll('.jg-review .jg-lesson')].some((x) => x.dataset.lesson === 'diagnostico')`));
check('botones «Empezar de nuevo» y «Probar otro sistema de cultivo»', (await b.ev(`document.getElementById('jgAgain').textContent`)) === TEXTS.es.jgRv_deNuevo
  && (await b.ev(`document.getElementById('jgOtroSistema').textContent`)) === TEXTS.es.jgRv_otroSistema);
check('móvil: sin desborde', await b.ev(`document.documentElement.scrollWidth <= innerWidth`));
await b.shot('jg-repaso-muerta-es-mobile');
for (const L of ['en', 'de', 'fr']) {
  await b.ev(`document.querySelector('#langSwitch button[data-lang=${L}]').click(); 1`); await sleep(600);
  const tx = await b.ev(`document.querySelector('#juego .jg-review')?.innerText || ''`);
  check(`${L.toUpperCase()}: repaso traducido, sin claves sueltas`, tx.includes(TEXTS[L].jgRv_tituloMuerta) && tx.includes(TEXTS[L].jgRv_principal) && !/\bjg[A-Z]\w+/.test(tx)
    && (await b.ev(`document.getElementById('jgOtroSistema').textContent`)) === TEXTS[L].jgRv_otroSistema, tx.slice(0, 200));
  await b.shot(`jg-repaso-muerta-${L}-mobile`);
}
await b.ev(`document.querySelector('#langSwitch button[data-lang=es]').click(); 1`); await sleep(500);
await b.ev(`document.getElementById('jgAgain').click(); 1`); await sleep(1500);
let st = await gs(b);
check('«Empezar de nuevo» -> misma carpa y equipo, directo a germinar', st.stage === 'germinacion' && st.setup.sistema === 'maceta' && st.run === dead.run + 1);
check('…y queda guardado en la cuenta', await (async () => { for (let i = 0; i < 20; i++) { const r = await sql(`select state->>'stage' as s from game_progress where user_id = '${NEWBIE}'`); if (r[0]?.s === 'germinacion') return true; await sleep(500); } return false; })());
check('sin errores de JavaScript', errors(b) === 0);
await b.close();

console.log('2. Cosecha con moho en el secado; «Probar otro sistema»');
let h = E.start(E.setSetup(E.newGame(), SETUP, RULES));
h = E.applyGerm(h, { metodo: 'taco', temperatura: 'templada', humedad: 'humedo' }, RULES);
for (let i = 0; i < 2; i++) h = E.applyWeek(h, ideal('plantula'), RULES);
for (let i = 0; i < 3; i++) h = E.applyWeek(h, ideal('vegetativo'), RULES);
h = E.applyWeek(h, { ...ideal('vegetativo'), fotoperiodo: '12/12' }, RULES);
for (let i = 0; i < 8; i++) h = E.applyWeek(h, ideal('floracion'), RULES);
h = E.harvest(h, RULES);
h = E.skipRosin(E.applyPost(E.applyPost(h, { ...PI('secado'), humedad: 'alta' }, RULES), PI('curado'), RULES));
b = await loadSaved(h, 1280);
const tx2 = await b.ev(`document.querySelector('#juego .jg-review')?.innerText || ''`);
check('cosecha: «Qué bajó tu nota y por qué», humedad de la sala «Alta» -> moho -> puntos, opción mejor', tx2.includes(TEXTS.es.jgRv_tituloCosecha) && tx2.includes('«Alta»')
  && tx2.includes(TEXTS.es.jgTentX_moho) && tx2.includes('Suele ir mejor «Media»'), tx2);
check('el «¿Por qué?» de los tricomas sigue en el resultado', await b.ev(`!!document.querySelector('.jg-whys[data-gid="fin"] .jg-why[data-why="tricomas"]')`));
check('computadora: sin desborde', await b.ev(`document.documentElement.scrollWidth <= innerWidth`));
await b.shot('jg-repaso-moho-es-desktop');
await b.ev(`document.getElementById('jgOtroSistema').click(); 1`); await sleep(1200);
st = await gs(b);
check('«Probar otro sistema de cultivo» -> partida nueva que pide el equipo («Prepara tu carpa»)', st.stage === 'intro' && !st.setup && await b.ev(`!!document.getElementById('jgSetupForm') || !!document.querySelector('#juego form')`));
check('sin errores de JavaScript', errors(b) === 0);
await b.close();
summary();
