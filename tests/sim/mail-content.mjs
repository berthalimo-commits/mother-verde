// Checks the 13 Supabase Auth e-mail templates (supabase/email-templates):
// 4 languages in order, no images, no link shorteners, few links, light
// colours declared, short subjects without capitals-only words, "!" or spam
// words, and that each one fits a 360 px phone without sideways scrolling
// (light and dark preference). No server needed (headless Chrome only).
import fs from 'fs';
import { check, sleep, browser, summary, OUT } from './browser.mjs';

const DIR = new URL('../../supabase/email-templates/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.html')).sort();
const md = fs.readFileSync(DIR + 'SUBJECTS.md', 'utf8');
const subjects = Object.fromEntries([...md.matchAll(/^\| `([a-z-]+\.html)` \| [^|]+ \| ([^|]+) \|/gm)].map((m) => [m[1], m[2].trim()]));
const SPAM = /\b(gratis|free|urgente?|urgent|gana[rs]?|win(ner)?|oferta|offer|dinero|money|premio|prize|100 ?%|haz clic aquí|click here|act now|garantizado|guaranteed)\b|\$/i;
const SHORTENERS = /(bit\.ly|tinyurl|t\.co\/|goo\.gl|ow\.ly|is\.gd|buff\.ly|cutt\.ly|rebrand\.ly)/i;

check('13 plantillas y 13 asuntos', files.length === 13 && Object.keys(subjects).length === 13, files.join(','));
for (const f of files) {
  const h = fs.readFileSync(DIR + f, 'utf8');
  const langs = [...h.matchAll(/<td lang="(es|en|de|fr)"/g)].map((m) => m[1]).join(',');
  const links = (h.match(/<a\s/gi) || []).length;
  const text = h.replace(/<!--[\s\S]*?-->/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\{\{[^}]+\}\}/g, '').replace(/\s+/g, ' ').trim();
  const s = subjects[f] || '';
  const problems = [];
  if (langs !== 'es,en,de,fr') problems.push('idiomas ' + langs);
  if (/<img|background-image|url\(/i.test(h)) problems.push('imagen');
  if (SHORTENERS.test(h)) problems.push('acortador');
  if (/https?:\/\//i.test(h.replace(/<!--[\s\S]*?-->/g, ''))) problems.push('enlace fijo (debe ser una variable de Supabase)');
  if (links > 5) problems.push(links + ' enlaces');
  if (links && text.length / links < 150) problems.push('poco texto por enlace ' + Math.round(text.length / links));
  if (!/name="color-scheme" content="light"/.test(h)) problems.push('sin color-scheme');
  if (!/max-width:600px/.test(h) || !/name="viewport"/.test(h)) problems.push('sin diseño para móvil');
  if (s.length > 70) problems.push('asunto largo ' + s.length);
  if (/!/.test(s) || /\b[A-ZÁÉÍÓÚÑÄÖÜ]{3,}\b/.test(s)) problems.push('asunto con ! o MAYÚSCULAS');
  if (SPAM.test(s) || SPAM.test(text)) problems.push('palabra de spam: ' + ((s + ' ' + text).match(SPAM) || [])[0]);
  check(`${f}: ${s}`, problems.length === 0, problems.join('; '));
}

// Phone width, light and dark preference: nothing wider than the screen.
const b = await browser(null, null, 360);
for (const scheme of ['light', 'dark']) {
  await b.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] });
  const wide = [];
  for (const f of files) {
    await b.send('Page.navigate', { url: 'file:///' + DIR.replace(/\\/g, '/') + f }); await sleep(250);
    const r = await b.ev(`({ w: document.documentElement.scrollWidth, vw: innerWidth, bg: getComputedStyle(document.querySelector('table table')).backgroundColor })`);
    if (r.w > r.vw || r.bg !== 'rgb(255, 255, 255)') wide.push(`${f} ${r.w}/${r.vw} ${r.bg}`);
    if (f === 'confirm-signup.html') await b.shot(`mail-confirm-signup-360-${scheme}`);
  }
  check(`360 px, preferencia ${scheme}: ninguna se sale de la pantalla y el fondo sigue claro`, wide.length === 0, wide.join(' | '));
}
await b.close();
summary();
process.exit(0);
