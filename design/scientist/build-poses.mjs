// PROPOSED poses of the platform's scientist (the one that flies across the
// app, createMiniScientist in public/main.js). Same 64x64 vector drawing —
// body, head, goggles — reused exactly; each pose only changes the face and
// adds thin green arms / small props (approved style: fine green stroke).
// Run: node design/scientist/build-poses.mjs
//   -> design/scientist/poses/*.svg (with the app's CSS colours)
//   -> design/scientist/poses-sheet.png (contact sheet for the owner)
// NOTHING in the game uses these files until the owner approves the sheet.
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(new URL('../../package.json', import.meta.url));
const sharp = require('sharp');
const DIR = new URL('./', import.meta.url);
fs.mkdirSync(new URL('poses/', DIR), { recursive: true });

// ---------------------------------------------------------------- the original drawing (public/main.js)
const SMOKE = '<ellipse cx="10" cy="46" rx="7" ry="3" fill="var(--moss-deep)" opacity="0.35"/>'
  + '<ellipse cx="18" cy="40" rx="5" ry="2.4" fill="var(--moss-deep)" opacity="0.5"/>';
const BODY = '<path d="M26 24 Q34 20 40 30 Q42 40 34 48 Q26 52 20 46 Q16 36 26 24 Z" fill="var(--moss)" opacity="0.92"/>'
  + '<path d="M26 24 Q34 20 40 30 Q42 40 34 48" fill="none" stroke="var(--moss-deep)" stroke-width="1.2" opacity="0.6"/>';
const HEAD = '<circle cx="40" cy="24" r="9" fill="var(--paper-raised)" stroke="var(--line-strong)" stroke-width="1"/>';
const GOGGLES = '<circle cx="37" cy="23" r="2.6" fill="var(--teal)" opacity="0.9"/><circle cx="43" cy="23" r="2.6" fill="var(--teal)" opacity="0.9"/>';
const BROW = '<path d="M35 20 Q40 17 45 20" fill="none" stroke="var(--ink-soft)" stroke-width="1"/>';
const SMILE = '<path d="M32 30 Q40 34 48 28" fill="none" stroke="var(--ink)" stroke-width="2" stroke-linecap="round"/>';

// ---------------------------------------------------------------- new pieces (approved: fine green stroke)
const arm = (d) => `<path d="${d}" fill="none" stroke="var(--moss-deep)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`;
const hand = (x, y) => `<circle cx="${x}" cy="${y}" r="1.4" fill="var(--moss)"/>`;
const mouth = (d, w = 2) => `<path d="${d}" fill="none" stroke="var(--ink)" stroke-width="${w}" stroke-linecap="round"/>`;
const line = (d, c = 'var(--ink-soft)', w = 1) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;

const POSES = {
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
  pensando: { label: 'Pensando', parts: [SMOKE,
    BODY, arm('M24 35.5 Q30.5 38.5 35.6 33.6'), hand(36, 33.2),                                          // hand to the chin
    HEAD, GOGGLES, line('M35 19.4 Q37.5 18 40 19'), line('M41 18.4 L45 18.4'),                          // one brow up
    mouth('M36 31 L43.6 30.2'),
    '<circle cx="51" cy="13" r="1.3" fill="none" stroke="var(--ink-soft)" stroke-width="1"/>',          // thought bubbles
    '<circle cx="54.6" cy="9.2" r="2" fill="none" stroke="var(--ink-soft)" stroke-width="1"/>',
    '<circle cx="59" cy="4.6" r="2.8" fill="none" stroke="var(--ink-soft)" stroke-width="1"/>'] },
};
const svg = (parts, extra = '') => `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"${extra}><g>${parts.join('')}</g></svg>`;
for (const [id, p] of Object.entries(POSES)) fs.writeFileSync(new URL(`poses/${id}.svg`, DIR), svg(p.parts, ' aria-hidden="true"') + '\n');

// ---------------------------------------------------------------- contact sheet
// The app's colours (public/style.css :root). The platform is dark-only; a light
// row is added only to judge the drawing on another background.
const DARK = { '--moss': '#2AEBA0', '--moss-deep': '#16B884', '--paper-raised': '#101F1A', '--paper': '#07100D',
  '--line-strong': 'rgba(240,247,243,0.22)', '--teal': '#5FD4E0', '--ink-soft': '#9FB8AE', '--ink': '#F0F7F3', '--resin': '#E3A75F' };
const LIGHT = { ...DARK, '--paper-raised': '#FFFFFF', '--paper': '#F4F6F3', '--line-strong': 'rgba(31,42,36,0.35)', '--ink-soft': '#5E7268', '--ink': '#1F2A24' };
const paint = (s, pal) => s.replace(/var\((--[a-z-]+)\)/g, (_, v) => pal[v] ?? '#f0f');
const ids = Object.keys(POSES);
const CELL = 220, PAD = 20, LABEL = 34;
const rows = [['Oscuro (como la app) · 160 px', DARK, 160], ['Oscuro · 64 px (tamaño real en el juego)', DARK, 64], ['Claro (solo para comparar) · 160 px', LIGHT, 160]];
const W = PAD + ids.length * CELL, H = rows.length * (CELL + LABEL) + 70;
let body = `<rect width="${W}" height="${H}" fill="#0b1712"/>`
  + `<text x="${PAD}" y="38" font-family="Arial, sans-serif" font-size="22" fill="#F0F7F3">Científico de Mother Verde — 6 poses propuestas (sin aplicar en el juego)</text>`;
rows.forEach(([title, pal, size], r) => {
  const y0 = 70 + r * (CELL + LABEL);
  body += `<text x="${PAD}" y="${y0 + 18}" font-family="Arial, sans-serif" font-size="15" fill="#9FB8AE">${title}</text>`;
  ids.forEach((id, i) => {
    const x = PAD + i * CELL, y = y0 + 28;
    body += `<rect x="${x}" y="${y}" width="${CELL - PAD}" height="${CELL - 30}" rx="10" fill="${pal['--paper']}" stroke="#2a3b33"/>`;
    const off = (CELL - PAD - size) / 2;
    body += `<svg x="${x + off}" y="${y + (CELL - 30 - size) / 2 - 8}" width="${size}" height="${size}" viewBox="0 0 64 64">${paint(POSES[id].parts.join(''), pal)}</svg>`;
    body += `<text x="${x + (CELL - PAD) / 2}" y="${y + CELL - 42}" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="${pal === LIGHT ? '#1F2A24' : '#F0F7F3'}">${POSES[id].label}</text>`;
  });
});
const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`;
await sharp(Buffer.from(sheet)).png().toFile(new URL('poses-sheet.png', DIR).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
console.log('ok', ids.length, 'dibujos ->', W + 'x' + H);
