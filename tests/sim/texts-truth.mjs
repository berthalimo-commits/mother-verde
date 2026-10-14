// Texts that must match what the platform really does (audit N7 + N8):
// the Privacy screen and the Community intro, in ES / EN / DE / FR.
import fs from 'fs';
const APP = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1').replace(/\/$/, '');
let pass = 0, fail = 0; const failures = [];
const check = (n, c, d = '') => { if (c) { pass++; console.log('  ok   ', n); } else { fail++; failures.push(n); console.log('  FALLA', n, d); } };
const js = fs.readFileSync(APP + '/public/main.js', 'utf8');
const html = fs.readFileSync(APP + '/index.html', 'utf8');
// Evaluate the translations exactly as the browser would.
const translations = new Function(js.slice(0, js.indexOf('\nlet currentLang')).replace(/^[\s\S]*?(const translations = \{)/, '$1') + '\n' +
  [...js.matchAll(/^translations\.(es|en|de|fr)\.[A-Za-z0-9_]+ = .*;$/gm)].map((m) => m[0]).join('\n') + '\nreturn translations;')();
const L = ['es', 'en', 'de', 'fr'];
const priv = html.slice(html.indexOf('id="privacidad"'), html.indexOf('</section>', html.indexOf('id="privacidad"')));
const keys = [...priv.matchAll(/data-i18n="([A-Za-z0-9_]+)"/g)].map((m) => m[1]);

console.log('1. Pantalla de Privacidad');
check(`todas sus claves (${keys.length}) existen en los 4 idiomas`, keys.every((k) => L.every((l) => typeof translations[l][k] === 'string' && translations[l][k].length)), keys.filter((k) => L.some((l) => !translations[l][k])).join(','));
const all = (l) => keys.map((k) => translations[l][k]).join(' ');
check('ya no dice que los datos se guardan en el dispositivo ni «si en el futuro…»', !/localmente en tu|en el futuro almacenamos|stored locally|in the future we store|julio de 2026/i.test(L.map(all).join(' ')));
for (const l of L) {
  const t = all(l);
  check(`${l}: Supabase, Vercel, Hostinger, Resend, DeepL, red Base, Google Fonts y flagcdn`, ['Supabase', 'Vercel', 'Hostinger', 'Resend', 'DeepL', 'Base', 'Google Fonts', 'flagcdn'].every((w) => t.includes(w)));
  check(`${l}: TXID público y permanente en la cadena, nombre/teléfono opcionales, hello@`, /TXID/.test(t) && /hello@motherverdeny\.com/.test(t) && /(públicas y permanentes|public and permanent|öffentlich und dauerhaft|publics et permanents)/.test(t));
  check(`${l}: lo que depende de la ley queda marcado como pendiente de revisión`, (t.match(/\[(PENDIENTE|PENDING|AUSSTEHEND|EN ATTENTE)/g) || []).length >= 6);
}
check('no promete lo que no existe (cookies de analítica, exportar datos)', !/Google Analytics|exportar tus datos|export your data/i.test(L.map(all).join(' ')));

console.log('2. Comunidad');
for (const l of L) {
  const t = ['cmyEyebrow', 'cmyTitle', 'cmySub', 'cmyPrivacidadNote', 'cmyPreguntasNota'].map((k) => translations[l][k]).join(' ');
  check(`${l}: sin «próximamente», «backend», «plan de construcción», «verificados» ni «cualquier persona»`, !/próximamente|coming soon|demnächst|bientôt|backend|plan de construcción|build plan|Bauplan|plan de construction|verificados|verified|verifiziert|vérifiés|cualquier persona|anyone who uses|jede Person|n’importe qui/i.test(t), t.slice(0, 200));
  check(`${l}: dice que solo lo ven personas con acceso completo`, /(acceso completo|full access|Vollzugriff|accès complet)/.test(translations[l].cmySub) && /(acceso completo|full access|Vollzugriff|accès complet)/.test(translations[l].cmyPrivacidadNote));
}
check('la tarjeta de Inicio ya no pone «próximamente» junto a Comunidad', !/data-i18n="modComunidadTitle">Comunidad<\/span> <span[^>]*data-i18n="soon"/.test(html));
check('claves del modelo viejo eliminadas (cuentaPlanGratis, cmyEnDesarrollo)', !/cuentaPlanGratis|cmyEnDesarrollo/.test(js));

console.log(`\nRESULTADO: ${pass} ok, ${fail} fallas${fail ? ' -> ' + failures.join(' | ') : ''}`);
process.exit(0);
