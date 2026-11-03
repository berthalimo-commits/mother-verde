// «Nuestra historia» — the welcome story (Bertha's texts, 2026-11-03).
// Shown ONCE, right after the age confirmation (main.js ageGateConfirm calls
// window.mvMaybeOpenStory), and any time from «Más ▾ → Nuestra historia» or
// the footer (window.mvOpenStory). 6 screens: swipe on phones (scroll-snap),
// «Continuar» / «Atrás» / arrow keys elsewhere; «Saltar e ir a la plataforma»
// always visible; Esc = skip. A real dialog: focus stays inside, the screen
// reader hears «Pantalla n de 6» and each heading; with «reduce motion» the
// screens change without animation.
// Photos: /historia/*.jpg (compressed, no metadata). Until a file exists the
// frame shows «Foto próximamente» with the alt text already written.
const t = (k) => (window.t ? window.t(k) : k);
const SEEN = 'mv-story-seen';
const GAME_ON = import.meta.env.VITE_MV_GAME === '1';
const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const PHOTOS = {
  1: [['/historia/01-carpa.jpg', 'storyAlt1']],
  2: [['/historia/07-flores.jpg', 'storyAlt2a'], ['/historia/05-planta.jpg', 'storyAlt2b']],
  3: [['/historia/02-campo.jpg', 'storyAlt3']],
  4: [['/historia/03-abrazo.jpg', 'storyAlt4']],
  5: [['/historia/08-rociando.jpg', 'storyAlt5']],
  6: [],
};
const TOTAL = 6;

function photosHtml(n) {
  const list = PHOTOS[n];
  if (!list.length) return '';
  return `<div class="story-photos story-photos-${list.length}">${list.map(([src, alt], i) => `
    <figure class="story-photo">
      <img src="${src}" alt="${t(alt)}" ${n === 1 && i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"
        onerror="this.hidden=true; this.nextElementSibling.hidden=false;">
      <div class="story-photo-soon" hidden><span>${t('storyPhotoSoon')}</span><small>${t(alt)}</small></div>
    </figure>`).join('')}</div>`;
}

function bodyHtml(n) {
  if (n === 5) {
    const items = [
      ['🧮', t('story5Calc')], ['🧭', t('story5Viaje')],
      ['🌱', t(GAME_ON ? 'story5Juego' : 'story5JuegoPronto')], ['💬', t('story5Comunidad')],
    ];
    return `<ul class="story-list">${items.map(([i, s]) => `<li><span class="story-ico" aria-hidden="true">${i}</span><span>${s}</span></li>`).join('')}</ul>`;
  }
  return t('story' + n + 'P');
}

function slideHtml(n) {
  return `<section class="story-slide" id="storySlide${n}" data-n="${n}" aria-labelledby="storyH${n}" aria-roledescription="slide">
      ${photosHtml(n)}
      <div class="story-text">
        <h2 id="storyH${n}" tabindex="-1">${t('story' + n + 'H')}</h2>
        ${bodyHtml(n)}
        ${n === TOTAL ? `<p class="story-independent">${t('storyIndependent')}</p>` : ''}
      </div>
    </section>`;
}

let current = 1, lastFocus = null, root = null;

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
  const slide = root.querySelector('#storySlide' + current);
  track.scrollTo({ left: slide.offsetLeft, behavior: reduced() ? 'auto' : 'smooth' });
  update(focusHeading);
}

function close() {
  try { localStorage.setItem(SEEN, '1'); } catch (e) {}
  if (!root) return;
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
