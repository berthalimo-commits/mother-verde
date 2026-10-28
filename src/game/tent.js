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
  if (st === 'curado' || st === 'rosin') return 'curado';
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
function bud(x, y, r, trich, dots) {
  const [c1, o, c2] = TRICH[trich] || TRICH.transparentes;
  let out = `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(r * 0.75)}" ry="${f1(r)}" fill="#8FCF7E"/>`
    + `<ellipse cx="${f1(x - r * 0.45)}" cy="${f1(y + r * 0.35)}" rx="${f1(r * 0.5)}" ry="${f1(r * 0.7)}" fill="#7DBE6C"/>`
    + `<ellipse cx="${f1(x + r * 0.45)}" cy="${f1(y + r * 0.35)}" rx="${f1(r * 0.5)}" ry="${f1(r * 0.7)}" fill="#7DBE6C"/>`;
  for (let j = 0; j < dots; j++) {
    const ang = j * 2.39996, rad = r * 0.7 * Math.sqrt((j + 0.5) / dots);
    out += `<circle cx="${f1(x + Math.cos(ang) * rad * 0.8)}" cy="${f1(y + Math.sin(ang) * rad)}" r="0.7" fill="${c2 && j % 3 === 2 ? c2 : c1}" opacity="${o}"/>`;
  }
  return out;
}

const vegHeight = (w) => 26 + Math.min(w, 6) * 13;

// The living plant (seedling, vegetative or flowering).
function plant(state, sc, rules) {
  const color = LEAF[healthBand(state.health)];
  if (sc === 'germ') {
    return `<g fill="${color}"><path d="M${CX} ${BASE}V${BASE - 10}" stroke="${color}" stroke-width="1.6"/>`
      + `<ellipse cx="${CX - 5}" cy="${BASE - 11}" rx="4.5" ry="2.2" transform="rotate(-20 ${CX - 5} ${BASE - 11})"/>`
      + `<ellipse cx="${CX + 5}" cy="${BASE - 11}" rx="4.5" ry="2.2" transform="rotate(20 ${CX + 5} ${BASE - 11})"/></g>`;
  }
  if (sc === 'plantula') {
    return `<g fill="${color}"><path d="M${CX} ${BASE}V${BASE - 20}" stroke="${color}" stroke-width="1.8"/>`
      + `<ellipse cx="${CX - 5}" cy="${BASE - 9}" rx="4.5" ry="2.2" transform="rotate(-20 ${CX - 5} ${BASE - 9})"/>`
      + `<ellipse cx="${CX + 5}" cy="${BASE - 9}" rx="4.5" ry="2.2" transform="rotate(20 ${CX + 5} ${BASE - 9})"/>`
      + leaf(CX, BASE - 19, -55, 11, 3) + leaf(CX, BASE - 19, 55, 11, 3) + '</g>';
  }
  const vegWeeks = sc === 'vegetativo' ? state.stageWeek : Math.max(1, state.log.filter((l) => l.s === 'vegetativo').length);
  const stretch = sc === 'floracion' ? Math.min(state.stageWeek, 3) * 10 : 0;
  const H = Math.min(vegHeight(vegWeeks) + stretch, 136);
  const top = BASE - H;
  const nodes = Math.max(2, Math.min(7, Math.round(H / 17)));
  let leaves = '', buds = '';
  const w = state.stageWeek;
  const trich = sc === 'floracion' ? E.trichomes(w, rules) : null;
  const budR = Math.min(4 + w * 0.9, 11);
  const dots = 4 + Math.min(w, 8);
  for (let i = 0; i < nodes; i++) {
    const y = BASE - 8 - (H - 14) * (i / nodes);
    const k = 1 - i / (nodes + 1);
    const s = 12 + 18 * k;
    const tilt = i % 2 ? 6 : -6;
    leaves += leaf(CX - 1, y, -72 + tilt, s) + leaf(CX + 1, y - 4, 72 + tilt, s);
    if (sc === 'floracion' && i >= Math.floor(nodes / 2)) {
      buds += bud(CX - 9 - s * 0.15, y - 6, budR * 0.55, trich, Math.ceil(dots / 2)) + bud(CX + 9 + s * 0.15, y - 10, budR * 0.55, trich, Math.ceil(dots / 2));
    }
  }
  const crown = sc === 'floracion' ? bud(CX, top + budR * 0.4, budR, trich, dots) : leaf(CX, top + 4, 0, 10, 3);
  return `<path class="jgt-stem" d="M${CX} ${BASE}Q${CX + 3} ${f1(BASE - H / 2)} ${CX} ${f1(top + 4)}" fill="none" stroke="${color}" stroke-width="${sc === 'floracion' ? 3 : 2.4}" stroke-linecap="round"/>`
    + `<g fill="${color}">${leaves}${sc === 'floracion' ? '' : crown}</g>${buds}${sc === 'floracion' ? crown : ''}`;
}

function wilted() {
  const c = LEAF.dead;
  return `<path d="M${CX} ${BASE}Q${CX + 5} 150 ${CX - 6} 132Q${CX - 14} 124 ${CX - 22} 134" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round"/>`
    + `<g fill="${c}">${leaf(CX + 2, 168, 150, 18)}${leaf(CX - 1, 160, -150, 16)}${leaf(CX - 4, 146, 165, 14)}${leaf(CX - 22, 134, 175, 10, 3)}</g>`;
}

function hanging() {
  let out = '<path d="M38 58H202" stroke="#9FB8AE" stroke-width="1"/>';
  for (const x of [78, 120, 162]) {
    out += `<path d="M${x} 56v6M${x} 62V108" stroke="#7D8F4A" stroke-width="1.6" fill="none"/>`
      + `<g fill="#7D8F4A">${leaf(x, 78, -150, 11, 3)}${leaf(x, 90, 150, 11, 3)}</g>`
      + bud(x, 104, 6, 'mezcla', 8).replace(/#8FCF7E/g, '#A3AE6E').replace(/#7DBE6C/g, '#929D60');
  }
  return out + `<rect x="${CX - 1.5}" y="${BASE - 7}" width="3" height="7" fill="#6B4E2E"/>`;
}

function jars() {
  let out = '';
  for (const x of [84, 120, 156]) {
    out += `<rect x="${x - 14}" y="166" width="28" height="38" rx="5" fill="#5FD4E0" fill-opacity="0.12" stroke="#9FB8AE" stroke-width="1"/>`
      + `<rect x="${x - 12}" y="160" width="24" height="7" rx="1.5" fill="#E3A75F"/>`
      + `<ellipse cx="${x - 5}" cy="196" rx="6" ry="5" fill="#8FAE6A"/><ellipse cx="${x + 5}" cy="197" rx="5.5" ry="4.5" fill="#7F9E5C"/><ellipse cx="${x}" cy="189" rx="5" ry="4.5" fill="#9DBA76"/>`;
  }
  return out;
}

function pot(riego) {
  const wet = riego === 'mucho';
  return (wet ? `<ellipse cx="${CX}" cy="205" rx="44" ry="3.5" fill="#5FD4E0" opacity="0.45"/>` : '')
    + `<path d="M95 ${BASE}H145L140 205H100Z" fill="#7A4E34" stroke="#5A3826" stroke-width="1"/>`
    + `<ellipse cx="${CX}" cy="${BASE}" rx="25" ry="4" fill="${SOIL[riego] || SOIL.moderado}"/>`
    + (riego === 'poco' ? `<path d="M108 ${BASE}l4 -1.5M126 ${BASE + 1}l5 -1" stroke="#6B4E2E" stroke-width="0.8"/>` : '');
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
  else if (living) inside = pot(riego) + plant(state, sc, ctx.RULES);
  else if (sc === 'muerta') inside = pot('poco') + wilted();
  else if (sc === 'secado') inside = pot('poco') + hanging();
  else inside = jars();
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
function caption(state, sc, choices, light, t) {
  const out = [t('jgTentD_' + sc)];
  // intro, drying and curing already say the tent is dark
  if (light || sc === 'muerta') out.push(t(light ? 'jgTentLuz_' + light : 'jgTentLuz_off'));
  if (['germ', 'plantula', 'vegetativo', 'floracion'].includes(sc)) {
    out.push(t('jgTentRiego_' + choices.riego), t('jgTentHoja_' + healthBand(state.health)));
  }
  return out.join(' ');
}

// choices: the week's choices on screen (live while the person picks), or null.
// ui.open: the object whose panel is open; ui.blocked: an event must be
// answered first (same as the list: options disabled).
export function tentHtml(state, choices, ctx, ui = {}) {
  const sc = scene(state);
  const play = PLAYABLE.includes(state.stage);
  const ch = play ? choices : null;
  const light = play ? (ch.intensidad || 'media') : sc === 'fin' ? 'baja' : null;
  const open = play && OBJECTS[ui.open] ? ui.open : null;
  return `<figure class="jg-tent" id="jgTent">
    <div class="jgt-scene">
      <div class="jgt-stage">${tentSvg(state, sc, ch, light, ctx)}${play ? objButtons(open, ctx) : ''}</div>
      ${play ? `<p class="jgt-hint">${ctx.esc(ctx.t('jgTentHint'))}</p>` : ''}
      ${open ? panelHtml(open, ch, !!ui.blocked, ctx) : ''}
    </div>
    ${play ? gauges(ch, ctx) : ''}
    <figcaption class="jgt-desc" id="jgTentDesc">${ctx.esc(caption(state, sc, ch, light, ctx.t))}</figcaption>
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
@media (min-width:700px){
  #juego .jg-tent{grid-template-columns:minmax(0,3fr) minmax(0,2fr);align-items:start}
  #juego .jg-gauges{grid-template-columns:1fr}
  #juego .jgt-desc{grid-column:1 / -1}
}
`;
