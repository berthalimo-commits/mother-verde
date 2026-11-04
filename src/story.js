// «Nuestra historia» — the welcome story (Bertha's texts, 2026-11-03).
// Shown ONCE, right after the age confirmation (main.js ageGateConfirm calls
// window.mvMaybeOpenStory), and any time from «Más ▾ → Nuestra historia» or
// the footer (window.mvOpenStory). 6 screens: swipe on phones (scroll-snap),
// «Continuar» / «Atrás» / arrow keys elsewhere; «Saltar e ir a la plataforma»
// always visible; Esc = skip. A real dialog: focus stays inside, the screen
// reader hears «Pantalla n de 6» and each heading; with «reduce motion» the
// screens change without animation.
// Photos: one per screen, set in src/storyPhotos.js; files built by
// tools/historia-fotos.mjs (4:5, compressed, no metadata). If a file is
// missing the frame shows «Foto próximamente» with the alt text.
const t = (k) => (window.t ? window.t(k) : k);
const SEEN = 'mv-story-seen';
import { STORY_PHOTOS } from './storyPhotos.js';
const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const TOTAL = 6;

// One photo per screen, from src/storyPhotos.js (the only place to change one).
// Shown whole (4:5), never cropped by CSS. Only screen 1 loads right away.
function photoHtml(n) {
  const p = STORY_PHOTOS[n];
  if (!p) return '';
  return `<figure class="story-photo">
      <img src="/historia/${p.file}" alt="${t(p.alt)}" width="800" height="1000" ${n === 1 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"
        onerror="this.hidden=true; this.nextElementSibling.hidden=false;">
      <div class="story-photo-soon" hidden><span>${t('storyPhotoSoon')}</span><small>${t(p.alt)}</small></div>
    </figure>`;
}

function bodyHtml(n) {
  if (n === 5) {
    const items = [
      ['🧮', t('story5Calc')], ['🧭', t('story5Viaje')],
      ['🌱', t('story5Juego')], ['💬', t('story5Comunidad')],
    ];
    return `<ul class="story-list">${items.map(([i, s]) => `<li><span class="story-ico" aria-hidden="true">${i}</span><span>${s}</span></li>`).join('')}</ul>`;
  }
  return t('story' + n + 'P');
}

function slideHtml(n) {
  return `<section class="story-slide" id="storySlide${n}" data-n="${n}" aria-labelledby="storyH${n}" aria-roledescription="slide">
      ${photoHtml(n)}
      <div class="story-text">
        <h2 id="storyH${n}" tabindex="-1">${t('story' + n + 'H')}</h2>
        ${bodyHtml(n)}
        ${n === TOTAL ? `<p class="story-independent">${t('storyIndependent')}</p>` : ''}
      </div>
    </section>`;
}

let current = 1, lastFocus = null, root = null, resizeObs = null;

function update(focusHeading) {
  if (!root) return;
  root.querySelectorAll('.story-dot').forEach((d) => d.setAttribute('aria-current', String(Number(d.dataset.n) === current)));
  root.querySelector('#storyStep').textContent = t('storyStep').replace('{n}', current).replace('{total}', TOTAL);
  root.querySelector('#storyBack').hidden = current === 1;
  root.querySelector('#storyNext').textContent = t(current === TOTAL ? 'storyEnter' : 'storyNext');
  root.querySelectorAll('.story-slide').forEach((s) => { s.setAttribute('aria-hidden', String(Number(s.dataset.n) !== current)); s.inert = Number(s.dataset.n) !== current; });
  if (focusHeading) root.querySelector('#storyH' + current)?.focus({ preventScroll: true });
}

function go(n, focusHeading = true) {
  current = Math.max(1, Math.min(TOTAL, n));
  const track = root.querySelector('#storyTrack');
  track.scrollTo({ left: (current - 1) * track.clientWidth, behavior: reduced() ? 'auto' : 'smooth' });
  update(focusHeading);
}

function close() {
  try { localStorage.setItem(SEEN, '1'); } catch (e) {}
  if (!root) return;
  resizeObs?.disconnect(); resizeObs = null;
  root.remove(); root = null;
  document.documentElement.classList.remove('story-open');
  document.removeEventListener('keydown', onKey, true);
  (lastFocus && document.contains(lastFocus) ? lastFocus : document.querySelector('main, #app, body'))?.focus?.();
}

function onKey(e) {
  if (!root) return;
  if (e.key === 'Escape') { e.preventDefault(); close(); return; }
  if (e.key === 'ArrowRight' && !e.target.matches('input, textarea')) { e.preventDefault(); if (current < TOTAL) go(current + 1); return; }
  if (e.key === 'ArrowLeft' && !e.target.matches('input, textarea')) { e.preventDefault(); if (current > 1) go(current - 1); return; }
  if (e.key === 'Tab') {
    // keep the focus inside the dialog
    const f = [...root.querySelectorAll('button:not([hidden]), [tabindex="-1"]')].filter((x) => !x.closest('[inert]') && x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
}

export function openStory() {
  if (root) return;
  lastFocus = document.activeElement;
  current = 1;
  root = document.createElement('div');
  root.className = 'story-modal';
  root.id = 'storyModal';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', t('storyDialog'));
  root.innerHTML = `
    <div class="story-sheet">
      <div class="story-track" id="storyTrack">${Array.from({ length: TOTAL }, (_, i) => slideHtml(i + 1)).join('')}</div>
      <div class="story-bar">
        <p class="story-step" id="storyStep" aria-live="polite"></p>
        <div class="story-dots" aria-hidden="true">${Array.from({ length: TOTAL }, (_, i) => `<span class="story-dot" data-n="${i + 1}"></span>`).join('')}</div>
        <div class="story-actions">
          <button type="button" class="btn btn-ghost" id="storyBack">${t('storyBack')}</button>
          <button type="button" class="btn btn-primary" id="storyNext"></button>
        </div>
        <button type="button" class="story-skip" id="storySkip">${t('storySkip')}</button>
      </div>
    </div>`;
  document.body.appendChild(root);
  document.documentElement.classList.add('story-open');
  root.querySelector('#storyNext').onclick = () => (current === TOTAL ? close() : go(current + 1));
  root.querySelector('#storyBack').onclick = () => go(current - 1);
  root.querySelector('#storySkip').onclick = close;
  // swiping: the slide that ends up in view becomes the current one
  const track = root.querySelector('#storyTrack');
  let timer = 0;
  track.addEventListener('scroll', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const n = Math.round(track.scrollLeft / Math.max(1, track.clientWidth)) + 1;
      if (n !== current && n >= 1 && n <= TOTAL) { current = n; update(false); }
    }, 120);
  }, { passive: true });
  // a size change (phone rotated, window resized) keeps the same screen:
  // without this the scroll position would point at another screen
  resizeObs = new ResizeObserver(() => { if (root) track.scrollLeft = (current - 1) * track.clientWidth; });
  resizeObs.observe(track);
  document.addEventListener('keydown', onKey, true);
  update(true);
}

// Once, right after the age confirmation.
export function maybeOpenStory() {
  let seen = false;
  try { seen = localStorage.getItem(SEEN) === '1'; } catch (e) {}
  if (!seen) openStory();
}

window.mvOpenStory = openStory;
window.mvMaybeOpenStory = maybeOpenStory;
