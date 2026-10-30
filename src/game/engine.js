// Zona del juego — the rules engine. Pure functions (no screen, no network):
// state in, new state out. Everything comes from rules.json; no randomness,
// so the same choices always give the same result and a reload never re-rolls.
// The state shape is checked again on the server (game_state_valid).

export const DECISIONS = ['fotoperiodo', 'intensidad', 'riego', 'nutrientes', 'temperatura', 'humedad'];
// Events are checked in this order (the more specific one first).
const EVENT_ORDER = ['pudricion_raiz', 'quemadura_luz', 'botrytis', 'acaros', 'carencia_n', 'exceso_riego', 'oidio'];
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
// Phase 6: the substrate can change the ideal (coco needs feeding from the
// seedling on; living soil feeds itself). A list = any of them is ideal.
export const ideal = (rules, stage, d, setup) => {
  const extra = rules.setup?.efectos.ideal_extra[setup?.sustrato]?.[stage]?.[d];
  return extra !== undefined ? extra : rules.etapas[stage]?.ideal?.[d]?.valor ?? null;
};

export function newGame(prev = null) {
  return { v: 1, seq: (prev?.seq ?? 0) + 1, run: (prev?.run ?? 0) + 1, stage: 'intro', week: 0, stageWeek: 0,
    health: 100, risks: {}, event: null, log: [], lessons: prev?.lessons ?? [], result: null, last: null, trich: null, post: null,
    lab: prev?.lab ? { at: null, f: [], q: [], v: prev.lab.v || 0 } : null, notes: [] };
}

// ---------------------------------------------------------------- phase 6: the equipment
// Chosen once, before planting. No option is «right»: each one changes the
// rules of the weeks (rules.json → setup.efectos).
const applies = (cuando, vals) => !cuando || Object.entries(cuando).every(([k, list]) => list.includes(vals?.[k]));
export const setupDecisions = (rules, picked = {}) => Object.entries(rules.setup.decisiones).filter(([, def]) => applies(def.cuando, picked)).map(([d]) => d);

export function setSetup(s, choices, rules) {
  if (s.stage !== 'intro') throw new Error('not_intro');
  const ds = setupDecisions(rules, choices);
  if (!ds.every((d) => rules.setup.decisiones[d].opciones.includes(choices?.[d]))) throw new Error('bad_setup');
  const setup = Object.fromEntries(ds.map((d) => [d, choices[d]]));
  if (setup.maceta_tam === 'pequena') setup.trasplante = 'no';
  return { ...s, seq: s.seq + 1, setup, notes: ['setupOk'] };
}

// The decisions the player doesn't take in this system (hydroponics: no
// watering; aquaponics: no nutrients either).
export const fixedDecisions = (s, rules) => { const f = rules.setup?.efectos.fijos[s.setup?.sistema] || {}; return Object.fromEntries(Object.entries(f).filter(([k]) => DECISIONS.includes(k))); };

// With an equipment chosen the run starts with germination (phase 7);
// a game saved before phase 6 (no setup) goes straight to the seedling.
export function start(s) {
  if (s.setup) return { ...s, seq: s.seq + 1, stage: 'germinacion', week: 0, stageWeek: 0, notes: ['guia'] };
  return { ...s, seq: s.seq + 1, stage: 'plantula', week: 1, stageWeek: 1, notes: ['guia'] };
}

// ---------------------------------------------------------------- phase 7: germination
export const germDecisions = (rules, picked = {}) => Object.entries(rules.germinacion.decisiones).filter(([, def]) => applies(def.cuando, picked)).map(([d]) => d);

export function applyGerm(s, choices, rules) {
  if (s.stage !== 'germinacion') throw new Error('not_germ');
  const G = rules.germinacion;
  const ds = germDecisions(rules, choices);
  if (!ds.every((d) => G.decisiones[d].opciones.includes(choices?.[d]))) throw new Error('bad_choices');
  const lost = {};
  for (const d of ds) {
    const def = G.decisiones[d];
    const wants = [].concat(def.ideal.valor ?? []);
    if (!wants.length || wants.includes(choices[d])) continue;
    const dist = def.escala === false ? 1 : Math.min(...wants.map((w) => Math.abs(def.opciones.indexOf(choices[d]) - def.opciones.indexOf(w))));
    lost[d] = dist >= 2 ? G.resta_dos_niveles : G.resta_un_nivel;
  }
  const total = Object.values(lost).reduce((a, b) => a + b, 0);
  const health = clamp(s.health - total, 0, 100);
  const c = Object.fromEntries(ds.map((d) => [d, choices[d]]));
  return { ...s, seq: s.seq + 1, stage: 'plantula', week: 1, stageWeek: 1, health, setup: { ...s.setup, germinacion: choices.metodo },
    log: [...s.log, { w: 0, s: 'germinacion', h: health, l: lost, c }].slice(-60), notes: [total ? 'germMal' : 'germBien', 'guia'] };
}

// A small pot has to be moved to a big one during the vegetative stage.
export function transplant(s) {
  if (!['plantula', 'vegetativo'].includes(s.stage) || s.setup?.maceta_tam !== 'pequena' || s.setup.trasplante === 'si') throw new Error('no_transplant');
  return { ...s, seq: s.seq + 1, setup: { ...s.setup, trasplante: 'si' }, notes: ['trasplanteOk'] };
}

// Choices the person sees pre-selected: last week's, or the middle option.
export function defaultChoices(s, rules) {
  const out = {};
  for (const d of DECISIONS) {
    const prev = s.last?.[d];
    // a saved choice that no longer exists (rules changed) falls back to the middle option
    out[d] = rules.opciones[d].includes(prev) ? prev : (d === 'fotoperiodo' ? '18/6' : rules.opciones[d][1]);
  }
  return out;
}

export function trichomes(stageWeek, rules) {
  let cur = rules.tricomas.estados[0].id;
  for (const e of rules.tricomas.estados) if (stageWeek >= e.desde_semana) cur = e.id;
  return cur;
}

// Penalty of one decision against the ideal of the stage. null ideal = not scored.
function penalty(rules, stage, d, value, setup) {
  const want = ideal(rules, stage, d, setup);
  if (want === null) return { pts: 0, unscored: true };
  const wants = [].concat(want);
  if (wants.includes(value)) return { pts: 0 };
  if (d === 'fotoperiodo') return { pts: rules.puntuacion.resta_fotoperiodo };
  const opts = rules.opciones[d];
  const dist = Math.min(...wants.map((w) => Math.abs(opts.indexOf(value) - opts.indexOf(w))));
  return { pts: dist >= 2 ? rules.puntuacion.resta_dos_niveles : rules.puntuacion.resta_un_nivel };
}

// What the tent really gets this week: the fixed decisions of the system and
// the HPS warming the air one level.
function effective(s, choices, rules) {
  const eff = { ...choices, ...fixedDecisions(s, rules) };
  const up = rules.setup?.efectos.sube.luz[s.setup?.luz] || {};
  for (const [d, n] of Object.entries(up)) {
    const o = rules.opciones[d];
    eff[d] = o[Math.min(o.length - 1, o.indexOf(eff[d]) + n)];
  }
  return eff;
}
const extraWeeks = (s, id, rules) => Object.entries(rules.setup?.efectos.semanas_extra || {})
  .reduce((n, [k, map]) => n + (map?.[s.setup?.[k]]?.[id] || 0), 0);

function valid(choices, rules) {
  return DECISIONS.every((d) => rules.opciones[d].includes(choices[d]));
}

// One week with the person's choices.
export function applyWeek(s, choices, rules) {
  if (!['plantula', 'vegetativo', 'floracion'].includes(s.stage) || s.event && !s.event.answered) throw new Error('not_playable');
  // Phase 6: what the system fixes is not the player's choice.
  const fixed = fixedDecisions(s, rules);
  choices = { ...choices, ...fixed };
  if (!valid(choices, rules)) throw new Error('bad_choices');
  const P = rules.puntuacion;
  const FX = rules.setup?.efectos;
  const setup = s.setup || {};
  const eff = effective(s, choices, rules);
  const notes = [];
  const lost = {};
  let health = s.health;
  let stage = s.stage, stageWeek = s.stageWeek;
  const veg = rules.etapas.vegetativo.semanas;
  if (eff.temperatura !== choices.temperatura) notes.push('efecto:hps');

  for (const d of DECISIONS) {
    if (d in fixed) continue;
    // In vegetativo, choosing 12/12 is the switch to flowering, not a mistake.
    if (stage === 'vegetativo' && d === 'fotoperiodo' && choices[d] === '12/12') continue;
    const p = penalty(rules, stage, d, eff[d], setup);
    if (p.unscored) notes.push('sinDato:' + d);
    let pts = p.pts;
    // porous pots dry faster: too little water costs double (F10)
    if (pts && d === 'riego' && eff.riego === 'poco' && FX?.poco_doble.maceta.includes(setup.maceta)) { pts *= 2; notes.push('efecto:poco_doble'); }
    // a big tent is harder to keep even (author's criteria)
    if (pts && setup.carpa === 'grande') pts += FX?.carpa_grande.resta_extra[d] || 0;
    if (pts) { health -= pts; lost[d] = pts; }
  }
  // a small pot not moved to a big one keeps the roots tight (author's criteria)
  const T = FX?.trasplante;
  if (T && setup.maceta_tam === T.maceta_tam && setup.trasplante !== 'si' && stage === 'vegetativo' && stageWeek >= T.desde_semana_vegetativo) {
    health -= T.resta; lost.maceta = T.resta; notes.push('sinTrasplante');
  }

  // An event nobody solved keeps costing health.
  let event = s.event;
  // (it has to be answered again next week).
  if (event) { health -= P.evento_por_semana; lost.evento = (lost.evento || 0) + P.evento_por_semana; event = { ...event, answered: false }; }

  // Risks: a bad condition repeated N weeks in a row brings its event.
  const risks = { ...s.risks };
  const need = rules.eventos.semanas_para_aparecer.valor;
  const vegWeeks = s.log.filter((l) => l.s === 'vegetativo').length;
  for (const id of EVENT_ORDER) {
    const ev = rules.eventos.lista[id];
    // phase 6: some problems only happen with some equipment (ev.solo)
    const hit = ev.etapas.includes(stage) && Object.entries(ev.si).every(([k, v]) => eff[k] === v)
      && (!ev.solo || Object.entries(ev.solo).every(([k, list]) => list.includes(setup[k])))
      && (!ev.semanas_vegetativo_min || vegWeeks >= ev.semanas_vegetativo_min);
    risks[id] = hit ? Math.min((risks[id] || 0) + 1, 20) : 0;
  }
  if (!event) {
    // drip irrigation, porous pots and plain soil delay some problems a week
    const id = EVENT_ORDER.find((x) => risks[x] >= need + extraWeeks(s, x, rules));
    if (id) { event = { id, since: s.week }; notes.push('evento:' + id); }
  }
  for (const k of Object.keys(risks)) if (!risks[k]) delete risks[k];

  // Stage changes.
  let nextStage = stage, nextStageWeek = stageWeek + 1;
  if (stage === 'plantula' && stageWeek >= rules.etapas.plantula.semanas.valor) { nextStage = 'vegetativo'; nextStageWeek = 1; notes.push('etapa:vegetativo'); }
  if (stage === 'vegetativo') {
    if (choices.fotoperiodo === '12/12') {
      if (stageWeek < veg.min) { health -= P.resta_fotoperiodo; lost.flip = P.resta_fotoperiodo; notes.push('flipTemprano'); }
      else notes.push('flipOk');
      nextStage = 'floracion'; nextStageWeek = 1; notes.push('etapa:floracion');
    } else if (stageWeek >= veg.max) {
      nextStage = 'floracion'; nextStageWeek = 1; notes.push('flipAuto', 'etapa:floracion');
    }
  }

  health = clamp(Math.round(health), 0, 100);
  if (!Object.keys(lost).length && !notes.some((n) => n.startsWith('evento'))) notes.unshift('semanaBien');
  else if (Object.keys(lost).length) notes.unshift('semanaMal');
  // c = what the tent really got (for the final review: «semana 3, riego
  // «Mucho»»); e / a = the problem that cost health this week and the wrong
  // answers given to it. Saves from before the review have none of them.
  const entry = { w: s.week, s: stage, h: health, l: lost, c: eff };
  if (s.event) { entry.e = s.event.id; if (s.event.a) entry.a = s.event.a; }
  const log = [...s.log, entry].slice(-60);
  let next = { ...s, seq: s.seq + 1, week: s.week + 1, stage: nextStage, stageWeek: nextStageWeek, health, risks,
    event, log, last: { ...choices }, notes };
  if (nextStage === 'floracion') next.trich = trichomes(nextStageWeek, rules);
  if (health === 0) next = finish(next, rules, true);
  else if (nextStage === 'floracion' && nextStageWeek > rules.tricomas.max_semanas_floracion.valor) {
    next = harvest({ ...next, stageWeek: rules.tricomas.max_semanas_floracion.valor }, rules, true);
  }
  return next;
}

export function answerEvent(s, answer, rules) {
  if (!s.event || s.event.answered) throw new Error('no_event');
  if (!rules.eventos.respuestas.includes(answer)) throw new Error('bad_answer');
  const ev = rules.eventos.lista[s.event.id];
  if (answer === ev.respuesta_correcta) {
    const risks = { ...s.risks }; delete risks[s.event.id];
    return { ...s, seq: s.seq + 1, event: null, risks, health: clamp(s.health + rules.puntuacion.evento_resuelto, 0, 100),
      notes: ['eventoBien:' + s.event.id], lessons: addLesson(s.lessons, 'diagnostico') };
  }
  // Wrong answer: the event stays (and keeps costing health); the week can go on.
  const a = [...new Set([...(s.event.a || []), answer])];
  return { ...s, seq: s.seq + 1, event: { ...s.event, answered: true, a }, notes: ['eventoMal:' + s.event.id] };
}

// Harvest now (only while flowering). auto = the game harvested at the last week.
export function harvest(s, rules, auto = false) {
  if (s.stage !== 'floracion') throw new Error('not_flowering');
  const trich = trichomes(s.stageWeek, rules);
  const pts = rules.tricomas.estados.find((e) => e.id === trich).puntos;
  // phase 6: a big tent gives more harvest (author's criteria)
  const bonus = s.setup?.carpa === 'grande' ? rules.setup.efectos.carpa_grande.bonus_cosecha : 0;
  const score = clamp(s.health + pts + bonus, 0, 100);
  const done = finish({ ...s, seq: s.seq + (auto ? 0 : 1), trich, notes: auto ? ['cosechaAuto'] : [] }, rules, false, { score, trich, pts });
  // Phase 2: a harvested plant goes on to drying, curing and (optional) rosin.
  return { ...done, stage: 'secado', post: {}, notes: [...done.notes, 'cosechado'] };
}

// ---------------------------------------------------------------- phase 2: after the harvest
// One screen of decisions per stage (not weeks). Each wrong decision takes
// points off the harvest's score (drying, curing). Rosin is optional and only
// qualitative (levels, no figures); it gets its own verdict, not a number.
// Sub-phase 8b («material»): preparing the starting material, optional,
// between curing and the press. A game saved before 8b goes curing → rosin.
export const POST = ['secado', 'curado', 'material', 'rosin'];
// The decisions shown for this stage: only those that apply to what is
// picked (8b: the sieve's options only with dry sifting…); in the press, the
// material is not asked again when 8b decided it.
// In the press, «cuando» also sees the material 8b sent (frozen fresh flower
// asks how its moisture is handled).
export const postDecisions = (rules, stage, picked = {}, s = null) => {
  const seen = stage === 'rosin' ? { ...picked, material: pressMaterial(rules, picked, s) } : picked;
  return Object.entries(rules.post[stage].decisiones)
    .filter(([d, def]) => applies(def.cuando, seen) && !(stage === 'rosin' && d === 'material' && s?.post?.material))
    .map(([d]) => d);
};
// What goes into the press: what 8b produced, or (games saved before 8b) the choice.
export const pressMaterial = (rules, picked, s) => (s?.post?.material ? materialFrom(s.post.material.c, rules) : picked.material);

// What 8b sends to the press: flower, kief (dry sift) or hash (ice water).
export function materialFrom(c, rules) {
  const M = rules.post.material.da_material;
  if (c.separacion === 'ninguna' && c.partida === 'flor_congelada') return M._congelada_sin_separar;
  return M[c.separacion];
}
// Purity of the separated material: no mistake = high, one = medium, more = low.
export function purity(s) {
  const n = Object.keys(s.post?.material?.l || {}).length;
  return !s.post?.material ? null : n === 0 ? 'alta' : n === 1 ? 'media' : 'baja';
}

export function applyPost(s, choices, rules) {
  if (!POST.includes(s.stage)) throw new Error('not_post');
  const R = rules.post;
  const defs = R[s.stage].decisiones;
  const ds = postDecisions(rules, s.stage, choices, s);
  const mat = s.stage === 'rosin' ? pressMaterial(rules, choices, s) : null;
  if (!ds.every((d) => defs[d].opciones.includes(choices?.[d]))) throw new Error('bad_choices');
  const lost = {};
  const notes = [];
  for (const d of ds) {
    const def = defs[d];
    // Phase 8: the ideal may be one option, several (any of them) or null.
    // null + no source = no approved figure yet (the guide says so); null on
    // purpose (author's criteria: it only teaches) = no note.
    // the right mesh depends on the material (C2: an open mesh for fresh frozen flower)
    const want = def.ideal_por_material?.[mat] ?? def.ideal.valor;
    if (want === null) { if (def.ideal.respaldo === 'sin' || !def.ideal.respaldo) notes.push('postSinDato:' + s.stage + '_' + d); continue; }
    const wants = Array.isArray(want) ? want : [want];
    if (wants.includes(choices[d])) continue;
    // escala:false = the options are not a scale: any wrong one is one level.
    const dist = def.escala === false ? 1
      : Math.min(...wants.map((w) => Math.abs(def.opciones.indexOf(choices[d]) - def.opciones.indexOf(w))));
    lost[d] = dist >= 2 ? R.resta_dos_niveles : R.resta_un_nivel;
  }
  notes.unshift((Object.keys(lost).length ? 'postMal:' : 'postBien:') + s.stage);
  if (s.stage === 'rosin' && lost.proteccion) notes.push('quemadura');
  const c = {};
  for (const d of ds) c[d] = choices[d];
  // the press gets the material 8b produced
  if (s.stage === 'rosin' && s.post?.material) c.material = materialFrom(s.post.material.c, rules);
  if (s.stage === 'material') notes.push('pureza:' + (Object.keys(lost).length === 0 ? 'alta' : Object.keys(lost).length === 1 ? 'media' : 'baja'));
  const post = { ...(s.post || {}), [s.stage]: { c, l: lost } };
  const next = POST[POST.indexOf(s.stage) + 1] || 'fin';
  const out = { ...s, seq: s.seq + 1, stage: next, post, notes };
  return next === 'fin' ? closePost(out) : out;
}

// «Terminar sin hacer rosin»: from the preparation (8b) or from the press.
export function skipRosin(s) {
  if (s.stage !== 'rosin' && s.stage !== 'material') throw new Error('not_rosin');
  return closePost({ ...s, seq: s.seq + 1, notes: ['rosinNo'] });
}

function closePost(s) {
  const lostOf = (st) => Object.entries(s.post?.[st]?.l || {}).map(([d, v]) => [st + '_' + d, v]);
  const flower = [...lostOf('secado'), ...lostOf('curado')];
  const total = flower.reduce((a, [, v]) => a + v, 0);
  const postCauses = flower.sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
  // the preparation's mistakes count in the rosin's verdict, not in the bud's score
  const rosin = s.post?.rosin ? { causes: [...lostOf('material'), ...lostOf('rosin')].sort((a, b) => b[1] - a[1]).map(([k]) => k) } : null;
  return { ...s, stage: 'fin', result: { ...s.result, final: clamp(s.result.score - total, 0, 100), postCauses, rosin } };
}

function finish(s, rules, dead, extra = {}) {
  // What cost the most health over the whole plant (for "repasar").
  const total = {};
  for (const w of s.log) for (const [k, v] of Object.entries(w.l || {})) total[k] = (total[k] || 0) + v;
  const causes = Object.entries(total).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
  return { ...s, stage: 'fin', event: null, result: { dead, health: s.health, causes, ...extra } };
}

export function markLesson(s, lesson) { return { ...s, lessons: addLesson(s.lessons, lesson) }; }
function addLesson(list, l) { return list.includes(l) ? list : [...list, l].slice(-40); }

// Lesson of the platform for each stage / cause (showSub('cultivo', …)).
export const LESSON = { plantula: 'propagacion', vegetativo: 'sistemas', floracion: 'iluminacion', fin: 'cosecha',
  secado: 'procesos', curado: 'procesos', rosin: 'concentrados',
  fotoperiodo: 'ciclo', intensidad: 'iluminacion', riego: 'diagnostico', nutrientes: 'sustrato', temperatura: 'sistemas',
  humedad: 'sistemas', evento: 'diagnostico', flip: 'ciclo',
  germinacion: 'propagacion', maceta: 'sustrato', pudricion_raiz: 'diagnostico', quemadura_luz: 'iluminacion' };

// «Empezar de nuevo» on the final screen: a new plant with the same equipment,
// straight to germination. Without equipment (a save from before phase 6) it
// is a plain new game, which asks for the equipment first.
export function restart(s, rules) {
  const g = newGame(s);
  if (!s.setup) return g;
  const { germinacion, trasplante, ...choices } = s.setup;
  try { return start(setSetup(g, choices, rules)); } catch { return g; }
}
