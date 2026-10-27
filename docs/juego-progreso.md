# Juego v2 — notas de avance

Diseño: `docs/juego-diseno-v2.md`. Rama: **`juego`** solamente (nada en `main`, `dev` ni producción).
Método: una fase cada vez → pruebas → commit + push a `juego` → esta nota → resumen con capturas →
**esperar «sigue» de Bertha** antes de la fase siguiente.

---

## Fase 1 — Botón «¡Juega ya!» · HECHA (2026-10-22)

**Estado:** hecha y probada. Esperando «sigue» para la fase 2.

**Qué se ve**
- Botón ámbar **«¡Juega ya!»** en la barra de arriba, antes de «Buscar» (fuera de «Más»).
  En el celular (≤ 760 px) dice solo «Jugar / Play / Spielen / Jouer» con el brote.
- Otro **«¡Juega ya!»** en la portada, junto a «Explorar cultivo» y «Ver estatus legal».
- Con acceso completo → abre el juego. Sin acceso (prueba vencida, visitante, etc.) → **Desbloquear** con el
  aviso «El juego es parte del acceso completo. Cuando lo tengas, «¡Juega ya!» te lleva directo a tu planta.»
  El aviso se esconde al salir de Desbloquear y no aparece si se llega a Desbloquear por otro camino.
- Textos: ES «¡Juega ya!», EN «Play now!», DE «Jetzt spielen!», FR «Joue maintenant !» (espacio fijo antes del «!»).

**Archivos**
- `src/game/entry.js` — textos nuevos (`jgPlay`, `jgPlayShort`, `jgLockNote`), los dos botones, el aviso en
  Desbloquear y su CSS (inyectado solo cuando el juego está encendido).
- `tests/sim/game-play-ui.mjs` — prueba nueva (35 comprobaciones); añadida a `tests/sim/run-all.mjs`.

**Pruebas**
- `game-play-ui.mjs`: 35 ok, 0 fallas (con y sin acceso, visitante, 4 idiomas en vivo, celular 360 px sin
  desborde, computadora, teclado Tab + Enter con foco visible, ≥ 44 px, el juego no se descarga hasta entrar).
- Batería completa `run-all.mjs`: **35 pruebas, 0 fallas** (las 5 del juego y `csp-ui` repetidas al final; el
  primer intento lo cortó la falta de memoria de la computadora, no las pruebas). Una comprobación de seguridad
  saltó por el comentario «top bar» en `entry.js` («bar» es unidad de presión): se cambió a «top menu».
- Web sin el juego (`main`/`dev`): compilación **idéntica byte a byte** antes y después; ningún texto del juego.

**Pesos**
| Parte | Antes | Ahora |
|---|---|---|
| Entrada del juego (solo en `juego`) | 2,26 KB (1,14 comprimido) | 5,76 KB (2,55 comprimido) |
| Juego / laboratorio / resto de la web | sin cambio | sin cambio |

La entrada creció +1,4 KB comprimido (el diseño estimaba +1 KB): son los textos en 4 idiomas, el aviso y el CSS
del botón. Si Bertha lo prefiere, el CSS puede pasar al archivo del juego… pero entonces el botón se vería sin
estilo hasta abrir el juego, así que lo dejé aquí.

**Decisiones de Bertha:** ninguna nueva necesaria para esta fase. Siguen pendientes las del punto 4 del diseño
(necesarias para las fases 6 y 7).

**Lo siguiente:** Fase 2 — la carpa se ve (SVG dentro de `game.js`). Primer paso: leer la sección «Fase 2» de
`docs/juego-diseno-v2.md` y el render actual de la semana en `src/game/game.js`.

**Cómo retomar**
- `git checkout juego`
- Terminal 1: `node tests/sim/fakeserver.mjs` · Terminal 2:
  `VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_ANON_KEY=anon npx vite --port 5174`
- Solo esta fase: `cd tests/sim && node game-play-ui.mjs` (fakeserver recién arrancado). Todo: `node run-all.mjs`
  (arranca su propio fakeserver: apaga antes el tuyo).
- Aviso: si Windows reserva los puertos 54321/54322 (`netsh interface ipv4 show excludedportrange protocol=tcp`),
  mover los puertos de las pruebas solo mientras se prueban y luego `git checkout` de esos archivos.
- Aviso: `vite build --outDir <otra carpeta>` con el juego encendido termina con
  «mv-dev-preview: preview code still present in dist/main.js» porque ese control mira siempre `dist/`.
  Pasa igual sin los cambios del juego; no es un fallo de esta fase.
