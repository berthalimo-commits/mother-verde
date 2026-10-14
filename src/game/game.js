// Zona del juego — the screen (downloaded only when someone opens the game).
// Texts: the platform's translations + t() (registered from i18n.js).
// Access: the screen is only reachable with access (showScreen sends locked
// accounts to the lock screen); the server refuses saves without access too.
// Memory: a copy in this browser (per account) and the account row
// (game_progress via game_save). The newest one wins (step counter "seq"),
// so nothing is repeated and another device never overwrites newer progress.
import RULES from './rules.json';
import TEXTS from './i18n.js';
import * as E from './engine.js';

window.mvAddTexts?.(TEXTS);
const t = (k) => (window.t ? window.t(k) : k);
const fmt = (s, o) => String(s).replace(/\{(\w+)\}/g, (_, k) => (o[k] ?? ''));
const esc = (x) => String(x).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let state = null;
let loadedFor = null;
let sync = '';
let pending = false;
let loading = null;
let feedback = []; // notes of the last action, shown by the guide

// ---------------------------------------------------------------- memory
function who() {
  const uid = window.mvCurrentUser?.id || null;
  const preview = !uid && !!window.mvIsPreviewSignedIn?.();
  return { uid, preview, key: 'mv-game:' + (uid || 'preview') };
}
function readLocal(key) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}
function writeLocal(key, s, isPending) {
  try { localStorage.setItem(key, JSON.stringify({ state: s, pending: isPending })); } catch (e) {}
}

async function load() {
  const w = who();
  const local = readLocal(w.key);
  let server = null;
  const sb = window.mvSupabase;
  if (w.uid && sb) {
    const { data, error } = await sb.from('game_progress').select('state, seq').eq('user_id', w.uid).maybeSingle();
    if (!error && data) server = data.state;
  }
  const ls = local?.state || null;
  if (ls && (!server || ls.seq > server.seq)) {
    state = ls;
    pending = !!local.pending || !!server;
    if (w.uid && pending) persist(state); // the device was ahead (e.g. offline): send it
  } else {
    state = server || E.newGame();
    pending = false;
    writeLocal(w.key, state, false);
  }
  sync = w.preview ? 'preview' : '';
  loadedFor = w.uid || (w.preview ? 'preview' : null);
}

async function persist(s) {
  const w = who();
  writeLocal(w.key, s, true);
  pending = true;
  if (w.preview) { sync = 'preview'; return paintSync(); }
  const sb = window.mvSupabase;
  if (!w.uid || !sb) { sync = 'local'; return paintSync(); }
  let res;
  try { res = await sb.rpc('game_save', { p_state: s }); } catch (e) { res = { error: e }; }
  const { data, error } = res;
  if (error) {
    const m = String(error.message || '');
    sync = m.includes('rate_limited') ? 'lento' : m.includes('no_access') ? 'err' : 'local';
    if (m.includes('no_access')) window.mvRefreshAuth?.(); // access ended: the app locks with the usual screen
    if (sync === 'lento') setTimeout(() => pending && persist(state), 61000);
    return paintSync();
  }
  if (data?.ok) { pending = false; writeLocal(w.key, s, false); sync = 'ok'; return paintSync(); }
  if (data?.stale) {
    state = data.state; pending = false; writeLocal(w.key, state, false); sync = 'stale'; feedback = [];
    const root = document.getElementById('juegoRoot');
    if (root) paint(root);
  }
}
window.addEventListener('online', () => { if (pending && state) persist(state); });

// ---------------------------------------------------------------- actions
function act(next) {
  state = next;
  feedback = next.notes || [];
  persist(state);
  const root = document.getElementById('juegoRoot');
  paint(root);
  root.querySelector('#jgBubble')?.focus();
}

// ---------------------------------------------------------------- view
const SCIENTIST = '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">'
  // the same drawing as the mini scientist that flies across the platform (main.js)
  + '<ellipse cx="10" cy="46" rx="7" ry="3" fill="var(--moss-deep)" opacity="0.35"/>'
  + '<ellipse cx="18" cy="40" rx="5" ry="2.4" fill="var(--moss-deep)" opacity="0.5"/>'
  + '<path d="M26 24 Q34 20 40 30 Q42 40 34 48 Q26 52 20 46 Q16 36 26 24 Z" fill="var(--moss)" opacity="0.92"/>'
  + '<path d="M26 24 Q34 20 40 30 Q42 40 34 48" fill="none" stroke="var(--moss-deep)" stroke-width="1.2" opacity="0.6"/>'
  + '<circle cx="40" cy="24" r="9" fill="var(--paper-raised)" stroke="var(--line-strong)" stroke-width="1"/>'
  + '<circle cx="37" cy="23" r="2.6" fill="var(--teal)" opacity="0.9"/>'
  + '<circle cx="43" cy="23" r="2.6" fill="var(--teal)" opacity="0.9"/>'
  + '<path d="M35 20 Q40 17 45 20" fill="none" stroke="var(--ink-soft)" stroke-width="1"/>'
  + '<path d="M32 30 Q40 34 48 28" fill="none" stroke="var(--ink)" stroke-width="2" stroke-linecap="round"/>'
  + '</svg>';
const TRICH_KEY = { transparentes: 'trClearLabel', lechosas: 'trMilkyLabel', mezcla: 'trMixLabel', ambar: 'trAmberLabel' };
const LESSON_KEY = { propagacion: 'subPropagacion', sistemas: 'subSistemas', iluminacion: 'subIluminacion', cosecha: 'subCosecha',
  diagnostico: 'subDiagnostico', sustrato: 'subSustrato', ciclo: 'subCiclo' };

function lessonBtn(lesson) {
  return `<button type="button" class="btn btn-ghost jg-lesson" data-lesson="${esc(lesson)}">${esc(fmt(t('jgLeccion'), { l: t(LESSON_KEY[lesson]) }))}</button>`;
}

function guideText() {
  const out = [];
  for (const n of feedback) {
    const [kind, arg] = n.split(':');
    if (kind === 'guia' || kind === 'evento') continue;
    if (kind === 'semanaMal') {
      const lost = state.log.at(-1)?.l || {};
      out.push(fmt(t('jgFb_semanaMal'), { lista: Object.keys(lost).map((k) => t('jgCausa_' + k)).join(', ') }));
    } else if (kind === 'sinDato') out.push(fmt(t('jgFb_sinDato'), { d: t('jgD_' + arg).toLowerCase() }));
    else if (kind === 'eventoBien') out.push(fmt(t('jgEvBien'), { x: t('jgEvX_' + arg) }));
    else if (kind === 'eventoMal') out.push(t('jgEvMal'));
    else out.push(t('jgFb_' + n));
  }
  if (state.stage === 'intro') return t('jgIntro');
  if (['plantula', 'vegetativo', 'floracion'].includes(state.stage)) out.push(t('jgGuia_' + state.stage));
  return out.filter(Boolean).join(' ');
}

function statusHtml() {
  if (!['plantula', 'vegetativo', 'floracion'].includes(state.stage)) return '';
  const h = state.health;
  return `<div class="card-block jg-status">
    <dl>
      <div><dt>${t('jgEtapa_' + state.stage)}</dt><dd>${esc(fmt(t('jgSemana'), { n: state.week }))} · ${esc(fmt(t('jgSemanaEtapa'), { n: state.stageWeek }))}</dd></div>
      <div><dt id="jgSaludLbl">${t('jgSalud')}</dt><dd><meter id="jgSalud" min="0" max="100" low="40" high="70" optimum="100" value="${h}" aria-labelledby="jgSaludLbl">${h}</meter> <b>${h}/100</b></dd></div>
      ${state.stage === 'floracion' ? `<div><dt>${t('jgTricomas')}</dt><dd id="jgTrich">${t(TRICH_KEY[E.trichomes(state.stageWeek, RULES)])}</dd></div>` : ''}
    </dl>
  </div>`;
}

function eventHtml() {
  const ev = state.event;
  if (!ev || ev.answered) return '';
  const answers = [RULES.eventos.lista[ev.id].respuesta_correcta, ...RULES.eventos.respuestas.filter((r) => r !== RULES.eventos.lista[ev.id].respuesta_correcta)];
  // stable order (no randomness): rotate by the event so the right answer isn't always first
  const k = Object.keys(RULES.eventos.lista).indexOf(ev.id) % 4;
  const four = answers.slice(0, 4);
  const shown = [...four.slice(k), ...four.slice(0, k)];
  return `<div class="card-block jg-event" role="group" aria-labelledby="jgEvH">
    <h3 id="jgEvH">${t('jgEvTitulo')}: ${t('jgEvN_' + ev.id)}</h3>
    <p>${t('jgEvS_' + ev.id)}</p>
    <p><b>${t('jgEvPregunta')}</b></p>
    <div class="jg-answers">${shown.map((a) => `<button type="button" class="btn btn-ghost jg-answer" data-answer="${a}">${t('jgR_' + a)}</button>`).join('')}</div>
    ${lessonBtn('diagnostico')}
  </div>`;
}

function decisionsHtml() {
  const playable = ['plantula', 'vegetativo', 'floracion'].includes(state.stage);
  if (!playable) return '';
  const blocked = state.event && !state.event.answered;
  const ch = E.defaultChoices(state, RULES);
  const fields = E.DECISIONS.map((d) => `<fieldset class="jg-field">
      <legend>${t('jgD_' + d)}</legend>
      <div class="jg-opts">${RULES.opciones[d].map((o) => {
        const id = `jg-${d}-${o.replace('/', '-')}`;
        return `<input type="radio" name="jg-${d}" id="${id}" value="${o}"${ch[d] === o ? ' checked' : ''}${blocked ? ' disabled' : ''}>
          <label for="${id}"><span>${t(`jgO_${d}_${o}`)}</span><small>${t(`jgH_${d}_${o}`)}</small></label>`;
      }).join('')}</div>
    </fieldset>`).join('');
  return `<form class="jg-form" id="jgForm" novalidate>
    <h3>${t('jgDecide')}</h3>
    ${fields}
    <div class="jg-actions">
      <button type="submit" class="btn btn-primary" id="jgNext"${blocked ? ' disabled' : ''}>${t('jgPasarSemana')}</button>
      ${state.stage === 'floracion' ? `<button type="button" class="btn btn-ghost" id="jgHarvest">${t('jgCosechar')}</button>` : ''}
      ${lessonBtn(E.LESSON[state.stage])}
    </div>
  </form>`;
}

function resultHtml() {
  if (state.stage !== 'fin' || !state.result) return '';
  const r = state.result;
  const causes = r.causes || [];
  return `<div class="card-block jg-result">
    <h3>${t('jgFinTitulo')}</h3>
    ${r.dead ? `<p class="jg-big">${t('jgFinMuerta')}</p>` : `<p class="jg-big">${esc(fmt(t('jgFinPuntos'), { n: r.score }))}</p>
      <p>${esc(fmt(t('jgFinSalud'), { h: r.health }))}</p>
      <p>${esc(fmt(t('jgFinTricomas'), { t: t(TRICH_KEY[r.trich]) }))}</p>`}
    <p><b>${t('jgFinCausas')}</b> ${causes.length ? causes.map((c) => t('jgCausa_' + c)).join(', ') : t('jgFinNada')}</p>
    ${causes.length ? `<p><b>${t('jgFinRepasar')}</b></p><div class="jg-actions">${[...new Set(causes.map((c) => E.LESSON[c]))].map(lessonBtn).join('')}</div>` : ''}
    <div class="jg-actions"><button type="button" class="btn btn-primary" id="jgAgain">${t('jgPlantarOtra')}</button>${r.dead ? '' : lessonBtn('cosecha')}</div>
  </div>`;
}

function syncText() {
  return { ok: 'jgSync_ok', local: 'jgSync_local', stale: 'jgSync_stale', preview: 'jgSync_preview', lento: 'jgSync_lento', err: 'jgErrGuardar' }[sync];
}
function paintSync() {
  const el = document.getElementById('jgSync');
  if (el) el.textContent = sync ? t(syncText()) : '';
}

function paint(root) {
  root.innerHTML = `<div class="jg">
    <button type="button" class="detail-back jg-back" id="jgBack">${t('jgVolverInicio')}</button>
    <div class="eyebrow">${t('jgEyebrow')}</div>
    <h2 id="jgH1" class="jg-title">${t('jgTitle')}</h2>
    <ul class="jg-badges" aria-label="${esc(t('jgAvisoSim'))}">
      <li>${t('jgAvisoSim')}</li><li>${t('jgAviso18')}</li><li>${t('jgSinDinero')}</li>
    </ul>
    <div class="jg-guide">
      <div class="jg-sci">${SCIENTIST}</div>
      <p class="jg-bubble" id="jgBubble" tabindex="-1" role="status">${esc(guideText())}</p>
    </div>
    ${state.stage === 'intro' ? `<div class="jg-actions"><button type="button" class="btn btn-primary" id="jgStart">${t('jgEmpezar')}</button></div>` : ''}
    ${statusHtml()}
    ${eventHtml()}
    ${decisionsHtml()}
    ${resultHtml()}
    <p class="jg-sync" id="jgSync" role="status"></p>
  </div>`;
  paintSync();
  root.querySelector('#jgBack').addEventListener('click', () => window.showScreen?.('home'));
  root.querySelector('#jgStart')?.addEventListener('click', () => act(E.start(state)));
  root.querySelector('#jgForm')?.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const choices = Object.fromEntries(E.DECISIONS.map((d) => [d, fd.get('jg-' + d)]));
    act(E.applyWeek(state, choices, RULES));
  });
  root.querySelector('#jgHarvest')?.addEventListener('click', () => act(E.harvest(state, RULES)));
  root.querySelectorAll('.jg-answer').forEach((b) => b.addEventListener('click', () => act(E.answerEvent(state, b.dataset.answer, RULES))));
  root.querySelector('#jgAgain')?.addEventListener('click', () => act(E.newGame(state)));
  root.querySelectorAll('.jg-lesson').forEach((b) => b.addEventListener('click', () => {
    const l = b.dataset.lesson;
    state = E.markLesson(state, l);
    writeLocal(who().key, state, pending);
    window.showScreen?.('cultivo');
    window.showSub?.('cultivo', l);
  }));
}

const CSS = `
#juego .jg{max-width:760px}
#juego .jg-back{background:none;border:0;padding:0;min-height:44px;cursor:pointer;color:var(--ink-soft);font:inherit}
#juego .jg-title{font-family:'Manrope',sans-serif;font-size:clamp(24px,5vw,34px);font-weight:600;line-height:1.15;margin:10px 0 12px;color:var(--ink)}
#juego .jg-badges{list-style:none;padding:0;margin:0 0 18px;display:flex;flex-wrap:wrap;gap:8px}
#juego .jg-badges li{font-size:12.5px;line-height:1.5;color:var(--ink);background:var(--paper-raised);border:1px solid var(--resin);border-radius:6px;padding:6px 10px}
#juego .jg-guide{display:flex;gap:12px;align-items:flex-start;margin-bottom:16px}
#juego .jg-sci{flex:0 0 72px;width:72px;height:72px}
#juego .jg-sci svg{width:100%;height:100%;display:block}
#juego .jg-bubble{flex:1;margin:0;background:var(--paper-raised);border:1px solid var(--glow-border);border-radius:12px;padding:12px 14px;font-size:14px;line-height:1.6;color:var(--ink)}
#juego .jg-bubble:focus{outline:2px solid var(--moss);outline-offset:2px}
#juego .jg-status dl{display:grid;gap:10px;margin:0}
#juego .jg-status dl div{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between}
#juego .jg-status dt{font-weight:600;color:var(--ink)}
#juego .jg-status dd{margin:0;color:var(--ink-soft)}
#juego meter{width:140px;height:14px}
#juego .jg-form h3,#juego .jg-event h3,#juego .jg-result h3{font-family:'Manrope',sans-serif;font-size:17px;margin:4px 0 12px;color:var(--ink)}
#juego .jg-field{border:1px solid var(--line);border-radius:8px;padding:10px 12px 12px;margin:0 0 12px}
#juego .jg-field legend{padding:0 6px;font-weight:600;color:var(--ink);font-size:14px}
#juego .jg-opts{display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:8px}
#juego .jg-opts input{position:absolute;opacity:0;width:1px;height:1px}
#juego .jg-opts label{display:flex;flex-direction:column;justify-content:center;min-height:44px;padding:8px 12px;border:1px solid var(--line-strong);border-radius:8px;cursor:pointer;color:var(--ink);background:var(--paper)}
#juego .jg-opts label small{color:var(--ink-soft);font-size:12px;margin-top:2px}
#juego .jg-opts input:checked + label{border:2px solid var(--moss);background:var(--paper-raised);box-shadow:inset 4px 0 0 var(--moss)}
#juego .jg-opts input:focus-visible + label{outline:2px solid var(--teal);outline-offset:2px}
#juego .jg-opts input:disabled + label{opacity:.55;cursor:not-allowed}
#juego .jg-actions{display:flex;flex-wrap:wrap;gap:10px;margin:12px 0}
#juego .jg-actions .btn,#juego .jg-answers .btn{min-height:44px}
#juego .btn:focus-visible{outline:2px solid var(--teal);outline-offset:2px}
#juego .btn:disabled{opacity:.55;cursor:not-allowed}
#juego .jg-answers{display:grid;gap:8px;margin:8px 0 12px}
#juego .jg-answers .btn{text-align:left}
#juego .jg-event{border-color:var(--resin)}
#juego .jg-big{font-size:22px;font-weight:700;color:var(--ink)}
#juego .jg-sync{font-size:12.5px;color:var(--ink-soft);min-height:1.5em}
`;

export async function render(root) {
  if (!document.getElementById('jgStyle')) {
    const st = document.createElement('style'); st.id = 'jgStyle'; st.textContent = CSS; document.head.appendChild(st);
  }
  const w = who();
  const owner = w.uid || (w.preview ? 'preview' : null);
  if (!state || loadedFor !== owner) {
    root.innerHTML = `<p class="subhead" role="status">${t('jgCargandoProgreso')}</p>`;
    loading = loading || load().finally(() => { loading = null; });
    await loading;
  }
  paint(root);
}
// For the dev preview and the tests: forget what is in memory (not the saves).
export function _reset() { state = null; loadedFor = null; feedback = []; sync = ''; }
window.mvGameDebug = { get state() { return state; }, reset: _reset };
