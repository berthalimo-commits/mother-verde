// Zona del juego — the only part downloaded at start-up, and only in builds
// with VITE_MV_GAME = 1 (see src/gameFlag.js). It adds "Juego" to the "Más"
// menu, the «¡Juega ya!» buttons (top menu + Home) and an empty screen; the
// game itself (game.js) is downloaded the first time someone opens that screen.
// Access: showScreen() sends a locked account to the same lock screen as every
// other paid zone (juego isn't in mvScreenAllowedLocked). «¡Juega ya!» while
// locked goes to Desbloquear instead, with a note saying why — never an error.

const TEXTS = {
  es: { modJuegoTitle: 'Juego: cultiva tu planta', jgCargando: 'Cargando el juego…', jgErrCarga: 'No pudimos cargar el juego. Revisa tu conexión.', jgReintentar: 'Reintentar',
    jgPlay: '¡Juega ya!', jgPlayShort: 'Jugar', jgLockNote: 'El juego es parte del acceso completo. Cuando lo tengas, «¡Juega ya!» te lleva directo a tu planta.' },
  en: { modJuegoTitle: 'Game: grow your plant', jgCargando: 'Loading the game…', jgErrCarga: "We couldn't load the game. Check your connection.", jgReintentar: 'Try again',
    jgPlay: 'Play now!', jgPlayShort: 'Play', jgLockNote: 'The game is part of full access. Once you have it, «Play now!» takes you straight to your plant.' },
  de: { modJuegoTitle: 'Spiel: zieh deine Pflanze groß', jgCargando: 'Das Spiel wird geladen…', jgErrCarga: 'Das Spiel konnte nicht geladen werden. Prüfe deine Verbindung.', jgReintentar: 'Erneut versuchen',
    jgPlay: 'Jetzt spielen!', jgPlayShort: 'Spielen', jgLockNote: 'Das Spiel gehört zum vollen Zugang. Sobald du ihn hast, bringt dich «Jetzt spielen!» direkt zu deiner Pflanze.' },
  fr: { modJuegoTitle: 'Jeu : cultive ta plante', jgCargando: 'Chargement du jeu…', jgErrCarga: 'Impossible de charger le jeu. Vérifie ta connexion.', jgReintentar: 'Réessayer',
    jgPlay: 'Joue maintenant !', jgPlayShort: 'Jouer', jgLockNote: 'Le jeu fait partie de l’accès complet. Dès que tu l’as, « Joue maintenant ! » t’emmène directement à ta plante.' },
};
const t = (k) => (window.t ? window.t(k) : k);

// «¡Juega ya!»: a small sprout + the text (short text on phones, see CSS).
const SPROUT = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path d="M12 21v-8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none"/><path d="M12 13c0-4-3-6.5-7.5-6.5C4.5 11 7.5 13 12 13Z" fill="currentColor"/><path d="M12 11c0-4 2.6-6.5 7-6.5 0 4.5-2.8 6.5-7 6.5Z" fill="currentColor"/></svg>';
const CSS = `
.jg-play{display:inline-flex;align-items:center;gap:7px;min-height:44px;padding:0 18px;border-radius:100px;border:none;background:var(--resin);color:var(--ink-on-accent);font-family:'Manrope',sans-serif;font-weight:700;font-size:13.5px;cursor:pointer;white-space:nowrap;box-shadow:0 0 0 1px rgba(227,167,95,.35),0 4px 16px rgba(227,167,95,.22);transition:transform .15s ease,box-shadow .15s ease}
.jg-play:hover{transform:translateY(-1px);box-shadow:0 0 0 1px rgba(227,167,95,.6),0 6px 20px rgba(227,167,95,.32)}
.jg-play:focus-visible{outline:2px solid var(--moss);outline-offset:3px}
.jg-play-short{display:none}
.hero-actions .jg-play{min-height:0;padding:12px 22px;font-size:14px;border-radius:6px}
.hero-actions{flex-wrap:wrap}
.jg-lock-note{margin:0 0 20px;color:var(--ink);font-size:13.5px}
@media (max-width:760px){
  .topbar .jg-play{padding:0 14px}
  .topbar .jg-play-long{display:none}
  .topbar .jg-play-short{display:inline}
}
@media (prefers-reduced-motion: reduce){.jg-play{transition:none}.jg-play:hover{transform:none}}
`;
function playButton(id) {
  const b = document.createElement('button');
  b.type = 'button';
  b.id = id;
  b.className = 'jg-play';
  b.innerHTML = SPROUT + '<span class="jg-play-long" data-i18n="jgPlay"></span><span class="jg-play-short" data-i18n="jgPlayShort"></span>';
  b.querySelector('.jg-play-long').textContent = t('jgPlay');
  b.querySelector('.jg-play-short').textContent = t('jgPlayShort');
  b.addEventListener('click', play);
  return b;
}
function play() {
  const locked = window.mvIsLockedState?.(window.mvAccessStateNow?.());
  const note = document.getElementById('jgLockNote');
  if (locked) {
    if (note) note.hidden = false;
    window.showScreen?.('desbloquear');
  } else {
    window.showScreen?.('juego');
  }
}

function mount() {
  if (document.getElementById('juego') || !window.mvAddTexts) return;
  window.mvAddTexts(TEXTS);
  const menu = document.getElementById('tabsMoreMenu');
  if (menu) {
    const b = document.createElement('button');
    b.type = 'button';
    b.id = 'tabsMoreJuego';
    b.dataset.i18n = 'modJuegoTitle';
    b.textContent = t('modJuegoTitle');
    b.addEventListener('click', () => window.goMore?.('juego'));
    menu.appendChild(b);
  }
  const st = document.createElement('style'); st.id = 'jgEntryStyle'; st.textContent = CSS; document.head.appendChild(st);
  const search = document.getElementById('searchOpenBtn');
  search?.parentNode.insertBefore(playButton('jgPlayTop'), search);
  document.querySelector('#home .hero-actions')?.appendChild(playButton('jgPlayHero'));
  // The note only belongs to the visit that came from «¡Juega ya!»: it hides
  // again as soon as Desbloquear is left.
  const dsContent = document.getElementById('desbloquearContent');
  if (dsContent) {
    const note = document.createElement('div');
    note.className = 'note-box jg-lock-note';
    note.id = 'jgLockNote';
    note.setAttribute('role', 'status');
    note.dataset.i18n = 'jgLockNote';
    note.textContent = t('jgLockNote');
    note.hidden = true;
    dsContent.parentNode.insertBefore(note, dsContent);
    const ds = document.getElementById('desbloquear');
    new MutationObserver(() => { if (!ds.classList.contains('active')) note.hidden = true; }).observe(ds, { attributes: true, attributeFilter: ['class'] });
  }
  const anchor = document.getElementById('desbloquear');
  const sec = document.createElement('section');
  sec.className = 'screen';
  sec.id = 'juego';
  sec.setAttribute('aria-labelledby', 'jgH1');
  sec.innerHTML = '<div id="juegoRoot" aria-live="polite"></div>';
  anchor?.parentNode.insertBefore(sec, anchor.nextSibling);
}

let gameModule = null;
async function render() {
  const root = document.getElementById('juegoRoot');
  if (!root) return;
  if (!gameModule) {
    root.innerHTML = `<p class="subhead" role="status">${t('jgCargando')}</p>`;
    try {
      gameModule = await import('./game.js');
    } catch (e) {
      root.innerHTML = `<div class="note-box" role="alert">${t('jgErrCarga')}</div>
        <button type="button" class="btn btn-primary jg-retry">${t('jgReintentar')}</button>`;
      root.querySelector('.jg-retry').addEventListener('click', render);
      return;
    }
  }
  gameModule.render(root);
}
window.mvRenderJuego = render;
window.mvGameLoaded = () => !!gameModule;

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
else mount();
