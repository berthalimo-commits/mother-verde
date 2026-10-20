// Zona del juego — phase 3: the safety lab (BHO and CO₂, concepts and safety
// only). Pure functions, like engine.js. The person never "does" an
// extraction: they read concept cards, find hazards and answer questions.
// Every unsafe answer ends in "stop and call a professional".
// State: s.lab = { at: scene | null, f: [found ids], q: [scenes answered], v: visits }.

export const SCENES = ['intro', 's1', 'fin'];

// Questions: the right option and the order shown (fixed, no randomness).
export const QUESTIONS = {
  s1: { ok: 'inflamable', opts: ['caro', 'inflamable', 'tarda'] },
};

// What a scene needs before "Seguir" works.
function ready(lab) {
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

export function answer(s, opt) {
  const at = s.lab?.at;
  const q = QUESTIONS[at];
  if (!q || !q.opts.includes(opt)) throw new Error('lab_bad_answer');
  if (opt !== q.ok) return { ...s, seq: s.seq + 1, notes: [`jl:no:${at}:${opt}`] };
  const answered = s.lab.q.includes(at) ? s.lab.q : [...s.lab.q, at];
  return { ...s, seq: s.seq + 1, lab: { ...s.lab, q: answered }, notes: [`jl:ok:${at}`] };
}

// Leave the lab (from the end, or at any moment): the visit count stays.
export function close(s) {
  return { ...s, seq: s.seq + 1, lab: { at: null, f: [], q: [], v: s.lab?.v || 0 }, notes: [] };
}
