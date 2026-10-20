// Zona del juego — phase 3: the safety lab screen. Downloaded only when the
// person opens the lab (game.js imports it on demand), together with its texts
// and drawings. Same look, access, memory and guide as the rest of the game.
import TEXTS from './i18n-lab.js';
import * as L from './lab-engine.js';
import { KITCHEN, LAB } from './lab-art.js';

window.mvAddTexts?.(TEXTS);
export const open = L.open;

// The guide's line for the current scene and the last action.
export function guide(state, { t }) {
  const lab = state.lab;
  const out = [];
  for (const n of state.notes || []) {
    const [, kind, scene, opt] = n.split(':');
    if (kind === 'tap') out.push(t(`${SPOT_KEY[scene]}x_${opt}`));
    else if (kind === 'ok') out.push(t(`jl${up(scene)}_x_${L.QUESTIONS[scene].ok}`));
    else if (kind === 'no') out.push(t(`jl${up(scene)}_x_${opt}`));
  }
  if (lab.at === 'intro') return t('jlIntro');
  if (!out.length) out.push(t('jlGuia_' + lab.at));
  return out.join(' ');
}
const up = (s) => s.toUpperCase();
// text keys of the things to tap: jlK_<id> / jlL_<id> (name) and jlKx_<id> / jlLx_<id> (what the guide says)
const SPOT_KEY = { s2: 'jlK', s3: 'jlL' };
const ART = { s2: KITCHEN, s3: LAB };

// A drawing with buttons on top of each thing (44 px or more, real buttons for
// the keyboard and screen readers). A found thing keeps a mark: ✓ for a hazard,
// – for something that is not one.
function drawing(state, { t, esc }) {
  const at = state.lab.at;
  const art = ART[at];
  const T = L.TAPS[at];
  const k = SPOT_KEY[at];
  const spots = T.all.map((id) => {
    const [x, y] = art.spots[id];
    const found = state.lab.f.includes(id);
    const hazard = T.need.includes(id);
    const name = t(`${k}_${id}`) + (found ? ' — ' + t(hazard ? 'jlEncontrado_' + at : 'jlNoEsPeligro') : '');
    return `<button type="button" class="jl-spot${found ? ' jl-found' + (hazard ? '' : ' jl-decoy') : ''}" data-spot="${id}" style="left:${(x / 360 * 100).toFixed(2)}%;top:${(y / 240 * 100).toFixed(2)}%" aria-label="${esc(name)}" title="${esc(name)}"><span aria-hidden="true">${found ? (hazard ? '✓' : '–') : '?'}</span></button>`;
  }).join('');
  const done = T.need.every((id) => state.lab.f.includes(id));
  const list = T.need.filter((id) => state.lab.f.includes(id)).map((id) => `<li>${esc(t(`${k}_${id}`))}</li>`).join('');
  return `<div class="jl-art">${art.svg}${spots}</div>
    <p class="jl-progress" role="status">${esc(t(done ? 'jlTodos_' + at : 'jlFaltan_' + at))}</p>
    ${list ? `<ul class="jl-list" aria-label="${esc(t('jlEncontradosLbl_' + at))}">${list}</ul>` : ''}`;
}

function cards(ids, scene, { t, esc }) {
  return `<div class="jl-cards">${ids.map((id) => `<div class="card-block jl-card"><h4>${esc(t(`jl${up(scene)}_${id}_h`))}</h4><p>${esc(t(`jl${up(scene)}_${id}_p`))}</p></div>`).join('')}</div>`;
}

function question(state, { t, esc }) {
  const at = state.lab.at;
  const q = L.QUESTIONS[at];
  if (!q || !L.questionOpen(state)) return '';
  const done = state.lab.q.includes(at);
  return `<div class="card-block jl-q" role="group" aria-labelledby="jlQ">
    <h3 id="jlQ">${esc(t(`jl${up(at)}_q`))}</h3>
    <div class="jg-answers">${q.opts.map((o) => `<button type="button" class="btn btn-ghost jl-answer${done && o === q.ok ? ' jl-right' : ''}" data-answer="${o}"${done ? ' disabled' : ''}>${esc(t(`jl${up(at)}_o_${o}`))}</button>`).join('')}</div>
  </div>`;
}

function scene(state, ctx) {
  const { t, esc, lessonBtn } = ctx;
  const at = state.lab.at;
  if (at === 'intro') return `<div class="jg-actions"><button type="button" class="btn btn-primary" id="jlNext">${esc(t('jlEmpezar'))}</button></div>`;
  if (at === 'fin') {
    return `<div class="card-block jg-result">
      <h3>${esc(t('jlFin_t'))}</h3>
      <p>${esc(t('jlFin_p'))}</p>
      <div class="jg-actions"><button type="button" class="btn btn-primary" id="jlClose">${esc(t('jlVolver'))}</button>${lessonBtn('concentrados')}</div>
    </div>`;
  }
  let body = '';
  if (at === 's1') body = cards(['solvente', 'purgar', 'sin'], 's1', ctx) + question(state, ctx);
  if (at === 's2') body = drawing(state, ctx) + question(state, ctx);
  if (at === 's3') body = drawing(state, ctx);
  return `<h3 class="jl-h">${esc(t(`jl${up(at)}_t`))}</h3>
    ${body}
    <div class="jg-actions">
      <button type="button" class="btn btn-primary" id="jlNext"${L.canGoOn(state) ? '' : ' disabled'}>${esc(t('jlSeguir'))}</button>
      <button type="button" class="btn btn-ghost" id="jlClose">${esc(t('jlSalir'))}</button>
    </div>`;
}

export function html(state, ctx) {
  return `<div class="jl" data-scene="${state.lab.at}">
    <p class="eyebrow jl-eyebrow">${ctx.esc(ctx.t('jlTitulo'))}</p>
    ${scene(state, ctx)}
  </div>`;
}

// ctx.act(next, save) — save = false keeps a tap on this device only (the
// next scene change sends everything), so quick taps never hit the save limit.
export function bind(root, state, ctx) {
  root.querySelector('#jlNext')?.addEventListener('click', () => ctx.act(L.next(state)));
  root.querySelector('#jlClose')?.addEventListener('click', () => ctx.act(L.close(state)));
  // a tap stays on this device; it is sent with the next scene
  root.querySelectorAll('.jl-spot').forEach((b) => b.addEventListener('click', () => ctx.act(L.tap(state, b.dataset.spot), false)));
  // a wrong answer changes nothing worth sending on its own (it goes with the next save)
  root.querySelectorAll('.jl-answer').forEach((b) => b.addEventListener('click', () => {
    const n = L.answer(state, b.dataset.answer);
    ctx.act(n, n.lab.q !== state.lab.q);
  }));
}

export const CSS = `
#juego .jl-eyebrow{margin:0 0 6px}
#juego .jl-h{font-family:'Manrope',sans-serif;font-size:19px;margin:4px 0 12px;color:var(--ink)}
#juego .jl-cards{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));margin-bottom:12px}
#juego .jl-card h4{margin:0 0 6px;font-size:15px;color:var(--ink)}
#juego .jl-card p{margin:0;font-size:14px;line-height:1.55;color:var(--ink)}
#juego .jl-q h3{font-family:'Manrope',sans-serif;font-size:16px;margin:2px 0 10px;color:var(--ink)}
#juego .jl-answer.jl-right{border:2px solid var(--moss);opacity:1}
#juego .jl-art{position:relative;max-width:560px;margin:0 auto 10px;aspect-ratio:3/2;border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--paper)}
#juego .jl-art svg{position:absolute;inset:0;width:100%;height:100%;display:block}
#juego .jl-spot{position:absolute;transform:translate(-50%,-50%);width:48px;height:48px;border-radius:50%;border:2px dashed var(--teal);background:transparent;color:var(--ink);cursor:pointer;padding:0}
#juego .jl-spot:hover{background:rgba(95,212,224,.12)}
#juego .jl-spot span{position:absolute;top:-7px;right:-7px;width:20px;height:20px;border-radius:50%;background:var(--paper-raised);border:1.5px solid var(--teal);font:700 12px/17px 'Manrope',sans-serif;text-align:center}
#juego .jl-spot:focus-visible{outline:3px solid var(--teal);outline-offset:2px}
#juego .jl-spot.jl-found{border:2px solid var(--moss);color:var(--moss)}
#juego .jl-spot.jl-found span{border-color:var(--moss)}
#juego .jl-spot.jl-decoy,#juego .jl-spot.jl-decoy span{border-color:var(--ink-soft);color:var(--ink-soft)}
#juego .jl-progress{font-weight:600;color:var(--ink);margin:4px 0 6px}
#juego .jl-list{margin:0 0 12px;padding-left:20px;color:var(--ink);font-size:14px;line-height:1.6}
`;
