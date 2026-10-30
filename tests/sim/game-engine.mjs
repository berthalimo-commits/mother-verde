// Zona del juego — the rules engine (src/game/engine.js) with rules.json:
// a whole plant from seed to harvest, events, scoring, no randomness, and
// every state passes the SAME server check (game_state_valid) on PGlite.
// Also: no extraction figures in the game's files, texts in 4 languages.
// Phase 2: drying, curing and a qualitative rosin press after the harvest.
import fs from 'fs';
import { makeDb } from './fakerest.mjs';

const APP = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1').replace(/\/$/, '');
const E = await import('file:///' + APP + '/src/game/engine.js');
const RULES = JSON.parse(fs.readFileSync(APP + '/src/game/rules.json', 'utf8'));
const TEXTS = (await import('file:///' + APP + '/src/game/i18n.js')).default;
let pass = 0, fail = 0; const failures = [];
const check = (n, c, d = '') => { if (c) { pass++; console.log('  ok   ', n); } else { fail++; failures.push(n); console.log('  FALLA', n, d); } };
const db = await makeDb();
const serverOk = async (s) => (await db.query('select public.game_state_valid($1::jsonb) v', [JSON.stringify(s)])).rows[0].v === true;

const IDEAL = {
  plantula: { fotoperiodo: '18/6', intensidad: 'baja', riego: 'moderado', nutrientes: 'medio', temperatura: 'templada', humedad: 'media_alta' },
  vegetativo: { fotoperiodo: '18/6', intensidad: 'media', riego: 'moderado', nutrientes: 'medio', temperatura: 'templada', humedad: 'media_alta' },
  floracion: { fotoperiodo: '12/12', intensidad: 'alta', riego: 'moderado', nutrientes: 'medio', temperatura: 'templada', humedad: 'baja' },
};
const states = [];
const play = (s, c) => { const n = E.applyWeek(s, c, RULES); states.push(n); return n; };

console.log('1. Una planta perfecta, de la semilla a la cosecha');
let s = E.start(E.newGame()); states.push(s);
check('empieza en plántula, semana 1, salud 100', s.stage === 'plantula' && s.week === 1 && s.health === 100);
s = play(s, IDEAL.plantula); s = play(s, IDEAL.plantula);
check('tras 2 semanas de plántula pasa a vegetativo', s.stage === 'vegetativo' && s.stageWeek === 1 && s.health === 100, JSON.stringify(s));
for (let i = 0; i < 3; i++) s = play(s, IDEAL.vegetativo);
s = play(s, { ...IDEAL.vegetativo, fotoperiodo: '12/12' });
check('12/12 en la semana 4 de vegetativo -> floración sin restar', s.stage === 'floracion' && s.health === 100 && s.notes.includes('flipOk'), JSON.stringify(s.notes));
check('en floración se ven los tricomas (transparentes al principio)', s.trich === 'transparentes');
for (let i = 0; i < 8; i++) s = play(s, IDEAL.floracion);
check('a la semana 9 de floración los tricomas están en «mezcla»', E.trichomes(s.stageWeek, RULES) === 'mezcla', s.stageWeek);
s = E.harvest(s, RULES); states.push(s);
check('cosecha en su punto -> 100/100 (salud 100 + 20, con tope) y pasa al secado', s.stage === 'secado' && s.notes.includes('cosechado') && s.result.score === 100 && s.result.trich === 'mezcla' && s.result.causes.length === 0, JSON.stringify(s.result));

console.log('1b. Fase 8: secado, curado + almacenamiento y rosin (catálogo aprobado 2026-10-28)');
// first ideal of each decision (or the first option when it doesn't score)
const PI = (st) => Object.fromEntries(Object.entries(RULES.post[st].decisiones).map(([d, v]) => [d, [].concat(v.ideal.valor ?? v.opciones[0])[0]]));
const harvested = s;
let p = E.applyPost(s, PI('secado'), RULES); states.push(p);
check('secado ideal (planta entera, sala fresca, HR media, aire a la pared, a oscuras, hasta el chasquido) -> curado sin restar', p.stage === 'curado' && p.notes[0] === 'postBien:secado' && !Object.keys(p.post.secado.l).length);
p = E.applyPost(p, PI('curado'), RULES); states.push(p);
check('curado + almacenamiento ideales (9 decisiones) -> preparar el material (8b)', p.stage === 'material' && p.notes[0] === 'postBien:curado' && Object.keys(p.post.curado.c).length === 9);
const atMaterial = p;
p = E.applyPost(p, { partida: 'flor_curada', separacion: 'ninguna' }, RULES); states.push(p);
check('8b sin separar -> la prensa, con la flor como material (no se vuelve a preguntar)', p.stage === 'rosin' && !E.postDecisions(RULES, 'rosin', {}, p).includes('material'));
const pr = E.applyPost(p, PI('rosin'), RULES); states.push(pr);
check('rosin ideal -> final 100/100 y rosin «bien hecho»; presión y tiempo sin cifra aprobada avisan «sin dato»; prensa y prioridad solo enseñan (sin aviso)',
  pr.stage === 'fin' && pr.result.final === 100 && pr.result.rosin.causes.length === 0 && pr.notes.includes('postSinDato:rosin_presion')
  && pr.notes.includes('postSinDato:rosin_tiempo') && !pr.notes.some((n) => /rosin_(prensa|prioridad)/.test(n)), JSON.stringify(pr.notes));
const skip = E.skipRosin(atMaterial); states.push(skip);
check('el rosin es opcional: terminar sin prensar -> final igual, sin veredicto de rosin', skip.stage === 'fin' && skip.result.final === 100 && skip.result.rosin === null && skip.notes[0] === 'rosinNo');
const alt = E.applyPost(E.applyPost(harvested, { ...PI('secado'), metodo: 'ramas' }, RULES), { ...PI('curado'), envase: 'bolsa_curado', control: 'sobre', tiempo: 'meses', g_temp: 'nevera', g_tiempo: 'meses' }, RULES);
check('varias opciones ideales valen igual (ramas, bolsa de curado, sobre de humedad, meses, nevera)', !Object.keys(alt.post.secado.l).length && !Object.keys(alt.post.curado.l).length, JSON.stringify(alt.post));
let q = E.applyPost(harvested, { ...PI('secado'), metodo: 'rejilla', temperatura: 'calida', humedad: 'alta', aire: 'directo' }, RULES); states.push(q);
check('secado con rejilla, calor, humedad alta y aire directo -> resta 4 + 8 + 4 + 4 (opciones que no son escala: un nivel)', q.stage === 'curado' && q.notes[0] === 'postMal:secado'
  && q.post.secado.l.metodo === 4 && q.post.secado.l.temperatura === 8 && q.post.secado.l.humedad === 4 && q.post.secado.l.aire === 4, JSON.stringify(q.post));
q = E.applyPost(q, { ...PI('curado'), envase: 'plastico', g_temp: 'calido', g_forma: 'molida', g_tiempo: 'anos' }, RULES); states.push(q);
check('almacenamiento cálido, molido y por años (F8) y envase de plástico -> resta 4 cada uno', q.post.curado.l.envase === 4 && q.post.curado.l.g_temp === 4 && q.post.curado.l.g_forma === 4 && q.post.curado.l.g_tiempo === 4, JSON.stringify(q.post.curado));
// a game saved before 8b went curing -> press: the press still asks for the material
const qOld = { ...q, stage: 'rosin' };
check('partida guardada antes de 8b (en la prensa, sin preparación) -> la prensa pregunta el material', q.stage === 'material' && E.postDecisions(RULES, 'rosin', {}, qOld).includes('material'));
const qr = E.applyPost(qOld, { ...PI('rosin'), material: 'fresco', malla: 'sin_bolsa', proteccion: 'sin_proteccion' }, RULES); states.push(qr);
check('los errores de secado y curado bajan la nota final (100 - 36 = 64); lo que más restó va primero', qr.result.final === 64 && qr.result.score === 100
  && qr.result.postCauses[0] === 'secado_temperatura' && qr.result.postCauses.length === 3, JSON.stringify(qr.result));
check('rosin con flor fresca sin congelar, sin bolsa y sin protección -> «para mejorar» y aviso de quemadura (no cambia la nota del cogollo)',
  ['rosin_material', 'rosin_malla', 'rosin_proteccion'].every((c) => qr.result.rosin.causes.includes(c)) && qr.notes.includes('quemadura'));
let threw = 0;
for (const f of [() => E.applyPost(harvested, { ...PI('secado'), luz: 'neon' }, RULES), () => E.applyPost(harvested, {}, RULES),
  () => E.applyPost(E.start(E.newGame()), PI('secado'), RULES), () => E.skipRosin(harvested)]) { try { f(); } catch { threw++; } }
check('opciones inventadas, decisiones vacías, secado sin cosechar o saltar el rosin antes de tiempo -> rechazado', threw === 4);
check('cada decisión tiene fuente, nivel de respaldo conocido y la marca [POR VERIFICAR POR BERTHA]',
  E.POST.every((st) => Object.values(RULES.post[st].decisiones).every((v) => /POR VERIFICAR POR BERTHA/.test(v.ideal.verificar) && v.ideal.fuente.length > 10
    && ['estudio', 'guia', 'patente', 'comunidad', 'practica', 'autora', 'simple', 'sin'].includes(v.ideal.respaldo))));
check('cada ideal es una opción que existe', E.POST.every((st) => Object.values(RULES.post[st].decisiones).every((v) => [].concat(v.ideal.valor ?? []).every((x) => v.opciones.includes(x)))));
console.log('1c. Sub-fase 8b: preparar el material sin solventes');
const M = (c) => E.applyPost(atMaterial, c, RULES);
check('cada método muestra solo sus decisiones (sin separar 2, tamizado 6, agua y hielo 7)', E.postDecisions(RULES, 'material', { separacion: 'ninguna' }).length === 2
  && E.postDecisions(RULES, 'material', { separacion: 'tamiz_seco' }).length === 6 && E.postDecisions(RULES, 'material', { separacion: 'agua_hielo' }).length === 7);
const TZ = { partida: 'flor_curada', separacion: 'tamiz_seco', tamiz_frio: 'congelado', tamiz_malla: 'fina', tamiz_frotar: 'suave', tamiz_tiempo: 'corto' };
let k = M(TZ); states.push(k);
check('tamizado en seco bien hecho (congelado, malla fina, suave, corto: C4) -> pureza alta y la prensa recibe kief', k.stage === 'rosin' && k.notes.includes('pureza:alta') && E.purity(k) === 'alta'
  && E.materialFrom(k.post.material.c, RULES) === 'kief');
k = E.applyPost(k, PI('rosin'), RULES); states.push(k);
check('…el rosin guarda «kief» como material y sale bien', k.post.rosin.c.material === 'kief' && k.result.rosin.causes.length === 0);
const AG = { partida: 'flor_congelada', separacion: 'agua_hielo', agua_temp: 'helada', agua_agitar: 'suave', agua_lavados: 'varios', agua_bolsa: 'fina', agua_secado: 'aire' };
check('agua y hielo bien hecho (agua helada y agitación suave: C3) -> hachís, pureza alta', E.materialFrom(M(AG).post.material.c, RULES) === 'hachis' && E.purity(M(AG)) === 'alta');
const wet = M({ ...AG, agua_secado: 'bola_humeda', agua_bolsa: 'gruesa' }); states.push(wet);
check('hachís en bola húmeda (moho, C3) y bolsa gruesa -> 2 errores, pureza baja', wet.post.material.l.agua_secado === 4 && wet.post.material.l.agua_bolsa === 4 && E.purity(wet) === 'baja');
const wr = E.applyPost(wet, PI('rosin'), RULES); states.push(wr);
check('…los errores de la preparación cuentan en el veredicto del rosin, no en la nota del cogollo', wr.result.rosin.causes.includes('material_agua_secado') && wr.result.final === 100);
check('tamizar a temperatura ambiente, frotar fuerte y mucho rato -> restan (C4 + criterio)', Object.keys(M({ ...TZ, tamiz_frio: 'ambiente', tamiz_frotar: 'fuerte', tamiz_tiempo: 'largo' }).post.material.l).length === 3);
check('flor fresca congelada sin separar -> la prensa recibe material fresco congelado', E.materialFrom({ partida: 'flor_congelada', separacion: 'ninguna' }, RULES) === 'congelado');
check('se puede terminar sin rosin desde la preparación', E.skipRosin(atMaterial).stage === 'fin');
threw = 0; for (const f of [() => M({ partida: 'flor_curada', separacion: 'solvente' }), () => M({ partida: 'flor_curada', separacion: 'agua_hielo' }), () => M({ ...TZ, tamiz_malla: '25' })]) { try { f(); } catch { threw++; } }
check('métodos inventados (ningún solvente), agua y hielo sin sus decisiones o mallas inventadas -> rechazado', threw === 3);
check('el estado guardado con todo el post-cosecha cabe en el límite del servidor (post ≤ 1500 bytes)', [qr, wr, k].every((x) => JSON.stringify(x.post).length <= 1500), String(JSON.stringify(wr.post).length));

console.log('2. Errores, eventos y respuestas');
let b = E.start(E.newGame());
b = E.applyWeek(b, { ...IDEAL.plantula, riego: 'mucho', fotoperiodo: '12/12' }, RULES); states.push(b);
check('fotoperiodo equivocado (−8) y riego a un nivel (−4) -> salud 88', b.health === 88 && b.notes[0] === 'semanaMal', JSON.stringify(b));
check('la plántula no puntúa temperatura, humedad ni nutrientes (la plataforma no da el dato)', ['temperatura', 'humedad', 'nutrientes'].every((d) => b.notes.includes('sinDato:' + d)));
b = E.applyWeek(b, { ...IDEAL.plantula, riego: 'mucho' }, RULES); states.push(b);
check('riego «mucho» 2 semanas seguidas -> evento «exceso de riego»', b.event?.id === 'exceso_riego' && b.stage === 'vegetativo', JSON.stringify(b.event));
let blocked = false; try { E.applyWeek(b, IDEAL.vegetativo, RULES); } catch (e) { blocked = e.message === 'not_playable'; }
check('con un evento sin responder no se puede pasar la semana', blocked);
const wrong = E.answerEvent(b, 'esperar', RULES); states.push(wrong);
check('respuesta equivocada -> el evento sigue y ya se puede pasar la semana', wrong.event?.id === 'exceso_riego' && wrong.event.answered === true);
const after = E.applyWeek(wrong, IDEAL.vegetativo, RULES); states.push(after);
check('…y la semana siguiente resta 6 por el problema sin resolver y hay que responder otra vez', after.health === wrong.health - 6 && after.event.answered === false);
const right = E.answerEvent(after, 'dejar_secar', RULES); states.push(right);
check('respuesta correcta -> evento resuelto, +4 de salud y lección de Diagnóstico anotada', !right.event && right.health === after.health + 4 && right.lessons.includes('diagnostico'));
let f = E.start(E.newGame());
for (let i = 0; i < 2; i++) f = E.applyWeek(f, IDEAL.plantula, RULES);
f = E.applyWeek(f, { ...IDEAL.vegetativo, fotoperiodo: '12/12' }, RULES); states.push(f);
check('12/12 en la semana 1 de vegetativo -> floración, pero «muy pronto» resta 8', f.stage === 'floracion' && f.health === 92 && f.notes.includes('flipTemprano'));
let fl = f;
for (let i = 0; i < 2; i++) fl = E.applyWeek(fl, { ...IDEAL.floracion, humedad: 'alta' }, RULES);
states.push(fl);
check('humedad alta 2 semanas en floración -> botrytis (antes que oídio)', fl.event?.id === 'botrytis');
let m = E.start(E.newGame());
for (let i = 0; i < 2; i++) m = E.applyWeek(m, IDEAL.plantula, RULES);
for (let i = 0; i < 2; i++) m = E.applyWeek(m, { ...IDEAL.vegetativo, temperatura: 'calida', humedad: 'baja' }, RULES);
check('calor + aire seco 2 semanas -> ácaros', m.event?.id === 'acaros');
let n = E.start(E.newGame());
for (let i = 0; i < 2; i++) n = E.applyWeek(n, IDEAL.plantula, RULES);
for (let i = 0; i < 2; i++) n = E.applyWeek(n, { ...IDEAL.vegetativo, nutrientes: 'bajo' }, RULES);
check('nutrientes bajos 2 semanas en vegetativo -> carencia de nitrógeno', n.event?.id === 'carencia_n');

console.log('3. Final: planta que no sobrevive, cosecha automática, sin azar');
let d = E.start(E.newGame());
const worst = { fotoperiodo: '12/12', intensidad: 'alta', riego: 'mucho', nutrientes: 'alto', temperatura: 'fresca', humedad: 'alta' };
for (let i = 0; i < 30 && d.stage !== 'fin'; i++) {
  if (d.event && !d.event.answered) d = E.answerEvent(d, 'esperar', RULES);
  d = E.applyWeek(d, worst, RULES);
}
states.push(d);
check('salud a 0 -> la planta no sobrevive (sin secado) y el resumen dice qué restó más', d.stage === 'fin' && !d.post && d.result.dead === true && d.health === 0 && d.result.causes.length > 0, JSON.stringify(d.result));
let a = E.start(E.newGame());
for (let i = 0; i < 2; i++) a = E.applyWeek(a, IDEAL.plantula, RULES);
for (let i = 0; i < 3; i++) a = E.applyWeek(a, IDEAL.vegetativo, RULES);
a = E.applyWeek(a, { ...IDEAL.vegetativo, fotoperiodo: '12/12' }, RULES);
for (let i = 0; i < 12; i++) if (a.stage === 'floracion') a = E.applyWeek(a, IDEAL.floracion, RULES);
states.push(a);
check('si nadie cosecha, se cosecha sola al final (ámbar) y pasa al secado', a.stage === 'secado' && a.result.trich === 'ambar' && a.notes.includes('cosechaAuto'), JSON.stringify(a.result));
const replay = () => { let x = E.start(E.newGame()); for (let i = 0; i < 2; i++) x = E.applyWeek(x, { ...IDEAL.plantula, humedad: 'alta' }, RULES); return JSON.stringify(x); };
check('una elección guardada que ya no existe (humedad «media» antigua) vuelve a la opción del medio', E.defaultChoices({ last: { humedad: 'media' } }, RULES).humedad === 'media_alta');
check('mismas decisiones -> mismo resultado (sin azar)', replay() === replay());
const again = E.newGame(s);
check('«Plantar otra» sigue contando (seq y partida) y conserva las lecciones vistas', again.seq > s.seq && again.run === s.run + 1 && again.stage === 'intro');
check('cada acción sube «seq» (así otro dispositivo nunca pisa lo más nuevo)', states.every((x, i) => i === 0 || x.seq >= 1));

console.log('4. El servidor acepta todos los estados que produce el juego');
let allOk = true, bad = null;
for (const x of [E.newGame(), ...states]) if (!(await serverOk(x))) { allOk = false; bad = x; break; }
check(`${states.length + 1} estados del juego pasan game_state_valid y miden menos de 16 KB`, allOk && states.every((x) => JSON.stringify(x).length < 16384), JSON.stringify(bad));

console.log('5. Seguridad del contenido y textos');
const files = ['src/game/rules.json', 'src/game/i18n.js', 'src/game/i18n-post.js', 'src/game/i18n-setup.js', 'src/game/i18n-material.js', 'src/game/game.js', 'src/game/engine.js', 'src/game/entry.js', 'src/game/tent.js', 'src/game/why.js', 'src/game/review.js', 'src/game/i18n-review.js'].map((f) => fs.readFileSync(APP + '/' + f, 'utf8')).join('\n');
check('el juego no menciona butano, BHO, CO2, solventes de extracción ni unidades de presión', !/butan|\bBHO\b|\bCO2\b|\bpsi\b|\bbar\b|extracci/i.test(files.replace(/no de extracción/g, '')));
// Bertha, 2026-10-28: figures allowed ONLY in the rosin, only where a checked
// source gives them (mesh and plate heat, patents P1/P2), always marked
// «orientativo»; never pressure or time; the solvent / CO₂ lab has none (game-lab).
const ORIENT = { es: 'orientativo', en: 'orientative', de: 'Richtwert', fr: 'indicatif' };
const rosinTexts = ['es', 'en', 'de', 'fr'].flatMap((l) => Object.entries(TEXTS[l]).filter(([k]) => /rosin|Rosin/.test(k)).map(([k, v]) => [l, k, v]));
const withFigures = rosinTexts.filter(([, , v]) => /\d/.test(v));
check(`rosin: cifras solo en la malla y el calor, marcadas «orientativo» en su idioma (${withFigures.length} de ${rosinTexts.length} textos)`,
  rosinTexts.length > 100 && withFigures.length > 0 && withFigures.every(([l, k, v]) => /^jgP[DH]_rosin_(malla|calor)/.test(k) && v.includes(ORIENT[l])),
  JSON.stringify(withFigures.filter(([l, k, v]) => !/^jgP[DH]_rosin_(malla|calor)/.test(k) || !v.includes(ORIENT[l]))));
check('rosin: presión y tiempo sin ninguna cifra; ninguna opción del rosin es un número', rosinTexts.filter(([, k]) => /rosin_(presion|tiempo)/.test(k)).every(([, , v]) => !/\d/.test(v))
  && Object.values(RULES.post.rosin.decisiones).every((v) => v.opciones.concat(v.ideal.valor ?? []).every((o) => !/\d/.test(o))));
check('sin dinero, apuestas, cajas sorpresa ni rankings en el código del juego', !/leaderboard|ranking\b|apuesta|loot|gacha|compra|purchase/i.test(files.replace(/sin apuestas|sin rankings|no rankings|keine Ranglisten|pas de classements/g, '')));
const keys = Object.keys(TEXTS.es);
check(`textos del juego en los 4 idiomas (${keys.length} claves, ninguna vacía)`, ['en', 'de', 'fr'].every((l) => keys.every((k) => typeof TEXTS[l][k] === 'string' && TEXTS[l][k].length > 0)) && ['en', 'de', 'fr'].every((l) => Object.keys(TEXTS[l]).length === keys.length));
const game = fs.readFileSync(APP + '/src/game/game.js', 'utf8');
const usedKeys = [...game.matchAll(/t\('(jg[A-Za-z_]+)'\)/g)].map((x) => x[1]);
check('cada texto fijo que usa la pantalla existe', usedKeys.every((k) => keys.includes(k)), usedKeys.filter((k) => !keys.includes(k)).join(','));
const dyn = [...E.DECISIONS.flatMap((dd) => RULES.opciones[dd].flatMap((o) => [`jgO_${dd}_${o}`, `jgH_${dd}_${o}`])),
  ...E.DECISIONS.map((dd) => 'jgD_' + dd), ...Object.keys(RULES.eventos.lista).flatMap((id) => ['jgEvN_' + id, 'jgEvS_' + id, 'jgEvX_' + id]),
  ...RULES.eventos.respuestas.map((r) => 'jgR_' + r), ...['plantula', 'vegetativo', 'floracion'].map((x) => 'jgGuia_' + x),
  ...['fotoperiodo', 'intensidad', 'riego', 'nutrientes', 'temperatura', 'humedad', 'evento', 'flip'].map((c) => 'jgCausa_' + c),
  ...E.POST.flatMap((st) => ['jgEtapa_', 'jgGuia_', 'jgPostDecide_', 'jgPost_btn_'].map((p) => p + st)),
  ...E.POST.flatMap((st) => Object.entries(RULES.post[st].decisiones).flatMap(([d, v]) => ['jgPD_' + st + '_' + d, 'jgPC_' + st + '_' + d,
    ...v.opciones.flatMap((o) => [`jgPO_${st}_${d}_${o}`, `jgPH_${st}_${d}_${o}`])]))];
check('cada texto que se arma con variables (opciones, eventos, causas) existe', dyn.every((k) => keys.includes(k)), dyn.filter((k) => !keys.includes(k)).join(','));
check('cada valor de cultivo de rules.json está marcado [POR VERIFICAR POR BERTHA]', (() => {
  const walk = (o) => o && typeof o === 'object' ? (('valor' in o || 'min' in o) ? /POR VERIFICAR POR BERTHA/.test(o.verificar || '') || /VALOR DE JUEGO/.test(o.fuente || '') : true) && Object.values(o).every(walk) : true;
  return walk(RULES.etapas) && walk(RULES.equivalencias);
})());

// ------------------------------------------------------------ the guide's poses (src/game/poses.js)
const P = await import('file:///' + APP + '/src/game/poses.js');
const base = { stage: 'vegetativo', event: null, result: null };
check('poses: portada -> explicando; evento sin responder -> preocupado; respuesta correcta -> contento',
  P.poseFor({ ...base, stage: 'intro' }) === 'explicando' && P.poseFor({ ...base, event: { id: 'x', answered: false } }, ['evento:x']) === 'preocupado'
  && P.poseFor({ ...base, event: { id: 'x', answered: true } }, ['eventoBien:x']) === 'contento');
check('poses: semana mal / respuesta mal / cambio temprano -> preocupado; falta un dato -> pensando; floración -> lupa',
  ['semanaMal', 'eventoMal:x', 'flipTemprano'].every((n) => P.poseFor(base, [n]) === 'preocupado')
  && P.poseFor(base, ['semanaBien', 'sinDato:temperatura']) === 'pensando' && P.poseFor({ ...base, stage: 'floracion' }, ['semanaBien']) === 'lupa'
  && P.poseFor(base, ['semanaBien']) === 'contento');
check('poses: final -> planta muerta preocupado, buena cosecha contento, cosecha floja pensando',
  P.poseFor({ ...base, stage: 'fin', result: { dead: true } }) === 'preocupado' && P.poseFor({ ...base, stage: 'fin', result: { score: 85 } }) === 'contento'
  && P.poseFor({ ...base, stage: 'fin', result: { score: 40 } }) === 'pensando');
check('poses: todas reutilizan el mismo cuerpo, cabeza y gafas del científico, decorativas (aria-hidden) y sin colores fijos',
  Object.keys(P.POSES).every((id) => { const v = P.poseSvg(id); return v.includes('M26 24 Q34 20 40 30 Q42 40 34 48 Q26 52 20 46 Q16 36 26 24 Z') && v.includes('r="9"') && /aria-hidden="true"/.test(v) && !/#[0-9a-f]{3,6}/i.test(v); })
  && P.poseSvg('nada').includes('data-pose="original"'));

console.log(`\nRESULTADO: ${pass} ok, ${fail} fallas${fail ? ' -> ' + failures.join(' | ') : ''}`);
process.exit(0);
