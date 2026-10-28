// Test — Juego v2, phase 4: problems you can see on the plant (as their
// sources describe them, docs/juego-fuentes.md), recovery, and the week's
// animation (once, under 5 s, nothing with «reduce motion»).
import { check, sleep, sql, browser, summary } from './browser.mjs';
import fs from 'fs';

const APP = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const RULES = JSON.parse(fs.readFileSync(APP + '/src/game/rules.json', 'utf8'));
const TEXTS = (await import('file:///' + APP + '/src/game/i18n.js')).default;
const T = await import('file:///' + APP + '/src/game/tent.js');
const NEWBIE = 'b0000003-0000-4000-8000-000000000000';
const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const C = { fotoperiodo: '18/6', intensidad: 'media', riego: 'moderado', nutrientes: 'medio', temperatura: 'templada', humedad: 'media_alta' };
const ctx = (L = 'es') => ({ t: (k) => TEXTS[L][k] ?? `??${k}`, esc, RULES });
const veg = { stage: 'vegetativo', stageWeek: 4, week: 6, health: 80, log: [], notes: [], event: null };
const flor = { ...veg, stage: 'floracion', stageWeek: 6, log: [{ s: 'vegetativo' }, { s: 'vegetativo' }, { s: 'vegetativo' }] };

// ------------------------------------------------------------ the drawings (no browser)
console.log('1. Cada problema se dibuja como lo describe su fuente');
const draw = (s, L) => T.tentHtml(s, C, ctx(L));
const ev = (id, base = veg) => ({ ...base, event: { id, since: 5 } });
const H = {
  oidio: draw(ev('oidio')), acaros: draw(ev('acaros')), carencia_n: draw(ev('carencia_n')),
  exceso_riego: draw(ev('exceso_riego')), botrytis: draw(ev('botrytis', flor)),
};
check('oídio: manchas blancas sobre las hojas (F5, F7)', /data-problem="oidio"/.test(H.oidio) && /data-sym="oidio"/.test(H.oidio) && (H.oidio.match(/fill="#F4F6F2"/g) || []).length >= 6);
check('ácaros: puntitos claros y telaraña fina (F6)', /data-sym="acaros"/.test(H.acaros) && /stroke="#E8EEF0" stroke-width="0.4"/.test(H.acaros));
check('carencia de N: las hojas de ABAJO se ponen amarillas, las de arriba no (F2)', (() => {
  const m = H.carencia_n.match(/<g fill="#D9C64A" class="jgt-sym" data-sym="carencia_n">([\s\S]*?)<\/g><\/g>/);
  if (!m) return false;
  const ys = [...m[1].matchAll(/translate\([\d.]+ ([\d.]+)\)/g)].map((x) => +x[1]);
  const all = [...H.carencia_n.matchAll(/class="jgt-plant"[\s\S]*/g)][0][0];
  const greenYs = [...all.split('data-sym="carencia_n"')[0].matchAll(/translate\([\d.]+ ([\d.]+)\)/g)].map((x) => +x[1]);
  return ys.length > 0 && Math.min(...ys) > Math.max(...greenYs.filter((y) => y < 180));
})());
check('exceso de riego: hojas caídas y sustrato empapado y brillante (F3)', (() => {
  const ang = (h) => [...h.matchAll(/translate\([\d.]+ [\d.]+\) rotate\((-?[\d.]+)\)/g)].map((x) => Math.abs(+x[1]));
  return Math.max(...ang(H.exceso_riego)) > Math.max(...ang(draw(veg))) && /fill="#2F1D12"/.test(H.exceso_riego) && /opacity="0.3"\/>/.test(H.exceso_riego);
})());
check('botrytis: los cogollos de arriba se ponen grises/marrones (F4)', /class="jgt-rot"/.test(H.botrytis) && !/class="jgt-rot"/.test(draw(flor)));
check('sin problema, nada de eso', !/data-problem=/.test(draw(veg)) && !/jgt-sym/.test(draw(veg)));
const rec = draw({ ...veg, notes: ['eventoBien:oidio'] });
check('resuelto: la semana siguiente se ve más débil (se recupera poco a poco)', /data-recover="1"/.test(rec) && /data-sym="oidio" opacity="0.35"/.test(rec));
for (const L of ['es', 'en', 'de', 'fr']) {
  const caps = Object.keys(H).map((k) => draw(k === 'botrytis' ? ev(k, flor) : ev(k), L).match(/id="jgTentDesc">([^<]*)/)[1]);
  check(`${L.toUpperCase()}: la descripción en texto nombra cada problema y la recuperación`, Object.keys(H).every((k, i) => caps[i].includes(TEXTS[L]['jgTentP_' + k].replace(/[&<>"]/g, '')))
    && draw({ ...veg, notes: ['eventoBien:oidio'] }, L).includes(TEXTS[L].jgTentRec.replace(/’/g, '’')), caps[0]);
}
check('sin «??clave» en ningún idioma', ['es', 'en', 'de', 'fr'].every((L) => Object.keys(H).every((k) => !draw(ev(k), L).includes('??'))));
check('animaciones: ninguna se repite sin fin y ninguna dura más de 5 s', (() => {
  const css = T.CSS;
  if (/infinite/.test(css)) return false;
  const secs = [...css.matchAll(/animation:\w+ ([\d.]+)s/g)].map((x) => +x[1]);
  const delays = [...css.matchAll(/animation-delay:([\d.]+)s/g)].map((x) => +x[1]);
  return secs.length >= 3 && Math.max(...secs) + Math.max(0, ...delays) <= 5;
})());
check('con «reducir movimiento» se apagan todas', /@media \(prefers-reduced-motion:reduce\)\{[^}]*animation:none/.test(T.CSS));

// ------------------------------------------------------------ in the app
console.log('2. En la app');
await sql(`update profiles set subscription_status = 'trialing', trial_ends_at = now() + interval '20 hours', trial_started_at = now() where id = '${NEWBIE}'`);
await sql(`delete from game_progress where user_id = '${NEWBIE}'`);
let b = await browser(NEWBIE, 'aal1', 390);
const open = async () => { await b.send('Page.navigate', { url: 'http://localhost:5174/' }); await sleep(5500); await b.ev(`document.getElementById('ageGateModal').style.display='none'; document.getElementById('mvDevPreview')?.remove(); goMore('juego'); 1`); for (let i = 0; i < 30; i++) { if (await b.ev(`!!document.getElementById('jgBubble')`)) break; await sleep(200); } await sleep(300); };
const svg = () => b.ev(`(() => { const p = document.querySelector('#jgTent .jgt-plant'); return { problem: p?.dataset.problem || null, recover: p?.dataset.recover || null, anim: document.getElementById('jgTent').classList.contains('jgt-anim'), drops: document.querySelectorAll('#jgTent .jgt-drop').length, desc: document.getElementById('jgTentDesc').textContent }; })()`);
await open();
await b.ev(`document.getElementById('jgStart').click(); 1`); await sleep(800);
check('primera semana (sin haber pasado ninguna): sin animación', !(await svg()).anim);
await b.ev(`document.querySelector('label[for="jg-riego-mucho"]').click(); 1`); await sleep(200);
check('elegir una opción no anima nada', !(await svg()).anim);
await b.ev(`document.getElementById('jgNext').click(); 1`); await sleep(400);
let s = await svg();
check('al pasar la semana se anima una vez: la planta crece, caen tres gotas y la luz se apaga y enciende', s.anim && s.drops === 3 && await b.ev(`!!document.querySelector('#jgTent .jgt-night')`));
const longest = await b.ev(`Math.max(...document.getAnimations().map((a) => { const t = a.effect.getComputedTiming(); return (t.delay || 0) + t.activeDuration; }))`);
check(`ninguna animación pasa de 5 s (la más larga: ${Math.round(longest)} ms)`, longest > 0 && longest <= 5000);
await sleep(2600);
check('…y al terminar no queda nada moviéndose', (await b.ev(`document.getAnimations().filter((a) => a.playState === 'running').length`)) === 0);
await b.ev(`document.querySelector('label[for="jg-intensidad-alta"]').click(); 1`); await sleep(200);
check('cambiar una opción después no repite la animación', !(await svg()).anim);
for (let i = 0; i < 3 && !(await b.ev(`!!document.querySelector('.jg-event')`)); i++) { await b.ev(`document.querySelector('label[for="jg-riego-mucho"]').click(); document.getElementById('jgNext').click(); 1`); await sleep(900); }
s = await svg();
check('dos semanas con mucho riego: la planta muestra el exceso de riego y la descripción lo dice', s.problem === 'exceso_riego' && s.desc.includes(TEXTS.es.jgTentP_exceso_riego), JSON.stringify(s));
await b.shot('jgt4-exceso-es-mobile');
await b.ev(`document.querySelector('.jg-answer[data-answer="dejar_secar"]').click(); 1`); await sleep(900);
s = await svg();
check('respuesta correcta: la planta se recupera poco a poco (señales más débiles) y lo dice', s.problem === 'exceso_riego' && s.recover === '1' && s.desc.includes(TEXTS.es.jgTentRec), JSON.stringify(s));
await b.ev(`document.querySelector('label[for="jg-riego-moderado"]').click(); document.getElementById('jgNext').click(); 1`); await sleep(900);
check('una semana después ya no se ve', !(await svg()).problem);
for (const L of ['en', 'de', 'fr']) { await b.ev(`document.querySelector('#langSwitch button[data-lang=${L}]').click(); 1`); await sleep(500); }
await b.ev(`document.querySelector('#langSwitch button[data-lang=es]').click(); 1`); await sleep(400);
check('sin errores de JavaScript', b.events.filter((e) => e.method === 'Runtime.exceptionThrown').length === 0);
await b.close();

// reduce motion
b = await browser(NEWBIE, 'aal1', 390);
await b.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
await open();
await b.ev(`document.getElementById('jgNext').click(); 1`); await sleep(500);
check('«reducir movimiento»: al pasar la semana no se mueve nada (el cambio se ve de golpe)', (await b.ev(`document.getAnimations().length`)) === 0
  && await b.ev(`getComputedStyle(document.querySelector('#jgTent .jgt-night')).display === 'none'`));
await b.close();
summary();
