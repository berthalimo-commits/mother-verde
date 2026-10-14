// Zona del juego — the only part downloaded at start-up, and only in builds
// with VITE_MV_GAME = 1 (see src/gameFlag.js). It adds "Juego" to the "Más"
// menu and an empty screen; the game itself (game.js) is downloaded the first
// time someone opens that screen.
// Access: showScreen() sends a locked account to the same lock screen as every
// other paid zone (juego isn't in mvScreenAllowedLocked).

const TEXTS = {
  es: { modJuegoTitle: 'Juego: cultiva tu planta', jgCargando: 'Cargando el juego…', jgErrCarga: 'No pudimos cargar el juego. Revisa tu conexión.', jgReintentar: 'Reintentar' },
  en: { modJuegoTitle: 'Game: grow your plant', jgCargando: 'Loading the game…', jgErrCarga: "We couldn't load the game. Check your connection.", jgReintentar: 'Try again' },
  de: { modJuegoTitle: 'Spiel: zieh deine Pflanze groß', jgCargando: 'Das Spiel wird geladen…', jgErrCarga: 'Das Spiel konnte nicht geladen werden. Prüfe deine Verbindung.', jgReintentar: 'Erneut versuchen' },
  fr: { modJuegoTitle: 'Jeu : cultive ta plante', jgCargando: 'Chargement du jeu…', jgErrCarga: 'Impossible de charger le jeu. Vérifie ta connexion.', jgReintentar: 'Réessayer' },
};
const t = (k) => (window.t ? window.t(k) : k);

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
