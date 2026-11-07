// No degree or title is named (Bertha, 2026-11-04): fails if «bachillerato»,
// «bachelor» or «B.Tech» appears in any visible text — the page (index.html),
// the translations (public/main.js), the purpose texts, the game texts, the
// e-mail templates and the e-mails of the Edge Functions. Code comments are
// not visible and are skipped. Whole words only («f2b.tech», a blocked e-mail
// domain, is not a match).
// ONE allowed exception, on purpose: eduCsuP describes ANOTHER university's
// program («Bachelor of Science (BS) in Cannabis Biology and Chemistry»,
// Colorado State University-Pueblo) — a fact about that school, not about
// Bertha. Also checks: the SUNY lesson ends at the certificate (no A.A.S.,
// no stacking), and «no afiliado ni respaldado por SUNY Morrisville» is kept.
// Usage: node tests/sim/no-degree-text.mjs
import fs from 'fs';
import path from 'path';
let pass = 0, fail = 0; const failures = [];
const check = (n, c, d = '') => { if (c) { pass++; console.log('  ok   ', n); } else { fail++; failures.push(n); console.log('  FALLA', n, d); } };
const APP = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const read = (p) => fs.readFileSync(path.join(APP, p), 'utf8');
const DEGREE = /\bbachiller(ato|atos)?\b|\bbachelor|\bB\.?\s?Tech\b/i;
const ALLOWED = (line) => /\beduCsuP\b/.test(line);
const noComments = (src) => src.split('\n').map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? '' : l)).join('\n');
const noHtmlComments = (src) => src.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ''));

const files = [
  ['index.html', noHtmlComments(read('index.html'))],
  ['public/main.js', noComments(read('public/main.js'))],
  ['src/game/i18n.js', noComments(read('src/game/i18n.js'))],
  ...fs.readdirSync(path.join(APP, 'supabase/functions')).filter((d) => fs.existsSync(path.join(APP, 'supabase/functions', d, 'index.ts')))
    .map((d) => [`supabase/functions/${d}/index.ts`, noComments(read(`supabase/functions/${d}/index.ts`))]),
  ...fs.readdirSync(path.join(APP, 'supabase/email-templates')).map((f) => [`supabase/email-templates/${f}`, noHtmlComments(read(`supabase/email-templates/${f}`))]),
];
const { PURPOSE_TEXTS: T, SUNY_ACCEPTED: SA } = await import('file:///' + path.join(APP, 'src/purposeTexts.js'));
files.push(['src/purposeTexts.js (textos)', Object.entries(T).flatMap(([k, v]) => Object.values(v).map((x) => `${k}: ${x}`)).concat(Object.values(SA)).join('\n')]);

const hits = [];
for (const [name, src] of files) src.split('\n').forEach((l, i) => { if (DEGREE.test(l) && !ALLOWED(l)) hits.push(`${name}:${i + 1}: …${l.match(new RegExp('.{0,50}(' + DEGREE.source + ').{0,30}', 'i'))?.[0]}…`); });
check(`ningún «bachillerato», «bachelor» ni «B.Tech» en los textos visibles (${files.length} archivos)`, hits.length === 0, '\n      ' + hits.slice(0, 8).join('\n      '));
const allowed = files.flatMap(([, src]) => src.split('\n').filter((l) => DEGREE.test(l) && ALLOWED(l)));
check('única excepción: eduCsuP (programa de OTRA universidad, Colorado State University-Pueblo), nada sobre Bertha', allowed.length > 0 && allowed.every((l) => /Cannabis Biology and Chemistry/.test(l) && !/Bertha|SUNY/.test(l)), allowed.length + ' líneas');
check('el detector reconoce las palabras prohibidas y no salta con el dominio «f2b.tech»', ['mi bachillerato', "a bachelor's degree", 'ihren Bachelor', 'B.Tech.', 'B Tech'].every((s) => DEGREE.test(s)) && !DEGREE.test("('f2b.tech'),"));

const html = read('index.html'), main = read('public/main.js');
const suny = [html.match(/data-i18n="eduSunyP">([^<]*)/)?.[1] || '', ...[...main.matchAll(/eduSunyP:'([^']*)'/g)].map((m) => m[1])];
check('lección de SUNY: termina en el certificado, sin A.A.S. ni «apilarlo», en la página y en los 4 idiomas', suny.length === 5 && suny.every((s) => /Cannabis Production( certificate)?\. /.test(s) && !/A\.A\.S|apilar|stackable|anrechenbar|cumulable/.test(s)), JSON.stringify(suny.map((s) => s.slice(0, 90))));
const indep = { es: /no (está )?afiliado ni respaldado por SUNY Morrisville/i, en: /not affiliated with or endorsed by SUNY Morrisville/i, de: /nicht mit der SUNY Morrisville verbunden/i, fr: /affilié ni approuvé par SUNY Morrisville/i };
check('se mantiene «Mother Verde no está afiliado ni respaldado por SUNY Morrisville» (historia y aporte, 4 idiomas)', Object.entries(indep).every(([l, re]) => re.test(T.storyIndependent[l]) && re.test(T.dsProp5[l]) && re.test(T.dsAvisoCorto[l])));
check('la frase provisional de SUNY está en UN solo lugar del código fuente (src/purposeTexts.js)', ['es', 'en', 'de', 'fr'].every((l) => read('src/purposeTexts.js').split(SA[l]).length === 2));
console.log(`\nRESULTADO: ${pass} ok, ${fail} fallas${fail ? ' -> ' + failures.join(' | ') : ''}`);
process.exit(0);
