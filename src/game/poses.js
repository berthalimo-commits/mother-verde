// The guide's poses: the platform's mini scientist (createMiniScientist in
// public/main.js), same 64x64 drawing, only the face changes plus thin green
// arms and small props (owner-approved style). design/scientist/build-poses.mjs
// draws the contact sheet from this same file, so there is one source.
const SMOKE = '<ellipse cx="10" cy="46" rx="7" ry="3" fill="var(--moss-deep)" opacity="0.35"/>'
  + '<ellipse cx="18" cy="40" rx="5" ry="2.4" fill="var(--moss-deep)" opacity="0.5"/>';
const BODY = '<path d="M26 24 Q34 20 40 30 Q42 40 34 48 Q26 52 20 46 Q16 36 26 24 Z" fill="var(--moss)" opacity="0.92"/>'
  + '<path d="M26 24 Q34 20 40 30 Q42 40 34 48" fill="none" stroke="var(--moss-deep)" stroke-width="1.2" opacity="0.6"/>';
const HEAD = '<circle cx="40" cy="24" r="9" fill="var(--paper-raised)" stroke="var(--line-strong)" stroke-width="1"/>';
const GOGGLES = '<circle cx="37" cy="23" r="2.6" fill="var(--teal)" opacity="0.9"/><circle cx="43" cy="23" r="2.6" fill="var(--teal)" opacity="0.9"/>';
const BROW = '<path d="M35 20 Q40 17 45 20" fill="none" stroke="var(--ink-soft)" stroke-width="1"/>';
const SMILE = '<path d="M32 30 Q40 34 48 28" fill="none" stroke="var(--ink)" stroke-width="2" stroke-linecap="round"/>';

const arm = (d) => `<path d="${d}" fill="none" stroke="var(--moss-deep)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`;
const hand = (x, y) => `<circle cx="${x}" cy="${y}" r="1.4" fill="var(--moss)"/>`;
const mouth = (d, w = 2) => `<path d="${d}" fill="none" stroke="var(--ink)" stroke-width="${w}" stroke-linecap="round"/>`;
const line = (d, c = 'var(--ink-soft)', w = 1) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;

export const POSES = {
  original: { label: 'Actual (vuela)', parts: [SMOKE, BODY, HEAD, GOGGLES, BROW, SMILE] },
  preocupado: { label: 'Preocupado', parts: [SMOKE, BODY, HEAD, GOGGLES,
    line('M34.5 19.6 L38.6 17.6'), line('M41.4 17.6 L45.5 19.6'),          // brows up in the middle
    mouth('M34 31.6 Q40 27.6 46 31.6'),                                       // frown
    '<path d="M51 15 Q52.8 18.4 51 19.8 Q49.2 18.4 51 15 Z" fill="var(--teal)" opacity="0.8"/>'] }, // sweat drop
  contento: { label: 'Contento', parts: [SMOKE,
    arm('M23.5 33 Q17.5 27.5 17 19.5'), hand(17, 19), arm('M39 30.5 Q46 25.5 49.5 18'), hand(49.6, 17.4), // arms up
    BODY, HEAD, GOGGLES, BROW, mouth('M32 28.4 Q40 37.4 48 28.4', 2.2)] },
  explicando: { label: 'Explicando', parts: [SMOKE, BODY,
    arm('M39 32.5 Q47 32 53.5 28.5'), hand(54, 28.2), line('M55 27.6 L58.4 26', 'var(--moss-deep)', 1.4), // pointing
    HEAD, GOGGLES, BROW, SMILE] },
  lupa: { label: 'Con lupa', parts: [SMOKE, BODY,
    arm('M39 33 Q45 36.5 49.2 37.4'), hand(49.6, 37.5),
    line('M50.4 38 L53.4 39.2', 'var(--ink-soft)', 2),                                                  // handle
    '<circle cx="57" cy="40.6" r="4.6" fill="var(--teal)" fill-opacity="0.18" stroke="var(--ink-soft)" stroke-width="1.4"/>',
    HEAD, GOGGLES, BROW, mouth('M35 30.6 Q40 32.2 45 30.6')] },                                           // concentrated
  casco: { label: 'Con casco y gafas', parts: [SMOKE, BODY, HEAD,
    '<path d="M30.6 21.4 A9.4 9.4 0 0 1 49.4 21.4 Z" fill="var(--resin)"/>',                              // safety helmet
    line('M29.2 21.6 L50.8 21.6', 'var(--resin)', 1.8),                                                  // brim
    line('M40 13.2 L40 15.4', 'var(--paper-raised)', 1.2),
    GOGGLES, '<path d="M34.4 23 L39.6 23 M40.4 23 L45.6 23" stroke="var(--ink-soft)" stroke-width="0.8"/>', // goggle strap
    SMILE] },
  pensando: { label: 'Pensando', parts: [SMOKE, BODY,
    // hand to the chin: the arm leaves the body on the right and ends under the
    // head; a dark outline keeps it visible over the green body at 64 px
    '<path d="M38.6 40 Q44.6 38 41.6 34.2" fill="none" stroke="var(--paper)" stroke-width="3.4" stroke-linecap="round"/>',
    arm('M38.6 40 Q44.6 38 41.6 34.2'),
    HEAD, GOGGLES, line('M35 19.4 Q37.5 18 40 19'), line('M41 18.4 L45 18.4'),                          // one brow up
    mouth('M36 30.4 L43.6 29.6'),
    '<circle cx="41.4" cy="33.6" r="2.1" fill="var(--moss)" stroke="var(--paper)" stroke-width="0.9"/>', // the hand
    '<circle cx="51" cy="13" r="1.3" fill="none" stroke="var(--ink-soft)" stroke-width="1"/>',          // thought bubbles
    '<circle cx="54.6" cy="9.2" r="2" fill="none" stroke="var(--ink-soft)" stroke-width="1"/>',
    '<circle cx="59" cy="4.6" r="2.8" fill="none" stroke="var(--ink-soft)" stroke-width="1"/>'] },
};

// Which pose fits what the guide is saying (state after the last action and
// its notes). Decorative only: the text bubble carries the message.
export function poseFor(state, notes = []) {
  const has = (k) => notes.some((n) => n === k || n.startsWith(k + ':'));
  if (state.stage === 'intro') return 'explicando';
  if (state.stage === 'fin') {
    const r = state.result || {};
    if (r.dead) return 'preocupado';
    return r.score >= 70 ? 'contento' : 'pensando';
  }
  if ((state.event && !state.event.answered) || has('eventoMal') || has('semanaMal') || has('flipTemprano')) return 'preocupado';
  if (has('eventoBien')) return 'contento';
  if (has('sinDato')) return 'pensando';
  if (state.stage === 'floracion') return 'lupa';
  if (has('semanaBien')) return 'contento';
  return 'explicando';
}

export function poseSvg(id) {
  const p = POSES[id] || POSES.original;
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" data-pose="${POSES[id] ? id : 'original'}">${p.parts.join('')}</svg>`;
}
