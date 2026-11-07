// Shared helpers for the full-run game tests (game-full-*.mjs): open the game
// as a person with access, play it by touching the screen (labels and buttons,
// never the engine), and check every screen the same way (audit):
// - no disabled control without the explanation on screen (#jgBloqueo),
// - always a way forward (an enabled button besides back / why / lesson),
// - no JavaScript error or console error,
// - every visible «¿Por qué?» opens, with its reason and its backing level,
// - no untranslated key (jg… / jl…), no sideways overflow.
// The database is the local copy of staging (fakeserver.mjs: PGlite with the
// same migrations, game_save and game_state_valid included).
import fs from 'fs';
import { check, sleep, sql, browser } from './browser.mjs';
import * as E from '../../src/game/engine.js';

const APP = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
export const RULES = JSON.parse(fs.readFileSync(APP + '/src/game/rules.json', 'utf8'));
export const TEXTS = (await import('file:///' + APP + '/src/game/i18n.js')).default;
export { E };
export const USER = 'b0000003-0000-4000-8000-000000000000';
export const LANGS = ['es', 'en', 'de', 'fr'];
export const issues = []; // every problem found, for the report

export const IDEAL = (st) => Object.fromEntries(E.DECISIONS.map((d) => [d, [].concat(RULES.etapas[st].ideal[d]?.valor ?? RULES.opciones[d][1])[0]]));
export const POST_IDEAL = (st) => Object.fromEntries(Object.entries(RULES.post[st].decisiones).map(([d, v]) => [d, [].concat(v.ideal.valor ?? v.opciones[0])[0]]));
export const NEUTRAL = { carpa: 'mediana', luz: 'led', sistema: 'maceta', sustrato: 'tierra', maceta: 'plastico', maceta_tam: 'grande', riego_tipo: 'mano', medir: 'si' };
export const GERM_OK = { metodo: 'taco', temperatura: 'templada', humedad: 'humedo' };

export const gs = (b) => b.ev(`window.mvGameDebug?.state ? JSON.parse(JSON.stringify(window.mvGameDebug.state)) : null`);
const waitFor = async (b, js, ms = 6000) => { for (let i = 0; i < ms / 100; i++) { if (await b.ev(js)) return true; await sleep(100); } return false; };

async function access() {
  await sql(`update profiles set subscription_status = 'trialing', trial_ends_at = now() + interval '20 hours', trial_started_at = now() where id = '${USER}'`);
}
// a fresh browser on the game; state = a saved game in the account (or none)
export async function session(w = 390, state = null) {
  await access();
  await sql(`delete from game_progress where user_id = '${USER}'`);
  if (state) await sql(`insert into game_progress (user_id, state, seq) values ('${USER}', '${JSON.stringify(state).replace(/'/g, "''")}'::jsonb, ${state.seq})`);
  const b = await browser(USER, 'aal1', w);
  b.w = w; b.seen = 0;
  await b.send('Page.navigate', { url: 'http://localhost:5174/' });
  await enter(b);
  return b;
}
export async function enter(b) {
  await waitFor(b, `!!window.goMore && !!document.getElementById('ageGateModal')`, 15000);
  await sleep(1500);
  await b.ev(`document.getElementById('ageGateModal').style.display='none'; document.getElementById('mvDevPreview')?.remove(); goMore('juego'); 1`);
  await waitFor(b, `!!document.getElementById('jgBubble') || !!document.querySelector('#juego .jl')`, 15000);
  await sleep(300);
}
// close and open again in the same browser (the copy on this device + the account)
export async function reload(b) {
  await b.send('Page.reload', {});
  await sleep(500);
  await enter(b);
}
// let the account catch up (the server allows 20 saves a minute; the game
// retries on its own after a minute — here the window is reset instead of waiting)
export async function synced(b, ms = 15000) {
  for (let i = 0; i < ms / 300; i++) {
    const s = await gs(b);
    const r = (await sql(`select seq from game_progress where user_id = '${USER}'`))[0];
    if (s && r && r.seq === s.seq) return true;
    if (i % 10 === 5) { await sql(`update game_progress set saves_in_window = 0, window_start = now() - interval '2 minutes' where user_id = '${USER}'`); await b.ev(`window.dispatchEvent(new Event('online')); 1`); }
    await sleep(300);
  }
  return false;
}
export async function width(b, w) {
  b.w = w;
  await b.send('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile: w < 600 });
  await sleep(300);
}
export async function lang(b, L) { await b.ev(`document.querySelector('#langSwitch button[data-lang=${L}]').click(); 1`); await sleep(450); }

// ---------------------------------------------------------------- playing by touch
const clickAll = (b, ids) => b.ev(`(() => { const miss = []; for (const id of ${JSON.stringify(ids)}) { const l = document.querySelector('label[for="' + id + '"]'); if (l) l.click(); else miss.push(id); } return miss; })()`);
export async function click(b, sel) {
  const ok = await b.ev(`(() => { const x = document.querySelector(${JSON.stringify(sel)}); if (!x || x.disabled) return false; x.click(); return true; })()`);
  await sleep(250);
  return ok;
}
export async function setup(b, vals) {
  // the system first: it decides which other questions are shown
  const order = ['sistema', ...Object.keys(vals).filter((k) => k !== 'sistema')];
  for (const d of order) if (vals[d]) await clickAll(b, [`jgSetupForm-${d}-${vals[d]}`]);
  return click(b, '#jgSetupGo');
}
export async function germ(b, vals) {
  for (const d of ['metodo', ...Object.keys(vals).filter((k) => k !== 'metodo')]) await clickAll(b, [`jgGermForm-${d}-${vals[d]}`]);
  return click(b, '#jgGermGo');
}
// one week: pick each decision shown (the fixed ones are not on screen)
export async function week(b, choices) {
  await clickAll(b, Object.entries(choices).map(([d, o]) => `jg-${d}-${o.replace('/', '-')}`).filter(Boolean));
  return click(b, '#jgNext');
}
export const answer = (b, a) => click(b, `.jg-answer[data-answer="${a}"]`);
// a post-harvest screen: first the choices that redraw the form (method), then the rest
export async function post(b, stage, vals) {
  const first = ['partida', 'separacion'].filter((k) => k in vals);
  for (const d of [...first, ...Object.keys(vals).filter((k) => !first.includes(k))]) await clickAll(b, [`jgp-${stage}-${d}-${vals[d]}`]);
  return click(b, '#jgPostNext');
}
// the decisions the post screen shows right now
export const postShown = (b) => b.ev(`[...document.querySelectorAll('#jgPostForm fieldset')].map((f) => f.querySelector('input').name.slice(4))`);
export const options = (b, d) => b.ev(`[...document.querySelectorAll('input[name="jgp-${d}"]')].map((i) => i.value)`);

// ---------------------------------------------------------------- the audit
// quiet = only return the problems (for the control that plants faults on purpose)
export async function audit(b, label, { langs = false, why = true, quiet = false } = {}) {
  const probs = [];
  const look = await b.ev(`(() => {
    const root = document.getElementById('juego');
    if (!root || !root.classList.contains('active') && document.querySelector('.screen.active')?.id !== 'juego') return { gone: true };
    const vis = (e) => !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length);
    const keys = (root.innerText.match(/\\b(jg|jl|jgt)[A-Z][A-Za-z_]*|\\?\\?jg\\w*/g) || []);
    const dis = [...root.querySelectorAll('button:disabled, input:disabled')].filter((e) => vis(e) || (e.type === 'radio' && vis(e.closest('fieldset'))));
    const explained = !dis.length || !!document.getElementById('jgBloqueo') || dis.every((e) => e.getAttribute('aria-describedby') && document.getElementById(e.getAttribute('aria-describedby')));
    const skip = (x) => x.id === 'jgBack' || x.classList.contains('jg-why') || x.classList.contains('jg-lesson') || x.classList.contains('jgt-obj') || x.closest('#langSwitch') || x.id === 'jgtClose';
    const acts = [...root.querySelectorAll('button')].filter((x) => vis(x) && !x.disabled && !skip(x));
    return { keys, dis: dis.map((e) => e.id || e.name), explained, acts: acts.map((x) => x.id || x.dataset.answer || x.className).slice(0, 8),
      over: document.documentElement.scrollWidth > innerWidth + 1, back: !!(document.getElementById('jgBack') || root.querySelector('.jl-back, [data-lab-exit], #jlSalir, #jlBack')) };
  })()`);
  if (look.gone) probs.push('la pantalla del juego no está activa');
  else {
    if (look.keys.length) probs.push('textos sin traducir: ' + [...new Set(look.keys)].join(','));
    if (!look.explained) probs.push('controles bloqueados sin explicación: ' + look.dis.join(','));
    if (!look.acts.length) probs.push('pantalla sin salida (ningún botón para seguir)');
    if (look.over) probs.push('desborde lateral a ' + b.w + ' px');
  }
  // console: exceptions and console.error since the last audit
  const evs = b.events.slice(b.seen); b.seen = b.events.length;
  const errs = evs.filter((e) => e.method === 'Runtime.exceptionThrown' || (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error'))
    .map((e) => e.params.exceptionDetails?.exception?.description?.split('\n')[0] || e.params.exceptionDetails?.text || e.params.args?.map((a) => a.value ?? a.description).join(' '));
  if (errs.length) probs.push('errores en la consola: ' + errs.join(' | ').slice(0, 300));
  if (why && !look.gone) {
    const w = await b.ev(`(() => { const bad = []; let n = 0;
      for (const btn of [...document.querySelectorAll('#juego .jg-why')]) {
        if (!(btn.offsetWidth || btn.offsetHeight)) continue;
        const p = btn.closest('.jg-whys').querySelector('.jg-why-panel');
        if (btn.getAttribute('aria-expanded') === 'true') btn.click();
        btn.click(); n++;
        const lvl = p.querySelector('.jg-why-level')?.textContent.trim() || '', txt = p.querySelector('.jg-why-text')?.textContent.trim() || '';
        if (p.hidden || !lvl || !txt || /\\bjg[A-Z]/.test(p.innerText)) bad.push(btn.dataset.why);
        btn.click();
      }
      return { n, bad }; })()`);
    if (w.bad.length) probs.push('«¿Por qué?» sin razón o sin respaldo: ' + w.bad.join(','));
    look.whys = w.n;
  }
  if (langs && !look.gone) {
    for (const L of ['en', 'de', 'fr']) {
      await lang(b, L);
      const r = await b.ev(`(() => { const t = document.getElementById('juego').innerText; return { keys: t.match(/\\b(jg|jl|jgt)[A-Z][A-Za-z_]*|\\?\\?jg\\w*/g) || [], title: document.querySelector('#juego .jg-title, #juego h2')?.textContent || '', over: document.documentElement.scrollWidth > innerWidth + 1 }; })()`);
      if (r.keys.length) probs.push(`${L}: textos sin traducir: ${[...new Set(r.keys)].join(',')}`);
      if (TEXTS[L].jgTitle && !r.title.includes(TEXTS[L].jgTitle) && !(await b.ev(`!!document.querySelector('#juego .jl')`))) probs.push(`${L}: el título no cambió de idioma`);
      if (r.over) probs.push(`${L}: desborde lateral`);
    }
    await lang(b, 'es');
    const evs2 = b.events.slice(b.seen); b.seen = b.events.length;
    if (evs2.some((e) => e.method === 'Runtime.exceptionThrown')) probs.push('error de JavaScript al cambiar de idioma');
  }
  if (quiet) return probs;
  for (const p of probs) issues.push(`${label}: ${p}`);
  check(`${label}${look.whys ? ` (${look.whys} «¿Por qué?»)` : ''}`, probs.length === 0, probs.join(' · '));
  return probs;
}

// a screenshot on the phone and on the computer
export async function shots(b, name) {
  const w0 = b.w;
  await width(b, 390); await b.shot(`${name}-mobile`);
  const o1 = await b.ev(`document.documentElement.scrollWidth > innerWidth + 1`);
  await width(b, 1280); await b.shot(`${name}-desktop`);
  const o2 = await b.ev(`document.documentElement.scrollWidth > innerWidth + 1`);
  await width(b, w0);
  if (o1 || o2) issues.push(`${name}: desborde lateral (${o1 ? 'celular' : ''} ${o2 ? 'escritorio' : ''})`);
  check(`${name}: capturas celular y escritorio sin desborde`, !o1 && !o2);
}

// play the weeks by touch with the ideal choices (answering any problem well)
export async function growToHarvest(b, { flipAt = 4, harvestAt = 9, extra = {} } = {}) {
  for (let i = 0; i < 40; i++) {
    const s = await gs(b);
    if (!s || !['plantula', 'vegetativo', 'floracion'].includes(s.stage)) return s;
    if (s.event && !s.event.answered) { await answer(b, RULES.eventos.lista[s.event.id].respuesta_correcta); continue; }
    if (s.stage === 'floracion' && s.stageWeek >= harvestAt) { await click(b, '#jgHarvest'); continue; }
    const c = { ...IDEAL(s.stage), ...(extra[s.stage] || {}) };
    if (s.stage === 'vegetativo') c.fotoperiodo = s.stageWeek >= flipAt ? '12/12' : '18/6';
    if (s.setup?.maceta_tam === 'pequena' && s.setup.trasplante !== 'si') await click(b, '#jgTrasplante');
    if (!(await week(b, c))) { issues.push(`no se pudo pasar la semana en ${s.stage} ${s.stageWeek}`); return gs(b); }
  }
  return gs(b);
}

// engine-built saved games (to start a test in the middle, like a saved game)
export function harvestedGame(setup = NEUTRAL) {
  let s = E.applyGerm(E.start(E.setSetup(E.newGame(), setup, RULES)), GERM_OK, RULES);
  for (let i = 0; i < 40 && s.stage !== 'secado'; i++) {
    if (s.stage === 'floracion' && s.stageWeek >= 9) { s = E.harvest(s, RULES); break; }
    const c = { ...IDEAL(s.stage) };
    if (s.stage === 'vegetativo') c.fotoperiodo = s.stageWeek >= 4 ? '12/12' : '18/6';
    s = E.applyWeek(s, c, RULES);
  }
  return s;
}
export function gameAt(stage, stageWeek = 1, setup = NEUTRAL, flipAt = 4) {
  let s = E.applyGerm(E.start(E.setSetup(E.newGame(), setup, RULES)), GERM_OK, RULES);
  for (let i = 0; i < 40 && !(s.stage === stage && s.stageWeek >= stageWeek); i++) {
    const c = { ...IDEAL(s.stage) };
    if (s.stage === 'vegetativo') c.fotoperiodo = s.stageWeek >= flipAt && stage === 'floracion' ? '12/12' : '18/6';
    s = E.applyWeek(s, c, RULES);
  }
  return s;
}
export function report(name) {
  console.log(`\n${name} — problemas encontrados: ${issues.length}`);
  for (const i of issues) console.log('  · ' + i);
}
