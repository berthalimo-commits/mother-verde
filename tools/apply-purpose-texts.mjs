// Copies src/purposeTexts.js into public/main.js, between the
// @purpose-texts-start / @purpose-texts-end markers, as
// `translations.<lang>.<key> = "...";` lines (the purpose-texts test checks
// both stay identical). Usage: node tools/apply-purpose-texts.mjs
import fs from 'fs';
import path from 'path';
import { PURPOSE_TEXTS } from '../src/purposeTexts.js';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const file = path.join(ROOT, 'public/main.js');
const m = fs.readFileSync(file, 'utf8').split('\n');
const a = m.findIndex((l) => l.includes('@purpose-texts-start')), b = m.findIndex((l) => l.includes('@purpose-texts-end'));
if (a < 0 || b < a) throw new Error('faltan los marcadores @purpose-texts en public/main.js');
const lines = [];
for (const [k, v] of Object.entries(PURPOSE_TEXTS)) for (const l of ['es', 'en', 'de', 'fr']) lines.push(`translations.${l}.${k} = ${JSON.stringify(v[l])};`);
m.splice(a + 1, b - a - 1, ...lines);
fs.writeFileSync(file, m.join('\n'));
console.log(`${lines.length} líneas copiadas a public/main.js`);
