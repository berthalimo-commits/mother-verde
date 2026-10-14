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
3. **Humedad en vegetativo:** la plataforma da VPD 0,8–1,0 kPa, no un porcentaje. Puse «media» como deducción y lo
   marqué como DERIVADO. Que Bertha lo confirme.
4. **Poses nuevas del científico** (lista en el diseño, punto 7): preocupado, contento, explicando, con lupa, con
   casco y gafas, pensando.
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
