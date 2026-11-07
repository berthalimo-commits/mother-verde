// Phase 9 — final polish audit. Every kind of game screen (equipment,
// germination, a week with a problem, flowering with males, a full tent,
// drying, the press, the final review, the safety lab) on a small phone
// (320 px) and a big screen (1920 px), checking:
// - contrast of every visible text against what is really behind it (WCAG AA:
//   4.5:1, or 3:1 for large text; disabled controls are exempt);
// - a name for the screen reader on every button, field and drawing;
// - the keyboard: Tab reaches every control in order and the focus is visible;
// - the page language follows the language switch;
// - no sideways overflow and no text cut off.
// The platform only has the dark theme (style.css), so that is the one checked.
// Problems found are listed (with the screen) for the report.
import { summary, check, sleep } from './browser.mjs';
import { RULES, E, NEUTRAL, session, width, lang, gameAt, harvestedGame, click, gs, issues, report, enter } from './game-full-lib.mjs';

// ---------------------------------------------------------------- the audits (run in the page)
const CONTRAST = `(() => {
  const root = document.getElementById('juego');
  const parse = (c) => { const m = c.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const over = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
  const bgOf = (el) => {
    const layers = [];
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage && cs.backgroundImage !== 'none' && !cs.backgroundImage.startsWith('url')) return null; // gradient: skip, can't measure
      const c = parse(cs.backgroundColor); if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; }
    }
    let base = { r: 7, g: 16, b: 13, a: 1 }; // --paper (#07100D) under everything
    for (const l of layers.reverse()) base = over(l, base);
    return base;
  };
  const bad = []; let n = 0;
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  while (walk.nextNode()) {
    const t = walk.currentNode; const el = t.parentElement;
    if (!t.textContent.trim() || seen.has(el) || el.closest('svg')) continue;
    seen.add(el);
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || !(el.offsetWidth || el.offsetHeight)) continue;
    if (el.closest('button:disabled, input:disabled + label, [aria-disabled="true"]')) continue;
    const fg = parse(cs.color); const bg = bgOf(el); if (!fg || !bg) continue;
    const c = over({ ...fg, a: fg.a * Number(cs.opacity || 1) }, bg);
    const L1 = lum(c), L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const size = parseFloat(cs.fontSize), boldish = Number(cs.fontWeight) >= 700;
    const need = size >= 24 || (boldish && size >= 18.66) ? 3 : 4.5;
    n++;
    if (ratio < need) bad.push(\`\${(el.id || el.className || el.tagName).toString().slice(0, 30)} «\${t.textContent.trim().slice(0, 30)}» \${ratio.toFixed(2)}:1 (necesita \${need})\`);
  }
  return { n, bad: [...new Set(bad)] };
})()`;
const NAMES = `(() => {
  const root = document.getElementById('juego');
  const vis = (e) => !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length) || (e.type === 'radio' && !!e.closest('fieldset')?.offsetWidth);
  const nameOf = (e) => (e.getAttribute('aria-label') || (e.getAttribute('aria-labelledby') || '').split(' ').map((id) => document.getElementById(id)?.textContent || '').join(' ')
    || (e.id && document.querySelector('label[for="' + e.id + '"]')?.textContent) || e.closest('label')?.textContent || e.textContent || e.title || '').trim();
  const bad = [];
  for (const e of root.querySelectorAll('button, input, select, textarea, a[href]')) if (vis(e) && e.type !== 'hidden' && !nameOf(e)) bad.push((e.id || e.name || e.className || e.tagName).toString().slice(0, 40));
  for (const s of root.querySelectorAll('svg')) if (s.getAttribute('aria-hidden') !== 'true' && !(s.getAttribute('role') === 'img' && (s.getAttribute('aria-label') || s.getAttribute('aria-labelledby')))) bad.push('svg sin nombre: ' + (s.className.baseVal || '').slice(0, 30));
  for (const f of root.querySelectorAll('fieldset')) if (vis(f) && !f.querySelector('legend')?.textContent.trim()) bad.push('fieldset sin legend');
  // headings in order (no jump of more than one level)
  const hs = [...root.querySelectorAll('h1,h2,h3,h4,h5')].filter(vis).map((h) => Number(h.tagName[1]));
  for (let i = 1; i < hs.length; i++) if (hs[i] > hs[i - 1] + 1) bad.push('salto de encabezado h' + hs[i - 1] + ' -> h' + hs[i]);
  return { bad, controls: root.querySelectorAll('button, input').length };
})()`;
const FOCUS = `(() => {
  const e = document.activeElement; if (!e || e === document.body) return { where: 'body' };
  const look = (x) => { const cs = getComputedStyle(x); return (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== 'none'); };
  // radios are drawn by their label: the label must show the focus
  const shown = look(e) || (e.type === 'radio' && e.id && look(document.querySelector('label[for="' + e.id + '"]')));
  const r = (e.type === 'radio' && document.querySelector('label[for="' + e.id + '"]') || e).getBoundingClientRect();
  return { where: e.closest('#juego') ? 'juego' : 'fuera', id: e.id || e.name || e.className?.toString().slice(0, 30) || e.tagName, shown, onScreen: r.width > 0 && r.height > 0 };
})()`;

async function tabRound(b, label, max = 80) {
  await b.ev(`document.activeElement?.blur(); document.getElementById('juego').setAttribute('tabindex', '-1'); document.getElementById('juego').focus(); 1`);
  const stops = []; const hidden = []; const invisible = [];
  for (let i = 0; i < max; i++) {
    await b.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    const f = await b.ev(FOCUS);
    if (f.where !== 'juego') break;
    stops.push(f.id);
    if (!f.shown) hidden.push(f.id);
    if (!f.onScreen) invisible.push(f.id);
  }
  await b.ev(`document.getElementById('juego').removeAttribute('tabindex'); 1`);
  return { stops, hidden: [...new Set(hidden)], invisible: [...new Set(invisible)] };
}

const TEMP = await import('file:///' + new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1').replace(/\/$/, '') + '/src/game/temp.js');
const SPOKEN = `(() => {
  const root = document.getElementById('juego'); if (!root) return [];
  const out = [root.innerText];
  for (const e of root.querySelectorAll('[aria-label], [title], [alt]')) out.push(e.getAttribute('aria-label') || '', e.getAttribute('title') || '', e.getAttribute('alt') || '');
  for (const e of root.querySelectorAll('svg title, svg desc, svg text')) out.push(e.textContent);
  return out.filter(Boolean);
})()`;

async function auditScreen(b, label, { keyboard = true } = {}) {
  for (const w of [320, 1920]) {
    await width(b, w);
    const c = await b.ev(CONTRAST);
    const nm = await b.ev(NAMES);
    const over = await b.ev(`document.documentElement.scrollWidth > innerWidth + 1`);
    const cut = await b.ev(`[...document.querySelectorAll('#juego button, #juego label, #juego legend, #juego h3, #juego h4')].filter((e) => e.offsetWidth && e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflowX !== 'visible').map((e) => e.id || e.textContent.trim().slice(0, 25)).slice(0, 5)`);
    const probs = [];
    if (c.bad.length) probs.push(`contraste bajo (${c.bad.length} de ${c.n}): ${c.bad.slice(0, 4).join(' · ')}`);
    if (nm.bad.length) probs.push(`sin nombre para lector de pantalla: ${nm.bad.slice(0, 5).join(', ')}`);
    if (over) probs.push('desborde lateral');
    if (cut.length) probs.push(`texto cortado: ${cut.join(', ')}`);
    // Bertha 2026-11-03: every temperature in °C and °F, on screen and for the screen reader
    const oneScale = (await b.ev(SPOKEN)).flatMap((x) => TEMP.singleScale(x));
    if (oneScale.length) probs.push(`temperatura con una sola escala: ${oneScale.slice(0, 3).join(' · ')}`);
    if (keyboard && w === 1920) {
      const k = await tabRound(b, label);
      if (k.stops.length < 2) probs.push('el teclado no entra en el juego');
      if (k.hidden.length) probs.push(`foco invisible en: ${k.hidden.slice(0, 6).join(', ')}`);
      if (k.invisible.length) probs.push(`el foco cae en algo que no se ve: ${k.invisible.slice(0, 4).join(', ')}`);
    }
    await b.shot(`jgpulido-${label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w]+/g, '-').replace(/-+$/, '').toLowerCase()}-${w}`);
    for (const p of probs) issues.push(`${label} @${w}px: ${p}`);
    check(`${label} @${w}px: contraste (${c.n} textos), nombres, °C y °F, sin desborde${keyboard && w === 1920 ? ', teclado' : ''}`, probs.length === 0, probs.join(' | '));
  }
  await width(b, 390);
}

// ---------------------------------------------------------------- the screens
console.log('1. Pantallas del cultivo');
let b = await session(390);
await auditScreen(b, 'preparar la carpa');
await b.close();

const REG4 = { ...NEUTRAL, carpa: 'grande', semilla: 'regular', plantas: '4' };
const germ = E.start(E.setSetup(E.newGame(), REG4, RULES));
b = await session(390, germ);
await auditScreen(b, 'germinación');
await b.close();

const ev = { ...gameAt('vegetativo', 2), event: { id: 'oidio', since: 3 } };
b = await session(390, ev);
await auditScreen(b, 'semana con un problema sin responder');
await click(b, '#jgtObj-lampara');
await auditScreen(b, 'panel de la lámpara abierto', { keyboard: false });
await b.close();

b = await session(390, gameAt('floracion', 1, REG4));
await auditScreen(b, 'floración con machos');
await b.close();

const FULL = { ...NEUTRAL, carpa: 'pequena', semilla: 'autofloreciente', plantas: '2' };
b = await session(390, gameAt('vegetativo', 1, FULL));
await auditScreen(b, 'carpa llena, autofloreciente');
await b.close();

// control: plant a low-contrast text and a button without a visible focus; the audit must catch both
b = await session(390, gameAt('vegetativo', 1));
await b.ev(`(() => { const d = document.createElement('p'); d.id = 'jgFake'; d.textContent = 'texto de prueba'; d.style.color = '#2A3530'; document.getElementById('jgBubble').after(d);
  const x = document.createElement('button'); x.id = 'jgFakeBtn'; x.textContent = 'prueba'; x.style.outline = 'none'; x.style.boxShadow = 'none'; x.className = 'jg-fake'; d.after(x);
  const st = document.createElement('style'); st.textContent = '#jgFakeBtn:focus,#jgFakeBtn:focus-visible{outline:none!important;box-shadow:none!important}'; document.head.appendChild(st); return 1; })()`);
const cc = await b.ev(CONTRAST);
const kk = await tabRound(b, 'control');
check('control: el audit detecta un texto de bajo contraste y un foco invisible puestos a propósito', cc.bad.some((x) => x.includes('texto de prueba')) && kk.hidden.includes('jgFakeBtn'), JSON.stringify({ c: cc.bad.slice(0, 3), k: kk.hidden }));
check(`control: el teclado recorre el juego (${kk.stops.length} paradas)`, kk.stops.length >= 10);
const before = (await b.ev(SPOKEN)).flatMap((x) => TEMP.singleScale(x));
await b.ev(`(() => { const p = document.createElement('p'); p.textContent = 'sala a 28 °C'; document.getElementById('jgBubble').after(p);
  const i = document.createElement('span'); i.setAttribute('aria-label', 'calor de 90 °F'); p.after(i); return 1; })()`);
const planted = (await b.ev(SPOKEN)).flatMap((x) => TEMP.singleScale(x));
check('control: el audit detecta una temperatura con una sola escala en pantalla y en una descripción para lector de pantalla', before.length === 0 && planted.length === 2, JSON.stringify({ before, planted }));
await b.close();

console.log('2. Después de la cosecha');
b = await session(390, harvestedGame());
await auditScreen(b, 'secado');
await b.close();
let press = harvestedGame();
press = E.applyPost(E.applyPost(press, Object.fromEntries(Object.entries(RULES.post.secado.decisiones).map(([d, v]) => [d, [].concat(v.ideal.valor ?? v.opciones[0])[0]])), RULES),
  Object.fromEntries(Object.entries(RULES.post.curado.decisiones).map(([d, v]) => [d, [].concat(v.ideal.valor ?? v.opciones[0])[0]])), RULES);
press = E.applyPost(press, { partida: 'flor_curada', separacion: 'ninguna' }, RULES);
b = await session(390, press);
await auditScreen(b, 'prensa de rosin');
await click(b, '#jgSkipRosin');
await auditScreen(b, 'final con repaso');
// open every «¿Por qué?» of the final review once (panel text is audited too)
await b.ev(`document.querySelector('#juego .jg-why')?.click(); 1`); await sleep(200);
await auditScreen(b, 'final con un «¿Por qué?» abierto', { keyboard: false });
await click(b, '#jgLab'); await sleep(1500);
await auditScreen(b, 'laboratorio de seguridad');
await b.close();

console.log('3. Idioma de la página');
b = await session(390, gameAt('vegetativo', 1));
const langs = [];
for (const L of ['en', 'de', 'fr', 'es']) { await lang(b, L); langs.push(await b.ev(`document.documentElement.lang`)); }
check('el idioma de la página (lang) sigue al selector: en, de, fr, es', langs.join() === 'en,de,fr,es', langs.join());
if (langs.join() !== 'en,de,fr,es') issues.push('lang de la página: ' + langs.join());
await b.close();

report('game-polish');
summary();
