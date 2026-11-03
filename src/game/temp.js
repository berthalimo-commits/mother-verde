// Zona del juego — every temperature is shown in Celsius and Fahrenheit at
// once, «28 °C (82 °F)» (Bertha's rule, 2026-11-03). Texts are written in °C
// only; this adds the °F, computed here (never typed by hand), rounded to
// whole numbers. Micrometres (µm) and every other unit are left alone.

const MINUS = '−';
const num = (x) => Number(String(x).replace(MINUS, '-').replace(',', '.'));
const show = (n) => (n < 0 ? MINUS + Math.abs(n) : String(n));

export const toF = (c) => Math.round((num(c) * 9) / 5 + 32);

// «24–28 °C» → «24–28 °C (75–82 °F)»; «19 y 30 °C» → «19 y 30 °C (66 y 86 °F)»;
// «−20 °C» → «−20 °C (−4 °F)». Already converted text is left as it is.
const N = `[${MINUS}-]?\\d+(?:[.,]\\d+)?`;
const WORDS = 'y|a|and|to|und|bis|et|à';
const RE = new RegExp(`(${N})(?:(–|\\s(?:${WORDS})\\s)(${N}))?\\s?°C(?!\\s\\(${N}(?:–|\\s(?:${WORDS})\\s)?(?:${N})?\\s°F\\))`, 'g');

export function withFahrenheit(text) {
  if (typeof text !== 'string' || !text.includes('°C')) return text;
  return text.replace(RE, (m, a, sep, b) => (b === undefined
    ? `${a} °C (${show(toF(a))} °F)`
    : `${a}${sep}${b} °C (${show(toF(a))}${sep}${show(toF(b))} °F)`));
}

// The same over a whole text pack { es: {...}, en: {...}, ... }.
export function packWithFahrenheit(pack) {
  for (const L of Object.keys(pack)) for (const k of Object.keys(pack[L])) pack[L][k] = withFahrenheit(pack[L][k]);
  return pack;
}

// For the test: a temperature shown in one scale only (°C without its °F
// right after, °F alone, or a number range missing its °C).
export function singleScale(text) {
  if (typeof text !== 'string') return [];
  const bad = [];
  const okC = new RegExp(`${N}(?:–|\\s(?:${WORDS})\\s)?(?:${N})?\\s°C\\s\\(${N}(?:–|\\s(?:${WORDS})\\s)?(?:${N})?\\s°F\\)`, 'g');
  const rest = text.replace(okC, '');
  const m = rest.match(new RegExp(`.{0,25}(?:°C|°F|℃|℉|\\bgrados\\b|\\bdegrees?\\b|\\bGrad\\b|\\bdegrés?\\b).{0,10}`, 'g'));
  if (m) bad.push(...m);
  return bad;
}
