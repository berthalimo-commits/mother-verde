// Copies src/purposeTexts.js into public/main.js, between the
// @purpose-texts-start / @purpose-texts-end markers, as
// `translations.<lang>.<key> = "...";` lines (the purpose-texts test checks
// both stay identical), and the SUNY sentence into the support-claims e-mails.
// Usage: node tools/apply-purpose-texts.mjs
import fs from 'fs';
import path from 'path';
import { PURPOSE_TEXTS, SUNY_ACCEPTED } from '../src/purposeTexts.js';
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

// The SUNY sentence also goes into the e-mails of the support-claims function
// (between @suny-accepted-start / -end). After this, redeploy that function.
const fn = path.join(ROOT, 'supabase/functions/support-claims/index.ts');
const f = fs.readFileSync(fn, 'utf8').split('\n');
const fa = f.findIndex((l) => l.includes('@suny-accepted-start')), fb = f.findIndex((l) => l.includes('@suny-accepted-end'));
if (fa < 0 || fb < fa) throw new Error('faltan los marcadores @suny-accepted en support-claims/index.ts');
const block = ['const SUNY_ACCEPTED = {', ...['es', 'en', 'de', 'fr'].map((l) => `  ${l}: ${JSON.stringify(SUNY_ACCEPTED[l])},`), '};'];
const before = f.slice(fa + 1, fb).join('\n');
f.splice(fa + 1, fb - fa - 1, ...block);
fs.writeFileSync(fn, f.join('\n'));
console.log(before === block.join('\n') ? 'support-claims: la frase de SUNY ya estaba igual' : 'support-claims: frase de SUNY actualizada -> vuelve a desplegar la función');
