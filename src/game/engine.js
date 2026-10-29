// Zona del juego — the rules engine. Pure functions (no screen, no network):
// state in, new state out. Everything comes from rules.json; no randomness,
// so the same choices always give the same result and a reload never re-rolls.
// The state shape is checked again on the server (game_state_valid).

export const DECISIONS = ['fotoperiodo', 'intensidad', 'riego', 'nutrientes', 'temperatura', 'humedad'];
// Events are checked in this order (the more specific one first).
const EVENT_ORDER = ['botrytis', 'acaros', 'carencia_n', 'exceso_riego', 'oidio'];
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const ideal = (rules, stage, d) => rules.etapas[stage]?.ideal?.[d]?.valor ?? null;

export function newGame(prev = null) {
  return { v: 1, seq: (prev?.seq ?? 0) + 1, run: (prev?.run ?? 0) + 1, stage: 'intro', week: 0, stageWeek: 0,
    health: 100, risks: {}, event: null, log: [], lessons: prev?.lessons ?? [], result: null, last: null, trich: null, post: null,
    lab: prev?.lab ? { at: null, f: [], q: [], v: prev.lab.v || 0 } : null, notes: [] };
}

export function start(s) {
  return { ...s, seq: s.seq + 1, stage: 'plantula', week: 1, stageWeek: 1, notes: ['guia'] };
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
function penalty(rules, stage, d, value) {
  const want = ideal(rules, stage, d);
  if (want === null) return { pts: 0, unscored: true };
  if (value === want) return { pts: 0 };
  if (d === 'fotoperiodo') return { pts: rules.puntuacion.resta_fotoperiodo };
  const opts = rules.opciones[d];
  const dist = Math.abs(opts.indexOf(value) - opts.indexOf(want));
  return { pts: dist >= 2 ? rules.puntuacion.resta_dos_niveles : rules.puntuacion.resta_un_nivel };
}

function valid(choices, rules) {
  return DECISIONS.every((d) => rules.opciones[d].includes(choices[d]));
}

// One week with the person's choices.
export function applyWeek(s, choices, rules) {
  if (!['plantula', 'vegetativo', 'floracion'].includes(s.stage) || s.event && !s.event.answered) throw new Error('not_playable');
  if (!valid(choices, rules)) throw new Error('bad_choices');
  const P = rules.puntuacion;
  const notes = [];
  const lost = {};
  let health = s.health;
  let stage = s.stage, stageWeek = s.stageWeek;
  const veg = rules.etapas.vegetativo.semanas;

  for (const d of DECISIONS) {
    // In vegetativo, choosing 12/12 is the switch to flowering, not a mistake.
    if (stage === 'vegetativo' && d === 'fotoperiodo' && choices[d] === '12/12') continue;
    const p = penalty(rules, stage, d, choices[d]);
    if (p.unscored) notes.push('sinDato:' + d);
    if (p.pts) { health -= p.pts; lost[d] = p.pts; }
  }

  // An event nobody solved keeps costing health.
  let event = s.event;
  // (it has to be answered again next week).
  if (event) { health -= P.evento_por_semana; lost.evento = (lost.evento || 0) + P.evento_por_semana; event = { ...event, answered: false }; }

  // Risks: a bad condition repeated N weeks in a row brings its event.
  const risks = { ...s.risks };
  const need = rules.eventos.semanas_para_aparecer.valor;
  for (const id of EVENT_ORDER) {
    const ev = rules.eventos.lista[id];
    const hit = ev.etapas.includes(stage) && Object.entries(ev.si).every(([k, v]) => choices[k] === v);
    risks[id] = hit ? Math.min((risks[id] || 0) + 1, 20) : 0;
  }
  if (!event) {
    const id = EVENT_ORDER.find((x) => risks[x] >= need);
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
  const log = [...s.log, { w: s.week, s: stage, h: health, l: lost }].slice(-60);
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
  return { ...s, seq: s.seq + 1, event: { ...s.event, answered: true }, notes: ['eventoMal:' + s.event.id] };
}

// Harvest now (only while flowering). auto = the game harvested at the last week.
export function harvest(s, rules, auto = false) {
  if (s.stage !== 'floracion') throw new Error('not_flowering');
  const trich = trichomes(s.stageWeek, rules);
  const pts = rules.tricomas.estados.find((e) => e.id === trich).puntos;
  const score = clamp(s.health + pts, 0, 100);
  const done = finish({ ...s, seq: s.seq + (auto ? 0 : 1), trich, notes: auto ? ['cosechaAuto'] : [] }, rules, false, { score, trich, pts });
  // Phase 2: a harvested plant goes on to drying, curing and (optional) rosin.
  return { ...done, stage: 'secado', post: {}, notes: [...done.notes, 'cosechado'] };
}

// ---------------------------------------------------------------- phase 2: after the harvest
// One screen of decisions per stage (not weeks). Each wrong decision takes
// points off the harvest's score (drying, curing). Rosin is optional and only
// qualitative (levels, no figures); it gets its own verdict, not a number.
export const POST = ['secado', 'curado', 'rosin'];
export const postDecisions = (rules, stage) => Object.keys(rules.post[stage].decisiones);

export function applyPost(s, choices, rules) {
  if (!POST.includes(s.stage)) throw new Error('not_post');
  const R = rules.post;
  const defs = R[s.stage].decisiones;
  if (!Object.entries(defs).every(([d, def]) => def.opciones.includes(choices?.[d]))) throw new Error('bad_choices');
  const lost = {};
  const notes = [];
  for (const [d, def] of Object.entries(defs)) {
    // Phase 8: the ideal may be one option, several (any of them) or null.
    // null + no source = no approved figure yet (the guide says so); null on
    // purpose (author's criteria: it only teaches) = no note.
    const want = def.ideal.valor;
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
  for (const d of Object.keys(defs)) c[d] = choices[d];
  const post = { ...(s.post || {}), [s.stage]: { c, l: lost } };
  const next = POST[POST.indexOf(s.stage) + 1] || 'fin';
  const out = { ...s, seq: s.seq + 1, stage: next, post, notes };
  return next === 'fin' ? closePost(out) : out;
}

export function skipRosin(s) {
  if (s.stage !== 'rosin') throw new Error('not_rosin');
  return closePost({ ...s, seq: s.seq + 1, notes: ['rosinNo'] });
}

function closePost(s) {
  const lostOf = (st) => Object.entries(s.post?.[st]?.l || {}).map(([d, v]) => [st + '_' + d, v]);
  const flower = [...lostOf('secado'), ...lostOf('curado')];
  const total = flower.reduce((a, [, v]) => a + v, 0);
  const postCauses = flower.sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
  const rosin = s.post?.rosin ? { causes: lostOf('rosin').sort((a, b) => b[1] - a[1]).map(([k]) => k) } : null;
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
  humedad: 'sistemas', evento: 'diagnostico', flip: 'ciclo' };
