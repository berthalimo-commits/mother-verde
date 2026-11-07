// Zona del juego, behind the build flag VITE_MV_GAME (vite.config.js): on for
// the local dev server and the Vercel build of branch "juego"; OFF for main
// and dev. With the flag off this is `if (false)`: nothing of the game is
// compiled or downloaded.
if (import.meta.env.VITE_MV_GAME === '1') import('./game/entry.js');
