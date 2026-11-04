// Builds the welcome-story photos from Bertha's originals.
//   node tools/historia-fotos.mjs            -> public/historia/
//   node tools/historia-fotos.mjs <outDir>   -> another folder (previews)
// Reads fotos-historia/ (never writes there), crops 4:5 as set in
// src/storyPhotos.js, max 1200 px wide, JPEG q86, NO metadata at all
// (sharp drops EXIF/XMP/IPTC/ICC unless asked to keep them), then re-reads
// every output and fails if any metadata block or GPS tag is left.
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { STORY_PHOTOS } from '../src/storyPhotos.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const SRC = path.join(ROOT, 'fotos-historia');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'public/historia'));
fs.mkdirSync(OUT, { recursive: true });

function box(W, H, { x, y, w }) {
  let cw = Math.round(W * w), ch = Math.round((cw * 5) / 4);
  if (ch > H) { ch = H; cw = Math.round((H * 4) / 5); }
  const left = x === undefined ? Math.round((W - cw) / 2) : Math.round(W * x);
  const top = y === undefined ? Math.round((H - ch) / 2) : Math.round(H * y);
  if (left < 0 || top < 0 || left + cw > W || top + ch > H) throw new Error(`recorte fuera de la foto: ${JSON.stringify({ W, H, left, top, cw, ch })}`);
  return { left, top, width: cw, height: ch };
}

// Gamma < 1 brightens the shadows: out = 255 * (in/255)^gamma.
async function brighten(img, gamma) {
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const lut = new Uint8Array(256).map((_, v) => Math.round(255 * Math.pow(v / 255, gamma)));
  for (let i = 0; i < data.length; i++) data[i] = lut[data[i]];
  return sharp(data, { raw: info });
}

export function leftovers(buf) {
  // JPEG marker scan: APP1 (EXIF/XMP), APP2 (ICC), APP13 (IPTC/Photoshop), COM.
  const found = [];
  let i = 2;
  for (; i < buf.length - 4;) {
    if (buf[i] !== 0xff) break;
    const m = buf[i + 1], len = buf.readUInt16BE(i + 2);
    if (m === 0xda) break; // start of image data
    if ([0xe1, 0xe2, 0xed, 0xfe].includes(m) || (m >= 0xe3 && m <= 0xef)) found.push('0x' + m.toString(16));
    i += 2 + len;
  }
  // text search only in the header (before the compressed image data, where
  // any 3 bytes can spell «GPS» by chance)
  const head = buf.subarray(0, i);
  if (head.includes('GPS') || head.includes('Exif') || head.includes('http://ns.adobe.com')) found.push('texto GPS/Exif/XMP');
  return found;
}

const report = [];
for (const [n, p] of Object.entries(STORY_PHOTOS)) {
  const file = path.join(SRC, p.source);
  const meta = await sharp(file).metadata();
  const b = box(meta.width, meta.height, p.crop);
  let img = sharp(file).rotate().extract(b);
  if (p.tune?.gamma) {
    img = await brighten(img, p.tune.gamma);
    img = img.normalise({ lower: 0.5, upper: 99.7 }); // soft auto-contrast, background not burnt
  }
  if (p.tune?.sharpen) img = img.sharpen({ sigma: 0.7, m1: 0.6, m2: 1.2 });
  img = img.resize({ width: Math.min(p.maxWidth || 1200, b.width), withoutEnlargement: true });
  const buf = await img.jpeg({ quality: 86, mozjpeg: true }).toBuffer();
  const left = leftovers(buf);
  if (left.length) throw new Error(`${p.file}: quedan metadatos ${left.join(', ')}`);
  fs.writeFileSync(path.join(OUT, p.file), buf);
  const m2 = await sharp(buf).metadata();
  report.push(`P${n} ${p.file}: ${m2.width}x${m2.height} (${(m2.width / m2.height).toFixed(3)}), ${Math.round(buf.length / 1024)} KB, recorte ${JSON.stringify(b)}, exif=${!!m2.exif} xmp=${!!m2.xmp} iptc=${!!m2.iptc} icc=${!!m2.icc} gps=no`);
}
console.log(report.join('\n'));
