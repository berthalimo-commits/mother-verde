// Zona del juego v2 — the grow tent (phase 2). Pure drawing: state + the
// week's choices in, SVG + text out. It is part of the game's download (not
// the web's). Everything is drawn here (no images, CSP-safe) with the
// platform's colours, so it follows the platform's theme. The gauges show the
// LEVEL the person chose, never invented figures; the caption tells in words
// what the picture shows, for anyone who can't see it.
import * as E from './engine.js';

const PLAYABLE = ['plantula', 'vegetativo', 'floracion'];
const BASE = 187;           // where the stem leaves the soil
const CX = 120;             // centre of the pot
const LEAF = { ok: 'var(--moss-deep)', mid: '#A9B84A', low: '#CDB24A', dead: '#8A6A3A' };
const SOIL = { poco: '#A07A52', moderado: '#5B3A24', mucho: '#2F1D12' };
const CONE = { baja: 0.16, media: 0.3, alta: 0.48 };
const TRICH = { transparentes: ['#E8F4F0', 0.35], lechosas: ['#FFFFFF', 0.85], mezcla: ['#FFFFFF', 0.85, '#E3A75F'], ambar: ['#E3A75F', 0.95, '#FFFFFF'] };
const f1 = (n) => +n.toFixed(1);
const healthBand = (h) => (h >= 70 ? 'ok' : h >= 40 ? 'mid' : 'low');

// The scene for this state: what is drawn and how.
export function scene(state) {
  const st = state.stage;
  if (st === 'intro') return 'intro';
  if (st === 'plantula') return state.stageWeek <= 1 ? 'germ' : 'plantula';
  if (st === 'vegetativo' || st === 'floracion' || st === 'secado') return st;
  if (st === 'curado' || st === 'rosin') return st;
  if (st === 'fin') return state.result?.dead ? 'muerta' : 'fin';
  return 'intro';
}

// ---------------------------------------------------------------- pieces
// A fan leaf: n leaflets from one point, pointing up, then turned by a.
function leaf(x, y, a, s, n = 5) {
  const angs = n === 5 ? [-62, -32, 0, 32, 62] : n === 3 ? [-35, 0, 35] : [0];
  const lens = n === 5 ? [0.55, 0.82, 1, 0.82, 0.55] : n === 3 ? [0.75, 1, 0.75] : [1];
  return `<g transform="translate(${f1(x)} ${f1(y)}) rotate(${a})">${angs.map((g, i) => {
    const L = f1(s * lens[i]), w = f1(s * lens[i] * 0.17);
    return `<path transform="rotate(${g})" d="M0 0Q${w} ${f1(-L / 2)} 0 ${-L}Q${-w} ${f1(-L / 2)} 0 0Z"/>`;
  }).join('')}</g>`;
}

// A bud with its trichomes (white dots that go milky, then amber).
// rot = botrytis: the bud turns grey-brown (F4: bud rot; platform: «cogollos
// que se oscurecen y desmoronan desde adentro»).
function bud(x, y, r, trich, dots, rot = false) {
  const [c1, o, c2] = TRICH[trich] || TRICH.transparentes;
  const [a, b] = rot ? ['#8A7F72', '#6E6358'] : ['#8FCF7E', '#7DBE6C'];
  let out = `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(r * 0.75)}" ry="${f1(r)}" fill="${a}"${rot ? ' class="jgt-rot"' : ''}/>`
    + `<ellipse cx="${f1(x - r * 0.45)}" cy="${f1(y + r * 0.35)}" rx="${f1(r * 0.5)}" ry="${f1(r * 0.7)}" fill="${b}"/>`
    + `<ellipse cx="${f1(x + r * 0.45)}" cy="${f1(y + r * 0.35)}" rx="${f1(r * 0.5)}" ry="${f1(r * 0.7)}" fill="${b}"/>`;
  for (let j = 0; j < dots; j++) {
    const ang = j * 2.39996, rad = r * 0.7 * Math.sqrt((j + 0.5) / dots);
    out += `<circle cx="${f1(x + Math.cos(ang) * rad * 0.8)}" cy="${f1(y + Math.sin(ang) * rad)}" r="0.7" fill="${c2 && j % 3 === 2 ? c2 : c1}" opacity="${o}"/>`;
  }
  return out;
}

const vegHeight = (w) => 26 + Math.min(w, 6) * 13;

// Phase 4: the problem the plant shows. An open event shows it fully; the
// week after it was solved it shows faded (the plant recovers little by
// little). Returns { id, faded } or null.
export function problemOf(state) {
  if (!PLAYABLE.includes(state.stage)) return null;
  if (state.event?.id) return { id: state.event.id, faded: false };
  const ok = (state.notes || []).find((n) => n.startsWith('eventoBien:'));
  return ok ? { id: ok.split(':')[1], faded: true } : null;
}

// Where the tip of a leaf ends (leaf() points up, then turns by a).
const tipOf = (x, y, a, s, k = 0.7) => [x + Math.sin(a * Math.PI / 180) * s * k, y - Math.cos(a * Math.PI / 180) * s * k];

// Symptoms on top of the leaves, from their sources (docs/juego-fuentes.md):
// oídio = white powdery spots (F5, F7); ácaros = pale stippling and fine
// webbing (F6).
function symptoms(prob, tips) {
  if (!prob) return '';
  const op = prob.faded ? 0.35 : 1;
  if (prob.id === 'oidio') {
    return `<g class="jgt-sym" data-sym="oidio" opacity="${op}">${tips.map(([x, y], i) => `<circle cx="${f1(x)}" cy="${f1(y)}" r="${i % 2 ? 1.6 : 2.2}" fill="#F4F6F2" opacity="0.85"/><circle cx="${f1(x + 2.5)}" cy="${f1(y + 1.5)}" r="1.1" fill="#F4F6F2" opacity="0.7"/>`).join('')}</g>`;
  }
  if (prob.id === 'acaros') {
    const top = tips.slice(-4);
    const web = top.length > 1 ? `<path d="M${top.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}" fill="none" stroke="#E8EEF0" stroke-width="0.4" opacity="0.8"/>` : '';
    return `<g class="jgt-sym" data-sym="acaros" opacity="${op}">${tips.map(([x, y]) => `<circle cx="${f1(x)}" cy="${f1(y)}" r="0.6" fill="#F3F0C8"/><circle cx="${f1(x - 2)}" cy="${f1(y + 1)}" r="0.5" fill="#F3F0C8"/><circle cx="${f1(x + 1.5)}" cy="${f1(y - 1.5)}" r="0.5" fill="#F3F0C8"/>`).join('')}${web}</g>`;
  }
  return '';
}

// The living plant (seedling, vegetative or flowering).
function plant(state, sc, rules) {
  const color = LEAF[healthBand(state.health)];
  const prob = problemOf(state);
  const wrap = (inner, tips) => `<g class="jgt-plant"${prob ? ` data-problem="${prob.id}"${prob.faded ? ' data-recover="1"' : ''}` : ''}>${inner}${symptoms(prob, tips)}</g>`;
  const small = prob && ['carencia_n', 'exceso_riego'].includes(prob.id) && !prob.faded ? (prob.id === 'carencia_n' ? '#D9C64A' : color) : color;
  const sag = prob?.id === 'exceso_riego' && !prob.faded ? 25 : 0;
  if (sc === 'germ') {
    return wrap(`<g fill="${small}"><path d="M${CX} ${BASE}V${BASE - 10}" stroke="${small}" stroke-width="1.6"/>`
      + `<ellipse cx="${CX - 5}" cy="${BASE - 11}" rx="4.5" ry="2.2" transform="rotate(${-20 + sag} ${CX - 5} ${BASE - 11})"/>`
      + `<ellipse cx="${CX + 5}" cy="${BASE - 11}" rx="4.5" ry="2.2" transform="rotate(${20 - sag} ${CX + 5} ${BASE - 11})"/></g>`,
    [[CX - 6, BASE - 12], [CX + 6, BASE - 12]]);
  }
  if (sc === 'plantula') {
    return wrap(`<g fill="${small}"><path d="M${CX} ${BASE}V${BASE - 20}" stroke="${color}" stroke-width="1.8"/>`
      + `<ellipse cx="${CX - 5}" cy="${BASE - 9}" rx="4.5" ry="2.2" transform="rotate(${-20 + sag} ${CX - 5} ${BASE - 9})"/>`
      + `<ellipse cx="${CX + 5}" cy="${BASE - 9}" rx="4.5" ry="2.2" transform="rotate(${20 - sag} ${CX + 5} ${BASE - 9})"/></g>`
      + `<g fill="${color}">${leaf(CX, BASE - 19, -55 - sag, 11, 3) + leaf(CX, BASE - 19, 55 + sag, 11, 3)}</g>`,
    [[CX - 6, BASE - 10], [CX + 6, BASE - 10], tipOf(CX, BASE - 19, -55, 11), tipOf(CX, BASE - 19, 55, 11)]);
  }
  const vegWeeks = sc === 'vegetativo' ? state.stageWeek : Math.max(1, state.log.filter((l) => l.s === 'vegetativo').length);
  const stretch = sc === 'floracion' ? Math.min(state.stageWeek, 3) * 10 : 0;
  const H = Math.min(vegHeight(vegWeeks) + stretch, 136);
  const top = BASE - H;
  const nodes = Math.max(2, Math.min(7, Math.round(H / 17)));
  let leaves = '', yellow = '', buds = '';
  const tips = [];
  const w = state.stageWeek;
  const trich = sc === 'floracion' ? E.trichomes(w, rules) : null;
  const budR = Math.min(4 + w * 0.9, 11);
  const dots = 4 + Math.min(w, 8);
  // exceso de riego: leaves hang down (F3: the plant wilts; platform: «hojas
  // caídas»); faded = half way back up.
  const droop = prob?.id === 'exceso_riego' ? (prob.faded ? 18 : 38) : 0;
  // carencia de N: the older (lower) leaves turn yellow (F2).
  const lowN = prob?.id === 'carencia_n' ? Math.max(1, Math.ceil(nodes / 2)) : 0;
  for (let i = 0; i < nodes; i++) {
    const y = BASE - 8 - (H - 14) * (i / nodes);
    const k = 1 - i / (nodes + 1);
    const s = 12 + 18 * k;
    const tilt = i % 2 ? 6 : -6;
    const aL = -72 + tilt - droop, aR = 72 + tilt + droop;
    const pair = leaf(CX - 1, y, aL, s) + leaf(CX + 1, y - 4, aR, s);
    if (i < lowN) yellow += pair; else leaves += pair;
    tips.push(tipOf(CX - 1, y, aL, s), tipOf(CX + 1, y - 4, aR, s));
    if (sc === 'floracion' && i >= Math.floor(nodes / 2)) {
      const rot = prob?.id === 'botrytis' && !prob.faded && i >= nodes - 2;
      buds += bud(CX - 9 - s * 0.15, y - 6, budR * 0.55, trich, Math.ceil(dots / 2), rot) + bud(CX + 9 + s * 0.15, y - 10, budR * 0.55, trich, Math.ceil(dots / 2));
    }
  }
  const rotTop = prob?.id === 'botrytis';
  const crown = sc === 'floracion' ? `<g opacity="${rotTop && prob.faded ? 0.85 : 1}">${bud(CX, top + budR * 0.4, budR, trich, dots, rotTop)}</g>` : leaf(CX, top + 4, 0, 10, 3);
  const yellowCol = prob?.faded ? '#C4C35A' : '#D9C64A';
  return `<g class="jgt-plant"${prob ? ` data-problem="${prob.id}"${prob.faded ? ' data-recover="1"' : ''}` : ''}>`
    + `<path class="jgt-stem" d="M${CX} ${BASE}Q${CX + 3} ${f1(BASE - H / 2)} ${CX} ${f1(top + 4)}" fill="none" stroke="${color}" stroke-width="${sc === 'floracion' ? 3 : 2.4}" stroke-linecap="round"/>`
    + `<g fill="${color}">${leaves}${sc === 'floracion' ? '' : crown}</g>`
    + (yellow ? `<g fill="${yellowCol}" class="jgt-sym" data-sym="carencia_n">${yellow}</g>` : '')
    + `${buds}${sc === 'floracion' ? crown : ''}${symptoms(prob, tips)}</g>`;
}

function wilted() {
  const c = LEAF.dead;
  return `<path d="M${CX} ${BASE}Q${CX + 5} 150 ${CX - 6} 132Q${CX - 14} 124 ${CX - 22} 134" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round"/>`
    + `<g fill="${c}">${leaf(CX + 2, 168, 150, 18)}${leaf(CX - 1, 160, -150, 16)}${leaf(CX - 4, 146, 165, 14)}${leaf(CX - 22, 134, 175, 10, 3)}</g>`;
}

// ---------------------------------------------------------------- phase 8: drying, curing + storage, rosin
// c = what is picked on the screen so far (may be partial). Each scene marks
// what it shows (data-*) and returns the visible consequences (moho, reseco,
// restos, oscuro, agua) for the caption.
const DRY_BUD = ['#A3AE6E', '#929D60'], BURNT_BUD = ['#A08350', '#8A6E3F'];
const budsAt = (pts, r, cols, extra = '') => pts.map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="${f1(r * 0.8)}" ry="${r}" fill="${cols[0]}"${extra}/><ellipse cx="${x - 2}" cy="${y + 2}" rx="${f1(r * 0.5)}" ry="${f1(r * 0.6)}" fill="${cols[1]}"/>`).join('');
const mould = (pts) => `<g class="jgt-mould">${pts.map(([x, y]) => `<circle cx="${x - 2}" cy="${y - 2}" r="2.2" fill="#D9DCD4" opacity="0.85"/><circle cx="${x + 2}" cy="${y + 1}" r="1.6" fill="#C9CCC4" opacity="0.8"/>`).join('')}</g>`;

export function postLooks(stage, c = {}) {
  if (stage === 'secado') return { moho: c.humedad === 'alta' || c.aire === 'sin_aire', reseco: c.temperatura === 'calida' || c.humedad === 'baja' || c.duracion === 'muchas_semanas' };
  if (stage === 'curado') return { moho: c.abrir === 'nunca' || c.envase === 'plastico', reseco: c.abrir === 'siempre' || c.g_aire === 'abierto' || c.g_luz === 'sol' || c.g_temp === 'calido' };
  if (stage === 'rosin') return { restos: c.malla === 'sin_bolsa', oscuro: c.calor === 'alto', agua: c.material === 'fresco' };
  return {};
}

function dryScene(c) {
  const look = postLooks('secado', c);
  const cols = look.reseco ? BURNT_BUD : DRY_BUD;
  let body = '', pts = [];
  if (c.metodo === 'entera') {
    pts = [[120, 110], [108, 128], [132, 128], [114, 146], [126, 146]];
    body = '<path d="M38 58H202" stroke="#9FB8AE" stroke-width="1"/><path d="M120 56v8M120 64V150" stroke="#7D8F4A" stroke-width="2.2" fill="none"/>'
      + `<g fill="#7D8F4A">${[80, 96, 112, 128].map((y, i) => leaf(120, y, i % 2 ? 150 : -150, 14, 3)).join('')}</g>`;
  } else if (c.metodo === 'rejilla') {
    pts = [[70, 146], [92, 147], [114, 146], [136, 147], [158, 146], [176, 147]];
    body = '<rect x="52" y="150" width="136" height="3" fill="#2B3532"/><path d="M56 153v20M184 153v20" stroke="#9FB8AE"/>'
      + `<path d="${[60, 72, 84, 96, 108, 120, 132, 144, 156, 168, 180].map((x) => `M${x} 150v3`).join('')}" stroke="#9FB8AE" stroke-width="0.6"/>`;
  } else {
    pts = [[78, 104], [120, 104], [162, 104]];
    body = '<path d="M38 58H202" stroke="#9FB8AE" stroke-width="1"/>'
      + [78, 120, 162].map((x) => `<path d="M${x} 56v6M${x} 62V100" stroke="#7D8F4A" stroke-width="1.6" fill="none"/><g fill="#7D8F4A">${leaf(x, 78, -150, 11, 3)}${leaf(x, 90, 150, 11, 3)}</g>`).join('');
  }
  // the fan's air: to the wall, straight at the flowers, or none (off)
  const air = c.aire === 'pared' ? '<path d="M182 50q14 -6 30 -2M184 60q14 -2 28 4" class="jgt-air" fill="none" stroke="#5FD4E0" stroke-width="1.2" stroke-dasharray="3 2"/>'
    : c.aire === 'directo' ? '<path d="M182 60q-30 10 -52 34M184 68q-24 14 -40 36" class="jgt-air" fill="none" stroke="#5FD4E0" stroke-width="1.2" stroke-dasharray="3 2"/>' : '';
  return `<g class="jgt-post" data-metodo="${c.metodo || ''}" data-aire="${c.aire || ''}" data-moho="${look.moho ? 1 : 0}" data-reseco="${look.reseco ? 1 : 0}">`
    + `${air}${body}${budsAt(pts, 6, cols)}${look.moho ? mould(pts) : ''}`
    + (c.metodo === 'rejilla' ? '' : `<rect x="${CX - 1.5}" y="${BASE - 7}" width="3" height="7" fill="#6B4E2E"/>`) + '</g>';
}

function container(x, c, look) {
  const cols = look.reseco ? BURNT_BUD : ['#8FAE6A', '#7F9E5C'];
  const fill = c.g_aire === 'medio' ? 0.5 : 1;
  const top = 200 - 30 * fill;
  const content = c.g_forma === 'molida'
    ? `<path d="M${x - 11} 200Q${x} ${top - 4} ${x + 11} 200Z" fill="${cols[0]}"/>` + [0, 1, 2, 3, 4].map((i) => `<circle cx="${x - 7 + i * 3.5}" cy="${f1(198 - (i % 2) * 4 * fill)}" r="1" fill="${cols[1]}"/>`).join('')
    : budsAt(fill === 1 ? [[x - 5, 195], [x + 5, 195], [x, 186], [x - 4, 177], [x + 4, 177]] : [[x - 5, 195], [x + 5, 195], [x, 187]], 5, cols);
  const open = c.abrir === 'siempre' || c.g_aire === 'abierto';
  const kind = c.envase || 'vidrio';
  let shell;
  if (kind === 'plastico') shell = `<path d="M${x - 13} 168Q${x - 16} 186 ${x - 12} 204H${x + 12}Q${x + 16} 186 ${x + 13} 168Z" fill="#E8EEF0" fill-opacity="0.18" stroke="#C7CFD2" stroke-width="0.8"/>`;
  else if (kind === 'lata') shell = `<rect x="${x - 14}" y="166" width="28" height="38" rx="3" fill="#7F8B8E" stroke="#C7CFD2" stroke-width="0.8"/>`;
  else if (kind === 'bolsa_curado') shell = `<path d="M${x - 13} 166H${x + 13}V204H${x - 13}Z" fill="#3A4442" fill-opacity="0.55" stroke="#9FB8AE" stroke-width="0.8"/><rect x="${x - 6}" y="170" width="12" height="5" rx="1" fill="#2AEBA0" opacity="0.7"/>`;
  else shell = `<rect x="${x - 14}" y="166" width="28" height="38" rx="5" fill="#5FD4E0" fill-opacity="0.12" stroke="#9FB8AE" stroke-width="1"/>`;
  const lid = kind === 'vidrio' || kind === 'lata' ? (open ? `<rect x="${x + 10}" y="198" width="14" height="6" rx="1.5" fill="#E3A75F" transform="rotate(20 ${x + 17} 201)"/>` : `<rect x="${x - 12}" y="160" width="24" height="7" rx="1.5" fill="#E3A75F"/>`) : '';
  const tool = c.control === 'higrometro' ? `<circle cx="${x + 7}" cy="174" r="3.4" fill="#F0F7F3" stroke="#2B3532" stroke-width="0.6"/><path d="M${x + 7} 174l1.8 -1.6" stroke="#E2665A" stroke-width="0.7"/>`
    : c.control === 'sobre' ? `<rect x="${x + 2}" y="171" width="9" height="6" rx="1" fill="#C7CFD2" stroke="#2B3532" stroke-width="0.5"/>` : '';
  // lata: you can't see inside (only the outside is drawn)
  return (kind === 'lata' ? '' : content) + shell + (kind === 'lata' ? '' : tool) + lid + (look.moho && kind !== 'lata' ? mould([[x - 3, 192], [x + 4, 182]]) : '');
}

function cureScene(c) {
  const look = postLooks('curado', c);
  let place = '';
  if (c.g_temp === 'nevera' || c.g_temp === 'congelador') {
    place = `<rect x="56" y="70" width="128" height="138" rx="6" fill="#E8EEF0" fill-opacity="${c.g_temp === 'congelador' ? 0.32 : 0.2}" stroke="#C7CFD2"/><path d="M60 160H180" stroke="#C7CFD2"/>`
      + (c.g_temp === 'congelador' ? '<path class="jgt-frost" d="M74 86l8 8M82 86l-8 8M78 84v12M160 90l6 6M166 90l-6 6M163 88v10" stroke="#BFE9F0" stroke-width="1"/>' : '');
  } else if (c.g_luz === 'sol') {
    place = '<rect x="26" y="40" width="54" height="60" fill="#5FD4E0" fill-opacity="0.18" stroke="#C7CFD2"/><path d="M53 40v60M26 70h54" stroke="#C7CFD2"/><circle cx="40" cy="54" r="8" fill="#FFD58A"/><polygon points="80,50 200,150 200,206 80,206" fill="#FFD58A" opacity="0.25"/>';
  } else if (c.g_luz === 'indirecta') {
    place = '<path d="M50 160H190" stroke="#9FB8AE" stroke-width="2"/>';
  } else if (c.g_luz === 'oscuro' || c.g_temp === 'fresco') {
    place = '<rect x="52" y="140" width="136" height="68" rx="3" fill="#3A2A1E" fill-opacity="0.7" stroke="#6B4E2E"/>';
  }
  const heat = c.g_temp === 'calido' ? '<path class="jgt-heat" d="M64 150q4 -6 0 -12q-4 -6 0 -12M176 150q4 -6 0 -12q-4 -6 0 -12" fill="none" stroke="#E2665A" stroke-width="1.4"/>' : '';
  const where = c.g_temp === 'nevera' || c.g_temp === 'congelador' ? c.g_temp : c.g_luz || '';
  return `<g class="jgt-post" data-envase="${c.envase || ''}" data-lugar="${where}" data-forma="${c.g_forma || ''}" data-tapa="${c.abrir === 'siempre' || c.g_aire === 'abierto' ? 'no' : 'si'}" data-control="${c.control || ''}" data-moho="${look.moho ? 1 : 0}" data-reseco="${look.reseco ? 1 : 0}">`
    + place + heat + [84, 120, 156].map((x) => container(x, c, look)).join('') + '</g>';
}

const MATERIAL = { flor: '#7FA65A', hachis: '#7A5A3A', kief: '#C9B98A', congelado: '#A9CFA0', fresco: '#5FBF4A' };
function rosinScene(c) {
  const look = postLooks('rosin', c);
  const glow = { bajo: '#E3A75F', medio: '#F08A3C', alto: '#E2665A' }[c.calor] || '#3A4442';
  const frame = {
    manual: '<path d="M120 60v34M120 60h40" stroke="#9FB8AE" stroke-width="3" stroke-linecap="round"/>',
    hidraulica: '<rect x="108" y="60" width="24" height="34" rx="3" fill="#2B3532" stroke="#9FB8AE"/><rect x="116" y="52" width="8" height="10" fill="#9FB8AE"/>',
    neumatica: '<rect x="108" y="60" width="24" height="34" rx="12" fill="#2B3532" stroke="#9FB8AE"/><path d="M132 74q20 0 26 20" fill="none" stroke="#5FD4E0" stroke-width="1.6"/>',
    electrica: '<rect x="104" y="60" width="32" height="34" rx="3" fill="#2B3532" stroke="#9FB8AE"/><path d="M136 80h18v10" fill="none" stroke="#E3A75F" stroke-width="1.4"/>',
  }[c.prensa] || '<rect x="114" y="62" width="12" height="32" fill="#2B3532" stroke="#9FB8AE"/>';
  const paper = c.papel === 'sin_papel' ? '' : `<rect x="72" y="125" width="96" height="3" fill="${c.papel === 'comun' ? '#C7CFD2' : '#F0F7F3'}" opacity="0.9"/><rect x="72" y="142" width="96" height="3" fill="${c.papel === 'comun' ? '#C7CFD2' : '#F0F7F3'}" opacity="0.9"/>`;
  const mat = MATERIAL[c.material] || '#7FA65A';
  const bag = c.malla === 'sin_bolsa' ? `<ellipse cx="120" cy="135" rx="18" ry="5" fill="${mat}"/>`
    : `<rect x="100" y="129" width="40" height="12" rx="2" fill="${mat}" stroke="#E8EEF0" stroke-width="0.6" stroke-dasharray="${c.malla === 'fina' ? '0.6 0.6' : '1.6 1'}"/>`;
  const puddleCol = look.oscuro ? '#8B5A2B' : look.agua ? '#D9C88F' : '#E3A75F';
  // the rosin oozes out on both sides of the plates
  const puddle = c.material ? `<g class="jgt-rosin" fill="${puddleCol}" opacity="0.95"><ellipse cx="58" cy="136" rx="10" ry="4.5"/><ellipse cx="182" cy="136" rx="10" ry="4.5"/><rect x="66" y="133" width="108" height="5" rx="2"/></g>`
    + (look.restos ? '<g class="jgt-debris">' + [52, 58, 64, 176, 183, 188].map((x, i) => `<circle cx="${x}" cy="${135 + (i % 2) * 2}" r="1.1" fill="#4F7A3A"/>`).join('') + '</g>' : '')
    + (look.agua ? '<g fill="#5FD4E0">' + [54, 62, 180, 187].map((x) => `<ellipse cx="${x}" cy="143" rx="1.3" ry="2.2"/>`).join('') + '</g>' : '') : '';
  const gloves = c.proteccion === 'guantes' ? '<path class="jgt-gloves" d="M182 170q-4 -14 4 -18q4 6 6 0q4 2 4 8v10z" fill="#E3A75F" stroke="#9A6A35" stroke-width="0.6"/>' : '';
  return `<g class="jgt-post" data-material="${c.material || ''}" data-malla="${c.malla || ''}" data-calor="${c.calor || ''}" data-papel="${c.papel || ''}" data-prensa="${c.prensa || ''}" data-restos="${look.restos ? 1 : 0}" data-oscuro="${look.oscuro ? 1 : 0}">`
    + `<rect x="92" y="94" width="56" height="8" fill="#2B3532" stroke="#9FB8AE"/>${frame}`
    + `<rect x="66" y="112" width="108" height="12" rx="2" fill="#7F8B8E" stroke="${glow}" stroke-width="2"/>`
    + `<rect x="66" y="146" width="108" height="12" rx="2" fill="#7F8B8E" stroke="${glow}" stroke-width="2"/>`
    + `<path d="M74 158v40M166 158v40M60 198H180" stroke="#9FB8AE" stroke-width="2"/>`
    + paper + bag + puddle + gloves + '</g>';
}

function pot(riego) {
  const wet = riego === 'mucho';
  return (wet ? `<ellipse cx="${CX}" cy="205" rx="44" ry="3.5" fill="#5FD4E0" opacity="0.45"/>` : '')
    + `<path d="M95 ${BASE}H145L140 205H100Z" fill="#7A4E34" stroke="#5A3826" stroke-width="1"/>`
    + `<ellipse cx="${CX}" cy="${BASE}" rx="25" ry="4" fill="${SOIL[riego] || SOIL.moderado}"/>`
    + (riego === 'poco' ? `<path d="M108 ${BASE}l4 -1.5M126 ${BASE + 1}l5 -1" stroke="#6B4E2E" stroke-width="0.8"/>` : '')
    + (wet ? `<ellipse cx="${CX - 8}" cy="${BASE - 1}" rx="7" ry="1.2" fill="#F0F7F3" opacity="0.3"/>` : '');
}

function fan() {
  const blades = [0, 120, 240].map((a) => `<ellipse cx="0" cy="-6" rx="3" ry="6" transform="rotate(${a})"/>`).join('');
  return `<g transform="translate(196 54)"><circle r="13" fill="#2B3532" stroke="#9FB8AE" stroke-width="1"/>`
    + `<g fill="#9FB8AE" opacity="0.8">${blades}</g><circle r="2" fill="#E3A75F"/></g>`;
}

// ---------------------------------------------------------------- phase 3: what can be touched
// Each object opens the decisions it controls. x / y = its centre in the
// drawing (viewBox 240 × 216); the buttons over the picture use them.
export const OBJECTS = {
  lampara: { d: ['fotoperiodo', 'intensidad'], x: 120, y: 30 },
  termometro: { d: ['temperatura'], x: 34, y: 92 },
  humidificador: { d: ['humedad'], x: 200, y: 186 },
  regadera: { d: ['riego'], x: 50, y: 190 },
  nutrientes: { d: ['nutrientes'], x: 150, y: 190 },
};

// Watering can, nutrient bottle, thermometer with heater and humidifier.
function tools() {
  return '<g class="jgt-tools">'
    // thermometer on the left wall + small heater under it
    + '<rect x="31" y="74" width="6" height="26" rx="3" fill="#0B1512" stroke="#9FB8AE" stroke-width="0.8"/><rect x="32.8" y="84" width="2.4" height="14" fill="#E2665A"/><circle cx="34" cy="102" r="4" fill="#E2665A" stroke="#9FB8AE" stroke-width="0.8"/>'
    + '<rect x="26" y="112" width="16" height="10" rx="2" fill="#2B3532" stroke="#9FB8AE" stroke-width="0.6"/><path d="M29 115h10M29 118h10" stroke="#E3A75F" stroke-width="0.8"/>'
    // watering can
    + '<path d="M40 183h16l-2 15H42Z" fill="#5FD4E0" fill-opacity="0.5" stroke="#9FB8AE" stroke-width="0.8"/><path d="M56 186l9-7" stroke="#9FB8AE" stroke-width="1.6" stroke-linecap="round"/><path d="M42 183q6 -8 12 0" fill="none" stroke="#9FB8AE" stroke-width="1"/>'
    // nutrient bottle
    + '<rect x="144" y="183" width="12" height="18" rx="2" fill="#E3A75F" fill-opacity="0.75" stroke="#9FB8AE" stroke-width="0.8"/><rect x="147" y="178" width="6" height="5" fill="#2B3532"/><rect x="146" y="189" width="8" height="5" rx="1" fill="#F0F7F3" fill-opacity="0.7"/>'
    // humidifier with a little mist
    + '<rect x="190" y="182" width="20" height="20" rx="4" fill="#2B3532" stroke="#9FB8AE" stroke-width="0.8"/><circle cx="200" cy="192" r="4" fill="#5FD4E0" fill-opacity="0.6"/><path d="M197 178q3 -5 6 0M200 172q3 -4 5 0" fill="none" stroke="#C7CFD2" stroke-width="0.9" stroke-linecap="round" opacity="0.7"/>'
    + '</g>';
}

function objButtons(open, ctx) {
  return Object.entries(OBJECTS).map(([k, o]) => {
    const name = ctx.t('jgObj_' + k);
    return `<button type="button" class="jgt-obj" data-obj="${k}" id="jgtObj-${k}"
      aria-expanded="${open === k}" aria-controls="jgtPanel" aria-label="${ctx.esc(ctx.t('jgObjAbrir').replace('{o}', name))}" title="${ctx.esc(name)}"></button>`;
  }).join('');
}

// The panel of the open object: the same options as the list below (same
// rules); choosing here ticks the list too.
function panelHtml(open, choices, blocked, ctx) {
  const { t, esc, RULES } = ctx;
  const fields = OBJECTS[open].d.map((d) => `<fieldset class="jg-field">
      <legend>${t('jgD_' + d)}</legend>
      <div class="jg-opts">${RULES.opciones[d].map((o) => {
        const id = `jgt-${d}-${o.replace('/', '-')}`;
        return `<input type="radio" name="jgt-${d}" id="${id}" value="${o}"${choices[d] === o ? ' checked' : ''}${blocked ? ' disabled' : ''}>
          <label for="${id}"><span>${t(`jgO_${d}_${o}`)}</span><small>${t(`jgH_${d}_${o}`)}</small></label>`;
      }).join('')}</div>
    </fieldset>`).join('');
  return `<div class="jgt-panel" id="jgtPanel" role="group" aria-labelledby="jgtPanelH" data-obj="${open}">
    <h4 id="jgtPanelH">${esc(t('jgObj_' + open))}</h4>
    ${fields}
    <div class="jg-actions">
      <button type="button" class="btn btn-primary" id="jgtNext"${blocked ? ' disabled' : ''}>${t('jgPasarSemana')}</button>
      <button type="button" class="btn btn-ghost" id="jgtClose">${t('jgObjCerrar')}</button>
    </div>
  </div>`;
}

// ---------------------------------------------------------------- the tent
function tentSvg(state, sc, choices, light, ctx) {
  const riego = PLAYABLE.includes(state.stage) ? choices?.riego : 'moderado';
  const living = ['germ', 'plantula', 'vegetativo', 'floracion'].includes(sc);
  let inside = '';
  if (sc === 'intro') inside = pot('moderado') + `<ellipse cx="${CX + 3}" cy="${BASE - 2}" rx="2.6" ry="1.8" fill="#6B4E2E" stroke="#C9A77C" stroke-width="0.5"/>`;
  // an open «exceso de riego» keeps the medium soaked whatever is picked now
  else if (living) inside = pot(problemOf(state)?.id === 'exceso_riego' && !problemOf(state).faded ? 'mucho' : riego) + plant(state, sc, ctx.RULES);
  else if (sc === 'muerta') inside = pot('poco') + wilted();
  else if (sc === 'secado') inside = (ctx.post?.metodo === 'rejilla' ? '' : pot('poco')) + dryScene(ctx.post || {});
  else if (sc === 'rosin') inside = rosinScene(ctx.post || {});
  else if (sc === 'fin') inside = cureScene(state.post?.curado?.c || {}) + (state.post?.rosin ? '<rect class="jgt-rosin-jar" x="184" y="186" width="14" height="18" rx="3" fill="#E3A75F" fill-opacity="0.8" stroke="#9FB8AE" stroke-width="0.6"/>' : '');
  else inside = cureScene(ctx.post || {});
  const cone = light ? `<polygon points="74,35 166,35 214,204 26,204" fill="url(#jgtCone)" opacity="${CONE[light]}"/>` : '';
  return `<svg class="jgt-svg" viewBox="0 0 240 216" role="img" aria-label="${ctx.esc(ctx.t('jgTentAlt'))}" aria-describedby="jgTentDesc" focusable="false"
    data-scene="${sc}" data-light="${light ? 'on' : 'off'}" data-int="${light || ''}" data-riego="${living ? riego : ''}" data-leaf="${living ? healthBand(state.health) : ''}">
  <defs>
    <linearGradient id="jgtWall" x1="0" x2="1"><stop offset="0" stop-color="#7F8B8E"/><stop offset="0.5" stop-color="#C7CFD2"/><stop offset="1" stop-color="#7F8B8E"/></linearGradient>
    <linearGradient id="jgtCone" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#FFD58A"/><stop offset="1" stop-color="#FFD58A" stop-opacity="0"/></linearGradient>
  </defs>
  <rect x="12" y="6" width="216" height="206" rx="6" fill="#151E1B" stroke="#9FB8AE" stroke-width="1.5"/>
  <rect x="20" y="12" width="200" height="194" fill="var(--paper-raised)"/>
  <rect x="20" y="12" width="200" height="194" fill="url(#jgtWall)" opacity="0.3"/>
  <path d="M60 12V206M180 12V206" stroke="#C7CFD2" stroke-opacity="0.18"/>
  <rect x="20" y="204" width="200" height="4" fill="#2A2F2D"/>
  ${cone}
  ${fan()}
  <path d="M80 12L84 26M160 12L156 26" stroke="#9FB8AE" stroke-width="1"/>
  <rect x="70" y="26" width="100" height="9" rx="2" fill="#2B3532" stroke="#9FB8AE" stroke-width="0.6"/>
  <rect x="74" y="32" width="92" height="2.4" rx="1" fill="${light ? '#FFE3A3' : '#3A4442'}"/>
  ${living ? tools() : ''}
  ${inside}
  ${light ? '' : '<rect x="20" y="12" width="200" height="196" fill="#000" opacity="0.45"/>'}
  ${living && ctx.anim ? `<g class="jgt-drops" fill="#5FD4E0">${[108, 120, 132].map((x, i) => `<ellipse class="jgt-drop d${i}" cx="${x}" cy="${BASE - 6}" rx="1.4" ry="2.2"/>`).join('')}</g>
  <rect class="jgt-night" x="20" y="12" width="200" height="196" fill="#000" opacity="0"/>` : ''}
</svg>`;
}

// ---------------------------------------------------------------- gauges
const LV = ['lv0', 'lv1', 'lv2'];
function clock(foto) {
  const day = foto === '12/12' ? 12 : 18;
  const a = (day / 24) * 2 * Math.PI;
  const ex = f1(16 + 13 * Math.sin(a)), ey = f1(16 - 13 * Math.cos(a));
  return `<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" data-day="${day}"><circle cx="16" cy="16" r="13" fill="#0B1512" stroke="#9FB8AE"/>`
    + `<path d="M16 16L16 3A13 13 0 ${day > 12 ? 1 : 0} 1 ${ex} ${ey}Z" fill="#E3A75F"/><circle cx="16" cy="16" r="2" fill="#F0F7F3"/></svg>`;
}
function thermo(l) {
  const h = [6, 12, 18][l];
  return `<svg viewBox="0 0 20 32" aria-hidden="true" focusable="false"><rect x="7" y="3" width="6" height="21" rx="3" fill="none" stroke="#9FB8AE"/>`
    + `<rect class="${LV[l]}" x="8.5" y="${23 - h}" width="3" height="${h + 1}"/><circle class="${LV[l]}" cx="10" cy="26" r="4.5"/></svg>`;
}
function drops(l) {
  const d = (x, on) => `<path d="M${x} 9C${x - 4} 15 ${x - 5} 18 ${x - 5} 20.5A5 5 0 0 0 ${x + 5} 20.5C${x + 5} 18 ${x + 4} 15 ${x} 9Z" ${on ? `class="${LV[l]}"` : 'fill="none"'} stroke="#9FB8AE"/>`;
  return `<svg viewBox="0 0 40 32" aria-hidden="true" focusable="false">${d(8, true)}${d(20, l >= 1)}${d(32, l >= 2)}</svg>`;
}
function dial(l) {
  const a = [-55, 0, 55][l] * Math.PI / 180;
  return `<svg viewBox="0 0 32 24" aria-hidden="true" focusable="false"><path d="M4 20A12 12 0 0 1 28 20" fill="none" stroke="#9FB8AE" stroke-width="2"/>`
    + `<path d="M16 20L${f1(16 + 11 * Math.sin(a))} ${f1(20 - 11 * Math.cos(a))}" class="${LV[l]}s" stroke-width="2.4" stroke-linecap="round"/><circle cx="16" cy="20" r="2" fill="#F0F7F3"/></svg>`;
}

function gauges(choices, ctx) {
  const lvl = (d) => Math.max(0, ctx.RULES.opciones[d].indexOf(choices[d]));
  const item = (d, svg, level) => `<li class="jg-g" data-g="${d}"${level === null ? '' : ` data-level="${level}"`}>${svg}<span><small>${ctx.t('jgD_' + d)}</small><b>${ctx.t(`jgO_${d}_${choices[d]}`)}</b></span></li>`;
  return `<ul class="jg-gauges" aria-label="${ctx.esc(ctx.t('jgTentGauges'))}">
    ${item('fotoperiodo', clock(choices.fotoperiodo), null)}
    ${item('temperatura', thermo(lvl('temperatura')), lvl('temperatura'))}
    ${item('humedad', drops(lvl('humedad')), lvl('humedad'))}
    ${item('nutrientes', dial(lvl('nutrientes')), lvl('nutrientes'))}
  </ul>`;
}

// ---------------------------------------------------------------- caption
function caption(state, sc, choices, light, t, post) {
  const out = [t('jgTentD_' + sc)];
  if (sc === 'secado') out.push(t('jgTentM_' + (post?.metodo || 'ramas')));
  // intro and curing already say it is dark; drying can be dark or lit
  if (light || sc === 'muerta' || sc === 'secado') out.push(t(light ? 'jgTentLuz_' + light : 'jgTentLuz_off'));
  if (['germ', 'plantula', 'vegetativo', 'floracion'].includes(sc)) {
    out.push(t('jgTentRiego_' + choices.riego), t('jgTentHoja_' + healthBand(state.health)));
    const prob = problemOf(state);
    if (prob) out.push(t(prob.faded ? 'jgTentRec' : 'jgTentP_' + prob.id));
  }
  // phase 8: what the choices on the screen do (mould, over-dried, debris…)
  const look = post ? postLooks(sc, post) : {};
  for (const k of ['moho', 'reseco', 'restos', 'oscuro', 'agua']) if (look[k]) out.push(t('jgTentX_' + k));
  return out.join(' ');
}

// choices: the week's choices on screen (live while the person picks), or null.
// ui.open: the object whose panel is open; ui.blocked: an event must be
// answered first (same as the list: options disabled).
export function tentHtml(state, choices, ctx, ui = {}) {
  const sc = scene(state);
  const play = PLAYABLE.includes(state.stage);
  const ch = play ? choices : null;
  // phase 8: the post-harvest screens are drawn with what is picked (ui.post)
  const post = ['secado', 'curado', 'rosin'].includes(sc) ? (ui.post || {}) : null;
  const light = play ? (ch.intensidad || 'media')
    : sc === 'fin' || sc === 'rosin' ? 'baja' : sc === 'secado' && post.luz === 'con_luz' ? 'media' : null;
  const open = play && OBJECTS[ui.open] ? ui.open : null;
  return `<figure class="jg-tent${play && ui.anim ? ' jgt-anim' : ''}" id="jgTent">
    <div class="jgt-scene">
      <div class="jgt-stage">${tentSvg(state, sc, ch, light, { ...ctx, anim: play && ui.anim, post })}${play ? objButtons(open, ctx) : ''}</div>
      ${play ? `<p class="jgt-hint">${ctx.esc(ctx.t('jgTentHint'))}</p>` : ''}
      ${open ? panelHtml(open, ch, !!ui.blocked, ctx) : ''}
    </div>
    ${play ? gauges(ch, ctx) : ''}
    <figcaption class="jgt-desc" id="jgTentDesc">${ctx.esc(caption(state, sc, ch, light, ctx.t, post))}</figcaption>
  </figure>`;
}

export const CSS = `
#juego .jg-tent{margin:0 0 16px;display:grid;gap:10px}
#juego .jgt-scene{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:8px}
#juego .jgt-stage{position:relative;width:100%;max-width:440px;margin:0 auto}
#juego .jgt-svg{display:block;width:100%;height:auto}
#juego .jgt-obj{position:absolute;width:44px;height:44px;margin:-22px 0 0 -22px;padding:0;border-radius:50%;background:transparent;border:2px dashed rgba(42,235,160,0.55);cursor:pointer}
#juego .jgt-obj:hover{background:rgba(42,235,160,0.12)}
#juego .jgt-obj:focus-visible{outline:3px solid var(--teal);outline-offset:2px}
#juego .jgt-obj[aria-expanded="true"]{border-style:solid;border-color:var(--moss);background:rgba(42,235,160,0.18)}
${Object.entries(OBJECTS).map(([k, o]) => `#juego .jgt-obj[data-obj="${k}"]{left:${f1(o.x / 2.4)}%;top:${f1(o.y / 2.16)}%}`).join('\n')}
#juego .jgt-hint{margin:8px 0 0;font-size:12.5px;color:var(--ink-soft);text-align:center}
#juego .jgt-panel{margin-top:10px;border-top:1px solid var(--line);padding-top:10px}
#juego .jgt-panel h4{margin:0 0 8px;font-family:'Manrope',sans-serif;font-size:15px;color:var(--ink)}
#juego .jg-gauges{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
#juego .jg-g{display:flex;align-items:center;gap:8px;min-width:0;background:var(--paper-raised);border:1px solid var(--line);border-radius:8px;padding:8px 10px}
#juego .jg-g svg{flex:0 0 auto;width:30px;height:30px}
#juego .jg-g span{display:flex;flex-direction:column;min-width:0}
#juego .jg-g small{font-size:12px;color:var(--ink-soft);line-height:1.3}
#juego .jg-g b{font-size:14px;color:var(--ink);overflow-wrap:anywhere}
#juego .jg-g .lv0{fill:var(--teal)}#juego .jg-g .lv1{fill:var(--moss)}#juego .jg-g .lv2{fill:var(--resin)}
#juego .jg-g .lv0s{stroke:var(--teal)}#juego .jg-g .lv1s{stroke:var(--moss)}#juego .jg-g .lv2s{stroke:var(--resin)}
#juego .jgt-desc{margin:0;font-size:13.5px;line-height:1.55;color:var(--ink-soft)}
/* phase 4: the week that just passed, played once (under 2.5 s, nothing loops) */
#juego .jgt-anim .jgt-plant{transform-box:fill-box;transform-origin:50% 100%;animation:jgtGrow 1.2s ease-out 1}
#juego .jgt-drop{opacity:0;animation:jgtDrop 1.2s ease-in 1 forwards}
#juego .jgt-drop.d1{animation-delay:.25s}
#juego .jgt-drop.d2{animation-delay:.5s}
#juego .jgt-night{animation:jgtNight 2.2s ease-in-out 1 forwards}
@keyframes jgtGrow{from{transform:scaleY(.93)}to{transform:scaleY(1)}}
@keyframes jgtDrop{0%{opacity:0;transform:translateY(-34px)}25%{opacity:1}100%{opacity:0;transform:translateY(0)}}
@keyframes jgtNight{0%{opacity:0}40%{opacity:.6}60%{opacity:.6}100%{opacity:0}}
@media (prefers-reduced-motion:reduce){
  #juego .jgt-anim .jgt-plant,#juego .jgt-drop,#juego .jgt-night{animation:none}
  #juego .jgt-drops,#juego .jgt-night{display:none}
}
@media (min-width:700px){
  #juego .jg-tent{grid-template-columns:minmax(0,3fr) minmax(0,2fr);align-items:start}
  #juego .jg-gauges{grid-template-columns:1fr}
  #juego .jgt-desc{grid-column:1 / -1}
}
`;
