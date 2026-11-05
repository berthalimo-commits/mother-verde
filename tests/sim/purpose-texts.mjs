// New purpose of the contributions (Bertha, 2026-11-03): texts in 4 languages,
// identical in src/purposeTexts.js and public/main.js; no Canna Wasi left in
// anything served or sent; forbidden words only in «No es una donación»; the
// program name never translated; «not affiliated» said in every language.
// Usage: node tests/sim/purpose-texts.mjs
import fs from 'fs';
import path from 'path';
let pass = 0, fail = 0; const failures = [];
const check = (n, c, d = '') => { if (c) { pass++; console.log('  ok   ', n); } else { fail++; failures.push(n); console.log('  FALLA', n, d); } };
const APP = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const read = (p) => fs.readFileSync(path.join(APP, p), 'utf8');
const { PURPOSE_TEXTS: T } = await import('file:///' + path.join(APP, 'src/purposeTexts.js'));
const L = ['es', 'en', 'de', 'fr'];
const main = read('public/main.js');

const inMain = {};
for (const m of main.matchAll(/^translations\.(es|en|de|fr)\.([A-Za-z0-9_]+) = (".*");$/gm)) (inMain[m[2]] ||= {})[m[1]] = JSON.parse(m[3]);
const missing = [];
for (const [k, v] of Object.entries(T)) for (const l of L) { if (!v[l]) missing.push(`${k}.${l} vacío`); else if (inMain[k]?.[l] !== v[l]) missing.push(`${k}.${l}`); }
check(`los ${Object.keys(T).length} textos nuevos están en los 4 idiomas e idénticos en la app`, missing.length === 0, missing.slice(0, 8).join(', '));

// no Canna Wasi in anything served or sent
const served = ['index.html', 'panel-mv.html', 'public/main.js', ...fs.readdirSync(path.join(APP, 'src')).filter((f) => f.endsWith('.js')).map((f) => 'src/' + f),
  ...fs.readdirSync(path.join(APP, 'supabase/functions')).filter((d) => fs.existsSync(path.join(APP, 'supabase/functions', d, 'index.ts'))).map((d) => `supabase/functions/${d}/index.ts`),
  ...fs.readdirSync(path.join(APP, 'supabase/email-templates')).filter((f) => f.endsWith('.html')).map((f) => 'supabase/email-templates/' + f)];
const wasi = served.filter((f) => /canna ?wasi|urubamba|hermano C[ée]sar|brother C[ée]sar/i.test(read(f)));
check(`ningún texto de la web, el panel, las funciones ni las plantillas nombra Canna Wasi (${served.length} archivos)`, wasi.length === 0, wasi.join(', '));

// forbidden words: only in «No es una donación» (dsProp3), approved by Bertha
const FORBID = /donaci[oó]n|donation|\bSpende\b|\bdon\b|caridad|charity|Wohltätigkeit|charité|sin fines de lucro|non-?profit|gemeinnützig|sans but lucratif|deducible|deductible|absetzbar|déductible/i;
const bad = Object.entries(T).filter(([k]) => k !== 'dsProp3').flatMap(([k, v]) => L.filter((l) => FORBID.test(v[l])).map((l) => `${k}.${l}`));
const fnSrc = read('supabase/functions/support-claims/index.ts');
const mailBad = ['receivedEmail', 'manualEmail', 'activationEmail'].filter((fn) => { const i = fnSrc.indexOf('function ' + fn); return FORBID.test(fnSrc.slice(i, fnSrc.indexOf('\n}\n', i))); });
check('sin «donación», «caridad», «sin fines de lucro» ni deducción de impuestos (salvo «No es una donación»)', bad.length === 0 && mailBad.length === 0, bad.concat(mailBad).join(', '));
check('«No es una donación ni es deducible de impuestos» está tal cual en los 4 idiomas', /No es una donación ni es deducible de impuestos/.test(T.dsProp3.es) && /not a donation and is not tax-deductible/.test(T.dsProp3.en) && /keine Spende und nicht steuerlich absetzbar/.test(T.dsProp3.de) && /pas un don et elle n’est pas déductible/.test(T.dsProp3.fr));

// the SUNY sentence (provisional, ONE place: SUNY_ACCEPTED) in the story, the
// contribution screen, the short notice and the e-mails; no degree or title;
// «no afiliado NI respaldado» in every language
const { SUNY_ACCEPTED: SA, SUPPORT_HELPS: SH } = await import('file:///' + path.join(APP, 'src/purposeTexts.js'));
check('frase de SUNY (provisional) idéntica en historia 4, pantalla de aporte y aviso corto, en los 4 idiomas', L.every((l) => T.story4P[l].includes(SA[l]) && T.dsProp1[l].includes(SA[l]) && T.dsAvisoCorto[l].includes(SA[l])), JSON.stringify(SA));
const fnBlock = fnSrc.slice(fnSrc.indexOf('@suny-accepted-start'), fnSrc.indexOf('@suny-accepted-end'));
// the e-mails use the copied sentences: «aviso recibido» directly, «acceso
// activo» and «aporte manual confirmado» through THANKS (= SUPPORT_HELPS + SUNY)
const bodyOf = (fn) => { const i = fnSrc.indexOf(fn); return fnSrc.slice(i, fnSrc.indexOf('\n}', i)); };
const thanks = bodyOf('const THANKS = {');
const uses = (body, l) => body.includes('${SUPPORT_HELPS.' + l + '} ${SUNY_ACCEPTED.' + l + '}') || body.includes('${THANKS.' + l + '}');
const mailUses = L.every((l) => uses(thanks, l) && thanks.includes('${SUPPORT_HELPS.' + l + '} ${SUNY_ACCEPTED.' + l + '}'))
  && ['function receivedEmail', 'function manualEmail', 'function activationEmail'].every((fn) => L.every((l) => uses(bodyOf(fn), l)));
check('…y en los 3 correos («aviso recibido», «acceso activo», «aporte manual confirmado»): las mismas frases que el recuadro (SUPPORT_HELPS + SUNY_ACCEPTED), copiadas por la herramienta (no editadas a mano)', L.every((l) => fnBlock.includes(JSON.stringify(SA[l])) && fnBlock.includes(JSON.stringify(SH[l])) && T.dsProp1[l].includes(SH[l] + ' ' + SA[l])) && mailUses);
check('la frase es la de Bertha, sin «horticultura»', SA.es === 'SUNY Morrisville me aceptó para continuar mi educación.' && SA.en === 'SUNY Morrisville accepted me to continue my education.' && SA.de === 'Die SUNY Morrisville hat mich aufgenommen, damit ich meine Ausbildung fortsetzen kann.' && /^SUNY Morrisville m[’']a acceptée pour poursuivre mes études\.$/.test(SA.fr) && !L.some((l) => /horticul|Gartenbau/i.test(SA[l])));
const indep = { es: /no está afiliado ni respaldado por SUNY Morrisville|no afiliado ni respaldado por SUNY Morrisville/i, en: /not affiliated with or endorsed by SUNY Morrisville/, de: /nicht mit der SUNY Morrisville verbunden und (wird )?nicht von ihr unterstützt/, fr: /ni affilié ni approuvé par SUNY Morrisville|non affilié ni approuvé par SUNY Morrisville/ };
check('«no afiliado ni respaldado por SUNY Morrisville» en la historia, el aviso corto y la pantalla de aporte, en los 4 idiomas', L.every((l) => indep[l].test(T.storyIndependent[l]) && indep[l].test(T.dsAvisoCorto[l]) && indep[l].test(T.dsProp5[l])), L.map((l) => [l, indep[l].test(T.storyIndependent[l]), indep[l].test(T.dsAvisoCorto[l]), indep[l].test(T.dsProp5[l])]).join(' '));
check('«aporte único de apoyo» con el término de cada idioma', /aporte único de apoyo/.test(T.dsProp1.es) && /one-time support contribution/.test(T.dsProp1.en) && /einmaliger Unterstützungsbeitrag/.test(T.dsProp1.de) && /contribution unique de soutien/.test(T.dsProp1.fr));
// «Antes de aportar»: ONE voice (Bertha, first person, to the reader as tú)
const BOX = ['dsProp1', 'dsProp2', 'dsProp3', 'dsProp4', 'dsProp5', 'dsProp6', 'dsPropWallet'];
const THIRD = { es: /ayuda a Bertha|En sus palabras|su educación|sus estudios|de Bertha Limo|recibes acceso|un proyecto independiente, no/i, en: /helps Bertha|In her words|her education|her studies|of Bertha Limo|you receive full access/i, de: /hilft Bertha|In ihren Worten|ihre Ausbildung|von Bertha Limo|erhältst du vollen/i, fr: /aide Bertha|Selon ses mots|ses études|de Bertha Limo|tu reçois un accès/i };
const FIRST = { es: /\b(me|mi|mis|te doy|te explico|soy)\b/i, en: /\b(I|me|my)\b/, de: /\b(ich|mir|mein|meine|meiner|Ich)\b/, fr: /\b(je|Je|m’|mon|ma)\b|m’/ };
const voiceBad = L.flatMap((l) => BOX.filter((k) => k !== 'dsProp3' && (THIRD[l].test(T[k][l]) || !FIRST[l].test(T[k][l]))).map((k) => `${k}.${l}`).concat(BOX.filter((k) => THIRD[l].test(T[k][l])).map((k) => `${k}.${l}(3.ª)`)));
check('recuadro «Antes de aportar»: una sola voz (primera persona de Bertha) en los 6 puntos y la billetera, 4 idiomas; el punto 3 neutro', voiceBad.length === 0, voiceBad.join(', '));
check('recuadro: «Soy Bertha Limo, fundadora…», punto 3 «Es un aporte voluntario y único. No es una donación…» y billetera «Tu aporte llega a mi billetera personal de cripto, en la red Base.»', T.dsProp1.es.startsWith('Soy Bertha Limo, fundadora de Mother Verde.') && T.dsProp3.es === 'Es un aporte voluntario y único. No es una donación ni es deducible de impuestos.' && T.dsPropWallet.es === 'Tu aporte llega a mi billetera personal de cripto, en la red Base.' && L.every((l) => !/horticult|Gartenbauerin|specialist|especialista|spécialiste|Spezialistin/i.test(T.dsPropWallet[l] + T.dsProp1[l])));
check('fotos de campo (pantallas 3 y 6) sin la palabra «cannabis» en su texto alternativo', ['storyAlt3', 'storyAlt6'].every((k) => L.every((l) => !/cannabis/i.test(T[k][l]))));
const HEMP = { es: /cáñamo/, en: /hemp/, de: /Hanf/, fr: /chanvre/ };
check('fotos de campo 02 y 03 (pantallas 3 y 6): «cáñamo» / «hemp» / «Hanf» / «chanvre» en los 4 idiomas; las de carpa (05, 07, 01: pantallas 1, 2, 5) sin esas palabras; la 4 (graduación) nombra SUNY Morrisville', ['storyAlt3', 'storyAlt6'].every((k) => L.every((l) => HEMP[l].test(T[k][l]))) && L.every((l) => /SUNY Morrisville/.test(T.storyAlt4[l])) && ['storyAlt1', 'storyAlt2', 'storyAlt5'].every((k) => L.every((l) => !/cáñamo|hemp|Hanf|chanvre/i.test(T[k][l]))));
check('la lista de calculadoras dice «17»', L.every((l) => /17/.test(T.story5Calc[l])));

// Terms keep the lawyer/accountant marker; Privacy has the acceptance sentence
// Terms clause 5: final text approved by Bertha's lawyer (2026-11-05), no marker left
check('Términos: la cláusula de aportes tiene el texto final aprobado (sin marcador de pendiente), 4 idiomas', /tc5P:'El aporte único de apoyo ayuda a Bertha Limo, fundadora de Mother Verde, a continuar su educación en SUNY Morrisville/.test(main) && /tc5P:'The one-time support contribution helps Bertha Limo/.test(main) && /tc5P:'Der einmalige Unterstützungsbeitrag hilft Bertha Limo/.test(main) && /tc5P:'La contribution unique de soutien aide Bertha Limo/.test(main) && !/tc5P:'\[(PENDIENTE|PENDING|AUSSTEHEND|EN ATTENTE)/.test(main));
check('Privacidad: la frase de la casilla en los 4 idiomas', L.every((l) => new RegExp(`translations\\.${l}\\.pv4P = "[^\\n]*${T.pvPurposeAdd[l].slice(0, 30).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(main)));
check('SUNY Morrisville en «dónde estudiar»: «La fundadora estudia en esta institución»', /data-i18n="eduSunyFundadora"/.test(read('index.html')) && L.every((l) => !!T.eduSunyFundadora[l]));
console.log(`\nRESULTADO: ${pass} ok, ${fail} fallas${fail ? ' -> ' + failures.join(' | ') : ''}`);
process.exit(0);
