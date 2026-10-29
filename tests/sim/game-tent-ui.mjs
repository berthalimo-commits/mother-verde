// Browser test — Juego v2, phase 2: the tent you can see (src/game/tent.js).
// Every stage drawn (seed → seedling → vegetative → flowering → drying →
// curing → harvest in jars, and the wilted plant), lamp on/off + intensity,
// light clock 18/6 and 12/12, gauges = the level picked (live, nothing saved
// until the week passes), the text description in 4 languages, contrast,
// 360 px phone without overflow, computer layout, no JavaScript errors.
import { check, sleep, sql, browser, summary, startGame } from './browser.mjs';

const APP = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const NEWBIE = 'b0000003-0000-4000-8000-000000000000';
const open = async (b) => { await b.send('Page.navigate', { url: 'http://localhost:5174/' }); await sleep(5500); await b.ev(`document.getElementById('ageGateModal').style.display='none'; document.getElementById('mvDevPreview')?.remove(); 1`); };
const goGame = async (b) => { await b.ev(`goMore('juego'); 1`); for (let i = 0; i < 30; i++) { if (await b.ev(`!!document.getElementById('jgBubble')`)) break; await sleep(200); } await sleep(300); };
const click = (b, id) => b.ev(`document.getElementById('${id}').click(); 1`);
const gs = (b) => b.ev(`JSON.parse(JSON.stringify(window.mvGameDebug.state))`);
const svg = (b) => b.ev(`(() => { const s = document.querySelector('#jgTent svg.jgt-svg'); return s ? { ...s.dataset } : null; })()`);
const desc = (b) => b.ev(`document.getElementById('jgTentDesc')?.textContent || ''`);
const gauge = (b, g) => b.ev(`(() => { const li = document.querySelector('#jgTent .jg-g[data-g="${g}"]'); return li ? { level: li.dataset.level, text: li.innerText, day: li.querySelector('svg')?.dataset.day } : null; })()`);
const pickWeek = (b, d, o) => b.ev(`document.querySelector('label[for="jg-${d}-${o.replace('/', '-')}"]').click(); 1`);
// One week; an event that blocks the week is answered (any answer lets the week go on).
const nextWeek = async (b) => {
  if (await b.ev(`!!document.querySelector('.jg-answer')`)) { await b.ev(`document.querySelector('.jg-answer').click(); 1`); await sleep(500); }
  await click(b, 'jgNext'); await sleep(700);
};
const errors = (b) => b.events.filter((e) => e.method === 'Runtime.exceptionThrown').length;

// ------------------------------------------------------------ the drawing alone (no browser)
console.log('1. Cada escena se dibuja (sin navegador)');
const fs = await import('fs');
const RULES = JSON.parse(fs.readFileSync(APP + '/src/game/rules.json', 'utf8'));
const TEXTS = (await import('file:///' + APP + '/src/game/i18n.js')).default;
const T = await import('file:///' + APP + '/src/game/tent.js');
const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const C = { fotoperiodo: '18/6', intensidad: 'media', riego: 'moderado', nutrientes: 'medio', temperatura: 'templada', humedad: 'media_alta' };
const base = { stage: 'intro', stageWeek: 0, health: 100, log: [], result: null };
const cases = { intro: base, germ: { ...base, stage: 'plantula', stageWeek: 1 }, plantula: { ...base, stage: 'plantula', stageWeek: 2 },
  vegetativo: { ...base, stage: 'vegetativo', stageWeek: 3 }, floracion: { ...base, stage: 'floracion', stageWeek: 4, log: [{ s: 'vegetativo' }] },
  secado: { ...base, stage: 'secado' }, curado: { ...base, stage: 'curado' }, rosin: { ...base, stage: 'rosin' },
  fin: { ...base, stage: 'fin', result: { dead: false } }, muerta: { ...base, stage: 'fin', result: { dead: true } } };
const html = {};
for (const L of ['es', 'en', 'de', 'fr']) {
  const t = (k) => TEXTS[L][k] ?? `??${k}`;
  for (const [n, s] of Object.entries(cases)) html[L + n] = T.tentHtml(s, C, { t, esc, RULES });
}
const sceneOf = (h) => h.match(/data-scene="(\w+)"/)?.[1];
check('10 estados -> 10 escenas distintas (semilla, germinación, plántula, vegetativo, floración, secado, curado, prensa de rosin, cosecha, marchita)',
  Object.entries(cases).every(([n]) => sceneOf(html['es' + n]) === n) && new Set(Object.keys(cases).map((n) => sceneOf(html['es' + n]))).size === 10);
check('ningún texto falta en ningún idioma (sin «??clave»)', Object.values(html).every((h) => !h.includes('??')));
check('las 4 descripciones son distintas entre idiomas', ['intro', 'floracion', 'muerta'].every((n) => new Set(['es', 'en', 'de', 'fr'].map((L) => html[L + n].match(/id="jgTentDesc">([^<]*)/)[1])).size === 4));
check('floración: cogollos con tricomas; vegetativo: sin cogollos', /#8FCF7E/.test(html.esfloracion) && !/#8FCF7E/.test(html.esvegetativo));
check('secado: ramas colgadas de una cuerda; curado y cosecha: frascos', /M38 58H202/.test(html.essecado) && /rx="1.5" fill="#E3A75F"/.test(html.escurado) && /rx="1.5" fill="#E3A75F"/.test(html.esfin) && !/rx="1.5" fill="#E3A75F"/.test(html.esfloracion));
const dots = (L, w, trich) => T.tentHtml({ ...cases.floracion, stageWeek: w }, C, { t: (k) => TEXTS.es[k], esc, RULES }).match(/<circle[^>]*r="0\.7"[^>]*>/g).length;
check('los cogollos crecen y tienen más tricomas cada semana de floración', dots('es', 7) > dots('es', 2));
check('luz: encendida al cultivar, apagada en semilla, secado, curado y planta marchita',
  ['germ', 'plantula', 'vegetativo', 'floracion'].every((n) => /data-light="on"/.test(html['es' + n]))
  && ['intro', 'secado', 'curado', 'muerta'].every((n) => /data-light="off"/.test(html['es' + n])));
check('la intensidad elegida cambia el brillo de la lámpara (baja < media < alta)', (() => {
  const op = (i) => +T.tentHtml(cases.vegetativo, { ...C, intensidad: i }, { t: (k) => TEXTS.es[k], esc, RULES }).match(/fill="url\(#jgtCone\)" opacity="([\d.]+)"/)[1];
  return op('baja') < op('media') && op('media') < op('alta');
})());
check('salud baja -> hojas amarillentas (dibujo y texto)', /data-leaf="low"/.test(T.tentHtml({ ...cases.vegetativo, health: 20 }, C, { t: (k) => TEXTS.es[k], esc, RULES }))
  && /amarillentas/.test(T.tentHtml({ ...cases.vegetativo, health: 20 }, C, { t: (k) => TEXTS.es[k], esc, RULES })));
check('sin imágenes de fuera ni estilos en línea (CSP)', Object.values(html).every((h) => !/<image|href=|style=|<script/i.test(h)));
check('la carpa no tiene cifras inventadas: solo niveles (los únicos números son 18/6 y 12/12)', Object.values(html).every((h) => {
  const words = h.replace(/<[^>]*>/g, ' ');
  return !/\d/.test(words.replace(/18\/6|12\/12/g, ''));
}));

// ------------------------------------------------------------ in the app, playing
console.log('2. En la app, jugando (celular 360 px)');
await sql(`update profiles set subscription_status = 'trialing', trial_ends_at = now() + interval '20 hours', trial_started_at = now() where id = '${NEWBIE}'`);
await sql(`delete from game_progress where user_id = '${NEWBIE}'`);
let b = await browser(NEWBIE, 'aal1', 360);
await open(b);
await goGame(b);
let s = await svg(b);
check('portada: carpa a oscuras con la semilla, sin indicadores', s?.scene === 'intro' && s.light === 'off' && !(await gauge(b, 'temperatura')));
await b.shot('jgt-intro-es-mobile');
await startGame(b);
s = await svg(b);
check('semana 1: semilla germinada y lámpara encendida con la intensidad preseleccionada', s?.scene === 'germ' && s.light === 'on'
  && s.int === await b.ev(`document.querySelector('input[name="jg-intensidad"]:checked').value`), JSON.stringify(s));
check('reloj de luz: 18/6', (await gauge(b, 'fotoperiodo'))?.day === '18');
await b.shot('jgt-germ-es-mobile');

const seqBefore = (await gs(b)).seq;
await pickWeek(b, 'intensidad', 'alta'); await sleep(200);
await pickWeek(b, 'temperatura', 'calida'); await sleep(200);
await pickWeek(b, 'riego', 'mucho'); await sleep(200);
await pickWeek(b, 'humedad', 'baja'); await sleep(200);
s = await svg(b);
check('al elegir, la carpa cambia en el acto: lámpara fuerte y sustrato empapado', s.int === 'alta' && s.riego === 'mucho');
const th = await gauge(b, 'temperatura'), hu = await gauge(b, 'humedad');
check('termómetro y humedad marcan el nivel elegido (cálida = alto, baja = bajo) con su palabra', th.level === '2' && /Cálida/.test(th.text) && hu.level === '0' && /Baja/.test(hu.text));
check('la descripción en texto cuenta lo mismo (luz fuerte, agua en el suelo)', /luz fuerte/.test(await desc(b)) && /empapado/.test(await desc(b)));
check('elegir no guarda nada (la semana no ha pasado)', (await gs(b)).seq === seqBefore);
check('lo elegido sigue marcado después de redibujar la carpa', await b.ev(`document.querySelector('input[name="jg-riego"]:checked').value`) === 'mucho');
await b.shot('jgt-choices-es-mobile');
for (const [d, o] of [['intensidad', 'baja'], ['temperatura', 'templada'], ['riego', 'moderado'], ['humedad', 'media_alta']]) await pickWeek(b, d, o);
await sleep(200);

for (let i = 0; i < 6 && (await gs(b)).stage !== 'vegetativo'; i++) await nextWeek(b);
check('plántula -> vegetativo: la planta tiene hojas y no cogollos', (await svg(b))?.scene === 'vegetativo');
const h1 = await b.ev(`document.querySelector('#jgTent svg .jgt-stem').getAttribute('d')`);
await nextWeek(b); await nextWeek(b);
const h2 = await b.ev(`document.querySelector('#jgTent svg .jgt-stem').getAttribute('d')`);
check('la planta crece de una semana a otra', h1 !== h2, h1 + ' / ' + h2);
await b.shot('jgt-veg-es-mobile');
await pickWeek(b, 'fotoperiodo', '12/12'); await sleep(200);
check('reloj de luz: al elegir 12/12 muestra medio día de luz', (await gauge(b, 'fotoperiodo'))?.day === '12');
await nextWeek(b);
for (let i = 0; i < 4; i++) await nextWeek(b);
s = await svg(b);
check('floración: cogollos visibles', s?.scene === 'floracion' && await b.ev(`document.querySelectorAll('#jgTent ellipse[fill="#8FCF7E"]').length`) > 2, JSON.stringify(s));
await b.shot('jgt-flor-es-mobile');
check('360 px: sin desborde con la carpa y los indicadores', await b.ev(`document.documentElement.scrollWidth <= innerWidth && document.querySelector('#jgTent').getBoundingClientRect().right <= innerWidth`));
const a = await b.ev(`(() => {
  const lum = (c) => { const m = c.match(/\\d+(\\.\\d+)?/g).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
  const bg = (el) => { while (el) { const c = getComputedStyle(el).backgroundColor; if (c && !/rgba\\(\\d+, \\d+, \\d+, 0\\)|transparent/.test(c)) return c; el = el.parentElement; } return getComputedStyle(document.body).backgroundColor; };
  const ratio = (el) => { const l1 = lum(getComputedStyle(el).color), l2 = lum(bg(el)); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
  return Math.round(Math.min(...[...document.querySelectorAll('#jgTent .jgt-desc, #jgTent .jg-g small, #jgTent .jg-g b')].map(ratio)) * 100) / 100;
})()`);
check(`contraste de los textos de la carpa ≥ 4,5 (${a})`, a >= 4.5);
check('la imagen tiene nombre y su descripción en texto (para lectores de pantalla)', await b.ev(`(() => { const s = document.querySelector('#jgTent svg'); return s.getAttribute('role') === 'img' && !!s.getAttribute('aria-label') && document.getElementById(s.getAttribute('aria-describedby'))?.textContent.length > 20; })()`));

// 4 languages live
const want = { en: /The plant is flowering/, de: /Die Pflanze blüht/, fr: /La plante est en floraison/, es: /La planta está en floración/ };
for (const L of ['en', 'de', 'fr', 'es']) {
  await b.ev(`document.querySelector('#langSwitch button[data-lang=${L}]').click(); 1`); await sleep(600);
  check(`idioma ${L.toUpperCase()} en vivo: descripción y nombre de la imagen traducidos`, want[L].test(await desc(b))
    && await b.ev(`document.querySelector('#jgTent svg').getAttribute('aria-label')`) === TEXTS[L].jgTentAlt);
  if (L !== 'es') await b.shot(`jgt-flor-${L}-mobile`);
}

await click(b, 'jgHarvest'); await sleep(1200);
s = await svg(b);
check('cosecha -> secado: ramas colgadas, carpa a oscuras, sin indicadores', s?.scene === 'secado' && s.light === 'off' && !(await gauge(b, 'temperatura')));
await b.shot('jgt-secado-es-mobile');
const pickAll = () => b.ev(`(() => { document.querySelectorAll('#jgPostForm fieldset').forEach((f) => f.querySelector('label').click()); return 1; })()`);
await pickAll(); await click(b, 'jgPostNext'); await sleep(1200);
check('curado: frascos', (await svg(b))?.scene === 'curado');
await b.shot('jgt-curado-es-mobile');
await pickAll(); await click(b, 'jgPostNext'); await sleep(1200);
await click(b, 'jgSkipRosin'); await sleep(1200);
s = await svg(b);
check('resultado: la cosecha en frascos con luz suave', s?.scene === 'fin' && s.int === 'baja');
check('sin errores de JavaScript en toda la partida', errors(b) === 0, String(errors(b)));
await b.close();

// ------------------------------------------------------------ computer
console.log('3. Computadora');
b = await browser(NEWBIE, 'aal1', 1280);
await open(b);
await goGame(b);
await click(b, 'jgAgain'); await sleep(800);
await startGame(b);
for (let i = 0; i < 4; i++) await nextWeek(b);
const lay = await b.ev(`(() => { const s = document.querySelector('#jgTent .jgt-scene').getBoundingClientRect(), g = document.querySelector('#jgTent .jg-gauges').getBoundingClientRect(); return { side: g.left >= s.right - 1 && g.top < s.bottom, over: document.documentElement.scrollWidth > innerWidth }; })()`);
check('computadora: los indicadores van al lado de la carpa, sin desborde', lay.side && !lay.over, JSON.stringify(lay));
await b.shot('jgt-veg-es-desktop');
check('sin errores de JavaScript', errors(b) === 0);
await b.close();

summary();
