# Zona del juego — informe de la fase 1

Fecha: 14 de octubre de 2026 · Rama `juego` (sale de `dev`). Nada en producción, sin merge. No se tocaron las cuentas
Betian ni Mother Verde. Diseño completo: `docs/juego-diseno.md`.

## 1. Qué se hizo (un commit por paso)

| Paso | Commit | Qué |
|---|---|---|
| 1 | `59ec5a4` | Diseño (`docs/juego-diseno.md`) y reglas editables (`src/game/rules.json`) |
| 2 | `d0d8ce1` | Memoria en la base: migración, reversa, precheck propio, entrada en el precheck general y prueba |
| 3 | `2a50c5c` | Esqueleto jugable: variable de compilación, carga diferida, menú, bloqueo, guardado, 4 idiomas, motor |
| 4 | `c20b9d5` | Pruebas de navegador y botón «Juego» en la vista previa de dev |
| 5 | (este) | Este informe: peso y carga |

## 2. Base de datos: nombre y momento en el despliegue

- **Migración:** `supabase/migrations/20261015100000_game_progress.sql` (tabla `game_progress`, funciones
  `game_state_valid` y `game_save`).
- **Antes de pegarla:** `supabase/admin/precheck-game.sql` (solo lectura). Todas las filas `ok`.
- **Reversa:** `supabase/admin/rollback-20261015100000.sql` (borra el progreso de todas las personas).
- **Momento:** es **independiente** y va **después** del SQL del lanzamiento, porque usa `has_full_access()` de
  `20261010120000`. Se puede pegar el día que el juego vaya a producción, sin tocar nada más. No hace falta pegarla
  antes: con la web actual nadie llama a esas funciones.
  Orden de ese día: precheck-game → migración → merge de la rama del juego (con la variable encendida en producción
  solo cuando lo decidas).
- **Qué protege:** cada persona solo lee su fila (RLS). Nadie escribe la tabla directamente: solo `game_save`, que
  rechaza guardar sin acceso completo (la misma regla de la Comunidad), comprueba en el servidor cada clave del
  formato, limita a 16 KB y a 20 guardados por minuto, y nunca retrocede (si otro dispositivo va más adelante,
  devuelve ese progreso). Al bloquearse el acceso, la fila se conserva. Al borrar la cuenta, se borra la fila
  (clave con cascada) y la copia del navegador (`localStorage.clear()` del borrado de cuenta).

## 3. Peso añadido y carga

Medido con tres compilaciones (sin comprimir / comprimido con gzip):

| Compilación | Qué cambia frente a `dev` |
|---|---|
| **Variable apagada** (como `main` y `dev`) | `main.js` **+355 bytes** (+118 comprimidos: las 6 líneas que conectan el juego). `index.html` +1 byte. Ningún archivo del juego: no hay ni un texto del juego en `dist/`. |
| **Variable encendida**, al abrir la web | `entry.js` **2,1 KB** (1,1 KB comprimido): solo añade «Juego» al menú y la pantalla vacía. |
| **Variable encendida**, al entrar al juego | `game.js` **48,8 KB** (16,9 KB comprimido): motor, reglas, textos en 4 idiomas y pantalla. Se descarga **una sola vez, solo al entrar**. |

**Confirmado:** el juego **no** se descarga si la persona no entra. La prueba `game-ui` lo comprueba en el
navegador (ningún pedido de `game.js` tras cargar la web, ni siquiera cuando una cuenta bloqueada intenta entrar).

## 4. Cómo cumple los patrones de la plataforma

| Patrón | Cómo |
|---|---|
| 4 idiomas, cambio en vivo | Mismo sistema `translations` y `t()`; los textos del juego se registran al cargarlo (`mvAddTexts`). El botón de idioma vuelve a dibujar el juego. 121 claves × 4 idiomas, sin textos escritos a mano en el código. Reutiliza las claves de la plataforma para las lecciones y los tricomas. |
| Regla de acceso | Pantalla: `showScreen` manda a la **misma pantalla de bloqueo** si `mvAccessState()` está bloqueado. Servidor: `game_save` exige `has_full_access()`. Prueba de 24 h, aporte y regalo juegan; prueba vencida y acceso retirado, no. **Aviso:** la auditoría encontró que la regla de acceso todavía está en tres sitios (base, `auth.js` y `main.js`); el juego usa la de la base en el servidor y la de `main.js` en pantalla, igual que el resto de zonas. |
| Pantallas, carga, errores | Mismas clases (`card-block`, `btn`, `eyebrow`, `note-box`, `subhead`); «Cargando el juego…», error con «Reintentar», y mensajes de guardado con salida clara (cuenta, dispositivo, sin conexión, demasiados guardados, sin acceso). |
| Accesibilidad | Opciones como botones de radio reales con etiqueta, grupos con título, barra de salud con nombre, foco visible con teclado, objetivos de 44 px y contraste mínimo de 8,06:1. |
| Modo claro y oscuro | **La plataforma hoy solo tiene modo oscuro.** El juego usa sus mismas variables de color, así que se ve igual con el sistema en claro o en oscuro (comprobado) y seguirá a la plataforma cuando tenga modo claro. No le puse un modo claro propio para no desentonar: dime si lo prefieres de otra forma. |
| Vista previa de dev | Botón «Juego» en el panel de vista previa (solo en compilaciones con la variable encendida). Con «Ver como persona con prueba vencida», el juego muestra el bloqueo. |

## 5. Pruebas

| Prueba | Qué cubre | Resultado |
|---|---|---|
| `game-db.mjs` | regla de acceso en el servidor (prueba, vencida, aporte, regalo, retirado, sin sesión), RLS, escritura directa prohibida, 10 formatos inválidos, 16 KB, otro dispositivo, 20 por minuto, bloqueo y desbloqueo, cuenta borrada, reversa y precheck | 37 ✔ |
| `game-engine.mjs` | una planta completa, errores, los 5 eventos, respuestas, planta que no sobrevive, cosecha automática, sin azar, todos los estados aceptados por el servidor, textos en 4 idiomas, ninguna cifra de extracción, nada de dinero ni rankings | 29 ✔ |
| `game-ui.mjs` (navegador) | carga diferida, acceso (prueba, vencida, aporte, regalo), guardar, recargar, sin conexión, otro dispositivo, bloqueo con el juego abierto y desbloqueo, 4 idiomas en vivo, móvil y escritorio, claro y oscuro, accesibilidad, vista previa | 28 ✔ |
| Todo junto (`run-all.mjs`) | las 24 pruebas de la plataforma y del juego | **24 de 24, 826 comprobaciones + barrido de pantallas, 0 fallos** |

**Sin verificar: requiere prueba real.** Guardar contra el Supabase real: la migración no está pegada, así que la
web de la rama `juego` en Vercel guardará solo en el navegador («Guardado en este dispositivo»). Tampoco si Vercel
compiló la vista de la rama `juego` con la variable encendida.

## 6. Dudas para ti (antes de seguir)

1. **Cifras de la plataforma en Elaboración:** la plataforma ya publica una temperatura y un tiempo para el rosin con
   plancha de pelo (unos 90–120 °C, 5–10 s) y para descarboxilar. El juego **no** los usará. ¿Quieres revisar
   también esos textos de la plataforma?
2. **Datos que la plataforma no da** (no los inventé; esa decisión no puntúa): temperatura en floración y
   temperatura, humedad y nutrientes en plántula. Si Bertha los da, se añaden en `rules.json` sin tocar el código.
3. **Humedad en vegetativo (respondida):** «media-alta», ≈ 65–75 % HR (VPD 0,8–1,0 kPa a 24–25 °C). Pendiente de
   confirmación de Bertha.
4. **Poses nuevas del científico** (lista en el diseño, punto 7): preocupado, contento, explicando, con lupa, con
   casco y gafas, pensando. **Aprobadas (20-10-2026) y ya en el juego** (`src/game/poses.js`; la hoja está en `design/scientist/poses-sheet.png`). «Con casco» se usa en la pantalla del rosin (seguridad) y volverá en la fase 3.
5. **Modo claro:** ver la tabla de arriba.

## 7. Búsqueda de «Verdi» y de un tutor de IA

- **Nada visible para las personas.** En la web publicada no aparece «Verdi» en ningún texto, menú, pantalla ni en
  los 4 idiomas. Las coincidencias de «verdi» en `index.html` y `main.js` son la palabra «verdict» (veredicto de
  las calculadoras y de la cosecha).
- **Restos internos:**
  - un comentario en `public/style.css` (línea 288, «VERDI VISUAL LANGUAGE…»), que llega al CSS publicado pero
    es invisible;
  - dos maquetas en `reference/` (`verdi-about.html` y `verdi-app-mockup.html`), con el texto «Your AI cannabis
    tutor». **No se publican**: la carpeta no entra en la compilación (`dist/` no la contiene).
- **Política de privacidad:** sin menciones de Verdi ni de IA.
- **Llamadas a servicios de IA:** ninguna a un asistente o tutor de IA (ni OpenAI, ni Anthropic, ni Gemini, ni
  ninguna similar). Los únicos servicios externos con datos son Supabase, DeepL (**traducción automática** de las
  publicaciones de la Comunidad), la red Base, Resend/SMTP para correos y Cloudflare Turnstile (si se activa). DeepL
  es traducción automática, no un tutor; ya figura en la lista de proveedores pendiente de la política.

## 8. Fase 2: secado, curado y rosin (20-10-2026, rama `juego`)

**Cómo se juega.** Al cosechar, la planta ya no va directa al resultado: pasa por **Secado → Curado → Prensa de
rosin (opcional)**. Cada etapa es **una sola pantalla de decisiones** (no semanas) y **no hay nada elegido de
antemano**; si falta un grupo, aparece «Elige una opción en cada grupo para seguir». Una planta que no sobrevive va
directa al resultado. El rosin se puede saltar («Terminar sin hacer rosin»).

**De dónde sale cada valor ideal** (`src/game/rules.json` → `post`, todo marcado [POR VERIFICAR POR BERTHA]):

| Etapa | Decisión | Ideal | Fuente en la plataforma |
|---|---|---|---|
| Secado | temperatura de la sala | fresca (15–18 °C) | Elaboración → Procesos & SOP, SOP-01 |
| Secado | humedad de la sala | media (HR 55–60 %) | SOP-01 |
| Secado | ventilador | a la pared | Equipamiento → 5. Secado («nunca directo a las flores») |
| Secado | luz | a oscuras | Equipamiento → 5. Secado («espacio 100 % oscuro») |
| Secado | hasta cuándo | hasta el chasquido (≈ 7–14 días) | SOP-01 y Temporizador de secado («prueba del chasquido») |
| Curado | envase | frasco de vidrio hermético | Equipamiento → 6. Curado |
| Curado | humedad en el frasco | media (HR 58–62 %) | SOP-02 |
| Curado | abrir los frascos | cada día la primera semana | Temporizador de secado («burping diario») |
| Curado | tiempo | 2–4 semanas o más | SOP-02 («duración mínima 2–4 semanas») |
| Rosin | material | ya curado | Concentrados → Rosin («flor, hash o kief ya curado») |
| Rosin | calor | medio | Técnicas caseras («a temperatura media»); en el juego **solo el nivel** |
| Rosin | presión | **no puntúa** | la plataforma no da un nivel (no lo inventé) |
| Rosin | papel | pergamino | Concentrados → Rosin («sobre papel pergamino, sin solventes») |
| Rosin | protección | guantes y superficie estable | diseño aprobado de la fase 2 (avisos de quemaduras) |

**Puntuación (VALOR DE JUEGO).** Igual que en el cultivo: un nivel de distancia resta 4 y dos niveles, 8. Lo del
secado y el curado se resta de la nota de la cosecha → **nota final del cogollo**. El rosin **no cambia esa nota**:
tiene su propio veredicto («bien hecho» o «para mejorar: …»), y sin protección el guía avisa de las quemaduras.

**Rosin solo cualitativo** (decisión del 14-10-2026): bajo / medio / alto, **sin temperaturas, tiempos, presiones
ni cantidades**. Una prueba revisa que ninguno de sus textos (4 idiomas) ni sus reglas tengan una sola cifra, y otra
lo comprueba en la pantalla real. El aviso de seguridad se ve siempre en la pantalla del rosin. Siguen prohibidos
en todo el juego butano, BHO, CO2 y unidades de presión (eso es la fase 3, que requiere tu aprobación del guion).

**El guía.** Contento si todo va bien, preocupado si algo restó, pensando si falta un dato, y **con casco y gafas en
la pantalla del rosin** (es la pantalla de seguridad; en la fase 3 se volverá a usar).

**Lecciones.** «Repasar la lección» lleva a **Elaboración → Procesos & SOP** (secado y curado) y a **Elaboración →
Concentrados** (rosin).

**Base de datos.** Como la migración `20261015100000_game_progress.sql` **todavía no se ha pegado en ningún
Supabase**, la amplié en el mismo archivo (no hace falta una migración nueva): acepta las etapas `secado`, `curado`
y `rosin` y una clave `post` pequeña (máx. 1000 bytes, solo esas tres etapas). Si alguien ya la hubiera pegado en
staging, basta con volver a pegar el archivo entero: es `create or replace`.

**Pruebas.** `game-engine` 44 (antes 30), `game-ui` 44 (antes 28): partida completa con secado, curado y rosin,
saltar el rosin, errores y su resta, opciones inventadas rechazadas, el servidor acepta todos los estados nuevos,
guardar y recargar en mitad del curado, 4 idiomas en la pantalla del rosin sin claves a la vista, móvil sin
desborde y con opciones de 44 px, y el botón de repasar abre Elaboración → Procesos & SOP. `game-db` 37 sin cambios.

**Decisiones de la dueña (20-10-2026).**
1. **Rosin con veredicto propio:** aprobado. No baja la nota del cogollo.
2. **Presión del rosin:** se queda **sin puntuar** por ahora. Bertha decidirá más adelante un nivel **cualitativo**
   (bajo / medio / alto), sin cifras; se cambia en `rules.json` sin tocar el código.
3. **Protección (guantes y superficie estable):** sigue pendiente de que Bertha confirme la redacción.
4. **Guion de la fase 3** (`docs/juego-fase3-guion.md`): **todavía NO aprobado**, en revisión. No se programa nada de la fase 3.

## 9. Fase 3: laboratorio de seguridad (20-10-2026, rama `juego`)

**Programada según el guion aprobado** (`docs/juego-fase3-guion.md`), un commit por escena:

| Commit | Escena |
|---|---|
| `301eaf4` | Base y escena 1: entrada (frase aprobada) y «¿Qué es una extracción?» (3 tarjetas y una pregunta) |
| `1f5c06b` | Escena 2: BHO, encuentra los peligros en una cocina (6 peligros y 2 cosas que no lo son) |
| `e0181a2` | Escena 3: el laboratorio con licencia (6 cosas que lo hacen seguro) |
| (ver git log) | Escena 4: CO₂, alta presión (3 tarjetas y una pregunta), final «Laboratorio visitado», peso y este informe |

**Cómo se entra.** Al terminar una partida de la fase 2 aparece «Visitar el laboratorio de seguridad». Es opcional, no
da puntos, y se guarda solo «laboratorio visitado» (cuántas veces). Se puede salir en cualquier momento.

**Reglas que comprueba la prueba automática** (`tests/sim/game-lab.mjs`, 35 comprobaciones, en los 4 idiomas):
- **Ni una cifra** en ningún texto del laboratorio ni en el botón para entrar; y en el navegador, ninguna cifra en
  ninguna pantalla del laboratorio. «CO₂» va con el ₂ pequeño para que esta regla no tenga excepciones.
- **Sin palabras de procedimiento** (paso, llenar, cargar el gas, tiempo de purga, vacío, unidades, válvulas,
  mangueras, tanques…) ni piezas de equipo por dentro.
- **Sin marcas, modelos, tiendas ni enlaces.**
- **Sin número de emergencias**: solo «llama a emergencias».
- **Toda respuesta insegura** termina en «Detener todo y llamar a un profesional».
- **Sin manera de «ganar» extrayendo**: sin puntos ni ranking en el laboratorio.
- Los dibujos no llevan texto, imágenes externas ni enlaces; los botones del dibujo no se tapan entre sí.

**Dibujos.** Cocina y laboratorio en SVG plano, mismo estilo que el científico, con los colores de la app. Ningún
equipo muestra su interior: el «aparato hecho en casa» es una caja cerrada con cinta y el «sistema cerrado» es un
armario sellado con candado y sello. Sobre cada cosa hay un botón real (48 px, con nombre en los 4 idiomas) para el
teclado y los lectores de pantalla.

**Guía.** Con casco y gafas en todo el laboratorio.

**Guardado.** Los toques en los dibujos y las respuestas equivocadas se guardan en el dispositivo y viajan con el
siguiente guardado (al cambiar de escena), para no chocar con el límite de 20 guardados por minuto. La migración
`20261015100000` (sin pegar) acepta una clave `lab` pequeña (máx. 600 bytes, solo escenas conocidas).

**Peso añadido** (compilación con el juego encendido, comparada con la de antes de la fase 3):

| Archivo | Antes | Después | Cuándo se descarga |
|---|---|---|---|
| `main.js` (la plataforma) | 501,46 KB | 501,46 KB (sin cambio) | siempre |
| entrada del juego (`entry`) | 2,07 KB (1,07 comprimido) | 2,25 KB (1,14 comprimido) | siempre, solo en la rama `juego` |
| juego (`game`) | 84,71 KB (27,06 comprimido) | 86,46 KB (27,71 comprimido) | al entrar al juego |
| **laboratorio (`lab`, nuevo)** | — | **36,69 KB (12,97 comprimido)** | **solo al pulsar «Visitar el laboratorio»** |

Con el juego apagado (`main` y `dev`) no se compila ningún archivo del juego ni del laboratorio.

**Pruebas.** `game-lab` 35 (nueva), `game-ui` 54, `game-engine` 44, `game-db` 37.

**Pendiente.** Añadir al Glosario los textos aprobados (lista en el guion, punto 9). Las explicaciones de las cosas
del laboratorio («luces, enchufes y aparatos están hechos para no provocar chispas», «el aire se renueva y un
detector avisa si hay gas», «todo se revisa con frecuencia siguiendo guías de buenas prácticas») desarrollan los
puntos aprobados y también podrían ir al Glosario.
