// Zona del juego — phase 3, the safety lab (src/game/lab-engine.js + texts):
// scenes and answers, every unsafe answer ends in "stop and call a
// professional", the server accepts every lab state, and what the game must
// NEVER show, in the 4 languages: no digits, no procedure words, no brands or
// shops, no emergency number, no way to "win" by extracting.
import fs from 'fs';
import { makeDb } from './fakerest.mjs';

const APP = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1').replace(/\/$/, '');
const E = await import('file:///' + APP + '/src/game/engine.js');
const L = await import('file:///' + APP + '/src/game/lab-engine.js');
const LT = (await import('file:///' + APP + '/src/game/i18n-lab.js')).default;
const GT = (await import('file:///' + APP + '/src/game/i18n.js')).default;
const RULES = JSON.parse(fs.readFileSync(APP + '/src/game/rules.json', 'utf8'));
let pass = 0, fail = 0; const failures = [];
const check = (n, c, d = '') => { if (c) { pass++; console.log('  ok   ', n); } else { fail++; failures.push(n); console.log('  FALLA', n, d); } };
const db = await makeDb();
const serverOk = async (s) => (await db.query('select public.game_state_valid($1::jsonb) v', [JSON.stringify(s)])).rows[0].v === true;
const LANGS = ['es', 'en', 'de', 'fr'];

// a finished game (phase 2 done) to open the lab from
const finished = () => {
  let s = E.start(E.newGame());
  for (let i = 0; i < 2; i++) s = E.applyWeek(s, { fotoperiodo: '18/6', intensidad: 'baja', riego: 'moderado', nutrientes: 'medio', temperatura: 'templada', humedad: 'media_alta' }, RULES);
  s = E.applyWeek(s, { fotoperiodo: '12/12', intensidad: 'media', riego: 'moderado', nutrientes: 'medio', temperatura: 'templada', humedad: 'media_alta' }, RULES);
  s = E.harvest(s, RULES);
  const pick = (st) => Object.fromEntries(Object.entries(RULES.post[st].decisiones).map(([d, v]) => [d, v.ideal.valor ?? v.opciones[1]]));
  s = E.applyPost(s, pick('secado'), RULES); s = E.applyPost(s, pick('curado'), RULES);
  return E.skipRosin(s);
};
const states = [];
const keep = (x) => { states.push(x); return x; };
// walk the lab to the end with the right answers / taps (whatever the scenes are)
function walk(s) {
  for (let i = 0; i < 40 && s.lab.at !== 'fin'; i++) {
    const at = s.lab.at;
    for (const id of L.TAPS?.[at]?.all || []) if (!s.lab.f.includes(id)) s = keep(L.tap(s, id));
    if (L.QUESTIONS[at] && !s.lab.q.includes(at)) s = keep(L.answer(s, L.QUESTIONS[at].ok));
    s = keep(L.next(s));
  }
  return s;
}

console.log('1. Entrar, recorrer y salir');
let s = keep(L.open(finished()));
check('el laboratorio se abre desde una partida terminada, en la entrada', s.stage === 'fin' && s.lab.at === 'intro' && s.lab.v === 0);
s = keep(L.next(s));
check('entrada -> escena de conceptos', s.lab.at === 's1');
let threw = false; try { L.next(s); } catch { threw = true; }
check('no se avanza sin responder la pregunta', threw);
const wrong = L.QUESTIONS.s1.opts.filter((o) => o !== L.QUESTIONS.s1.ok);
for (const o of wrong) s = keep(L.answer(s, o));
check('respuesta equivocada -> el guía explica y se puede volver a intentar (sin puntos)', s.lab.q.length === 0 && s.notes[0].startsWith('jl:no:s1:'));
s = walk(s);
check('recorrido completo -> «laboratorio visitado», una visita, sin ninguna nota numérica', s.lab.at === 'fin' && s.lab.v === 1 && !('score' in s.lab));
const out = keep(L.close(s));
check('salir -> vuelve a la partida y se recuerda la visita', out.lab.at === null && out.lab.v === 1 && out.stage === 'fin');
const again = E.newGame(out);
check('«Plantar otra» conserva las visitas al laboratorio', again.lab.v === 1 && again.lab.at === null && again.stage === 'intro');
threw = 0;
for (const f of [() => L.answer(L.open(finished()), 'inflamable'), () => L.answer(keep(L.next(L.open(finished()))), 'inventada')]) { try { f(); } catch { threw++; } }
check('responder fuera de una pregunta o con una opción inventada -> rechazado', threw === 2);

console.log('1b. Escena 2: la cocina (BHO)');
let k = keep(L.next(L.answer(keep(L.next(L.open(finished()))), 'inflamable')));
check('después de los conceptos viene la cocina', k.lab.at === 's2' && k.lab.f.length === 0);
threw = 0; try { L.answer(k, 'no_casa'); } catch { threw++; } try { L.next(k); } catch { threw++; }
check('la pregunta final y «Seguir» no se abren hasta encontrar los seis peligros', threw === 2 && !L.questionOpen(k));
for (const id of L.TAPS.s2.decoys) k = keep(L.tap(k, id));
check('tocar lo que no es peligro no cuenta como peligro (el guía lo dice)', !L.questionOpen(k) && k.notes[0] === 'jl:tap:s2:frasco');
for (const id of L.TAPS.s2.need) k = keep(L.tap(k, id));
check('los seis peligros encontrados -> se abre la pregunta', L.questionOpen(k) && L.TAPS.s2.need.length === 6 && L.TAPS.s2.decoys.length === 2);
const unsafe = L.QUESTIONS.s2.opts.filter((o) => o !== L.QUESTIONS.s2.ok).map((o) => keep(L.answer(k, o)));
check('toda respuesta insegura lleva a «Detener todo y llamar a un profesional» (en los 4 idiomas)', unsafe.length === 2 && unsafe.every((x) => x.lab.q.length === 1 && x.notes[0].startsWith('jl:no:s2:'))
  && LANGS.every((l) => unsafe.every((x) => /profesional|professional|Fachperson|professionnel/.test(LT[l]['jlS2_x_' + x.notes[0].split(':')[3]]))));
k = keep(L.answer(k, 'no_casa'));
check('la respuesta segura: no se hace en casa, aléjate y llama a emergencias', k.lab.q.includes('s2') && /aléjate y llama a emergencias/.test(LT.es.jlS2_o_no_casa));
threw = false; try { L.tap(k, 'receta'); } catch { threw = true; }
check('tocar algo que no está en el dibujo -> rechazado', threw);
const ART = await import('file:///' + APP + '/src/game/lab-art.js');
check('cada cosa de la cocina tiene su sitio en el dibujo y su nombre y explicación en los 4 idiomas',
  L.TAPS.s2.all.every((id) => ART.KITCHEN.spots[id] && LANGS.every((l) => LT[l]['jlK_' + id] && LT[l]['jlKx_' + id])));
const svgs = Object.values(ART).map((a) => a.svg);
check('los dibujos no llevan texto, imágenes externas ni enlaces (los nombres van en los botones)', svgs.every((v) => !/<text|<image|<a|href|<foreignObject/i.test(v) && /aria-hidden="true"/.test(v)));
const spotsOk = Object.values(ART).every((a) => { const p = Object.values(a.spots); return p.every(([x, y], i) => p.every(([u, w], j) => i === j || Math.hypot(x - u, y - w) >= 52)); });
check('los botones del dibujo no se tapan entre sí (separados al menos 52 de 360)', spotsOk);

console.log('1c. Escena 3: el laboratorio con licencia');
k = keep(L.next(k));
check('después de la cocina viene el laboratorio con licencia (lo encontrado se vacía)', k.lab.at === 's3' && k.lab.f.length === 0);
threw = false; try { L.next(k); } catch { threw = true; }
check('no se sigue hasta tocar las seis cosas que lo hacen seguro', threw && L.TAPS.s3.need.length === 6 && L.TAPS.s3.decoys.length === 0);
for (const id of L.TAPS.s3.need) k = keep(L.tap(k, id));
check('las seis encontradas -> se puede seguir, y cada una tiene su sitio, su nombre y su explicación en los 4 idiomas', L.canGoOn(k)
  && L.TAPS.s3.need.every((id) => ART.LAB.spots[id] && LANGS.every((l) => LT[l]['jlL_' + id] && LT[l]['jlLx_' + id])));
check('el laboratorio solo muestra qué lo hace seguro (licencia, sistema cerrado, a prueba de explosiones, ventilación y detección, protección, inspecciones)',
  ['licencia', 'cerrado', 'explosion', 'ventilacion', 'proteccion', 'inspeccion'].every((id) => L.TAPS.s3.need.includes(id)));

console.log('2. El servidor acepta todos los estados del laboratorio');
let allOk = true, bad = null;
for (const x of states) if (!(await serverOk(x))) { allOk = false; bad = x.lab; break; }
check(`${states.length} estados del laboratorio pasan game_state_valid`, allOk, JSON.stringify(bad));
check('…y uno con una escena inventada o una clave de más no', !(await serverOk({ ...out, lab: { ...out.lab, at: 'cocina_casera' } })) && !(await serverOk({ ...out, lab: { ...out.lab, receta: [] } })));

console.log('3. Lo que el juego NUNCA muestra (4 idiomas)');
const labKeys = Object.keys(LT.es);
check(`textos del laboratorio en los 4 idiomas (${labKeys.length} claves, ninguna vacía, las mismas en todos)`,
  LANGS.every((l) => Object.keys(LT[l]).length === labKeys.length && labKeys.every((k) => typeof LT[l][k] === 'string' && LT[l][k].trim())));
const texts = (l) => [...Object.values(LT[l]), GT[l].jgLabBtn, GT[l].jgLabCargando, GT[l].jgLabErr];
check('ni una cifra en ningún texto del laboratorio (sin temperaturas, presiones, tiempos ni cantidades)',
  LANGS.every((l) => texts(l).every((v) => !/[0-9]/.test(v))), LANGS.flatMap((l) => texts(l).filter((v) => /[0-9]/.test(v))).join(' | '));
const PROCEDURE = {
  es: /\bpaso\b|\bprimero (llena|carga|abre)|\bllen(a|ar)\b|\brellen|\bcarga(r)? el gas|tiempo de purga|\bvac[ií]o\b|\bgramos?\b|\blitros?\b|\bminutos?\b|\bsegundos?\b|\bhoras?\b|\bgrados?\b|\breceta paso|\bválvula|\bmanguera|\bcolumna|\bmanómetro|\btanque|\bbombona|\bmalla/i,
  en: /\bstep\b|\bfill\b|\brefill|\bload the gas|purge time|\bvacuum\b|\bgrams?\b|\blit(re|er)s?\b|\bminutes?\b|\bseconds?\b|\bhours?\b|\bdegrees?\b|\bvalve|\bhose\b|\bcolumn\b|\bgauge|\btank\b|\bcanister|\bmesh\b/i,
  de: /\bschritt|\bbef[üu]ll|\bf[üu]llen\b|\bgas laden|sp[üu]lzeit|\bvakuum|\bgramm\b|\bliter\b|\bminuten?\b|\bsekunden?\b|\bstunden?\b|\bgrad\b|\bventil|\bschlauch|\bs[äa]ule\b|\bmanometer|\btank\b|\bkartusche/i,
  fr: /[ée]tape\b|\bremplir|\bcharger le gaz|temps de purge|\bvide\b|\bgrammes?\b|\blitres?\b|\bminutes?\b|\bsecondes?\b|\bheures?\b|\bdegr[ée]s?\b|\bvanne|\btuyau|\bcolonne\b|\bmanom[èe]tre|\br[ée]servoir|\bcartouche|\bbonbonne/i,
};
const procHits = LANGS.flatMap((l) => texts(l).filter((v) => PROCEDURE[l].test(v)).map((v) => l + ': ' + v));
check('sin palabras de procedimiento ni piezas de equipo por dentro (paso, llenar, cargar el gas, purga, vacío, válvulas, unidades…)', procHits.length === 0, procHits.join(' | '));
const BRANDS = /precision|tamisium|agrify|eden labs|waters\b|colibri|nug smasher|rosin tech|pure extraction|extraktlab|puffco|boveda|integra|levo\b|ardent|vivosun|isolate|newport|amazon|ebay|aliexpress|wish\.com|\bshop\b|tienda|comprar|\bbuy\b|kaufen|acheter|https?:|www\./i;
const brandHits = LANGS.flatMap((l) => texts(l).filter((v) => BRANDS.test(v)));
check('sin marcas, modelos, tiendas ni enlaces', brandHits.length === 0, brandHits.join(' | '));
check('ningún número de emergencias: solo «llama a emergencias» (o su traducción)', /llama a emergencias/.test(LT.es.jlGuia_fin) && /emergency services/.test(LT.en.jlGuia_fin) && /Notruf/.test(LT.de.jlGuia_fin) && /secours/.test(LT.fr.jlGuia_fin));
check('la entrada es la frase aprobada (no dice que lo anterior «se puede practicar en casa»)',
  LT.es.jlIntro.startsWith('Hasta ahora practicaste cultivo y procesos sin solventes. Lo que viene es distinto:') && LANGS.every((l) => !/en casa|at home|zu Hause|à la maison/.test(LT[l].jlIntro)));
const code = ['lab-engine.js', 'lab.js'].map((f) => fs.readFileSync(APP + '/src/game/' + f, 'utf8')).join('\n');
check('no hay manera de «ganar» extrayendo: sin puntos ni ranking en el laboratorio', !/score|points|puntos|ranking|leaderboard/i.test(code.replace(/no score|sin ninguna nota/g, '')));

console.log(`\nRESULTADO: ${pass} ok, ${fail} fallas${fail ? ' -> ' + failures.join(' | ') : ''}`);
process.exit(0);
