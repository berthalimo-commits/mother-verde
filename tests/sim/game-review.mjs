// Zona del juego — the final review (src/game/review.js): every way of
// failing (dead plant, mould while drying, over-dried buds, dark or watery
// rosin, a pest answered wrong) gets the same clear explanation: the chain of
// the person's own decisions with weeks, what usually works better (never as
// the only answer), the «¿Por qué?» with its source and the lessons. Old saves
// (no weekly choices in the log) still get an honest, shorter review. Every
// state with the new log passes the SAME server check (game_state_valid).
import fs from 'fs';
import { makeDb } from './fakerest.mjs';

const APP = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1').replace(/\/$/, '');
const E = await import('file:///' + APP + '/src/game/engine.js');
const RULES = JSON.parse(fs.readFileSync(APP + '/src/game/rules.json', 'utf8'));
const TEXTS = (await import('file:///' + APP + '/src/game/i18n.js')).default;
const REVIEW_TEXTS = (await import('file:///' + APP + '/src/game/i18n-review.js')).default;
const { review, reviewHtml } = await import('file:///' + APP + '/src/game/review.js');
const W = await import('file:///' + APP + '/src/game/why.js');
let pass = 0, fail = 0; const failures = [];
const check = (n, c, d = '') => { if (c) { pass++; console.log('  ok   ', n); } else { fail++; failures.push(n); console.log('  FALLA', n, d); } };
const db = await makeDb();
const serverOk = async (s) => (await db.query('select public.game_state_valid($1::jsonb) v', [JSON.stringify(s)])).rows[0].v === true;

const fmt = (s, o) => String(s).replace(/\{(\w+)\}/g, (_, k) => (o[k] ?? ''));
const esc = (x) => String(x).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ctxFor = (L) => ({ t: (k) => TEXTS[L][k] ?? '??' + k, esc, fmt, lessonBtn: (l) => `<button class="jg-lesson" data-lesson="${l}"></button>` });
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const html = (s, L = 'es') => reviewHtml(review(s, RULES), ctxFor(L));

const V = { fotoperiodo: '18/6', intensidad: 'media', riego: 'moderado', nutrientes: 'medio', temperatura: 'templada', humedad: 'media_alta' };
const PL = { ...V, intensidad: 'baja' };
const FL = { fotoperiodo: '12/12', intensidad: 'alta', riego: 'moderado', nutrientes: 'medio', temperatura: 'templada', humedad: 'baja' };
const PI = (st) => Object.fromEntries(Object.entries(RULES.post[st].decisiones).map(([d, v]) => [d, [].concat(v.ideal.valor ?? v.opciones[0])[0]]));
const states = [];

console.log('1. La planta muere por exceso de riego (el caso de Bertha)');
let s = E.start(E.newGame());
for (let i = 0; i < 40 && s.stage !== 'fin'; i++) {
  if (s.event && !s.event.answered) { s = E.answerEvent(s, 'esperar', RULES); states.push(s); continue; }
  s = E.applyWeek(s, { ...(s.stage === 'plantula' ? PL : V), riego: 'mucho' }, RULES); states.push(s);
}
const dead = review(s, RULES);
check('cada semana guarda lo que recibió la carpa y el problema que restó, con la respuesta equivocada', s.log.every((x) => x.c?.riego === 'mucho') && s.log.some((x) => x.e === 'exceso_riego' && x.a?.includes('esperar')));
check('la planta muere; causa principal = el exceso de riego (lo que más salud quitó)', s.result.dead && dead.dead && dead.main?.type === 'evento' && dead.main.key === 'exceso_riego', JSON.stringify(dead.main));
check('la cadena: semanas con riego «Mucho» -> apareció el exceso de riego (semana) -> respuesta «Esperar» -> semanas sin resolver',
  dead.main.trigger?.from === 1 && dead.main.trigger.to === dead.main.appeared && dead.main.answers.join() === 'esperar' && dead.main.weeksCost > 0, JSON.stringify(dead.main));
let t = text(html(s));
check('el texto lo dice claro: título, causa principal, semana en que la salud llegó a 0', t.includes('¿Por qué murió la planta?') && t.includes('Causa principal: Exceso de riego')
  && t.includes(fmt(TEXTS.es.jgRv_murio, { w: dead.lastWeek })), t.slice(0, 300));
check('…«Semanas 1–N: Riego «Mucho»», «apareció «Exceso de riego»», «Respondiste «Esperar a ver qué pasa»»',
  /Semanas 1–\d+: Riego «Mucho»/.test(t) && /apareció «Exceso de riego»/.test(t) && t.includes('Respondiste «Esperar a ver qué pasa»'), t);
check('qué habría ido mejor, sin darlo como única respuesta (medida + prevención + «no es la única»)',
  t.includes('«Dejar secar el sustrato entre riegos»') && t.includes('Para que no aparezca') && t.includes(TEXTS.es.jgRv_noUnicaEvento) && t.includes(TEXTS.es.jgRv_noUnica));
check('el riego también sale como decisión, semana a semana por etapa, con lo recomendado en cada etapa',
  /\(Semilla y plántula\): Riego «Mucho»/.test(t) && /en Vegetativo, «Moderado»/.test(t), t);
const h = html(s);
check('cada causa tiene su «¿Por qué?» (con la fuente F3 del exceso de riego en why.js) y las lecciones de la plataforma',
  h.includes('data-why="exceso_riego"') && h.includes('data-why="riego"') && W.WHY.exceso_riego.src === 'F3' && /data-lesson="diagnostico"/.test(h));

console.log('2. Error de plagas: ácaros respondidos mal (la planta sobrevive)');
s = E.start(E.newGame());
const hot = { ...FL, temperatura: 'calida' };
for (let i = 0; i < 40 && s.stage !== 'secado'; i++) {
  if (s.event && !s.event.answered) { s = E.answerEvent(s, s.event.a ? 'depredadores' : 'ventilar', RULES); states.push(s); continue; }
  if (s.stage === 'floracion' && s.stageWeek >= 9) { s = E.harvest(s, RULES); states.push(s); break; }
  s = E.applyWeek(s, s.stage === 'plantula' ? PL : s.stage === 'vegetativo' ? (s.stageWeek >= 4 ? { ...V, fotoperiodo: '12/12' } : V) : hot, RULES); states.push(s);
}
s = E.skipRosin(E.applyPost(E.applyPost(s, PI('secado'), RULES), PI('curado'), RULES)); states.push(s);
const pest = review(s, RULES).grow.find((x) => x.key === 'acaros');
t = text(html(s));
check('el repaso de una cosecha se titula «Qué bajó tu nota y por qué»', t.includes('Qué bajó tu nota y por qué') && !t.includes('Causa principal'));
check('ácaros: lo que los trajo (temperatura «Cálida» + humedad «Baja», aunque no restaran), la respuesta equivocada y la buena',
  pest && pest.trigger && /Temperatura «Cálida» \+ Humedad «Baja»/.test(t) && t.includes('Respondiste «Mejorar la ventilación»') && t.includes('«Soltar depredadores naturales»'), JSON.stringify(pest));

console.log('3. Secado y curado: moho y cogollos resecos');
const harvested = (() => { let x = E.start(E.newGame()); for (let i = 0; i < 2; i++) x = E.applyWeek(x, PL, RULES); for (let i = 0; i < 3; i++) x = E.applyWeek(x, V, RULES);
  x = E.applyWeek(x, { ...V, fotoperiodo: '12/12' }, RULES); for (let i = 0; i < 8; i++) x = E.applyWeek(x, FL, RULES); return E.harvest(x, RULES); })();
let q = E.applyPost(harvested, { ...PI('secado'), humedad: 'alta', duracion: 'muchas_semanas' }, RULES); states.push(q);
q = E.skipRosin(E.applyPost(q, { ...PI('curado'), abrir: 'nunca' }, RULES)); states.push(q);
const rq = review(q, RULES);
t = text(html(q));
check('secado con humedad alta -> moho; secado de muchas semanas -> reseco; frascos nunca abiertos -> moho (lo mismo que dibuja la carpa)',
  rq.post.find((x) => x.d === 'humedad')?.look === 'moho' && rq.post.find((x) => x.d === 'duracion')?.look === 'reseco' && rq.post.find((x) => x.d === 'abrir')?.look === 'moho', JSON.stringify(rq.post));
check('…y el texto lo dice: «Humedad de la sala «Alta»», moho, resecos, puntos de la nota, opción mejor sin ser la única',
  t.includes('«Alta»') && t.includes(TEXTS.es.jgTentX_moho) && t.includes(TEXTS.es.jgTentX_reseco) && t.includes(fmt(TEXTS.es.jgRv_menosNota, { n: 4 }))
  && t.includes('Suele ir mejor «Media»') && t.includes(TEXTS.es.jgRv_noUnicaPost), t);
check('sin errores de cultivo, el repaso no inventa causas de cultivo', rq.grow.length === 0);

console.log('4. Rosin oscuro (calor alto) y aguado (flor fresca); hachís húmedo en la preparación');
const atRosin = E.applyPost(E.applyPost(E.applyPost(harvested, PI('secado'), RULES), PI('curado'), RULES), { partida: 'flor_congelada', separacion: 'agua_hielo', agua_temp: 'helada', agua_agitar: 'suave', agua_lavados: 'varios', agua_bolsa: 'fina', agua_secado: 'bola_humeda' }, RULES);
let r = E.applyPost(atRosin, { ...PI('rosin'), calor: 'alto' }, RULES); states.push(r);
let rr = review(r, RULES); t = text(html(r));
check('hachís en bola húmeda -> moho del material; calor alto -> rosin oscuro; cuentan en el veredicto, sin número',
  rr.post.find((x) => x.d === 'agua_secado')?.look === 'moho' && rr.post.find((x) => x.d === 'calor')?.look === 'oscuro'
  && t.includes(TEXTS.es.jgTentX_moho_material) && t.includes(TEXTS.es.jgTentX_oscuro) && t.includes(TEXTS.es.jgRv_veredicto), t);
const oldPress = { ...E.applyPost(E.applyPost(harvested, PI('secado'), RULES), PI('curado'), RULES), stage: 'rosin' };
r = E.applyPost(oldPress, { ...PI('rosin'), material: 'fresco' }, RULES); states.push(r);
rr = review(r, RULES); t = text(html(r));
check('flor fresca sin congelar en la prensa -> rosin aguado, con la opción mejor', rr.post.find((x) => x.d === 'material')?.look === 'agua' && t.includes(TEXTS.es.jgTentX_agua) && t.includes('Suele ir mejor'), t);
check('cada error del post-cosecha tiene su «¿Por qué?»', [...review(q, RULES).post, ...rr.post].every((x) => W.WHY[x.key]));

console.log('5. Germinación, maceta sin trasplantar, floración temprana');
let g = E.setSetup(E.newGame(), { carpa: 'mediana', luz: 'led', sistema: 'maceta', sustrato: 'tierra', maceta: 'plastico', maceta_tam: 'pequena', riego_tipo: 'mano', medir: 'si' }, RULES);
let gOk = true;
try {
  g = E.start(g);
  g = E.applyGerm(g, { metodo: 'taco', temperatura: 'fria', humedad: 'empapado' }, RULES);
  for (let i = 0; i < 2; i++) g = E.applyWeek(g, PL, RULES);
  g = E.applyWeek(g, { ...V, fotoperiodo: '12/12' }, RULES);
} catch (e) { gOk = false; console.log('   (equipo de prueba no válido:', e.message, ')'); }
if (gOk) {
  states.push(g);
  t = text(html({ ...g, result: { dead: false } }));
  const rg = review(g, RULES);
  check('germinación fría y empapada -> dos pasos con «Germinación: …» y la opción mejor', rg.grow.filter((x) => x.type === 'germ').length === 2 && t.includes('Germinación: Temperatura') && t.includes('Suele ir mejor «Templada»'), t);
  check('12/12 en la primera semana de vegetativo -> «antes de N semanas de vegetativo»', rg.grow.some((x) => x.type === 'flip') && t.includes(fmt(TEXTS.es.jgRv_mejorFlip, { min: RULES.etapas.vegetativo.semanas.min })), t);
} else check('equipo de prueba válido para germinación', false);

console.log('6. Partida guardada antes del repaso (sin elecciones en el registro)');
const old = { ...s, log: s.log.map(({ c, e, a, ...x }) => x) };
t = text(html(old));
const ro = review(old, RULES);
check('partida vieja: sin semanas inventadas, pero dice qué restó, por qué y qué habría ido mejor', !/Semanas? \d/.test(t)
  && ro.grow.every((x) => x.type !== 'decision' || x.steps.length === 0) && ro.grow.some((x) => x.key === 'evento') && t.includes(TEXTS.es.jgRv_mejorTitulo), t);
const oldDead = { stage: 'fin', result: { dead: true }, log: [], post: null };
check('planta muerta sin registro: lo dice con honestidad (sin datos de las semanas)', text(html(oldDead)).includes(TEXTS.es.jgRv_sinDatos));

console.log('7. Empezar de nuevo / probar otro sistema');
const withSetup = { ...q, setup: { carpa: 'mediana', luz: 'led', sistema: 'maceta', sustrato: 'tierra', maceta: 'plastico', maceta_tam: 'grande', riego_tipo: 'mano', medir: 'si', germinacion: 'taco' } };
const again = E.restart(withSetup, RULES);
check('«Empezar de nuevo» = misma carpa y equipo, directo a germinar, partida nueva (lecciones conservadas)', again.stage === 'germinacion' && again.run === withSetup.run + 1
  && again.setup.sistema === 'maceta' && !('germinacion' in again.setup) && again.lessons === withSetup.lessons, JSON.stringify(again.setup));
check('«Probar otro sistema» = partida nueva que pide el equipo', E.newGame(withSetup).stage === 'intro' && !E.newGame(withSetup).setup);
check('partida vieja sin equipo: «Empezar de nuevo» pide el equipo', E.restart(old, RULES).stage === 'intro');

console.log('8. Servidor y textos');
let allOk = true, bad = null;
for (const x of [...states, again]) if (!(await serverOk(x))) { allOk = false; bad = x; break; }
check(`${states.length + 1} estados con el registro nuevo pasan game_state_valid y miden menos de 16 KB`, allOk && states.every((x) => JSON.stringify(x).length < 16384), JSON.stringify(bad)?.slice(0, 300));
const keys = Object.keys(REVIEW_TEXTS.es);
check(`textos del repaso en los 4 idiomas (${keys.length} claves, ninguna vacía, mismos marcadores)`, ['en', 'de', 'fr'].every((L) => keys.every((k) => REVIEW_TEXTS[L][k]?.length > 0
  && (REVIEW_TEXTS[L][k].match(/\{\w+\}/g) || []).sort().join() === (REVIEW_TEXTS.es[k].match(/\{\w+\}/g) || []).sort().join())) && ['en', 'de', 'fr'].every((L) => Object.keys(REVIEW_TEXTS[L]).length === keys.length));
const src = fs.readFileSync(APP + '/src/game/review.js', 'utf8');
const used = [...src.matchAll(/t\('(jg[A-Za-z_]+)'\)/g)].map((x) => x[1]);
check('cada texto fijo que usa el repaso existe', used.every((k) => k in TEXTS.es), used.filter((k) => !(k in TEXTS.es)).join());
for (const L of ['en', 'de', 'fr']) {
  const out = text(html(E.applyPost(atRosin, { ...PI('rosin'), calor: 'alto' }, RULES), L)) + text(html(states[0].stage === 'fin' ? states[0] : states.find((x) => x.result?.dead) || states[0], L));
  check(`${L}: el repaso sale sin claves sin traducir`, !/\?\?jg|\bjg[A-Z]/.test(out), out.match(/\?\?jg\w+|\bjg[A-Z]\w+/g)?.join());
}
check('el repaso no menciona butano, BHO, CO2, solventes de extracción ni unidades de presión', !/butan|\bBHO\b|\bCO2\b|\bpsi\b|\bbar\b|extracci/i.test(src + JSON.stringify(REVIEW_TEXTS)));

console.log(`\nRESULTADO: ${pass} ok, ${fail} fallas${fail ? ' -> ' + failures.join(' | ') : ''}`);
process.exit(fail ? 1 : 0);
