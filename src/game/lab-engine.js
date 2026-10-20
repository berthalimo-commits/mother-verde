// Zona del juego — phase 3: the safety lab (BHO and CO₂, concepts and safety
// only). Pure functions, like engine.js. The person never "does" an
// extraction: they read concept cards, find hazards and answer questions.
// Every unsafe answer ends in "stop and call a professional".
// State: s.lab = { at: scene | null, f: [found ids], q: [scenes answered], v: visits }.

export const SCENES = ['intro', 's1', 's2', 'fin'];

// Things to tap in a drawing. "need" = what has to be found to go on;
// "all" also has the objects that are not a hazard (the guide says so).
export const TAPS = {
  s2: { need: ['llama', 'ventana', 'tubo', 'enchufe', 'fumar', 'detector'], decoys: ['planta', 'frasco'] },
};
for (const v of Object.values(TAPS)) v.all = [...v.need, ...v.decoys];
const foundAll = (lab) => !TAPS[lab.at] || TAPS[lab.at].need.every((id) => lab.f.includes(id));

// Questions: the right option and the order shown (fixed, no randomness).
export const QUESTIONS = {
  s1: { ok: 'inflamable', opts: ['caro', 'inflamable', 'tarda'] },
  // asked once every hazard of the kitchen is found; both wrong options end in "stop and call a professional"
  s2: { ok: 'no_casa', opts: ['ventana', 'no_casa', 'quemador'] },
};

// What a scene needs before "Seguir" works.
function ready(lab) {
  if (!foundAll(lab)) return false;
  if (QUESTIONS[lab.at] && !lab.q.includes(lab.at)) return false;
  return true;
}

export function open(s) {
  const v = s.lab?.v || 0;
  return { ...s, seq: s.seq + 1, lab: { at: 'intro', f: [], q: [], v }, notes: ['jl:intro'] };
}

export function canGoOn(s) { return !!s.lab?.at && s.lab.at !== 'fin' && ready(s.lab); }

export function next(s) {
  if (!canGoOn(s)) throw new Error('lab_not_ready');
  const at = SCENES[SCENES.indexOf(s.lab.at) + 1];
  const lab = { ...s.lab, at, f: [] };
  if (at === 'fin') lab.v = Math.min((lab.v || 0) + 1, 1000);
  return { ...s, seq: s.seq + 1, lab, notes: ['jl:scene:' + at] };
}

export function questionOpen(s) { return !!QUESTIONS[s.lab?.at] && foundAll(s.lab); }

export function answer(s, opt) {
  const at = s.lab?.at;
  const q = QUESTIONS[at];
  if (!q || !q.opts.includes(opt)) throw new Error('lab_bad_answer');
  if (!foundAll(s.lab)) throw new Error('lab_find_first');
  if (opt !== q.ok) return { ...s, seq: s.seq + 1, notes: [`jl:no:${at}:${opt}`] };
  const answered = s.lab.q.includes(at) ? s.lab.q : [...s.lab.q, at];
  return { ...s, seq: s.seq + 1, lab: { ...s.lab, q: answered }, notes: [`jl:ok:${at}`] };
}

// Tap one thing in the drawing (a hazard or not): the guide explains it.
export function tap(s, id) {
  const at = s.lab?.at;
  if (!TAPS[at]?.all.includes(id)) throw new Error('lab_bad_tap');
  const f = s.lab.f.includes(id) ? s.lab.f : [...s.lab.f, id];
  return { ...s, seq: s.seq + 1, lab: { ...s.lab, f }, notes: [`jl:tap:${at}:${id}`] };
}

// Leave the lab (from the end, or at any moment): the visit count stays.
export function close(s) {
  return { ...s, seq: s.seq + 1, lab: { at: null, f: [], q: [], v: s.lab?.v || 0 }, notes: [] };
}
