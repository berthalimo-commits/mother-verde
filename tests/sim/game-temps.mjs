// Zona del juego — every temperature in °C and °F at once (Bertha's rule,
// 2026-11-03): «28 °C (82 °F)», the °F computed by src/game/temp.js, whole
// numbers, the same format everywhere. Fails if any text of the game (4
// languages, lab included) shows a temperature in one scale only.
// Usage: node tests/sim/game-temps.mjs
const APP = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1').replace(/\/$/, '');
const T = await import('file:///' + APP + '/src/game/temp.js');
const TEXTS = (await import('file:///' + APP + '/src/game/i18n.js')).default;
const LAB = (await import('file:///' + APP + '/src/game/i18n-lab.js')).default;
let pass = 0, fail = 0; const failures = [];
const check = (n, c, d = '') => { if (c) { pass++; console.log('  ok   ', n); } else { fail++; failures.push(n); console.log('  FALLA', n, d); } };

console.log('1. La conversión (una función del código, enteros)');
check('0 °C = 32 °F, 100 °C = 212 °F, −20 °C = −4 °F, 28 °C = 82 °F, 24 °C = 75 °F (redondeado)',
  T.toF(0) === 32 && T.toF(100) === 212 && T.toF('−20') === -4 && T.toF(28) === 82 && T.toF(24) === 75);
check('un valor, un rango con guion y un rango con palabras salen con el mismo formato',
  T.withFahrenheit('a 28 °C') === 'a 28 °C (82 °F)' && T.withFahrenheit('24–30 °C de día') === '24–30 °C (75–86 °F) de día'
  && T.withFahrenheit('entre 19 y 30 °C.') === 'entre 19 y 30 °C (66 y 86 °F).' && T.withFahrenheit('below −20 °C') === 'below −20 °C (−4 °F)');
check('un texto ya convertido no se convierte dos veces', T.withFahrenheit(T.withFahrenheit('15–21 °C')) === '15–21 °C (59–70 °F)');
check('las micras y los demás números no cambian', T.withFahrenheit('malla de 25 µm, 90 µm, 120 s, 50 %') === 'malla de 25 µm, 90 µm, 120 s, 50 %');

console.log('2. Control del propio test (un error puesto a propósito se detecta)');
check('«28 °C» solo, «82 °F» solo y «28 grados» se detectan; «28 °C (82 °F)» no',
  T.singleScale('a 28 °C de día').length > 0 && T.singleScale('82 °F').length > 0 && T.singleScale('28 grados').length > 0
  && T.singleScale('a 28 °C (82 °F) de día').length === 0 && T.singleScale('entre 19 y 30 °C (66 y 86 °F)').length === 0);

console.log('3. Todos los textos del juego, en los 4 idiomas');
const all = [];
for (const [pack, name] of [[TEXTS, 'juego'], [LAB, 'laboratorio']]) for (const L of ['es', 'en', 'de', 'fr']) for (const [k, v] of Object.entries(pack[L] || {})) if (typeof v === 'string') all.push([name, L, k, v]);
const bad = all.flatMap(([n, L, k, v]) => T.singleScale(v).map((x) => `${n} ${L} ${k}: «${x}»`));
check(`ninguna temperatura con una sola escala (${all.length} textos revisados)`, bad.length === 0, bad.slice(0, 8).join(' | '));
const withC = all.filter(([, , , v]) => v.includes('°C'));
check('cada idioma muestra las mismas temperaturas (mismos textos con °C en es, en, de, fr)',
  ['en', 'de', 'fr'].every((L) => withC.filter((x) => x[1] === L).map((x) => x[2]).sort().join() === withC.filter((x) => x[1] === 'es').map((x) => x[2]).sort().join()));
// every °F shown is the computed one for the °C next to it
const N = '[−-]?\\d+';
const pair = new RegExp(`(${N})(?:(?:–|\\s\\S+\\s)(${N}))?\\s°C\\s\\((${N})(?:(?:–|\\s\\S+\\s)(${N}))?\\s°F\\)`, 'g');
const wrong = [];
for (const [, L, k, v] of withC) for (const m of v.matchAll(pair)) {
  if (T.toF(m[1]) !== Number(m[3].replace('−', '-')) || (m[2] !== undefined && T.toF(m[2]) !== Number(m[4].replace('−', '-')))) wrong.push(`${L} ${k}: ${m[0]}`);
}
check('cada °F es el calculado por la función para su °C', withC.length > 30 && wrong.length === 0, wrong.slice(0, 5).join(' | '));
check('sin paréntesis dentro de paréntesis («°F))»)', !all.some(([, , , v]) => /°F\)\)/.test(v)));
check('las temperaturas de la carpa, del secado, del rosin, del almacenamiento y de la germinación llevan °F',
  ['jgH_temperatura_templada', 'jgH_temperatura_templada_fl', 'jgPH_secado_temperatura_fresca', 'jgPH_rosin_calor_medio', 'jgWhy_curado_g_temp', 'jgGermH_temperatura_templada', 'jgPH_material_agua_temp_helada']
    .every((k) => ['es', 'en', 'de', 'fr'].every((L) => /°C \([^)]*°F\)/.test(TEXTS[L][k]))));

console.log(`\nRESULTADO: ${pass} ok, ${fail} fallas${fail ? ' -> ' + failures.join(' | ') : ''}`);
process.exit(0);
