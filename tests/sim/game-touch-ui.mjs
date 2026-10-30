// Browser test — Juego v2, phase 3: orders by touching the tent, and the
// «¿Por qué?» buttons (src/game/why.js, docs/juego-fuentes.md).
// Each object opens its panel; mouse and keyboard (Tab, Enter, Escape); the
// panel and the list below are the same choices; passing the week from the
// panel gives exactly the engine's result; 44 px; 360 px; 4 languages.
// «¿Por qué?»: under the guide after a bad week, in a problem, in the result;
// reason + backing level + checked source link + lesson; nothing invented.
import { check, sleep, sql, browser, summary, startGame } from './browser.mjs';
import fs from 'fs';

const APP = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const RULES = JSON.parse(fs.readFileSync(APP + '/src/game/rules.json', 'utf8'));
const E = await import('file:///' + APP + '/src/game/engine.js');
const W = await import('file:///' + APP + '/src/game/why.js');
const TEXTS = (await import('file:///' + APP + '/src/game/i18n.js')).default;
const NEWBIE = 'b0000003-0000-4000-8000-000000000000';
const open = async (b) => { await b.send('Page.navigate', { url: 'http://localhost:5174/' }); await sleep(5500); await b.ev(`document.getElementById('ageGateModal').style.display='none'; document.getElementById('mvDevPreview')?.remove(); 1`); };
const goGame = async (b) => { await b.ev(`goMore('juego'); 1`); for (let i = 0; i < 30; i++) { if (await b.ev(`!!document.getElementById('jgBubble')`)) break; await sleep(200); } await sleep(300); };
const click = (b, sel) => b.ev(`document.querySelector('${sel}').click(); 1`);
const gs = (b) => b.ev(`JSON.parse(JSON.stringify(window.mvGameDebug.state))`);
const key = async (b, k, code, vk) => { for (const type of ['keyDown', 'keyUp']) await b.send('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: vk, ...(type === 'keyDown' && k === 'Enter' ? { text: String.fromCharCode(13) } : {}) }); await sleep(250); };
const active = (b) => b.ev(`document.activeElement?.id || document.activeElement?.className || ''`);
const errors = (b) => b.events.filter((e) => e.method === 'Runtime.exceptionThrown').length;

// ------------------------------------------------------------ the sources behind «¿Por qué?» (no browser)
console.log('1. «¿Por qué?»: cada razón tiene texto, nivel y solo fuentes comprobadas');
const doc = fs.readFileSync(APP + '/docs/juego-fuentes.md', 'utf8');
check('cada fuente enlazada está en docs/juego-fuentes.md (mismo enlace)', Object.values(W.SOURCES).every((s) => doc.includes(s.url)));
check('cada razón tiene su texto en los 4 idiomas', Object.keys(W.WHY).every((k) => ['es', 'en', 'de', 'fr'].every((L) => (TEXTS[L]['jgWhy_' + k] || '').length > 20)));
check('cada nivel de respaldo existe en los 4 idiomas', [...new Set(Object.values(W.WHY).map((w) => w.level))].every((l) => ['es', 'en', 'de', 'fr'].every((L) => TEXTS[L]['jgWhyNivel_' + l])));
const srcs = (w) => [].concat(w.src ?? []);
check('«estudio», «guía» o «patente» siempre con fuente enlazada; sin fuente, solo «regla del juego», «práctica» o «criterio de la autora»', Object.values(W.WHY).every((w) =>
  (['estudio', 'guia', 'patente'].includes(w.level) ? srcs(w).length > 0 : true) && srcs(w).every((c) => !!W.SOURCES[c])
  && (srcs(w).length ? true : ['simple', 'practica', 'autora'].includes(w.level))));
check('los textos del rosin no llevan cifras', ['es', 'en', 'de', 'fr'].every((L) => !/\d/.test(TEXTS[L].jgWhy_rosin)));

// ------------------------------------------------------------ phone, touching the tent
console.log('2. Tocar la carpa (celular 360 px)');
await sql(`update profiles set subscription_status = 'trialing', trial_ends_at = now() + interval '20 hours', trial_started_at = now() where id = '${NEWBIE}'`);
await sql(`delete from game_progress where user_id = '${NEWBIE}'`);
let b = await browser(NEWBIE, 'aal1', 360);
await open(b);
await goGame(b);
check('portada: sin objetos que tocar (todavía no hay planta)', await b.ev(`document.querySelectorAll('.jgt-obj').length`) === 0);
await startGame(b);
const objs = await b.ev(`[...document.querySelectorAll('.jgt-obj')].map((o) => { const r = o.getBoundingClientRect(), s = document.querySelector('.jgt-stage').getBoundingClientRect(); return { k: o.dataset.obj, w: r.width, h: r.height, inside: r.left >= s.left - 1 && r.right <= s.right + 1 && r.top >= s.top - 1 && r.bottom <= s.bottom + 1, label: o.getAttribute('aria-label') }; })`);
check('5 objetos: lámpara, termómetro, humidificador, regadera y nutrientes', objs.map((o) => o.k).sort().join() === 'humidificador,lampara,nutrientes,regadera,termometro', JSON.stringify(objs.map((o) => o.k)));
check('cada objeto mide ≥ 44 px, está dentro de la carpa y tiene nombre («Lámpara: cambiar»…)', objs.every((o) => o.w >= 44 && o.h >= 44 && o.inside && /: cambiar$/.test(o.label)), JSON.stringify(objs));
const rects = await b.ev(`[...document.querySelectorAll('.jgt-obj')].map((o) => { const r = o.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; })`);
const overlap = rects.some((a, i) => rects.some((c, j) => i < j && a[0] < c[2] && c[0] < a[2] && a[1] < c[3] && c[1] < a[3]));
check('360 px: sin desborde y los objetos no se tapan entre sí', await b.ev(`document.documentElement.scrollWidth <= innerWidth`) && !overlap, JSON.stringify(rects));

await click(b, '#jgtObj-lampara'); await sleep(300);
let p = await b.ev(`(() => { const p = document.getElementById('jgtPanel'); return p ? { obj: p.dataset.obj, legends: [...p.querySelectorAll('legend')].map((l) => l.textContent), expanded: document.getElementById('jgtObj-lampara').getAttribute('aria-expanded') } : null; })()`);
check('tocar la lámpara abre su panel: horas de luz e intensidad', p?.obj === 'lampara' && p.legends.join('|') === 'Luz: horas al día|Luz: intensidad' && p.expanded === 'true', JSON.stringify(p));
check('…el foco va a la opción marcada del panel', /^jgt-(fotoperiodo|intensidad)-/.test(await active(b)));
await b.shot('jgt3-lampara-es-mobile');
const seq0 = (await gs(b)).seq;
await click(b, 'label[for="jgt-intensidad-alta"]'); await sleep(300);
check('elegir «Alta» en el panel marca «Alta» en la lista, la lámpara brilla fuerte y el panel sigue abierto',
  await b.ev(`document.getElementById('jg-intensidad-alta').checked`) && await b.ev(`document.querySelector('#jgTent svg').dataset.int`) === 'alta' && !!(await b.ev(`document.getElementById('jgtPanel')`)));
check('…y no se guarda nada (la semana no pasó)', (await gs(b)).seq === seq0);
await click(b, 'label[for="jg-intensidad-baja"]'); await sleep(300);
check('elegir en la lista cambia el panel abierto (son las mismas opciones)', await b.ev(`document.getElementById('jgt-intensidad-baja').checked`));
for (const [k, d] of [['regadera', 'riego'], ['nutrientes', 'nutrientes'], ['termometro', 'temperatura'], ['humidificador', 'humedad']]) {
  await click(b, `#jgtObj-${k}`); await sleep(300);
  check(`${k} abre «${TEXTS.es['jgD_' + d]}»`, await b.ev(`[...document.querySelectorAll('#jgtPanel legend')].map((l) => l.textContent).join()`) === TEXTS.es['jgD_' + d]);
}
await click(b, '#jgtObj-humidificador'); await sleep(300);
check('tocar otra vez el mismo objeto cierra el panel', !(await b.ev(`document.getElementById('jgtPanel')`)));

// keyboard
await b.ev(`document.getElementById('jgBubble').focus(); 1`);
let reached = false;
for (let i = 0; i < 25 && !reached; i++) { await key(b, 'Tab', 'Tab', 9); reached = (await active(b)) === 'jgtObj-lampara'; }
check('teclado: Tab llega a la lámpara', reached);
await key(b, 'Enter', 'Enter', 13);
check('teclado: Enter abre el panel', !!(await b.ev(`document.getElementById('jgtPanel')`)) && /^jgt-/.test(await active(b)));
await key(b, 'Escape', 'Escape', 27);
check('teclado: Escape cierra el panel y el foco vuelve a la lámpara', !(await b.ev(`document.getElementById('jgtPanel')`)) && (await active(b)) === 'jgtObj-lampara');
check('el foco se ve (contorno)', await b.ev(`getComputedStyle(document.activeElement).outlineStyle !== 'none'`));

// the week from the panel = the engine with the same choices
await click(b, '#jgtObj-regadera'); await sleep(300);
await click(b, 'label[for="jgt-riego-mucho"]'); await sleep(300);
const before = await gs(b);
const choices = await b.ev(`Object.fromEntries(['fotoperiodo','intensidad','riego','nutrientes','temperatura','humedad'].map((d) => [d, document.querySelector('input[name="jg-' + d + '"]:checked').value]))`);
await click(b, '#jgtNext'); await sleep(900);
const after = await gs(b);
const want = E.applyWeek(before, choices, RULES);
check('«Pasar a la semana siguiente» del panel = el mismo resultado que la regla del juego', JSON.stringify(after) === JSON.stringify(want), JSON.stringify({ after: after.health, want: want.health }));
check('al pasar la semana el panel se cierra', !(await b.ev(`document.getElementById('jgtPanel')`)));

// «¿Por qué?» after a bad week
console.log('3. «¿Por qué?»');
const whyBtns = await b.ev(`[...document.querySelectorAll('.jg-whys[data-gid="guia"] .jg-why')].map((x) => x.textContent)`);
check('semana con pérdidas: bajo el guía, «¿Por qué? · Riego» (y una por cada causa)', whyBtns.includes('¿Por qué? · Riego'), JSON.stringify(whyBtns));
await b.ev(`[...document.querySelectorAll('.jg-whys[data-gid="guia"] .jg-why')].find((x) => /Riego/.test(x.textContent)).click(); 1`); await sleep(300);
const panel = await b.ev(`(() => { const p = document.querySelector('.jg-whys[data-gid="guia"] .jg-why-panel'); return { hidden: p.hidden, text: p.innerText, href: p.querySelector('a')?.href, lesson: !!p.querySelector('.jg-lesson') }; })()`);
check('…abre la razón, el respaldo («guía técnica»), la fuente comprobada (UC IPM) y la lección', !panel.hidden && /raíces se quedan sin aire/.test(panel.text) && /guía técnica/.test(panel.text)
  && panel.href === W.SOURCES.F3.url && panel.lesson, JSON.stringify(panel).slice(0, 300));
await b.shot('jgt3-porque-es-mobile');
for (const [L, btn] of [['en', 'Why?'], ['de', 'Warum?'], ['fr', 'Pourquoi ?']]) {
  await b.ev(`document.querySelector('#langSwitch button[data-lang=${L}]').click(); 1`); await sleep(600);
  check(`${L.toUpperCase()}: botones «${btn}» y objetos de la carpa traducidos`, await b.ev(`[...document.querySelectorAll('.jg-why')].every((x) => x.textContent.startsWith(${JSON.stringify(btn)}))`)
    && await b.ev(`document.getElementById('jgtObj-lampara').getAttribute('aria-label')`) === TEXTS[L].jgObjAbrir.replace('{o}', TEXTS[L].jgObj_lampara));
  if (L === 'de') await b.shot('jgt3-de-mobile');
}
await b.ev(`document.querySelector('#langSwitch button[data-lang=es]').click(); 1`); await sleep(500);

// a problem: too much water two weeks in a row -> «Exceso de riego» with its «¿Por qué?»
for (let i = 0; i < 3 && !(await b.ev(`!!document.querySelector('.jg-event')`)); i++) {
  await click(b, 'label[for="jg-riego-mucho"]'); await sleep(150);
  await click(b, '#jgNext'); await sleep(900);
}
const ev = await b.ev(`(() => { const e = document.querySelector('.jg-event'); return e ? [...e.querySelectorAll('.jg-why')].map((x) => x.textContent) : null; })()`);
check('un problema (exceso de riego) trae su «¿Por qué?» dentro de la tarjeta', JSON.stringify(ev) === JSON.stringify(['¿Por qué? · ' + TEXTS.es.jgEvN_exceso_riego]), JSON.stringify(ev));
check('con un problema sin responder, el panel de la carpa no deja elegir (igual que la lista)', await (async () => { await click(b, '#jgtObj-lampara'); await sleep(300); return b.ev(`[...document.querySelectorAll('#jgtPanel input')].every((i) => i.disabled) && document.getElementById('jgtNext').disabled`); })());
// the lesson button inside a reason opens the platform
await click(b, '.jg-event .jg-why'); await sleep(300);
await click(b, '.jg-event .jg-why-panel .jg-lesson'); await sleep(800);
check('el botón de la lección dentro de «¿Por qué?» abre la plataforma (Cultivo)', await b.ev(`document.querySelector('.screen.active')?.id`) === 'cultivo');
check('sin errores de JavaScript', errors(b) === 0, String(errors(b)));
await b.close();

// ------------------------------------------------------------ the result
console.log('4. Resultado');
b = await browser(NEWBIE, 'aal1', 1280);
await open(b);
await goGame(b);
const st = await gs(b);
if (st.event && !st.event.answered) { await click(b, '.jg-answer'); await sleep(700); }
for (let i = 0; i < 16 && (await gs(b)).stage !== 'floracion'; i++) { if (await b.ev(`!!document.querySelector('.jg-answer')`)) { await click(b, '.jg-answer'); await sleep(600); } await click(b, '#jgNext'); await sleep(700); }
await click(b, '#jgHarvest'); await sleep(1000);
const pickAll = () => b.ev(`(() => { document.querySelectorAll('#jgPostForm fieldset').forEach((f) => f.querySelector('label').click()); return 1; })()`);
await pickAll(); await click(b, '#jgPostNext'); await sleep(1000);
await pickAll(); await click(b, '#jgPostNext'); await sleep(1000);
await click(b, '#jgSkipRosin'); await sleep(1000);
const fin = await b.ev(`[...document.querySelectorAll('.jg-whys[data-gid="fin"] .jg-why, .jg-review .jg-why')].map((x) => x.textContent)`);
check('resultado: «¿Por qué?» de los tricomas y de cada causa que restó (en el repaso)', fin.includes('¿Por qué? · Tricomas') && fin.length >= 2, JSON.stringify(fin));
await b.ev(`[...document.querySelectorAll('.jg-whys[data-gid="fin"] .jg-why')].find((x) => /Tricomas/.test(x.textContent)).click(); 1`); await sleep(300);
const tri = await b.ev(`document.querySelector('.jg-whys[data-gid="fin"] .jg-why-panel').innerText`);
check('…los tricomas dicen la verdad: práctica de cultivadores, sin estudio que lo confirme, sin enlace inventado', /no encontramos un estudio/.test(tri) && /práctica de cultivadores/.test(tri)
  && !(await b.ev(`!!document.querySelector('.jg-whys[data-gid="fin"] .jg-why-panel a')`)));
await b.shot('jgt3-fin-es-desktop');
check('computadora: sin desborde ni errores', await b.ev(`document.documentElement.scrollWidth <= innerWidth`) && errors(b) === 0);
await b.close();
summary();
