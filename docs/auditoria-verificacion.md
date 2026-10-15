# Auditoría de verificación final

Fecha: 14 de octubre de 2026 · Rama `dev` (`6939e0c`) · **Solo lectura**: no se cambió código, base ni configuración.
No se envió ningún correo real y no se tocaron las cuentas Betian ni Mother Verde. Todo se probó con la base simulada
(Postgres real con todas las migraciones) y Chrome sin pantalla. Los ataques se escribieron en scripts temporales fuera del
repositorio.
Prioridades: 🔴 P0 · 🟠 P1 · 🟡 P2 · 🔵 P3 · ⚪ P4. **SIN VERIFICAR: requiere prueba real** = solo se puede comprobar en el
Supabase o el Vercel reales.

---

## 0. Lo primero que hay que saber

**Desde la auditoría anterior (commit `2f6dd3f`, 13 de octubre) solo hay dos cambios en `dev`:**

| Commit | Qué cambia |
|---|---|
| `3077499` A1.1 | Al borrar una cuenta se conservan los avisos con TXID, sin datos de la persona |
| `6939e0c` A1.2 | Pago tardío: con la reserva vencida se puede registrar el TXID, que siempre pasa a revisión manual |

No hay otras ramas, ni cambios guardados aparte (*stash*), ni otras copias de trabajo. `origin/dev` es igual a `dev`.
**El resto de la lista del encargo no existe en el código.** Eso incluye el aviso de TXID, el plazo único, la regla de
acceso unificada, la activación en vivo, «Cargando…», las cabeceras y la CSP, la página 404, la Bitácora, el botón atrás
y las rutas, los nombres del menú, cambiar la contraseña, la pestaña de reportes, el texto legal, la velocidad, las fuentes
y banderas propias y staging. **`docs/staging.md` no existe.** La corrección de correo es anterior a la auditoría
(`7dc4369`) y ya estaba revisada.
La cabecera de `tests/sim/a1-money.mjs` dice que la prueba cubre «notice to support on a new TXID, one access rule, live
refresh helpers», pero esas partes no existen y la prueba no las comprueba (🔵 P3, comentario engañoso).

---

## 1. Cierre de la auditoría anterior

Leyenda: ✔ arreglado · ✘ sin arreglar · ⚠ arreglado a medias. «Sin cambios» = el código citado es el mismo que en `7dc4369`.

### Ronda 1 — arquitectura, navegación, rutas, roles, autenticación

| # | Prio. | Estado | Prueba |
|---|---|---|---|
| 1.1 «Directorio» y «Diagnóstico» con dos significados | 🟠 | ✘ | `index.html:284` (Cultivo → Diagnóstico), `:2595` (Negocio → Directorio), `:2856` (tipo de publicación «Diagnóstico») |
| 1.2 Bitácora y tricomas enterrados | 🟡 | ✘ | sin cambios en el menú |
| 1.3 «Más ▾» mezcla cosas distintas | 🟡 | ✘ | sin cambios |
| 1.4 Dos «cuentas» (Perfil / Cuenta) | 🟡 | ✘ | sin cambios |
| 1.5 Ficha de país sin dirección | 🔵 | ✘ | no hay rutas (ver 2.2) |
| 1.6 Inicio sin tarjetas a Ciencia/Seguridad/Comunidad | 🔵 | ✘ | sin cambios |
| 1.7 Lema «Codex global» | ⚪ | ✘ | sigue en la cabecera (capturas) |
| 1.8 Acceso y Desbloquear sin dirección propia | 🟡 | ✘ | sin rutas |
| 2.1 «Atrás» saca de la web | 🟠 | ✘ | no hay `pushState` ni `popstate` en `public/main.js` ni en `src/`; solo `history.replaceState` en `src/auth.js:520` (limpiar enlaces de correo) |
| 2.2 Sin enlaces profundos | 🟠 | ✘ | igual que 2.1 |
| 2.3 El logo no lleva a Inicio | 🟡 | ✘ | `index.html:59` `<div class="brand">` sin acción |
| 2.4 Pestaña bloqueada cambia en silencio | 🟡 | ✘ | sin cambios |
| 2.5 Búsqueda hacia contenido bloqueado | 🔵 | ✘ | sin cambios (SIN VERIFICAR con cuenta real) |
| 2.6 Enlaces externos vivos | 🔵 | SIN VERIFICAR | requiere prueba real |
| 2.7 Móvil sin desbordes | 🔵 | ✔ | 92 capturas a 390 y 1280 px: 0 páginas con desplazamiento horizontal |
| 2.8 «Volver a Inicio» pierde contexto | ⚪ | ✘ | por diseño |
| 3.1 Contenido de pago público | 🟠 | ✘ | todo sigue en `index.html` (591 KB) y `main.js` |
| 3.2 Sin 404 ni redirecciones | 🟡 | ✘ | `vercel.json` solo tiene `crons`; no hay `404.html` |
| 3.3 Nombre `subscription-cron` | 🔵 | ✘ | `api/subscription-cron.js` |
| 3.4 `motherverdeny.com` → `www` | 🔵 | SIN VERIFICAR | requiere prueba real |
| 3.5 Panel adivinable | ⚪ | ✘ | aceptado |
| 4.1 Bitácora escribible sin acceso | 🟡 | ✘ | reglas `bitacora_*_own` sin cambios (`20260811205653…:94-103`) |
| 4.2 `community_can_view` / `is_mutual` | 🟡 | ✘ | siguen concedidas a `authenticated` (`20261010130000…:155-156`) |
| 4.3 Fotos públicas por enlace | 🟡 | ✘ | bucket sin cambios |
| 4.4 `avatar_url` / `cover_photo_url` libres | 🟡 | ✘ | sin validación en la base |
| 4.5 `photo_url` libre | 🔵 | ✘ | `community-publish-post/index.ts:322` acepta cualquier texto |
| 4.6 Permiso de ejecución en disparadores | 🔵 | ✘ | no hay `revoke` para `handle_new_user` ni `handle_community_swipe` |
| 4.7 Sin escaladas | ✅ | ✔ | confirmado hoy con ataques: PATCH directo a `support_claims` y a `profiles` → 400 sin cambios; `admin_*` → `not_allowed`; `svc_*` → `permission denied` |
| 4.8 Nadie lee los reportes | 🔵 (🔴 en la matriz) | ✘ | `community_reports` solo aparece en `src/mvCommunity.js:358` (insertar); ni `src/admin.js` ni ninguna función de admin la lee |
| 4.9 Admin bloqueada al vencer su prueba | 🔵 | ✘ | se resuelve con el bloque «hello@ = admin + acceso completo» (pedido aparte) |
| 5.1 Captcha apagado y hook pendiente | 🟠 | ✘ | configuración (SIN VERIFICAR en Supabase) |
| 5.2 Cambiar la contraseña con sesión | 🟡 | ✘ | `updateUser({ password })` solo en el formulario de recuperación (`src/auth.js:309-319`) |
| 5.3 Sesión en `localStorage` sin CSP | 🟡 | ✘ | no hay CSP (ver 13.1) |
| 5.4 Correo de contacto frente al de inicio de sesión | 🟡 | ✘ | sin cambios |
| 5.5 «Confirm email» activado | 🟡 | SIN VERIFICAR | requiere prueba real |
| 5.6 Hora del dispositivo | 🔵 | ✘ | `computeIsPremium` usa `Date.now()` (`src/auth.js:44`) |
| 5.7 Borrar y volver a registrarse da 24 h | 🔵 | ✘ | aceptado |
| 5.8 Contraseña antes de «sin confirmar» | 🔵 | SIN VERIFICAR | requiere prueba real |
| 5.9 MFA para miembros | ⚪ | ✘ | — |

### Ronda 2 — base de datos, flujos, negocio, sincronía, contradicciones

| # | Prio. | Estado | Prueba |
|---|---|---|---|
| 6.1 Borrar la cuenta borra avisos con pago | 🟠 | ✔ en código · ⚠ en despliegue | migración `20261014100000`; `a1-money.mjs` (11 comprobaciones); ataque 5c: los avisos de cuentas borradas no se ven desde el navegador. **Pero la migración no figura en el orden de `docs/lanzamiento-produccion.md`** (ver N6) |
| 6.2 `community_reports.target_id` sin clave | 🟡 | ✘ | sin cambios |
| 6.3 Nombre visible duplicado | 🟡 | ✘ | decisión anterior |
| 6.4 Correo en tres sitios | 🟡 | ✘ | por diseño |
| 6.5 `email_normalized` no único | 🔵 | ✘ | sin cambios |
| 6.6 Columnas del modelo viejo | 🔵 | ✘ | siguen y se leen (`src/auth.js:53-54`) |
| 6.7 Registros sin limpieza | 🔵 | ✘ | sin cambios |
| 6.8 Índice de publicaciones por persona | 🔵 | ✘ | sin cambios |
| 6.9 Consultas sin límite | 🔵 | ✘ | `admin_list_claims` se rehízo en A1.1, también sin límite ni páginas |
| 6.10 Montos, TXID y códigos | ✅ | ✔ | pruebas `test.mjs` y `a1-money.mjs` |
| 7.1 Publicar la web antes del SQL | 🔴 | ✘ (riesgo de proceso) | sigue igual, y ahora hay 2 migraciones más que no están en el orden (N6) |
| 7.2 Dirección USDC en dos sitios | 🟠 | ✘ | `src/supportConfig.js:17` frente al secreto `SUPPORT_ADDRESS` (`support-claims/index.ts:218`); nada compara las dos |
| 7.3 `community-translate` sin uso | 🟡 | ✘ | la carpeta `supabase/functions/community-translate/` sigue; SIN VERIFICAR si está desplegada |
| 7.4 Feed sin «ver más»; directorio en el navegador | 🟡 | ✘ | `listFeedPosts` acepta `before` (`src/mvCommunity.js:232-235`), pero la pantalla no lo usa |
| 7.5 `photo_url` sin validar | 🟡 | ✘ | igual que 4.5 |
| 7.6 Condiciones de carrera | 🔵 | ✔ | `submit_support_claim_tx` ahora bloquea la fila (`for update`) |
| 7.7 Dar días, revocar y devolver acceso sin botones | 🟡 | ✘ | `src/admin.js` no llama a `admin_grant_days`, `admin_revoke_access` ni `admin_create_gift_codes`; no existe «devolver acceso» |
| 7.8 Validación doble | 🔵 | ✔ | — |
| 8.1 Pago tardío sin camino | 🟠 | ⚠ a medias | A1.2 añade el camino para la persona (captura 6, 4 idiomas, `a1-money.mjs` sección 2). Pero abre un agujero nuevo (N1), el panel pierde la marca (N2), no tiene límite de antigüedad (N3) y **el panel sigue sin poder registrar un TXID a mano**, que también se pidió en 19.4 |
| 8.2 Sin plazo ni aviso para la revisión | 🟠 | ✘ | `support-claims/index.ts` no envía ningún aviso a hello@; el panel no marca avisos de más de 24 o 48 h |
| 8.3 «trialing» no cambia al vencer | 🟡 | ✘ | — |
| 8.4 «Des-revocar» devuelve días viejos | 🟡 | ✘ | — |
| 8.5 Rechazado y vuelta a empezar | 🟡 | ✘ | — |
| 8.6 Tope de 99 montos por cantidad | 🔵 | ✘ | (los tardíos ahora quedan fuera de este tope) |
| 8.7 Aceptar 0,50 USDC menos solo a mano | 🔵 | ✘ | decisión |
| 8.8 Cuentas antiguas sin confirmar | 🔵 | ✘ | coherente con la regla |
| 8.9 Cálculos en el servidor y en enteros | ✅ | ✔ | — |
| 9.1 Activación no llega a la app abierta | 🟡 | ✘ | el temporizador de `main.js:7137` solo recalcula fechas; no hay `visibilitychange` ni consulta periódica |
| 9.2 Revocación no inmediata | 🟡 | ✘ | igual |
| 9.3 Varias pestañas antes de confirmar | 🔵 | ✘ | — |
| 9.4 Trabajador de servicio viejo | 🔵 | SIN VERIFICAR | requiere un móvil con la versión vieja |
| 9.5 Refresco tras acciones | ✅ | ✔ | `submitLate` también llama a `mvRefreshAuth` (`src/desbloquear.js`) |
| 10.1 Borrador de privacidad: el directorio sería público | 🟠 | ✘ | `docs/politica-privacidad-borrador-es.md:36` sigue igual. **Y la pantalla de Privacidad de la app dice lo mismo, y cosas peores** (N7) |
| 10.2 `active` sin fecha: acceso en pantalla, no en la base | 🟡 | ✘ | `src/auth.js:53-54` |
| 10.3 Bitácora | 🟡 | ✘ | igual que 4.1 |
| 10.4 Promesa de 48 h sin mecanismo | 🟡 | ✘ | igual que 8.2 |
| 10.5 Correo de activación frente a la app bloqueada | 🟡 | ✘ | igual que 9.1 |
| 10.6 Fotos | 🟡 | ✘ | igual que 4.3 |
| 10.7 Hora del dispositivo | 🔵 | ✘ | igual que 5.6 |
| 10.8 Lógica «Premium» vieja | 🔵 | ✘ | `FULL_GATES`, `applyTier`, `openPremium` (`main.js:8550`) |
| 10.9 Registro de auditoría sin su aviso | 🔵 | ✔ | el aviso se conserva y la aprobación anota `account_deleted` (`20261014100000`, `svc_approve_claim`) |
| 10.10 Palabras internas | 🔵 | ✘ | — |
| 11 Base compartida entre dev y producción | 🔴 | ✘ | un solo proyecto (el `.env.local` apunta a `uoba…`); no hay proyecto de pruebas ni `docs/staging.md` |
| 11 Correos de Supabase sin plan B | 🟠 | ✘ | — |
| 11 Límite de correos por hora | 🟠 | SIN VERIFICAR | paso 10 de la lista de lanzamiento |
| 11 Google Fonts y flagcdn | 🟡 | ✘ | `index.html:7-8`; 34 banderas de `flagcdn` |

### Ronda 3 — errores, seguridad, rendimiento, código, consistencia

| # | Prio. | Estado | Prueba |
|---|---|---|---|
| 12.1 «Cargando…» sin salida | 🟠 | ✘ | `src/auth.js:64-67` devuelve `null` ante cualquier error; `main.js:6816` → `loading`; `main.js:6971-6972` solo pinta «Cargando…», sin reintento |
| 12.2 Sin mensaje «sin conexión» | 🟡 | ✘ | — |
| 12.3 Errores del servidor en el panel, en inglés | 🟡 | ✘ | aceptado para la admin |
| 12.4 404 de Vercel en inglés | 🔵 | ✘ | igual que 3.2 |
| 12.5 Publicidad sin límite de envíos | 🔵 | ✘ | `api/ad-inquiry.js` |
| 13.1 Sin cabeceras de seguridad | 🟠 | ✘ | `vercel.json` sin `headers`; ninguna `Content-Security-Policy` en `index.html` ni en `panel-mv.html` |
| 13.2 Contenido de pago público | 🟠 | ✘ | igual que 3.1 |
| 13.3 `community-translate` | 🟡 | ✘ | igual que 7.3 |
| 13.4 Imágenes de terceros | 🟡 | ✘ | — |
| 13.5 Fotos públicas | 🟡 | ✘ | — |
| 13.6 Relaciones consultables | 🟡 | ✘ | — |
| 13.7 Terceros con la IP de cada visita | 🟡 | ✘ | — |
| 13.8 Captcha y hook | 🟡 | ✘ | — |
| 13.9 / 13.10 Formulario de publicidad | 🔵 | ✘ | — |
| 13.11 `mvAvatarHtml` sin escapar al principio | 🔵 | ✘ | sin cambios |
| 13.12 Panel público | 🔵 | ✘ | aceptado |
| 13.13 Permisos en disparadores | 🔵 | ✘ | igual que 4.6 |
| 13.14 Sesión en `localStorage` | ⚪ | ✘ | — |
| 14.1 `main.js` de 3 MB | 🟠 | ✘ | `public/main.js`: **2.973.643 bytes, 9.732 líneas** (21 más que antes); `dist/main.js`: 2,9 MB |
| 14.2 a 14.9 | 🟡/🔵/⚪ | ✘ | sin cambios |
| 15.1 Archivo único gigante | 🟠 | ✘ | 9.732 líneas |
| 15.2 Dos sistemas de bloqueo | 🟡 | ✘ | — |
| 15.3 Regla de acceso en tres sitios | 🟡 | ✘ | `is_premium()` / `computeIsPremium()` (`src/auth.js:42`) / `mvAccessState()` (`main.js:68xx`) |
| 15.4 a 15.7 | 🟡/🔵 | ✘ | — |
| 15.8 Puntos fuertes | ✅ | ✔ | 19 pruebas, 670 comprobaciones (punto 6) |
| 16.1 a 16.7 | 🟡/🔵/⚪ | ✘ | sin cambios (16.3: siguen los `span` con `onclick`) |

### Ronda 4 — funciones que faltaban (punto 19) y críticos (punto 21 E)

| # | Estado | Prueba |
|---|---|---|
| 19.1 Aviso a la admin cuando llega un TXID | ✘ | nada en `support-claims` ni en el panel |
| 19.2 Revisar reportes de Comunidad | ✘ | igual que 4.8 |
| 19.3 No perder avisos con pago al borrar la cuenta | ✔ | A1.1 |
| 19.4 Camino para el pago tardío + registrar un TXID a mano en el panel | ⚠ | la parte de la persona sí; la del panel no |
| 19.5 Textos legales finales | ✘ | `index.html:3615` (`tc5P`) y `:3663` (`ppv4P`) siguen `[PENDIENTE]`; ver N7 |
| 19.6 Salir de «Cargando…» | ✘ | igual que 12.1 |
| 19.7 a 19.14 (atrás y rutas, cabeceras, refresco, botones del panel, «ver más», contraseña, staging, copias) | ✘ | ver 2.1, 13.1, 9.1, 7.7, 7.4, 5.2, 11; las copias de seguridad, SIN VERIFICAR |
| 19.15 a 19.22 | ✘ | — |
| Críticos 21 E: 1 (web antes del SQL) ✘ · 2 (base compartida) ✘ · 3 (aviso de TXID) ✘ · 4 (borrar cuenta) ✔ · 5 (pago tardío) ⚠ · 6 («Cargando…») ✘ · 7 (cabeceras) ✘ · 8 (atrás) ✘ · 9 (3 MB) ✘ · 10 (privacidad) ✘ · 11 (USDC en dos sitios) ✘ | | |

**Balance:** de unos 120 hallazgos, **4 quedaron arreglados** (6.1, 10.9, 19.3 y 7.6, este de paso) y **1 a medias** (8.1/19.4).
Otros 8 que estaban bien siguen bien. El resto sigue abierto.

---

## 2. Regresiones y problemas nuevos

Revisé el *diff* completo `2f6dd3f..6939e0c` (13 archivos de código, 2 migraciones, 2 reversas, precheck y pruebas).
De los cambios de la lista del encargo, solo existen el pago tardío y las cuentas borradas con pagos (ver punto 0).

| # | Prio. | Hallazgo | Prueba |
|---|---|---|---|
| **N1** | 🟠 P1 | **Un pago tardío puede «robar» el TXID de otra persona.** Para que el pago tardío funcione, los avisos tardíos quedaron fuera de la regla «un aviso abierto por monto». Las transferencias en Base son públicas. Quien tenga una reserva vencida con el mismo monto que la reserva vigente de otra persona puede registrar como suyo el TXID del pago de esa persona. El aviso queda en revisión manual, la persona que pagó de verdad recibe «TXID ya usado» y el panel no avisa de que hay dos avisos con el mismo monto. El monto coincide con los dos, así que la admin podría aprobar al atacante. | ataque simulado: 1a → 200, `manual_review`; 1b → 400 `tx_already_used` |
| **N2** | 🟡 P2 | **El panel pierde la marca de «pago tardío».** `admin_list_claims` no devuelve `late` y `src/admin.js` no la menciona. Además, al pulsar «Comprobar en Base», `svc_record_claim_check` sustituye el motivo `reserva_vencida` por los códigos de la comprobación (`solicitud_no_vigente…`). | `20261011120000…:244-246`; `grep late src/admin.js` = 0 |
| **N3** | 🔵 P3 | **Sin límite de antigüedad**: una reserva vencida hace 200 días todavía acepta un TXID tardío. | ataque 4 → 200 `manual_review` |
| **N4** | 🔵 P3 | El formulario del pago tardío no pide nombre ni teléfono opcionales (el normal sí). Así es más difícil contactar justo con quien está en el caso dudoso. | `lateFormHtml` en `src/desbloquear.js` |
| **N5** | 🔵 P3 | **Dos promesas a la vez**: tras un pago tardío se ve «Recibido… te escribiremos cuando lo revisemos» y, debajo, «Lo revisamos en un máximo de 48 horas». | `claimHtml` (`dsTardeOk` + `dsPendingP`) |
| **N6** | 🟠 P1 | **`docs/lanzamiento-produccion.md` no incluye `20261014100000` ni `20261014110000`**, ni en el orden de pegado (paso 6), ni en la tabla de reversas (sección 4). La app ya pide la columna `late` (`src/auth.js:93`). Si la web sale sin esa migración, la consulta falla, `mvLatestClaim` queda vacío y **cada persona deja de ver su aviso abierto** (reserva, pendiente, en revisión). El precheck sí comprueba los dos objetos. | `docs/lanzamiento-produccion.md:136-139` y `:89-101` |
| **N7** | 🔴 P0 (para abrir al público) | **La pantalla de Privacidad de la app dice cosas falsas**: «la mayoría de los datos se guardan localmente en tu propio dispositivo», «si en el futuro almacenamos datos en servidores…», con fecha «julio de 2026». En realidad, las cuentas, la Bitácora, la Comunidad, los avisos de aporte (TXID, monto, nombre y teléfono opcionales), los registros y los correos están en Supabase. No estaba en la auditoría anterior (solo se miró el `[PENDIENTE]` y el borrador). | `index.html:3640-3700` (sección «Política de Privacidad») |
| **N8** | 🟠 P1 | **El texto de Comunidad está desfasado y contradice la base**: «necesita cuentas de usuario y moderación real (backend) — es el plan de construcción, no una simulación… el directorio… lo puede ver cualquier persona que use la app». Hoy hay cuentas y el directorio solo se ve con acceso completo. Además, el encabezado dice «COMUNIDAD — PRÓXIMAMENTE». | `index.html:2834` (`cmySub`), también en los otros idiomas de `main.js`; captura 9 |
| N9 | ⚪ P4 | En la compilación de producción quedan nombres de la vista previa sin efecto: la variable `mvAccessPreviewState` (siempre vacía) y los textos del aviso de demostración en `panel-*.js`. No se puede activar: `mvPreviewOn = false` y los datos de ejemplo no están. | `dist/main.js:6771` |
| N10 | ⚪ P4 | **La app no tiene modo claro**: no responde a `prefers-color-scheme`. Las capturas «claro» y «oscuro» salen idénticas. No es un fallo, pero el recorrido «en claro y oscuro» no se puede hacer. | comparación byte a byte de las capturas |
| N11 | 🔵 P3 | Comentario engañoso en `tests/sim/a1-money.mjs:1-2` (ver punto 0). | — |

Sin regresiones en lo que ya funcionaba: las 19 pruebas pasan, incluidas las de antes del cambio (punto 6). La única prueba
vieja que se cambió (`test-part2.mjs`, «solicitud vencida») se adaptó a la regla nueva, y la regla nueva se comprueba.

---

## 3. Seguridad de lo nuevo

| Comprobación | Resultado |
|---|---|
| RLS de `20261014100000` | ✔ No crea tablas. Los avisos sin cuenta (`user_id` vacío) no los ve ninguna cuenta (ataque 5c → `[]`). La restricción `support_claims_owner_or_deleted` impide un aviso sin cuenta que conserve nombre o teléfono. Los disparadores no se pueden llamar (`permission denied`). |
| RLS de `20261014110000` | ✔ Solo concede leer la columna `late` de los avisos propios. La persona ve solo los suyos (5a). Las columnas de contacto siguen cerradas (5b → 400). `submit_support_claim_tx` comprueba que el aviso sea de quien llama (ataque 2 → `not_found`). Una reserva cancelada no acepta TXID (ataque 3). |
| Funciones de admin y de servicio | ✔ Como cuenta normal: `admin_approve_claim`, `admin_reject_claim`, `admin_list_claims`, `admin_export_csv` → `not_allowed`; `svc_claim_context`, `svc_record_claim_check`, `svc_approve_claim` → `permission denied`. |
| Funciones con «Verify JWT» apagado | ✔ `support-claims` y `admin-send-gift-code` validan el token por su cuenta (`auth.getUser`, `index.ts:326` y `:230`) y las acciones de admin exigen `is_admin_aal2`. `community-retranslate` exige la clave secreta (comparación en tiempo constante, `index.ts:100`). `signup-fix-email`, sin cambios (30 ataques superados hoy). |
| Panel con MFA | ✔ La verificación está en la base (`is_admin_aal2()` dentro de cada `admin_*`), no solo en la pantalla. `panel-ui`: una cuenta normal y una admin sin MFA quedan rechazadas. |
| Datos personales en funciones | ✔ `svc_claim_context` devuelve el correo vacío si la cuenta se borró. El CSV pone «cuenta borrada». No hay funciones nuevas expuestas al navegador. |
| Correos nuevos | ✔ No hay plantillas ni correos nuevos desde la auditoría. Aprobar un aviso de una cuenta borrada no envía nada. |
| CSP | ✘ No existe (13.1), así que no puede romper nada. |
| Secretos | ✔ Ni en el código, ni en el historial de git (todas las ramas), ni en `dist/`. Solo aparecen claves falsas de las pruebas (`'k:fx'`, `SMTP_PASS: 'x'`). `.env` y `.env.local` nunca se subieron. |
| Nuevo agujero | 🟠 N1 (TXID ajeno con el pago tardío). |

---

## 4. Base de datos y orden de despliegue

| Comprobación | Resultado |
|---|---|
| Migraciones | ✔ 25 archivos con fecha creciente. Las dos nuevas dependen de `20261011120000` (y la 100000 también de `20261011130000`), que van antes. Cada una es una sola transacción. |
| Reversas | ✔ Las hay para las dos (`rollback-20261014100000.sql`, `rollback-20261014110000.sql`). `test.mjs` las ejecuta en orden inverso y comprueba que el esquema vuelve a ser idéntico al anterior. |
| Precheck | ✔ `precheck-before-20261010.sql` incluye `on_auth_user_delete_claims` y `support_claims.late`. |
| Semillas | ✔ `seed-blocked-email-domains/part-01…07`. |
| `docs/lanzamiento-produccion.md` | ✘ **Desfasado** (N6): faltan las 2 migraciones en el paso 6 y en la tabla de reversas. |
| `docs/staging.md` | ✘ **No existe.** |
| Orden SQL → secretos → funciones → variables de Vercel → plantillas → merge → administradora → hook | ✔ El orden es seguro (el SQL va antes de la web, la cuenta admin se crea con la web nueva y el hook va al final), **siempre que** el paso 6 incluya las dos migraciones nuevas. |
| Preview/dev nunca contra producción | ✘ 🔴 **No se cumple**: hay un solo proyecto de Supabase. El `.env.local` apunta a él, y la auditoría anterior confirmó que el Preview de Vercel también. Las variables de Vercel, SIN VERIFICAR: requiere mirarlas en Vercel. |

---

## 5. Textos y 4 idiomas

| Comprobación | Resultado |
|---|---|
| ES/EN/DE/FR en la app | ✔ 223 claves añadidas sueltas, 0 sin traducir (las 3 aparentes están en los diccionarios principales). `screens-scan`: 0 textos viejos y 0 errores en 20 pantallas × 4 idiomas. `lang-live`: 29 ✔. |
| ES/EN/DE/FR en el panel | ✔ Diccionarios `T` y `T2` de `src/admin.js` completos en los 4 idiomas. |
| Correos | ✔ `mail-content`: 16 ✔ (plantillas y correos de funciones). |
| Modelo antiguo ($7,10, suscripción, Stripe, App Store, Payment Nerds) | ✔ 0 en textos visibles. «premium» solo aparece en el Glosario (cannabis «premium») y en código interno. |
| Plazo único de activación | ⚠ Un solo número en el código (`VERIFY_MAX_HOURS: 48`, `src/supportConfig.js:24`), pero sin nada que lo haga cumplir (8.2) y con doble mensaje en el pago tardío (N5). Que sea el «texto aprobado», SIN VERIFICAR: no hay registro escrito del texto aprobado en el repositorio. |
| Montos | ✔ 10 USDC por flor, de 1 a 20 flores, sufijo de 0,0001 a 0,0099, 4 decimales en pantalla (`amount-ui` 19 ✔, `flowers20-ui` 14 ✔). |
| Billetera | ✔ Contrato USDC de Base correcto (`0x8335…2913`). Destino `0x63bb…92d0` en un solo sitio del código; **que coincida con el secreto `SUPPORT_ADDRESS` y que sea tu billetera: SIN VERIFICAR** (prueba de $5). |
| Política de privacidad y términos | ✘ La pantalla de Privacidad describe una app que guarda los datos en el móvil (N7). `tc5P` y `ppv4P` siguen en `[PENDIENTE]` en los 4 idiomas. El borrador contradice la base sobre el directorio (10.1). El texto de Comunidad, también (N8). |

---

## 6. Pruebas

Todas juntas con `node tests/sim/run-all.mjs` (no hizo falta separarlas: no hubo problemas de memoria):

| Prueba | Resultado | Prueba | Resultado |
|---|---|---|---|
| test.mjs | 235 ✔ 0 ✘ | panel-users-ui | 32 ✔ |
| mail-db | 19 ✔ | screens-scan | 0 textos viejos, 0 errores de JS |
| signup-fix-attacks | 30 ✔ | amount-ui | 19 ✔ |
| a1-money | 21 ✔ | preview-ui | 14 ✔ |
| fn-e2e | 117 ✔ | flowers20-ui | 14 ✔ |
| mail-content | 16 ✔ | flower-shots | 6 ✔ |
| lang-live | 29 ✔ | mail-links-ui | 28 ✔ |
| app-ui | 10 ✔ | mail-signup-ui | 30 ✔ |
| panel-ui | 20 ✔ | mail-flow-ui / mail-panel-ui | 21 ✔ / 9 ✔ |

**Total: 19 pruebas, 670 comprobaciones más el barrido de pantallas, 0 fallos.**
Compilación como `main` (`npx vite build` sin `VERCEL_GIT_COMMIT_REF`): ✔ sale bien, y el control propio de la compilación
no encuentra la vista previa. En `dist/` no está ni el selector de estados ni los datos de ejemplo (`ana.ejemplo`: 0), y
`mvPreviewOn` queda en `false`. Solo quedan nombres sin efecto (N9).
Además: 2 scripts de ataque fuera del repositorio (puntos 2 y 3).

---

## 7. Recorrido (capturas)

92 capturas: móvil (390 px) y escritorio (1280 px), 4 idiomas, más «claro». Pantallas: bloqueo, Desbloquear, selector de
flores, aviso de TXID, pendiente, pago tardío, revocado, Cuenta, Comunidad y panel (demo). Resultado: **0 páginas con
desplazamiento horizontal y 0 errores de JavaScript**. Las hojas de contacto están en `docs/auditoria-verificacion/`:

- `1-bloqueo` … `9-comunidad` `-movil-4-idiomas.jpg` (ES · EN · DE · FR, una al lado de otra)
- `escritorio-es.jpg` (las 9 pantallas y el panel a 1280 px)
- `movil-claro-es-y-panel.jpg` (con el sistema en modo claro: igual que en oscuro, ver N10)

Lo que se ve: los textos de acceso, Desbloquear, flores, TXID, pago tardío y revocado son correctos en los 4 idiomas.
**Comunidad muestra el texto desfasado** (N8). El panel se capturó solo en modo demo: el MFA real lo cubre `panel-ui`, y
con una cuenta real queda **SIN VERIFICAR: requiere prueba real**.

---

## 8. Veredicto

### a) Notas (de 1 a 10)

| Aspecto | Antes | Ahora | Por qué |
|---|---|---|---|
| Técnica | 6 | **6** | Dos cambios bien hechos y probados; el frente sigue igual. |
| Funcional | 7 | **7** | Se ganan los avisos de cuentas borradas y el pago tardío, pero el pago tardío abre N1 y siguen sin aviso de TXID ni moderación. |
| Experiencia | 5 | **5** | Sin cambios en navegación ni velocidad; texto desfasado en Comunidad. |
| Seguridad | 6 | **6** | Sin datos expuestos ni secretos; siguen sin cabeceras, y aparece N1. |
| Base de datos | 7 | **7** | Migraciones, reversas y precheck correctos; el documento de lanzamiento no está al día. |
| Escalabilidad | 4 | **4** | Sin cambios. |
| Mantenimiento | 4 | **4** | Sin cambios (9.732 líneas en un archivo). |
| Capacidad de crecer | 5 | **5** | Sin cambios. |

### b) Qué bloquea cada nivel de apertura

**Grupo pequeño de confianza** (personas que conoces, con aviso de que es una versión de prueba):
1. Añadir `20261014100000` y `20261014110000` al paso 6 y a la tabla de reversas de `docs/lanzamiento-produccion.md` (N6).
2. Prueba de $5 y comprobar que `SUPPORT_ADDRESS` = `src/supportConfig.js` (7.2).
3. Cerrar N1 (por ejemplo: un aviso tardío no se acepta si otro aviso abierto tiene el mismo monto; o el panel lo marca en
   rojo) o, como mínimo, una regla escrita: «antes de aprobar un tardío, mirar si otro aviso tiene el mismo monto».
4. Sustituir la pantalla de Privacidad por un texto provisional **verdadero** (N7) y corregir el texto de Comunidad (N8).
5. Una rutina diaria para mirar el panel, mientras no exista el aviso de TXID (8.2).

**Público**: todo lo anterior, y además:
1. Proyecto de Supabase separado para pruebas (11, 🔴).
2. Términos y Privacidad finales revisados por la abogada (19.5, N7, 10.1).
3. Aviso a la admin de cada TXID nuevo, y plazo visible en el panel (8.2).
4. Moderación de reportes (4.8).
5. Captcha y hook activos; límite de correos subido (5.1, 11).
6. Cabeceras de seguridad (13.1).
7. Salir de «Cargando…» (12.1).
8. Botón atrás y página 404 (2.1, 3.2).
9. Primera carga más ligera (14.1) y fuentes y banderas propias (13.7, por privacidad).
10. Regla de acceso única (10.2, 15.3) y activación que llegue a la app sin recargar (9.1).

### c) Riesgos que quedan, por gravedad

- 🔴 Base compartida entre dev y producción (11). · Publicar la web sin el SQL completo (7.1 + N6). · Privacidad falsa en
  la app (N7), si se abre al público.
- 🟠 TXID ajeno con el pago tardío (N1). · Nadie avisa de un TXID nuevo (8.2). · «Cargando…» sin salida (12.1). · Sin
  cabeceras de seguridad (13.1). · Botón atrás (2.1). · 3 MB de JavaScript (14.1). · Texto de Comunidad falso (N8).
  · Dirección USDC en dos sitios (7.2). · Contenido de pago público (3.1). · Captcha y hook (5.1).
- 🟡 Panel sin la marca de tardío (N2). · Bitácora escribible (4.1). · Imágenes y fotos (4.3–4.5). · Regla de acceso en tres
  sitios (15.3). · Botones del panel (7.7).
- 🔵/⚪ El resto de las tablas del punto 1, más N3, N4, N5, N9, N10 y N11.

### d) Pruebas reales que tienes que hacer tú

1. **Antes de nada**: en Vercel → Settings → Environment Variables, mira qué `VITE_SUPABASE_URL` tienen «Preview» y
   «Production». Si son la misma dirección, dev y producción comparten la base (dímelo).
2. Envía 5 USDC de prueba en Base a la dirección que muestra Desbloquear y comprueba que llegan a **tu** billetera.
3. En Supabase → Edge Functions → Secrets, comprueba que `SUPPORT_ADDRESS` es esa misma dirección (en minúsculas).
4. En Supabase → Authentication → Providers → Email: «Confirm email» y «Secure email change» activados.
5. En Supabase → Edge Functions: si aparece `community-translate`, dímelo (no se usa).
6. Abre `motherverdeny.com` sin «www» y mira si te lleva a `www.motherverdeny.com`.
7. Con una cuenta de prueba **sin confirmar**, prueba «Corrígelo» con una contraseña equivocada: debe decir «La contraseña
   no coincide».
8. En el móvil, entra a Cultivo → Cosecha y pulsa «atrás»: hoy **sale de la web** (sigue pendiente).
9. Abre la web en el móvil con datos móviles (no wifi) en una ventana privada y cronometra la primera carga.
10. Lee la pantalla Cuenta → Privacidad y confirma que **no** describe lo que hace la web (N7).
11. Después del lanzamiento, al día siguiente: `select * from public.cron_runs order by started_at desc limit 3;` → `ok = true`.
12. Si alguna vez tuviste un móvil con la web vieja instalada, ábrela y comprueba que carga la versión nueva.
