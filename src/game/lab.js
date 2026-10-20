// Zona del juego — phase 3: the safety lab screen. Downloaded only when the
// person opens the lab (game.js imports it on demand), together with its texts
// and drawings. Same look, access, memory and guide as the rest of the game.
import TEXTS from './i18n-lab.js';
import * as L from './lab-engine.js';

window.mvAddTexts?.(TEXTS);
export const open = L.open;

// The guide's line for the current scene and the last action.
export function guide(state, { t }) {
  const lab = state.lab;
  const out = [];
  for (const n of state.notes || []) {
    const [, kind, scene, opt] = n.split(':');
    if (kind === 'ok') out.push(t(`jl${up(scene)}_x_${L.QUESTIONS[scene].ok}`));
    else if (kind === 'no') out.push(t(`jl${up(scene)}_x_${opt}`));
  }
  if (lab.at === 'intro') return t('jlIntro');
  if (!out.length) out.push(t('jlGuia_' + lab.at));
  return out.join(' ');
}
const up = (s) => s.toUpperCase();

function cards(ids, scene, { t, esc }) {
  return `<div class="jl-cards">${ids.map((id) => `<div class="card-block jl-card"><h4>${esc(t(`jl${up(scene)}_${id}_h`))}</h4><p>${esc(t(`jl${up(scene)}_${id}_p`))}</p></div>`).join('')}</div>`;
}

function question(state, { t, esc }) {
  const at = state.lab.at;
  const q = L.QUESTIONS[at];
  if (!q) return '';
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
  root.querySelectorAll('.jl-answer').forEach((b) => b.addEventListener('click', () => ctx.act(L.answer(state, b.dataset.answer))));
}

export const CSS = `
#juego .jl-eyebrow{margin:0 0 6px}
#juego .jl-h{font-family:'Manrope',sans-serif;font-size:19px;margin:4px 0 12px;color:var(--ink)}
#juego .jl-cards{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));margin-bottom:12px}
#juego .jl-card h4{margin:0 0 6px;font-size:15px;color:var(--ink)}
#juego .jl-card p{margin:0;font-size:14px;line-height:1.55;color:var(--ink)}
#juego .jl-q h3{font-family:'Manrope',sans-serif;font-size:16px;margin:2px 0 10px;color:var(--ink)}
#juego .jl-answer.jl-right{border:2px solid var(--moss);opacity:1}
`;
