// PROPOSED poses of the platform's scientist (the one that flies across the
// app, createMiniScientist in public/main.js). Same 64x64 vector drawing —
// body, head, goggles — reused exactly; each pose only changes the face and
// adds thin green arms / small props (approved style: fine green stroke).
// Run: node design/scientist/build-poses.mjs
//   -> design/scientist/poses/*.svg (with the app's CSS colours)
//   -> design/scientist/poses-sheet.png (contact sheet for the owner)
// The drawings live in src/game/poses.js (approved 2026-10-20, used by the game).
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(new URL('../../package.json', import.meta.url));
const sharp = require('sharp');
const DIR = new URL('./', import.meta.url);
fs.mkdirSync(new URL('poses/', DIR), { recursive: true });

import { POSES } from '../../src/game/poses.js';

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
  + `<text x="${PAD}" y="38" font-family="Arial, sans-serif" font-size="22" fill="#F0F7F3">Científico de Mother Verde — 6 poses (aprobadas, en el juego)</text>`;
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
