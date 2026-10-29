// Test — Juego v2, phase 8: drying, curing + storage and rosin you can see
// (docs/juego-decisiones.md, approved 2026-10-28). Every choice changes the
// drawing live; the consequences (mould, over-dried, debris, dark / watery
// rosin) show and are told in words; «¿Por qué?» with its checked source
// (F8 storage study, P1/P2 rosin patents); rosin figures only «orientativo»;
// the server keeps the whole post-harvest; 4 languages; 360 px.
import { check, sleep, sql, browser, summary, startGame } from './browser.mjs';
import fs from 'fs';

const APP = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const RULES = JSON.parse(fs.readFileSync(APP + '/src/game/rules.json', 'utf8'));
const TEXTS = (await import('file:///' + APP + '/src/game/i18n.js')).default;
const T = await import('file:///' + APP + '/src/game/tent.js');
const W = await import('file:///' + APP + '/src/game/why.js');
const NEWBIE = 'b0000003-0000-4000-8000-000000000000';
const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ctx = (L = 'es') => ({ t: (k) => TEXTS[L][k] ?? `??${k}`, esc, RULES });
const S = (stage, extra = {}) => ({ stage, stageWeek: 0, health: 90, log: [], result: { dead: false }, post: null, ...extra });
const draw = (stage, post, L) => T.tentHtml(S(stage), null, ctx(L), { post });
const attr = (h, a) => h.match(new RegExp(`class="jgt-post"[^>]*data-${a}="([^"]*)"`))?.[1];
const cap = (h) => h.match(/id="jgTentDesc">([^<]*)/)[1];

// ------------------------------------------------------------ drawings (no browser)
console.log('1. Cada decisión cambia el dibujo');
check('secado: planta entera, ramas o rejilla se dibujan distinto', ['entera', 'ramas', 'rejilla'].every((m) => attr(draw('secado', { metodo: m }), 'metodo') === m)
  && new Set(['entera', 'ramas', 'rejilla'].map((m) => draw('secado', { metodo: m }))).size === 3);
check('secado: con luz la lámpara se enciende; a oscuras, no', /data-light="on"/.test(draw('secado', { luz: 'con_luz' })) && /data-light="off"/.test(draw('secado', { luz: 'oscuro' })));
check('secado: aire a la pared / directo se ve; sin ventilador, sin aire', /class="jgt-air"/.test(draw('secado', { aire: 'pared' })) && /class="jgt-air"/.test(draw('secado', { aire: 'directo' })) && !/class="jgt-air"/.test(draw('secado', { aire: 'sin_aire' })));
check('secado: humedad alta o aire quieto -> moho visible; calor -> cogollos resecos', attr(draw('secado', { humedad: 'alta' }), 'moho') === '1' && attr(draw('secado', { aire: 'sin_aire' }), 'moho') === '1'
  && /jgt-mould/.test(draw('secado', { humedad: 'alta' })) && attr(draw('secado', { temperatura: 'calida' }), 'reseco') === '1' && attr(draw('secado', { temperatura: 'fresca', humedad: 'media', aire: 'pared' }), 'moho') === '0');
check('curado: los 4 envases se dibujan distinto; la lata no deja ver el contenido', new Set(['vidrio', 'plastico', 'lata', 'bolsa_curado'].map((e) => draw('curado', { envase: e }))).size === 4
  && !/#8FAE6A/.test(draw('curado', { envase: 'lata' })) && /#8FAE6A/.test(draw('curado', { envase: 'vidrio' })));
check('guardar: armario, estante, ventana al sol, nevera y congelador (con escarcha) se ven', [['g_luz', 'oscuro'], ['g_luz', 'indirecta'], ['g_luz', 'sol'], ['g_temp', 'nevera'], ['g_temp', 'congelador']]
  .every(([d, o]) => attr(draw('curado', { [d]: o }), 'lugar') === o) && /jgt-frost/.test(draw('curado', { g_temp: 'congelador' })) && /jgt-heat/.test(draw('curado', { g_temp: 'calido' })));
check('guardar: molido se ve como polvo; siempre abierto, sin tapa; higrómetro y sobre dentro del frasco', attr(draw('curado', { g_forma: 'molida' }), 'forma') === 'molida'
  && attr(draw('curado', { abrir: 'siempre' }), 'tapa') === 'no' && attr(draw('curado', { abrir: 'diario' }), 'tapa') === 'si'
  && attr(draw('curado', { control: 'higrometro' }), 'control') === 'higrometro' && draw('curado', { control: 'sobre' }) !== draw('curado', { control: 'higrometro' }));
check('curado: frascos siempre cerrados -> moho; al sol -> resecos (F8)', attr(draw('curado', { abrir: 'nunca' }), 'moho') === '1' && attr(draw('curado', { g_luz: 'sol' }), 'reseco') === '1');
check('rosin: sin bolsa -> restos de planta; calor alto -> rosin oscuro; flor fresca -> agua', attr(draw('rosin', { material: 'flor', malla: 'sin_bolsa' }), 'restos') === '1'
  && /jgt-debris/.test(draw('rosin', { material: 'flor', malla: 'sin_bolsa' })) && /fill="#8B5A2B"/.test(draw('rosin', { material: 'flor', calor: 'alto' }))
  && attr(draw('rosin', { material: 'flor', calor: 'medio', malla: 'fina' }), 'restos') === '0');
check('rosin: el tipo de prensa, el papel y el material cambian el dibujo', new Set(['manual', 'hidraulica', 'neumatica', 'electrica'].map((p) => draw('rosin', { prensa: p }))).size === 4
  && new Set(['pergamino', 'comun', 'sin_papel'].map((p) => draw('rosin', { papel: p }))).size === 3 && new Set(['flor', 'hachis', 'kief', 'congelado', 'fresco'].map((m) => draw('rosin', { material: m }))).size === 5);
for (const L of ['es', 'en', 'de', 'fr']) {
  const ok = [['secado', { humedad: 'alta' }, 'moho'], ['secado', { temperatura: 'calida' }, 'reseco'], ['rosin', { material: 'flor', malla: 'sin_bolsa' }, 'restos'],
    ['rosin', { material: 'flor', calor: 'alto' }, 'oscuro'], ['rosin', { material: 'fresco' }, 'agua']].every(([st, p, k]) => cap(draw(st, p, L)).includes(TEXTS[L]['jgTentX_' + k].replace(/[&<>"]/g, '')));
  check(`${L.toUpperCase()}: la descripción cuenta el método y cada consecuencia, sin «??clave»`, ok && cap(draw('secado', { metodo: 'rejilla' }, L)).includes(TEXTS[L].jgTentM_rejilla)
    && ['secado', 'curado', 'rosin'].every((st) => !draw(st, {}, L).includes('??')));
}
check('«¿Por qué?» de almacenamiento cita el estudio F8; la malla, las dos patentes', W.WHY.curado_g_temp.src === 'F8' && W.WHY.curado_g_forma.src === 'F8'
  && JSON.stringify(W.WHY.rosin_malla.src) === '["P1","P2"]' && W.WHY.rosin_malla.level === 'patente');

// ------------------------------------------------------------ in the app
console.log('2. En la app: una partida con secado, curado + guardado y rosin');
await sql(`update profiles set subscription_status = 'trialing', trial_ends_at = now() + interval '20 hours', trial_started_at = now() where id = '${NEWBIE}'`);
await sql(`delete from game_progress where user_id = '${NEWBIE}'`);
const b = await browser(NEWBIE, 'aal1', 360);
await b.send('Page.navigate', { url: 'http://localhost:5174/' }); await sleep(5500);
await b.ev(`document.getElementById('ageGateModal').style.display='none'; document.getElementById('mvDevPreview')?.remove(); goMore('juego'); 1`);
for (let i = 0; i < 30; i++) { if (await b.ev(`!!document.getElementById('jgBubble')`)) break; await sleep(200); }
const gs = () => b.ev(`JSON.parse(JSON.stringify(window.mvGameDebug.state))`);
const pick = (st, d, o) => b.ev(`document.querySelector('label[for="jgp-${st}-${d}-${o}"]').click(); 1`).then(() => sleep(150));
const post = () => b.ev(`(() => { const g = document.querySelector('#jgTent .jgt-post'); return g ? { ...g.dataset, desc: document.getElementById('jgTentDesc').textContent } : null; })()`);
await startGame(b);
for (let i = 0; i < 16 && (await gs()).stage !== 'floracion'; i++) {
  if (await b.ev(`!!document.querySelector('.jg-answer')`)) { await b.ev(`document.querySelector('.jg-answer').click(); 1`); await sleep(500); }
  await b.ev(`document.getElementById('jgNext').click(); 1`); await sleep(700);
}
await b.ev(`document.getElementById('jgHarvest').click(); 1`); await sleep(1000);
check('secado: 6 decisiones, nada elegido de antemano', await b.ev(`document.querySelectorAll('#jgPostForm fieldset').length`) === 6 && await b.ev(`document.querySelectorAll('#jgPostForm input:checked').length`) === 0);
const seq0 = (await gs()).seq;
await pick('secado', 'metodo', 'rejilla');
await pick('secado', 'humedad', 'alta');
let p = await post();
check('al elegir, la carpa cambia en el acto: rejilla y moho visible, y la descripción lo dice', p.metodo === 'rejilla' && p.moho === '1' && p.desc.includes(TEXTS.es.jgTentX_moho), JSON.stringify(p));
check('elegir no guarda nada', (await gs()).seq === seq0);
await b.shot('jg8-secado-es-mobile');
for (const [d, o] of [['metodo', 'ramas'], ['temperatura', 'fresca'], ['humedad', 'media'], ['aire', 'pared'], ['luz', 'oscuro'], ['duracion', 'chasquido']]) await pick('secado', d, o);
await b.ev(`document.getElementById('jgPostNext').click(); 1`); await sleep(1000);
check('curado: 9 decisiones y el apartado «Cómo lo vas a guardar después» antes de la luz', await b.ev(`document.querySelectorAll('#jgPostForm fieldset').length`) === 9
  && await b.ev(`(() => { const h = document.querySelector('#jgPostForm .jg-pgroup'); return !!h && h.textContent === ${JSON.stringify(TEXTS.es.jgPG_curado_guardar)} && h.nextElementSibling.querySelector('input').name === 'jgp-g_luz'; })()`));
for (const [d, o] of [['envase', 'vidrio'], ['control', 'higrometro'], ['abrir', 'diario'], ['tiempo', 'semanas'], ['g_luz', 'oscuro'], ['g_temp', 'congelador'], ['g_aire', 'lleno'], ['g_forma', 'molida'], ['g_tiempo', 'meses']]) await pick('curado', d, o);
p = await post();
check('guardar en el congelador y molido se ve (escarcha, polvo)', p.lugar === 'congelador' && p.forma === 'molida' && await b.ev(`!!document.querySelector('#jgTent .jgt-frost')`));
check('360 px: sin desborde en la pantalla del curado', await b.ev(`document.documentElement.scrollWidth <= innerWidth`));
await b.shot('jg8-curado-es-mobile');
await b.ev(`document.getElementById('jgPostNext').click(); 1`); await sleep(1000);
const whys = await b.ev(`[...document.querySelectorAll('.jg-whys[data-gid="guia"] .jg-why')].map((x) => x.textContent)`);
check('curado con errores: «¿Por qué?» por cada decisión que restó (congelador y molido)', whys.includes('¿Por qué? · Temperatura donde se guarda') && whys.includes('¿Por qué? · Cómo se guarda'), JSON.stringify(whys));
await b.ev(`[...document.querySelectorAll('.jg-whys[data-gid="guia"] .jg-why')].find((x) => /Cómo se guarda/.test(x.textContent)).click(); 1`); await sleep(300);
const wp = await b.ev(`(() => { const p = document.querySelector('.jg-whys[data-gid="guia"] .jg-why-panel'); return { text: p.innerText, hrefs: [...p.querySelectorAll('a')].map((a) => a.href) }; })()`);
check('…y explica con el estudio comprobado (F8, «estudio publicado»)', /molido/.test(wp.text) && /estudio publicado/.test(wp.text) && wp.hrefs.length === 1 && wp.hrefs[0] === W.SOURCES.F8.url, JSON.stringify(wp));
check('rosin: 11 decisiones; malla y calor con su cifra «orientativo»; presión y tiempo sin cifras', await b.ev(`document.querySelectorAll('#jgPostForm fieldset').length`) === 11
  && /5–25 µm \(orientativo\)/.test(await b.ev(`document.querySelector('label[for="jgp-rosin-malla-fina"]').innerText`))
  && /orientativo: 49–116 °C/.test(await b.ev(`[...document.querySelectorAll('#jgPostForm legend')].map((l) => l.textContent).join('|')`))
  && !/\d/.test(await b.ev(`[...document.querySelectorAll('#jgPostForm fieldset')].filter((f) => /jgp-(presion|tiempo)/.test(f.querySelector('input').name)).map((f) => f.innerText).join(' ')`)));
for (const [L, w] of [['en', '5–25 µm (orientative)'], ['de', '5–25 µm (Richtwert)'], ['fr', '5–25 µm (indicatif)']]) {
  await b.ev(`document.querySelector('#langSwitch button[data-lang=${L}]').click(); 1`); await sleep(500);
  check(`${L.toUpperCase()}: la malla fina dice «${w}»`, (await b.ev(`document.querySelector('label[for="jgp-rosin-malla-fina"]').innerText`)).includes(w));
  if (L === 'de') await b.shot('jg8-rosin-de-mobile');
}
await b.ev(`document.querySelector('#langSwitch button[data-lang=es]').click(); 1`); await sleep(500);
for (const [d, o] of [['material', 'flor'], ['malla', 'sin_bolsa'], ['calor', 'alto'], ['presion', 'media'], ['tiempo', 'medio'], ['prensa', 'hidraulica'], ['papel', 'pergamino'], ['enfriado', 'enfriar'], ['guardar', 'frio'], ['prioridad', 'sabor'], ['proteccion', 'guantes']]) await pick('rosin', d, o);
p = await post();
check('rosin sin bolsa y con calor alto: restos de planta y rosin oscuro a la vista', p.restos === '1' && p.oscuro === '1' && p.desc.includes(TEXTS.es.jgTentX_restos) && p.desc.includes(TEXTS.es.jgTentX_oscuro));
await b.shot('jg8-rosin-es-mobile');
await b.ev(`document.getElementById('jgPostNext').click(); 1`); await sleep(1200);
const fin = await gs();
check('resultado: el rosin «para mejorar» por la malla y el calor', fin.stage === 'fin' && fin.result.rosin.causes.includes('rosin_malla') && fin.result.rosin.causes.includes('rosin_calor'), JSON.stringify(fin.result));
await b.ev(`[...document.querySelectorAll('.jg-whys[data-gid="fin"] .jg-why')].find((x) => /Bolsa de malla/.test(x.textContent)).click(); 1`); await sleep(300);
const mp = await b.ev(`(() => { const p = document.querySelector('.jg-whys[data-gid="fin"] .jg-why-panel'); return { text: p.innerText, hrefs: [...p.querySelectorAll('a')].map((a) => a.href) }; })()`);
check('«¿Por qué? · Bolsa de malla» enlaza las dos patentes y dice que es un documento técnico, no un estudio', mp.hrefs.join() === [W.SOURCES.P1.url, W.SOURCES.P2.url].join() && /patente/.test(mp.text) && /no es un estudio/.test(mp.text), JSON.stringify(mp));
await sleep(1500);
const row = (await sql(`select seq, state->'post' as post from game_progress where user_id = '${NEWBIE}'`))[0];
check('el servidor guardó el post-cosecha completo (secado, curado con guardado, rosin)', row && row.seq === fin.seq && Object.keys(row.post.curado.c).length === 9 && Object.keys(row.post.rosin.c).length === 11, JSON.stringify(row).slice(0, 200));
check('la cosecha final muestra cómo se guardó (congelador)', await b.ev(`document.querySelector('#jgTent .jgt-post')?.dataset.lugar`) === 'congelador');
check('sin errores de JavaScript', b.events.filter((e) => e.method === 'Runtime.exceptionThrown').length === 0);
await b.close();
summary();
