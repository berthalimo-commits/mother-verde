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

## Fase 8 — Secado, curado + almacenamiento y rosin que se ven · HECHA (2026-10-29)

Hecha con el catálogo que Bertha aprobó el 2026-10-28 (`docs/juego-decisiones.md`, especificación de la fase 8).

**Qué se ve y qué se decide**
- **Secado** (6 decisiones): método (planta entera / ramas / rejilla), temperatura, humedad, aire, luz y cuándo
  terminar.
- **Curado** (4) + **almacenamiento** (5, en la misma pantalla bajo «Cómo lo vas a guardar después»):
  - curado: envase (vidrio, plástico, lata, bolsa de curado), control de humedad (sin control, higrómetro, sobre de
    dos vías), abrir y tiempo;
  - almacenamiento: luz, temperatura (fresco, cálido, nevera, congelador), aire en el envase, entero o molido, y
    tiempo.
- **Rosin** (11 decisiones): material de partida (flor curada, hachís, kief, fresco congelado, flor fresca sin
  congelar), malla, calor, presión, tiempo, tipo de prensa, papel, enfriado, guardar, prioridad y protección.
- **Cifras solo en el rosin y solo con fuente**, marcadas «orientativo» en su idioma:
  - malla fina 5–25 µm y estándar 25–220 µm (patentes P1 y P2);
  - calor de las placas 49–116 °C (P2).
  - **Presión y tiempo, en niveles:** no hay fuente con cifras, y la prueba de seguridad prohíbe unidades de
    presión.
- **El dibujo cambia en el acto según lo elegido:**
  - secado: planta colgada o rejilla, flechas del aire, luz;
  - curado y almacenamiento: frasco, bolsa o lata, tapa, higrómetro o sobre, armario, estante, ventana al sol,
    nevera o congelador con escarcha, entero o molido;
  - rosin: prensa según su tipo, placas que brillan según el calor, papel, bolsa, material.
- **Las consecuencias se ven en el dibujo y se cuentan en la descripción:** moho, cogollos resecos, restos de
  planta, rosin oscuro por calor alto, rosin aguado con flor fresca.
- **«¿Por qué?» en cada decisión que restó** (23), con su nivel y su fuente:
  - almacenamiento: estudio F8;
  - malla: patentes P1 y P2;
  - el resto: práctica de la plataforma o «criterio de la autora».
- Las decisiones que solo enseñan (tipo de prensa, prioridad) no restan. Presión y tiempo dicen «sin dato» hasta
  que Bertha dé una cifra.
- La cosecha final muestra dónde se guardó y el frasco de rosin si se hizo.
- **Sin migración nueva:** el almacenamiento va dentro de la pantalla del curado, y el servidor ya aceptaba
  «secado», «curado» y «rosin». El post-cosecha completo cabe en el límite de 1.000 bytes.

**Archivos**
- `src/game/rules.json` (bloque `post`): ideal = una opción, varias o ninguna; `escala:false`; `respaldo`; `grupo`.
- `src/game/engine.js`: varios ideales, decisiones que no son escala y las que no puntúan.
- `src/game/i18n-post.js` (nuevo): todos los textos del post-cosecha en 4 idiomas. Los viejos se quitaron de
  `i18n.js`.
- `src/game/tent.js`: escenas `dryScene`, `cureScene` y `rosinScene`, y `postLooks()` para las consecuencias.
- `src/game/why.js`: 23 razones nuevas, fuentes F8, P1 y P2, niveles «autora» y «patente».
- `src/game/game.js`: redibujo en vivo (`postLive`) y subtítulo del almacenamiento.
- `docs/juego-fuentes.md`: F8, P1, P2 y los niveles nuevos.

**Pruebas**
- `tests/sim/game-post-ui.mjs` (nueva): **33 ok**.
  - Dibujos: cada decisión cambia el dibujo; las consecuencias se ven y se cuentan en 4 idiomas.
  - En la app: elegir no guarda; «¿Por qué?» con F8 y con las dos patentes; cifras del rosin «orientativo» en 4
    idiomas; el servidor guarda todo; 360 px sin desborde.
- Pruebas adaptadas a la fase 8:
  - `game-engine` 49: la regla de cifras nueva y que el post-cosecha cabe en el límite;
  - `game-ui` 54: las decisiones nuevas y la regla de cifras;
  - `game-tent-ui` 36: el rosin tiene escena propia;
  - `game-lab` 35: el ideal ahora puede ser una lista.
- **Batería completa (2026-10-29), en grupos de 2 a 5 archivos: 41 pruebas, 0 fallas.**
  - `game-ui` falló una vez en «escritorio oscuro»: el juego no cargó y se veía «Reintentar», con la máquina sin
    memoria. Repetida, pasó, y también pasó dentro de la batería.

**Peso:** juego 137,8 → 189,1 KB (43,3 → 58,9 comprimido). Casi todo son textos: 26 decisiones con sus opciones,
explicaciones y «¿Por qué?» en 4 idiomas. Se descarga solo al entrar al juego.

**Para validar por Bertha:** la lista de `docs/juego-decisiones.md` («Para validar por Bertha»).

## Fases 5, 6 y 7 — Migración, equipo y sistemas, germinación · HECHAS (2026-10-29)

**Fase 5 — migración nueva (solo staging, hay que pegarla)**
- `supabase/migrations/20261029100000_game_setup.sql`: solo cambia `game_state_valid()`.
  - La partida puede llevar la clave `setup` (equipo y método), cada opción solo con sus valores conocidos y
    `plantas` de 1 a 6.
  - Se suman la etapa `germinacion` y los problemas `pudricion_raiz` y `quemadura_luz`.
  - Todo lo demás queda igual.
- Vuelta atrás: `supabase/admin/rollback-20261029100000.sql`.
- **Para pegar en staging:** `supabase/staging/paso4c-juego-setup.sql`, copia exacta comprobada byte a byte
  (`docs/staging.md`, paso 4). Sin ella, la web de pruebas rechaza guardar una partida con equipo.
- En `tests/sim/test.mjs` la migración y su vuelta atrás entran en la comprobación de «esquema después de las
  reversas = esquema de antes».

**Fase 6 — «Prepara tu carpa» (una vez por partida, antes de plantar)**
- Decisiones:
  - carpa (pequeña, mediana, grande);
  - luz (LED, HPS, CMH);
  - sistema (maceta, DWC, NFT, aeroponía, acuaponía);
  - solo con maceta: sustrato (tierra, coco, lana de roca, tierra viva), maceta (plástico, tela, de aire, barro),
    tamaño y riego (a mano o goteo);
  - medir pH y EC.
- No hay opción «correcta»: cada pieza cambia las reglas. Fuentes en `docs/juego-decisiones.md`:
  - **hidroponía:** sin decisión de riego; con calor 2 semanas, **pudrición de raíz** (F9 + F3);
  - **acuaponía:** sin decisión de nutrientes, porque los dan los peces;
  - **HPS:** la temperatura cuenta un nivel más alta (glosario, simplificación);
  - **tela, de aire y barro:** el exceso de riego tarda una semana más y «poco» riego resta el doble (F10);
  - **goteo:** el oídio tarda una semana más (F5);
  - **sustratos:** coco y lana de roca piden nutrientes desde la plántula; la tierra viva no; en tierra, la
    carencia de N tarda una semana más;
  - **carpa pequeña:** **quemadura de luz** con planta alta y luz fuerte;
  - **carpa grande:** +1 por cada error de clima y +5 en la cosecha;
  - **maceta pequeña sin trasplantar:** resta desde la 3.ª semana de vegetativo. Hay un botón «Trasplantar».
  - **sin medidor:** «sin medir» y sin cifras de EC.
- **El dibujo cambia con el equipo:** maceta y sustrato, los sistemas (raíces, burbujas, canal, niebla, peces),
  lámpara LED, HPS o CMH, techo más bajo en la carpa pequeña, línea de goteo, medidor. Sin regadera en hidroponía y
  sin botella de nutrientes en acuaponía.
- Las partidas guardadas antes de la fase 6 siguen funcionando: sin equipo, empiezan directo en la plántula.

**Fase 7 — Germinación (etapa nueva, una pantalla antes de la plántula)**
- Decisiones:
  - método: papel húmedo, taco de turba, directo en tierra, directo en coco, vaso de agua o cubo de lana de roca;
  - temperatura: fría, templada (19–30 °C, **F11**) o calurosa;
  - humedad;
  - tiempo en el vaso (solo con el vaso).
- Los errores restan salud al empezar la plántula y tienen su «¿Por qué?».
- Se dibuja cada método.

**«¿Por qué?» nuevos:** pudrición de raíz (F9 + F3), quemadura de luz, maceta pequeña, lámpara HPS, maceta porosa
(F10) y la germinación (temperatura F11; humedad y tiempo, criterio de la autora).

**Archivos**
- `src/game/rules.json`: bloques `setup` (decisiones y efectos) y `germinacion`, y los eventos nuevos.
- `src/game/engine.js`: `setSetup`, `setupDecisions`, `fixedDecisions`, `start` con germinación, `applyGerm`,
  `transplant` y los efectos en `applyWeek` y `harvest`.
- `src/game/i18n-setup.js` (nuevo): todos los textos en 4 idiomas.
- `src/game/game.js`: las dos pantallas nuevas (las decisiones aparecen según lo elegido), el resumen del equipo,
  el aviso de hidroponía y el botón de trasplante.
- `src/game/tent.js`: maceta, `hydro()`, `lamp()`, `germScene()`, medidor, goteo, los dos problemas nuevos y
  objetos ocultos.
- `src/game/why.js`: 8 razones nuevas, fuentes F9, F10 y F11.
- `docs/juego-fuentes.md`: F9, F10 y F11 comprobadas, y lo que no se pudo comprobar.

**Pruebas**
- Nuevas:
  - `game-setup-db.mjs` **13 ok**: la migración, la vuelta atrás y las copias para staging;
  - `game-setup-engine.mjs` **31 ok**: cada efecto del equipo uno por uno, y el servidor acepta todos los
    estados;
  - `game-setup-ui.mjs` **27 ok**: las pantallas, lo que aparece y desaparece, hidroponía, trasplante, sin
    medidor, HPS, servidor, 4 idiomas, 360 px.
- Las pruebas que empezaban con «Plantar la semilla» usan ahora `startGame()` (en `browser.mjs`): equipo neutro y
  germinación ideal, así siguen en la semana 1 de la plántula con salud 100.
- **Batería completa (2026-10-29), en grupos de 4 a 6: 44 pruebas, 0 fallas.**

**Peso:** juego 189,1 → 237,9 KB (58,9 → 73,4 comprimido). Lo que más pesa son los textos de 4 idiomas. Se
descarga solo al entrar al juego.

**Para Bertha:**
1. **Pegar en staging** `supabase/staging/paso4c-juego-setup.sql`. Sin esto, guardar una partida con equipo
   falla en la web de pruebas.
2. Validar los «criterio de la autora» de las fases 6 y 7 (lista en `docs/juego-decisiones.md`).

**Lo siguiente:**
- **Varias plantas y autofloreciente** (semilla regular con macho posible, autofloreciente con calendario propio,
  número de plantas que agranda la carpa).
- Después, la **fase 9** (pulido final).
- Más tarde: varias plantas y autofloreciente; después, la fase 9.
- Fuera del juego, cerrado: Bertha comprobó que el arreglo de las flores funciona en la página publicada de `dev`.

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
