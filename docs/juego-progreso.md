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

---

## Fuera del juego: arreglo de Desbloquear traído de `dev` (2026-10-27)

- Arreglo aprobado por Bertha («APRUEBO»), hecho en `dev` (commit `40afc41`, vista previa de staging lista) y
  traído a `juego` con un merge (`086a8c1`). Al cambiar el número de flores después de «Ver mi monto» vuelve el
  botón y se esconden las indicaciones viejas; la reserva vieja se anula solo al pedir el monto nuevo.
  Prueba `tests/sim/flowers-change-ui.mjs` (16 ok).
- En el merge solo chocó la lista de `tests/sim/run-all.mjs`: quedan las pruebas del juego y la nueva.
- `tests/sim/fn-e2e.mjs` fallaba a veces (dos veces seguidas aquí): forzaba un monto fijo sin mirar si otra reserva
  abierta ya lo tenía por azar. Ahora la aparta 1 unidad antes. Solo cambia la prueba, no la app. **Este arreglo
  de la prueba está solo en `juego`;** `dev` tiene todavía la versión que falla a veces.
- Batería completa en `juego`, en 7 grupos pequeños (para gastar menos memoria; servidor y navegador cerrados al
  terminar cada grupo): **38 pruebas, 0 fallas**.

---

## Cambio de modo (2026-10-27, pedido de Bertha)

- Las fases 3 y 4 se hacen seguidas, sin esperar «sigue». Se sube a `juego` al terminar cada una. En cada fase se
  corren solo las pruebas relacionadas; la batería completa, al final.
- **La fase 8 espera la aprobación de `docs/juego-decisiones.md`.**
- **Regla de fuentes:** cada regla y cada efecto tienen su fuente o su nivel en `docs/juego-fuentes.md`. Cada
  consecuencia lleva un botón «¿Por qué?».
- Documentos nuevos:
  - `docs/juego-fuentes.md`: 7 fuentes abiertas y citadas, y lo que no tiene fuente comprobada;
  - `docs/juego-decisiones.md`: borrador del catálogo, con preguntas para Bertha (commit `fbf239f`).

## Fase 3 — Dar órdenes tocando la carpa + «¿Por qué?» · HECHA (2026-10-27)

**Qué se ve**
- **Cinco objetos en la carpa, cada uno con su botón** (círculo punteado, ≥ 44 px):
  - lámpara → horas de luz e intensidad;
  - termómetro y calefactor → temperatura;
  - humidificador → humedad;
  - regadera → riego;
  - botella de nutrientes → nutrientes.
- **Al tocar un objeto** se abre su panel bajo la carpa, con las mismas opciones que la lista y el botón «Pasar a la
  semana siguiente». Elegir en el panel marca la lista y al revés. La carpa cambia en el acto y no se guarda nada
  hasta pasar la semana.
- **Teclado:** Tab llega a cada objeto, Enter abre su panel (el foco va a la opción marcada) y Escape lo cierra (el
  foco vuelve al objeto).
- Con un problema sin responder, el panel no deja elegir, igual que la lista.
- La lista de siempre se queda debajo, para teclado, lectores de pantalla o quien la prefiera.
- **«¿Por qué?»:**
  - Dónde está: bajo el guía (una por cada causa de la semana), dentro de cada problema y en el resultado
    (tricomas, causas, secado, curado, rosin, planta marchita).
  - Qué muestra: la razón, el respaldo (estudio / guía técnica / práctica / regla del juego), la fuente comprobada
    cuando la hay (F1–F6 de `juego-fuentes.md`) y el botón de la lección.
  - Sin fuente externa, lo dice así («práctica de cultivadores… sin fuente externa comprobada», «regla del juego»).

**Archivos**
- `src/game/tent.js`: objetos dibujados (`tools()`), botones encima del dibujo (posiciones en el CSS, sin estilos
  en línea) y el panel.
- `src/game/why.js` (nuevo): razones, fuentes, niveles y botones.
- `src/game/game.js`: estado del panel, teclado, sincronía panel ↔ lista y grupos «¿Por qué?».
- `src/game/i18n.js`: textos de objetos y de «¿Por qué?» en ES/EN/DE/FR.

**Pruebas**
- `tests/sim/game-touch-ui.mjs` (nueva): **37 ok**.
  - Fuentes: cada enlace está en `juego-fuentes.md`; «estudio» o «guía» siempre con enlace; rosin sin cifras.
  - Carpa: 5 objetos ≥ 44 px dentro de la carpa y sin taparse a 360 px; cada objeto abre lo suyo; panel ↔ lista;
    Tab, Enter y Escape; el panel bloqueado con un problema.
  - **Pasar la semana desde el panel da exactamente el resultado del motor del juego.**
  - «¿Por qué?» con su texto, nivel, fuente y lección, en 4 idiomas; resultado en computadora; sin errores.
- Relacionadas:
  - `game-tent-ui` 36 ok: la comprobación de «la planta crece» ahora mira el tallo (`.jgt-stem`) y no el
    primer trazo redondo, que ahora es la regadera.
  - `game-ui` 54 ok: el Tab de prueba ahora pasa los objetos de la carpa antes de llegar a la lista.
  - `game-play-ui` 35, `game-engine` 44 (ahora revisa también `why.js`), `game-db` 37.

**Peso:** juego 105,9 → 132,0 KB (33,7 → 41,5 comprimido). El diseño estimaba +2 a 3 KB comprimido para los
objetos; el resto (≈ +5 KB comprimido) son los textos de «¿Por qué?» en 4 idiomas, que no estaban en el diseño.

## Fase 4 — Los problemas se ven y la semana se anima · HECHA (2026-10-27)

**Qué se ve**
- **Cada problema se dibuja en la planta como lo describe su fuente** (`docs/juego-fuentes.md`):

  | Problema | Cómo se ve | Fuente |
  |---|---|---|
  | Oídio | manchas blancas como polvo sobre las hojas | F5, F7 |
  | Botrytis | los cogollos de arriba se ponen grises y marrones | F4 y la plataforma |
  | Ácaros | puntitos claros y una telaraña fina | F6 |
  | Carencia de nitrógeno | se ponen amarillas las hojas de **abajo** (las más viejas) | F2 |
  | Exceso de riego | hojas caídas y sustrato oscuro, empapado y brillante, aunque ya se elija otro riego | F3 y la plataforma |

- **Recuperación:** la semana después de resolver bien el problema, sus señales se ven más débiles (la planta se
  recupera poco a poco). Una semana más tarde, desaparecen.
- **La descripción en texto** nombra el problema o la recuperación (ES/EN/DE/FR).
- **La semana se anima una sola vez** al pasar: la planta crece un poco, caen tres gotas sobre la maceta y la luz se
  apaga y vuelve. Dura menos de 2,5 s y nada se repite. Elegir opciones no anima nada.
- **Con «reducir movimiento»** activado en el sistema no se mueve nada: el cambio se ve de golpe.

**Archivos**
- `src/game/tent.js`: `problemOf()`, los síntomas, las hojas caídas o amarillas, los cogollos podridos, el sustrato
  empapado y el CSS de las animaciones.
- `src/game/game.js`: `animNext` (solo el primer dibujo después de pasar la semana se anima).
- `src/game/i18n.js`: `jgTentP_*` y `jgTentRec` en 4 idiomas.

**Pruebas**
- `tests/sim/game-problems-ui.mjs` (nueva): **25 ok**.
  - Dibujos: cada problema y su fuente; hojas amarillas solo abajo; sin problema no se dibuja nada; la
    recuperación; las descripciones en 4 idiomas.
  - Animaciones: ninguna repetida ni de más de 5 s; en la app se anima una vez, no queda nada en marcha y no se
    anima al elegir.
  - En la app: exceso de riego visible tras 2 semanas, la recuperación al responder bien y que desaparece después.
  - «Reducir movimiento»: cero animaciones.
- Relacionadas: `game-tent-ui` 36, `game-touch-ui` 37, `game-play-ui` 35, `game-engine` 44 y `game-ui` 54. En
  el primer intento, `game-ui` no pudo arrancar el Chrome de pruebas; repetida sola, pasó.

**Peso:** juego 132,0 → 137,8 KB (41,5 → 43,3 comprimido). El diseño estimaba +3 a 4 KB comprimido; quedó en +1,8.

**Guardado por partes** (la conexión se cortó una vez): A `a1ac216`, B `6638801`, C `bac27bf`, nota + subida en
el commit siguiente.

**Batería completa (2026-10-28), en 8 grupos pequeños:** **40 pruebas, 0 fallas**.
- Hubo una falla intermitente en `panel-ui.mjs` («enviar código de regalo → Enviado a…»): falló 2 veces seguidas
  y luego pasó 2 veces sin ningún cambio en el código (ni el panel ni `main.js` cambiaron desde que pasaba). Causa
  todavía desconocida; no tiene que ver con el juego.
- La prueba ahora imprime lo que mostraba el panel cuando falla, para poder ver la causa si vuelve a pasar.
- Vercel publicó las fases 3 (`f6a2e20`) y 4 (`44aae05`) en la vista previa de `juego` (READY).

**Lo siguiente:**
- **Fase 8** (secado, curado y rosin que se ven): **espera la aprobación de `docs/juego-decisiones.md`**. Hay
  preguntas abiertas; la principal: si el rosin puede llevar cifras (8.0).
- Fases 5, 6 y 7: necesitan las decisiones del catálogo (sistemas, germinación, equipo).
- Pendiente fuera del juego: el resultado de la prueba de Bertha en incógnito sobre el fallo de las flores.

**Cómo retomar**
- `git checkout juego`
- Terminal 1: `node tests/sim/fakeserver.mjs` · Terminal 2:
  `VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_ANON_KEY=anon npx vite --port 5174`
- Solo esta fase: `cd tests/sim && node game-play-ui.mjs` (fakeserver recién arrancado). Todo: `node run-all.mjs`
  (arranca su propio fakeserver: apaga antes el tuyo; necesita Vite ya encendido en 5174).
- Si la computadora anda corta de memoria, correr la batería en grupos de 5 o 6 archivos, cerrando Vite, el
  fakeserver y el Chrome de pruebas después de cada grupo (`panel-ui.mjs` va en el mismo grupo que `app-ui.mjs`,
  justo después, porque usa su base).
- Aviso: si Windows reserva los puertos 54321/54322 (`netsh interface ipv4 show excludedportrange protocol=tcp`),
  mover los puertos de las pruebas solo mientras se prueban y luego `git checkout` de esos archivos.
- Aviso: `vite build --outDir <otra carpeta>` con el juego encendido termina con
  «mv-dev-preview: preview code still present in dist/main.js» porque ese control mira siempre `dist/`.
  Pasa igual sin los cambios del juego; no es un fallo de esta fase.
