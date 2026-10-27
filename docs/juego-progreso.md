# Juego v2 — notas de avance

Diseño: `docs/juego-diseno-v2.md`. Rama: **`juego`** solamente (nada en `main`, `dev` ni producción).
Método: una fase cada vez → pruebas → commit + push a `juego` → esta nota → resumen con capturas →
**esperar «sigue» de Bertha** antes de la fase siguiente.

---

## Fase 1 — Botón «¡Juega ya!» · HECHA (2026-10-22)

**Estado:** hecha, probada y aprobada («sigue» de Bertha, 2026-10-27). Commit `1ff8f93`.

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

---

## Fase 2 — La carpa se ve · HECHA (2026-10-27)

**Estado:** hecha y probada. Esperando «sigue» para la fase 3.

**Qué se ve**
- Arriba de las decisiones, una **carpa de cultivo dibujada**: estructura, paredes plateadas, lámpara colgada,
  ventilador, maceta con sustrato y la planta.
- **Cada etapa tiene su dibujo:** semilla (portada), semilla germinada (semana 1), plántula con hojas dentadas,
  vegetativo (la planta crece cada semana), floración (estira hasta 3 semanas; los cogollos engordan y se llenan
  de tricomas que pasan de transparentes a blancos y ámbar), secado (ramas colgadas boca abajo de una cuerda,
  carpa a oscuras), curado y rosin (frascos), resultado (frascos con luz suave) y planta muerta (marchita, marrón).
- **La lámpara:** encendida mientras se cultiva; su brillo sigue la intensidad elegida (baja / media / alta).
  Apagada en la portada, el secado, el curado y la planta muerta.
- **El sustrato** se ve seco, húmedo o empapado (con agua en el suelo) según el riego elegido.
- **Las hojas** se ven verdes (salud ≥ 70), pálidas (40–69) o amarillentas (< 40).
- **Indicadores** (solo mientras se cultiva): reloj de luz (18/6 o 12/12 como círculo de día y noche),
  termómetro, gotas de humedad y medidor de nutrientes. Cada uno marca el **nivel** elegido con su palabra
  («Cálida», «Baja»…), nunca una cifra inventada.
- **En vivo:** al tocar una opción la carpa y los indicadores cambian en el acto. No se guarda nada hasta pasar
  la semana.
- **Descripción en texto** debajo de la carpa (para quien no ve la imagen y para todos): etapa, lámpara, sustrato
  y hojas, en los 4 idiomas.
- Celular: carpa arriba, indicadores 2 × 2, descripción. Computadora (≥ 700 px): indicadores al lado de la carpa.

**Una decisión mía para que Bertha la revise:** el diseño decía colores «bajo, bien, alto». Usé **bajo / medio /
alto** (azul, verde, ámbar) sin decir «bien», porque lo ideal cambia según la etapa (p. ej. la humedad en
floración) y marcar «bien» siempre el medio enseñaría algo falso o regalaría la respuesta. Si Bertha prefiere que
el indicador diga si está bien, se puede hacer en la fase 4 usando solo los valores que ella aprobó.

**Archivos**
- `src/game/tent.js` (nuevo) — el dibujo, los indicadores, la descripción y su CSS. Va dentro del archivo del
  juego (se descarga al entrar al juego, nunca al abrir la web).
- `src/game/game.js` — pone la carpa sobre las decisiones (no en el laboratorio) y la redibuja al elegir.
- `src/game/i18n.js` — 21 textos nuevos × 4 idiomas (`jgTent…`).
- `tests/sim/game-tent-ui.mjs` (nuevo, 36 comprobaciones) añadido a `run-all.mjs`;
  `tests/sim/game-engine.mjs` ahora revisa también `tent.js` (sin butano, CO2, unidades de presión…).

**Pruebas**
- `game-tent-ui.mjs`: 36 ok, 0 fallas — 9 escenas distintas, textos en 4 idiomas, cogollos y tricomas crecen,
  luz encendida/apagada, brillo según intensidad, hojas amarillas con poca salud, sin imágenes de fuera ni estilos
  en línea, sin cifras (solo 18/6 y 12/12); en la app: cambios en vivo sin guardar, reloj 18/6 → 12/12, la planta
  crece, floración, secado, curado, resultado, 4 idiomas en vivo, contraste ≥ 4,5, 360 px sin desborde,
  computadora con indicadores al lado, sin errores de JavaScript.
- Batería completa `run-all.mjs`: **37 pruebas, 0 fallas**.
- Web sin el juego (`main`/`dev`): la compilación no contiene nada del juego ni de la carpa.

**Pesos**
| Parte | Antes | Ahora |
|---|---|---|
| Juego (al entrar) | 86,5 KB (27,7 comprimido) | 105,9 KB (33,7 comprimido) |
| Entrada / laboratorio / resto de la web | sin cambio | sin cambio |

La carpa suma +19,4 KB (+6,0 comprimido), por debajo de lo estimado (+20 a 30 KB, 7 a 10 comprimido).

**Capturas:** `tests/sim/out/jgt-*.png` (intro, germ, choices, veg, flor en ES/EN/DE/FR, secado, curado,
veg en computadora).

**Lo siguiente:** Fase 3 — dar órdenes tocando la carpa. Primer paso: leer «Fase 3» en `docs/juego-diseno-v2.md`;
las piezas tocables serán la lámpara, la maceta (riego), el medidor (nutrientes), el ventilador/termómetro y la
humedad, que hoy se dibujan en `src/game/tent.js`.

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
