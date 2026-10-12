// Generates the PROPOSED flower (bud) and leaf icons + a before/after
// comparison page. Original vector drawings (no traced images).
// Run: node design/icons/build-icons.mjs  ->  design/icons/*.svg + comparison.html
// NOTHING in the app uses these files until the owner approves the drawing.
import fs from 'fs';
const DIR = new URL('./', import.meta.url);
const W = (f, s) => fs.writeFileSync(new URL(f, DIR), s);

// ------------------------------------------------------------- palette
const C = {
  deep: '#0E8A62', body: '#16B884', mid: '#1FCF8C', light: '#2AEBA0',
  edge: 'rgba(4,20,15,0.38)', pistil: '#E8A33D', trich: '#F2FFF8',
};

// ------------------------------------------------------------- bud geometry (viewBox 0 0 60 96)
// Rows of small rounded calyx clusters, bottom -> top: [y, half-width]
// widest around the middle, thinner towards the pointed tip.
// Spindle: narrow at the base, widest around the middle (y 44-52), long pointed top.
const ROWS = [[75, 6.5], [69, 10], [63, 12.4], [57, 13.6], [51, 14], [45, 13.6], [39, 12.6], [33, 11], [27, 9], [21, 6.8], [15.5, 4.6], [11, 2.8]];
const TIP = [30, 4];

function clusters() {
  const out = [];
  ROWS.forEach(([y, hw], i) => {
    const r = Math.max(2.6, Math.min(5, hw * 0.42));
    const n = Math.max(1, Math.round((hw * 2) / (r * 1.45)));
    const span = hw * 2 - r * 1.2;
    for (let k = 0; k < n; k++) {
      const x = n === 1 ? 30 : 30 - span / 2 + (span * k) / (n - 1) + (i % 2 ? 0.8 : -0.8);
      const shade = [C.body, C.mid, C.light][(k + i) % 3];
      out.push(`<ellipse cx="${x.toFixed(1)}" cy="${(y + (k % 2 ? 0.8 : -0.4)).toFixed(1)}" rx="${r.toFixed(1)}" ry="${(r * 0.9).toFixed(1)}" fill="${y < 30 ? (k % 2 ? C.light : C.mid) : shade}"/>`);
    }
  });
  return out.join('');
}
// Scalloped silhouette around the clusters (used as the base and as the outline).
function silhouette(bump = 0.8) {
  const right = ROWS.map(([y, hw]) => [30 + hw, y]);
  const left = ROWS.map(([y, hw]) => [30 - hw, y]).reverse();
  let d = `M${(30 - ROWS[0][1] + 1).toFixed(1)} ${ROWS[0][0] + 4}`;
  d += ` Q30 ${ROWS[0][0] + 7} ${(30 + ROWS[0][1] - 1).toFixed(1)} ${ROWS[0][0] + 4}`;
  let prev = [30 + ROWS[0][1] - 1, ROWS[0][0] + 4];
  for (const p of right) { d += ` A${4 * bump} ${4 * bump} 0 0 0 ${p[0].toFixed(1)} ${p[1]}`; prev = p; }
  d += ` Q${TIP[0] + 2.2} ${TIP[1] + 4} ${TIP[0]} ${TIP[1]} Q${TIP[0] - 2.2} ${TIP[1] + 4} ${left[0][0].toFixed(1)} ${left[0][1]}`;
  for (const p of left.slice(1)) d += ` A${4 * bump} ${4 * bump} 0 0 0 ${p[0].toFixed(1)} ${p[1]}`;
  d += ' Z';
  return d;
}
// v2 (after the owner's reference photo): long, thin, serrated sugar leaves
// that arch outwards and droop at the tip. Built along a curved midrib from
// (0,0) pointing "up" in local space; teeth lean towards the tip.
function sugarLeaf(len, maxW, bend) {
  const N = 14, right = [], left = [];
  for (let i = 1; i < N; i++) {
    const t = i / N;
    const mx = bend * len * t * t, my = -len * t;
    const tx = 2 * bend * len * t, ty = -len, tl = Math.hypot(tx, ty);
    const nx = -ty / tl, ny = tx / tl; // unit normal to the +x side
    const w = maxW * Math.pow(Math.sin(Math.PI * Math.min(t * 1.15, 1)), 0.7) * (1 - 0.35 * t);
    const k = i % 2 ? 1 : 0.55, kl = i % 2 ? 0.55 : 1; // tooth / notch, alternating on the two edges
    right.push([mx + nx * w * k, my + ny * w * k]);
    left.push([mx - nx * w * kl, my - ny * w * kl]);
  }
  const tip = [bend * len, -len];
  const pts = [[0, 0], ...right, tip, ...left.reverse()];
  return 'M' + pts.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(' L') + ' Z';
}
const midrib = (len, bend) => `M0 0 Q${(bend * len * 0.5).toFixed(2)} ${(-len * 0.5).toFixed(2)} ${(bend * len).toFixed(2)} ${(-len).toFixed(2)}`;
// [x, y, rotation, length, droop]: from the sides of the lower half and the
// middle, out and down; the tips droop (bend towards the ground).
const LEAVES = [[20, 66, -118, 36, -0.22], [40, 64, 116, 36, 0.22], [17.5, 47, -97, 30, -0.26], [42.5, 45, 99, 28, 0.26]];
const SHIFT = 12; // the leaves reach beyond the bud: viewBox is 84 wide, bud centred at 42
// Inner marks: short staggered "cups" (clusters), never full-width bands.
const CUPS = [[25, 66], [34, 64], [21, 56], [30, 57], [38, 54], [24, 46], [33, 45], [27, 36], [34, 34], [30, 26], [27, 18]];
const cupPaths = (w, every = 1, half = 3) => CUPS.filter((_, i) => i % every === 0).map(([x, y]) => `<path d="M${x - half} ${y} q${half} ${w} ${half * 2} 0"/>`).join('');
// Curled orange hairs spread along the whole cola (more than v1).
const PISTILS = ['M24 41 C21.5 38.5 19 37.5 16.5 35', 'M37 48 C39.5 45.5 42 44.5 45.5 43', 'M27.5 28 C25.5 25.5 24 23.5 21.5 21', 'M34.5 61 C37.5 60 40.5 60.5 43.5 59', 'M31.5 17.5 C32.5 14.5 34 12.5 36.5 10.5',
  'M22 56 C19 55 17 56.5 15 55', 'M38 36 C40.5 34 42 31.5 41.5 29', 'M26 68 C24 70 21.5 70.5 19.5 72'];
// Frost: pale trichome dots.
const TRICH = [[26, 50], [33, 44], [29, 36], [35, 54], [24, 58], [31, 24], [27, 66], [37, 34], [22, 44], [38, 60], [30, 50], [33, 30], [26, 30], [29, 15], [34, 68], [20, 62]];

const stem = (stroke, w) => `<path d="M30 95 C30 88 30.6 82 30 76" stroke="${stroke}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;
const leaves = (fill, stroke, sw, which = LEAVES, rib = null) => which.map(([x, y, r, len, bend]) => `<g transform="translate(${x} ${y}) rotate(${r})"><path d="${sugarLeaf(len, 4, bend)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>${rib ? `<path d="${midrib(len, bend)}" stroke="${rib}" stroke-width="0.6" fill="none"/>` : ''}</g>`).join('');
const open = (extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 84 96"${extra}><g transform="translate(${SHIFT} 0)">`;
const close = '</g></svg>';

const budFilled = `${open()}
${stem(C.deep, 2.4)}
${leaves(C.deep, C.edge, 0.5, LEAVES, C.mid)}
<path d="${silhouette()}" fill="${C.deep}"/>
<g stroke="${C.edge}" stroke-width="0.6">${clusters()}</g>
<path d="M30 ${TIP[1]} Q32.4 11 33 15 L27 15 Q27.6 11 30 ${TIP[1]} Z" fill="${C.light}"/>
<g stroke="${C.pistil}" stroke-width="1.15" fill="none" stroke-linecap="round">${PISTILS.map((d) => `<path d="${d}"/>`).join('')}</g>
<g fill="${C.trich}" opacity="0.85">${TRICH.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="0.75"/>`).join('')}</g>
${close}`;

// Outline (not chosen): currentColor, so it follows the text colour in light and dark.
const budOutline = `${open(' fill="none" stroke="currentColor" stroke-linejoin="round" stroke-linecap="round"')}
${stem('currentColor', 2.2)}
${leaves('none', 'currentColor', 1.2)}
<path d="${silhouette()}" stroke-width="2"/>
<g stroke-width="1.3" opacity="0.75">${cupPaths(3)}</g>
<g stroke="${C.pistil}" stroke-width="1.3">${PISTILS.slice(0, 4).map((d) => `<path d="${d}"/>`).join('')}</g>
${close}`;

// Simplified, for 24 px: silhouette + cups, the 2 long lower leaves, 3 thick pistils.
const budSmall = `${open()}
${stem(C.deep, 3.6)}
${leaves(C.deep, 'none', 0, LEAVES.slice(0, 2))}
<path d="${silhouette(0.85)}" fill="${C.mid}" stroke="${C.deep}" stroke-width="2"/>
<g stroke="${C.deep}" stroke-width="2.2" fill="none" stroke-linecap="round">${cupPaths(3.5, 2, 3.5)}</g>
<g stroke="${C.pistil}" stroke-width="2.6" fill="none" stroke-linecap="round"><path d="M23 42 C20.5 39.5 18 38.5 15 36"/><path d="M37 50 C40 47.5 42.5 46.5 46 45"/><path d="M29 24 C27.5 21 25.5 19 22.5 17"/></g>
${close}`;
const budSmallOutline = `${open(' fill="none" stroke="currentColor" stroke-linejoin="round" stroke-linecap="round"')}
${stem('currentColor', 3.4)}
${leaves('none', 'currentColor', 2.2, LEAVES.slice(0, 2))}
<path d="${silhouette(0.85)}" stroke-width="3.2"/>
<g stroke-width="2.2" opacity="0.75">${cupPaths(3.5, 2, 3.5)}</g>
${close}`;

// ------------------------------------------------------------- leaf (viewBox 0 0 40 40), stroke style like today
// Leaflet: lanceolate (wide in the middle, pointed), smooth edge with a few
// small teeth — not the zig-zag "fir" edge of the current one. Length 100.
const LEAFLET = 'M0 0 C3 -10 7 -22 8.5 -38 L10.5 -40 L8.8 -43 C8.6 -55 6.5 -70 4 -80 L5.2 -82 L3.4 -84 C2.4 -90 1.2 -95 0 -100 C-1.2 -95 -2.4 -90 -3.4 -84 L-5.2 -82 L-4 -80 C-6.5 -70 -8.6 -55 -8.8 -43 L-10.5 -40 L-8.5 -38 C-7 -22 -3 -10 0 0 Z';
function leaf(n, stroke, sw, scale = 0.3) {
  const set = n === 7 ? [[0, 1], [-28, 0.86], [28, 0.86], [-56, 0.66], [56, 0.66], [-92, 0.4], [92, 0.4]] : [[0, 1], [-32, 0.82], [32, 0.82], [-66, 0.56], [66, 0.56]];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><g stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" fill="none">
<path d="M20 34 L20 39" stroke-linecap="round"/>
${set.map(([r, s]) => `<path d="${LEAFLET}" transform="translate(20 34) rotate(${r}) scale(${(scale * s).toFixed(3)})"/>`).join('')}
</g></svg>`;
}

W('bud-filled.svg', budFilled);
W('bud-outline.svg', budOutline);
W('bud-24-filled.svg', budSmall);
W('bud-24-outline.svg', budSmallOutline);
W('leaf-7.svg', leaf(7, 'currentColor', 2.2));
W('leaf-5.svg', leaf(5, 'currentColor', 2.4));

// ------------------------------------------------------------- comparison page
const index = fs.readFileSync(new URL('../../index.html', DIR), 'utf8');
const sym = index.match(/<symbol id="mvBud" viewBox="0 0 60 96">([\s\S]*?)<\/symbol>/)[1];
const oldBud = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 96">${sym}</svg>`;
const oldLeafG = index.match(/<svg class="zone-icon" viewBox="0 0 40 40" width="20" height="20">([\s\S]*?)<\/svg>/)[1].replace(/var\(--moss-deep\)/g, 'currentColor');
const oldLeaf = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">${oldLeafG}</svg>`;
const oldLogoG = index.match(/<div class="brand-mark">\s*<svg viewBox="0 0 40 40" width="20" height="20">([\s\S]*?)<\/svg>/)[1];
const oldLogo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">${oldLogoG.replace(/var\(--paper\)/g, 'currentColor')}</svg>`;
const size = (svg, px, ratio) => svg.replace('<svg ', `<svg width="${px}" height="${Math.round(px * ratio)}" `);
const SIZES = [24, 32, 48];
const row = (title, items, ratio) => `<tr><th>${title}</th>${SIZES.map((px) => `<td>${items.map((s) => size(s, px, ratio)).join(' ')}</td>`).join('')}</tr>`;
const panel = (theme) => `<section class="${theme}"><h2>${theme === 'dark' ? 'Modo oscuro' : 'Modo claro'}</h2>
<table><tr><th></th>${SIZES.map((p) => `<th>${p} px</th>`).join('')}</tr>
${row('Flor — ANTES', [oldBud], 1)}
${row('Flor — DESPUÉS v2 (rellena · contorno)', [budFilled, budOutline], 1)}
${row('Flor 24 px simplificada — DESPUÉS v2 (rellena · contorno)', [budSmall, budSmallOutline], 1)}
${row('Hoja — ANTES (icono de zona · logo)', [oldLeaf, oldLogo], 1)}
${row('Hoja — DESPUÉS (7 · 5 foliolos)', [leaf(7, 'currentColor', 2.2), leaf(5, 'currentColor', 2.4)], 1)}
</table></section>`;
W('comparison.html', `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Icono de flor y hoja: antes y después</title>
<style>body{margin:0;font:14px system-ui,sans-serif} section{padding:16px 20px} .dark{background:#04140F;color:#2AEBA0} .light{background:#F4F6F3;color:#1F6B4A}
h2{margin:0 0 8px;font-size:16px;color:inherit} table{border-collapse:collapse} th{font-weight:600;text-align:left;padding:6px 14px 6px 0;font-size:13px;color:inherit;opacity:.85;max-width:210px}
td{padding:6px 18px;vertical-align:bottom} td svg{margin-right:6px;vertical-align:bottom}</style></head>
<body>${panel('dark')}${panel('light')}</body></html>`);
console.log('ok');
