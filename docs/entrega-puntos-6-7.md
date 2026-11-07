# Entrega: puntos 6 y 7 ampliados (11-10-2026)

Todo está en la rama `dev`. **Nada está en producción**: no se pegó ninguna
migración ni función, no se creó ninguna cuenta y no se envió ningún correo
real. Todas las pruebas (en `tests/sim/`, ver su README) se hicieron con una base de datos simulada (PGlite,
PostgreSQL 18) y con correo, red Base y DeepL simulados.

---

## 0. Bug de idioma en las pantallas nuevas (corregido, commit `7e0e1d2`)

**Síntoma:** en «Tu prueba gratis terminó», al pulsar EN/DE/FR el botón se
marcaba pero el texto seguía en español; y al recargar, la app volvía siempre
a español.

**Por qué mis pruebas anteriores no lo vieron:** el barrido de 880
combinaciones fijaba el idioma *antes* de dibujar cada pantalla, así que
nunca probó cambiar de idioma con la pantalla ya abierta.

| Pantalla | ¿Fallaba? | Por qué |
|---|---|---|
| Bloqueo «Tu prueba gratis terminó» (textos, enlaces, «Tengo un código de regalo», «Tu cuenta y tu Bitácora…») | **Sí** (EN, DE, FR) | Se dibuja con JavaScript; el botón de idioma solo re-aplicaba los textos fijos del HTML (`data-i18n`) y nunca volvía a dibujarla. |
| Bloqueo con aviso de aporte pendiente | **Sí** (EN, DE, FR) | La misma pantalla, la misma causa. |
| Franja de cuenta atrás de 24 h | **Sí** | Solo se redibujaba cada 15 s o al cambiar el estado de acceso. |
| Cuenta → «Tengo un código de regalo» (formulario abierto) | **Sí** | Al cambiar de idioma se redibujaba, pero se cerraba el formulario y se borraba lo escrito. |
| Desbloquear (monto reservado) | No | Ya se redibujaba al cambiar de idioma. |
| Panel de administración | **Sí** | Estaba solo en español y no tenía selector de idioma. |
| Recargar la página (cualquier pantalla) | **Sí** | El idioma elegido no se guardaba: siempre arrancaba en español. |

**Arreglo:** el botón de idioma ahora vuelve a dibujar todo lo que se crea con
JavaScript (pantalla de bloqueo, aviso pendiente, franja de 24 h, «Tu acceso»
y código de regalo, manteniendo abierto el formulario y lo escrito). El idioma
se guarda en este navegador y se recupera al recargar (también marca el botón
correcto, arriba y en la puerta de edad). El panel está ahora en los 4
idiomas: abre en el idioma elegido en la app y tiene su propio selector.

**Prueba nueva** (`tests/sim/lang-live.mjs`, en el repositorio): cambia de
idioma **con la pantalla abierta**, sin recargar, en EN → DE → FR → ES. En
cada cambio comprueba que no queda ningún texto en otro idioma y que aparece
el título correcto. Pantallas: bloqueo, bloqueo con aviso pendiente,
Desbloquear con monto reservado, código de regalo, franja de 24 h y panel.
También recarga la página y comprueba que se conserva el idioma.
Resultado: **29 / 29**. Antes del arreglo daba 10 / 29.

---

## 1. Resultado de las pruebas

| Batería | Qué cubre | Resultado |
|---|---|---|
| Base de datos (PGlite) | migraciones, permisos, aportes 1–20 flores, contacto opcional, admin (`hello@motherverdeny.com`) + MFA, códigos, Usuarios/ficha/Resumen/CSV, auditoría, borrado de cuenta, reversas con esquema idéntico | **225 / 225** |
| Funciones de punta a punta | admin-send-gift-code, support-claims, community-retranslate, cron de Vercel | **103 / 103** |
| Panel en navegador | admin con la prueba terminada usa el panel, MFA, comprobar en Base, activar, códigos, anular, correo de prueba, registro | **20 / 20** |
| Panel: Usuarios, Resumen, CSV | ficha registrada, botones de correo, contacto, exportación real (BOM, acentos, fórmulas), idiomas en vivo y al recargar, ninguna app de pago en los textos | **32 / 32** |
| Vista previa (dev) | selector de estados y panel de ejemplo, 0 escrituras en la base | **14 / 14** |
| Monto exacto (texto, 4 decimales) | 20,0040 / 20.0040 según idioma, copia con punto, texto «¿Por qué el monto lleva decimales?», aviso pendiente, panel, CSV, vista previa | **19 / 19** |
| Versión desplegada en dev (Vercel) | abierta como visitante: flag de vista previa, idioma, 20 flores, panel; 0 escrituras en producción | **9 / 9** |
| App en navegador | Desbloquear con monto exacto, envío del TXID, código de regalo | **10 / 10** |
| Idioma en vivo | cambio ES/EN/DE/FR con la pantalla abierta + recarga, 6 pantallas | **29 / 29** |
| 20 flores en navegador | 5×4 en móvil, 10×2 en pantalla grande, 200,00xx, «copiar monto exacto» y aviso en 4 idiomas | **14 / 14** |
| Barrido de textos | 20 pantallas × 4 idiomas × 8 estados de acceso (880 combinaciones) | **0 textos del modelo viejo, 0 errores JS** |

Pruebas de abuso pedidas, todas superadas: usuario normal llamando a funciones
de admin; admin sin MFA (aal1); código reutilizado; código vencido; 21.º código
del día; 4.º código al mismo correo; TXID repetido; monto incorrecto; destino
incorrecto; otro token que no es USDC; transacción fallida o inexistente;
transferencia anterior a la reserva; endpoint de Base agotado (429); 5 intentos
fallidos de canje → bloqueo 24 h; cuenta con acceso retirado intentando canjear.

---

## 2. Informe de auditoría

### Lo que protege cada pieza (en el servidor, no en el navegador)
- **Admin**: tabla `admin_users` sin ningún permiso para el navegador (ni leer
  ni escribir). Solo se añade con `grant-admin.sql` desde el SQL Editor, y ese
  archivo da el rol **únicamente** a `hello@motherverdeny.com`. Cada
  función de admin exige `admin_users` **y** sesión con MFA (`aal2`), lo
  comprueba la base de datos con el token firmado de la persona. La ruta oculta
  `/panel-mv.html` no es la protección: sin MFA, el servidor rechaza todo.
- **Aportes**: el navegador solo puede usar 3 funciones (reservar monto,
  enviar TXID, cancelar) y leer sus propias solicitudes. Nunca puede escribir
  estado, monto ni motivo. Monto único entre las solicitudes abiertas; TXID de
  un solo uso para siempre; caducidad 72 h.
- **Verificación en Base**: apagada (`claim_auto_verify_enabled = 0`). Ante
  cualquier duda (fallo, límite del endpoint, monto distinto…) pasa a
  **revisión manual con el motivo**; nunca activa por error.
- **Códigos de regalo**: en la base solo se guarda la huella (SHA-256); el
  código completo solo aparece una vez (en el correo o en el resultado del
  SQL Editor). 12 caracteres sin letras confusas, un solo uso, caducidad,
  límites 20/día y 3 por correo, dominios desechables bloqueados, bloqueo tras
  5 intentos fallidos en 24 h, mensajes de error genéricos. No consume el
  código si la cuenta ya tiene acceso completo.
- **Auditoría**: `admin_audit_log` registra quién, qué, a quién, motivo y
  cuándo. Nadie puede editarla ni borrarla desde la app. Nunca contiene códigos.
- **Retirar acceso (fraude)**: estado `revoked`, con motivo; no borra la cuenta.
  Un código de regalo no la reactiva.

### Riesgos abiertos (aceptados o pendientes)
| # | Riesgo | Estado |
|---|---|---|
| 1 | Los aportes llegan a tu billetera personal | Aceptado por ti; texto ya lo dice. Pendiente de contador/abogado. |
| 2 | Envío de correo desde funciones por el puerto 465: Supabase bloquea 25 y 587; 465 no está documentado como bloqueado, pero **no está verificado** | Se comprueba con «Enviar correo de prueba a mi correo» tras desplegar. Si falla → plan B Resend (sección 6). |
| 3 | Endpoint público de Base sin clave: con límite y «no para producción» | Solo se usa cuando tú lo actives; si se agota → revisión manual. |
| 4 | El contenido educativo se bloquea solo de forma visual | Conocido; la Comunidad sí está cerrada en el servidor. |
| 5 | Política de privacidad y Términos | §5 y §4 marcadas `[PENDIENTE]`; reescritura con contador y abogado. |
| 6 | DeepL Free recibe textos de la Comunidad | Pasar a DeepL Pro antes del lanzamiento público (checklist). |
| 7 | Captcha construido pero apagado | Se enciende cuando pongas las claves de Turnstile. |
| 8 | Fotos de la Comunidad en un bucket público (enlace sin sesión) | Punto 3b, después del lanzamiento. |
| 9 | El cron diario nunca se ha visto correr en producción | Revisar `cron_runs` el día siguiente al despliegue. |
| 10 | Si pierdes el teléfono del MFA no entras al panel | Guarda la clave al activarla. Recuperación por SQL en la sección 8. |
| 11 | Borrar la cuenta y registrarse otra vez da una prueba nueva de 24 h | Aceptado por ti. |
| 12 | `delete-account` conserva código del modelo viejo (sin texto visible) | No se tocó, como pediste. Mejora para después del lanzamiento. |

---

## 3. Limpieza del modelo viejo (punto D)

Alcance: todo el repositorio (sin `node_modules`, `reference/` ni las
migraciones ya aplicadas en producción) y la compilación `dist/`.

| Término | Antes (repo) | Antes (dist) | Después (repo) | Después (dist) | Dónde estaba |
|---|---|---|---|---|---|
| 7.10 / 7,10 | 35 | 33 | **0** | **0** ¹ | main.js 26, index.html 4, subscription.js 3, docs 2 |
| 7.99 / 7,99 | 0 | 0 | **0** | **0** | — |
| 19.99 / 19,99 | 0 | 0 | **0** | **0** | — |
| Payment Nerds | 50 | 38 | **0** | **0** | main.js 28, subscription.js 17, index.html 5 |
| Stripe | 9 | 9 | **0** | **0** | main.js 8, index.html 1 |
| App Store | 11 | 10 | **0** ² | **0** | main.js 9, index.html 1 |
| Google Play | 9 | 9 | **0** | **0** | main.js 8, index.html 1 |
| suscripción / suscribir | 51 | 45 | **0** | **0** | main.js 31, index.html 14, docs 5, subscription.js 1 |
| subscription / subscribe | 93 | 134 | **0 visibles** ³ | **0 visibles** ³ | main.js 53, subscription.js 22, docs 3, otros |
| Abo / Abonnement | 24 | 22 | **0** | **0** | main.js 22, docs 2 |
| abonnement / s'abonner | 34 | 31 | **0** | **0** | main.js 31, docs 3 |
| prueba de 3 días / 3-day trial | 30 | 22 | **0** | **0** | main.js 19, subscription.js 4, docs 4, index.html 3 |

¹ La única coincidencia en `dist` es `[7,10,13,…]`, una tabla numérica de la librería del QR.
² Queda 1 en `supabase/blocked-email-domains.txt`: es un dominio de la lista de correos desechables, no un texto.
³ Quedan solo identificadores que nadie lee: columnas de la base (`subscription_status`…), el nombre del archivo y ruta del cron (`api/subscription-cron`), el código interno `active subscription` de `delete-account` y `channel.subscribe()` de la librería de Supabase.

Qué se quitó físicamente: `src/subscription.js` (244 líneas), `docs/trial-reminder-email.md`, el modal de precio/prueba, el modal «tu prueba empezó», los avisos de cobro y de tarjeta, la tarjeta «Suscripción» de Cuenta, el código del flujo de suscripción en `main.js` y 75 claves de traducción. `index.html`, etiquetas meta, `manifest.webmanifest` y `service-worker.js`: 0 coincidencias.

---

## 4. Archivos nuevos o modificados (rutas exactas)

**Migraciones** (`C:\Users\User\Desktop\Cannapp\supabase\migrations\`)
- `20261010120000_access_support_model.sql` (modificada: `access_until`, estado `revoked`)
- `20261010130000_community_full_access.sql` (modificada: §9 reintentos, `gave_up`)
- `20261011100000_admin_and_audit.sql` (nueva)
- `20261011120000_support_claims.sql` (reescrita: monto único; 1–20 flores; tope automático 201)
- `20261011130000_gift_codes_and_access.sql` (nueva)

**SQL de administración** (`C:\Users\User\Desktop\Cannapp\supabase\admin\`)
- `precheck-before-20261010.sql` (actualizado), `grant-admin.sql`, `support-claims-review.sql`, `access-admin.sql`
- Reversas: `rollback-20261011130000.sql`, `rollback-20261011120000.sql`, `rollback-20261011100000.sql`, `rollback-20261010130000.sql`, `rollback-20261010120000.sql` (en ese orden)

**Edge Functions** (`C:\Users\User\Desktop\Cannapp\supabase\functions\`)
- `admin-send-gift-code\index.ts` (nueva), `support-claims\index.ts` (nueva), `community-retranslate\index.ts` (nueva)

**Plantillas de correo** (`C:\Users\User\Desktop\Cannapp\supabase\email-templates\`)
- 13 `.html`, `SUBJECTS.md` (asuntos y variables) y `_generate.cjs` (generador)

**App**
- `C:\Users\User\Desktop\Cannapp\panel-mv.html` y `src\admin.js` (panel), `vite.config.js`
- `src\desbloquear.js`, `src\auth.js`, `public\main.js`, `public\style.css`, `index.html`
- `api\subscription-cron.js` (sin cobros; 23:00 UTC), `vercel.json`

---

## 5. Orden de pegado (el día del lanzamiento, todo en una sesión)

La base de datos es compartida entre `dev` y producción: pega todo seguido y
haz el merge a `main` justo después.

**A. SQL Editor** (cada archivo entero, de una vez)
1. `supabase/admin/precheck-before-20261010.sql`: todas las filas deben decir `ok`.
2. `supabase/migrations/20261010120000_access_support_model.sql`
3. `supabase/seed-blocked-email-domains/part-01.sql` … `part-07.sql` (en orden)
4. `supabase/migrations/20261010130000_community_full_access.sql`
5. `supabase/migrations/20261011100000_admin_and_audit.sql`
6. `supabase/migrations/20261011120000_support_claims.sql`
7. `supabase/migrations/20261011130000_gift_codes_and_access.sql`
8. `supabase/admin/supporters-betian-mother-verde.sql`: PARTE 1 (debe mostrar 2 cuentas), luego PARTE 2.
9. ~~grant-admin.sql~~: ya **no** va aquí. Se pega después del merge (bloque F).

**B. Secretos** (Supabase → Edge Functions → Secrets). Los pones tú; nunca van en el repositorio.
| Secreto | Valor |
|---|---|
| `MAIL_PROVIDER` | `smtp` |
| `MAIL_FROM` | `Mother Verde <hello@motherverdeny.com>` |
| `SMTP_HOST` / `SMTP_PORT` | `smtp.hostinger.com` / `465` |
| `SMTP_USER` / `SMTP_PASS` | `hello@motherverdeny.com` / la contraseña del buzón |
| `APP_URL` | `https://www.motherverdeny.com` |
| `RETRANSLATE_SECRET` | una cadena aleatoria de 40+ caracteres (la misma en Vercel) |
| `SUPPORT_ADDRESS` | la dirección USDC, **solo cuando confirmes que la prueba de $5 llegó** |
| `BASE_RPC_URL` | opcional; sin él usa `https://mainnet.base.org` |
| `RESEND_API_KEY` | solo si pasas al plan B |

**C. Funciones** (Supabase → Edge Functions; pega cada `index.ts` entero)
1. `community-publish-post` y `community-publish-comment` (cambiaron en puntos anteriores)
2. `support-claims`
3. `admin-send-gift-code`
4. `community-retranslate`: **desactiva «Verify JWT»** (se protege con su propia clave secreta)
5. `delete-account`: **no se toca**.

**D. Vercel** → Settings → Environment Variables: `RETRANSLATE_SECRET` (mismo valor). `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` y `VITE_SUPABASE_ANON_KEY` ya existen.

**E. Plantillas** (Authentication → Emails): las 13 de `supabase/email-templates/` con los asuntos de `SUBJECTS.md`. Activa las notificaciones de seguridad.

**F. Merge `dev` → `main`**, solo con tu aprobación escrita. Justo después, en este orden:
  1. Te registras **por la pantalla normal de la app** con `hello@motherverdeny.com` y confirmas el correo (el hook todavía no está activo; de todos modos, `motherverdeny.com` no está en la lista de bloqueados y la normalización no cambia esa dirección).
  2. Pegas `supabase/admin/grant-admin.sql` entero. Si la cuenta no existe o el correo no está confirmado, **se detiene con un mensaje claro y no da el rol a nadie**. Al final muestra una sola fila: `hello@motherverdeny.com`. Betian (`berthalimo@gmail.com`) **no** es admin; si lo fuera, el archivo se lo quita.
  3. Abres `/panel-mv.html` y activas la verificación en dos pasos. Funciona aunque la prueba de 24 h de esa cuenta haya terminado y la app te muestre el bloqueo: el panel solo exige rol admin + MFA, no acceso completo.
  4. En el panel: **Códigos de regalo → «Enviar correo de prueba a mi correo»**. Llega a `hello@motherverdeny.com`.

**G. Hook** «Before User Created», **recién después de F.1–F.4**, siguiendo `supabase/admin/hook-activation-plan.md`.

---

## 6. Correo desde las funciones: SMTP y plan B

El módulo de envío tiene dos salidas, que eliges con `MAIL_PROVIDER`:
- `smtp`: Hostinger, `smtp.hostinger.com:465` con SSL desde el primer byte.
- `resend`: API HTTPS de Resend (no depende de ningún puerto SMTP).

**Plan B recomendado: Resend.** Plan gratuito: **3.000 correos al mes, máximo 100 al día, 1 dominio**. Al llegar al límite, el envío se pausa hasta el día o mes siguiente. Con el límite propio de 20 códigos al día, sobra.
Qué crear: una cuenta en resend.com → *Domains* → añadir `motherverdeny.com` (elige la región de la UE) → *API Keys* → una clave con permiso solo de envío → ponla en `RESEND_API_KEY` y cambia `MAIL_PROVIDER` a `resend`.
Registros DNS que te pedirá (en Hostinger, Resend da los valores exactos): un **TXT DKIM** en `resend._domainkey`, y en el subdominio `send` un **MX** y un **TXT SPF** (`v=spf1 include:amazonses.com ~all`). Al ir en el subdominio `send`, no tocan el SPF ni el MX actuales de Hostinger. Tu DMARC actual sirve.

Comprobación real: en el panel, **Códigos de regalo → «Enviar correo de prueba a mi correo»**. Envía un correo solo a tu cuenta, no crea ningún código y queda en el registro. Si falla, muestra el error exacto. Si un código no se puede enviar, el código queda **anulado** y se muestra el error.

---

## 7. Verificación en cadena (Base)

- Fuente: endpoint público `https://mainnet.base.org`, sin clave y gratuito. Base no publica el límite exacto: lo describe como «con límite y no para producción».
- Uso real: 3 llamadas por comprobación (recibo, bloque actual, hora del bloque) y como máximo una comprobación por persona por minuto. Con el volumen esperado, está muy lejos del límite.
- Si se agota (HTTP 429) o falla: el aviso pasa a **revisión manual** con el motivo `red_no_disponible`, **nunca se activa**. Probado.
- Comprobaciones (todas exactas para activar sola): la transacción existe y se completó; contrato oficial de USDC de Circle (`0x8335…2913`); destino = `SUPPORT_ADDRESS`; monto exacto de esa solicitud; transferencia posterior a la reserva; 30 confirmaciones; TXID no usado; solicitud vigente y de esa misma cuenta.
- **Tope de la verificación automática: `claim_auto_max_usdc = 201`** en `public.app_config`. Cubre de 1 a 20 flores (200,00xx entra). Se compara el monto completo, decimales incluidos. Cambiarlo es una línea:
  `update public.app_config set value = 201 where key = 'claim_auto_max_usdc';`
- Cualquier diferencia o monto por encima del tope pasa **siempre** a revisión manual, con el motivo escrito en códigos: `monto_alto`, `monto_distinto`, `destino_distinto`, `no_es_usdc`, `tx_fallida`, `tx_no_encontrada`, `tx_anterior_a_la_reserva`, `txid_ya_usado`, `solicitud_no_vigente`, `red_no_disponible`. Si hay varios, van separados por comas (p. ej. `monto_distinto, monto_alto`).
- **Formato del monto**: siempre texto con 4 decimales construido desde las unidades enteras (10.0420, nunca 10.042); en pantalla con coma (ES/DE/FR) o punto (EN); el botón copia siempre con punto; panel, CSV y correo de activación usan el mismo formato. La comparación con la red Base se hace en unidades enteras (6 decimales).
- **Monto único**: N × 10 USDC + un sufijo aleatorio de 4 decimales (0,0001–0,0099), sumado **una vez** al total, p. ej. 1 flor = 10,0042 y 20 flores = 200,0073. Nunca 6 decimales. Hay **99 sufijos por cada cantidad de flores** → como máximo 99 solicitudes abiertas a la vez de 1 flor, otras 99 de 2 flores… y así hasta 20 (1.980 en total). Entre cantidades distintas nunca chocan (están separadas por 10 USDC). Si se agotan los 99 de una cantidad, la función da el error `no_free_amount` y la app muestra «Ahora mismo no queda ningún monto libre para N flores… elige otra cantidad o vuelve en unas horas»; **nunca repite un monto**. Si dos personas reservan el mismo monto en el mismo instante, el índice único de la base rechaza una de las dos y la función elige otro sufijo sola (probado simulando la carrera).
- Estado: la parte automática está **apagada**. Para encenderla (solo con tu aprobación escrita): `update public.app_config set value = 1 where key = 'claim_auto_verify_enabled';`
- Si algún día hace falta más capacidad: Alchemy (gratis, con clave) en `BASE_RPC_URL`. Etherscan gratis no cubre Base.

---

## 8. Panel de administración

- Dirección: `https://www.motherverdeny.com/panel-mv.html` (no está enlazada en ningún sitio y tiene `noindex`).
- Primera vez (después de F.1 y F.2): entra en Mother Verde con `hello@motherverdeny.com`, abre el panel y escanea el QR con tu app de autenticación. **Guarda la clave.** No hace falta que esa cuenta tenga acceso completo.
- Pestañas: **Avisos de aporte** (correo, monto, TXID, fecha, cada comprobación con ✓/✗, enlace a Basescan; «Activar acceso completo» solo se habilita si todo pasa; la activación manual y el rechazo exigen motivo), **Códigos de regalo** (enviar, lista con estados, anular con motivo, correo de prueba), **Registro** (solo lectura).
- Idioma del panel: ES/EN/DE/FR, con selector propio; abre en el idioma elegido en la app.
- Si pierdes el teléfono del MFA, en el SQL Editor:
  `delete from auth.mfa_factors where user_id = (select id from auth.users where lower(email) = 'hello@motherverdeny.com');`
  y vuelve a activarlo en el panel.

En la app, el código de regalo está en el icono de persona (arriba a la derecha), en la pantalla de cuenta de cada idioma:
**Tu cuenta** → «Tengo un código de regalo» (ES) · **Your account** → "I have a gift code" (EN) · **Dein Konto** → „Ich habe einen Geschenkcode“ (DE) · **Ton compte** → « J’ai un code cadeau » (FR).

---

### Pestañas del panel (nuevas)
- **Resumen**: cuentas totales, altas de los últimos 7 días, pruebas activas, pruebas vencidas sin aporte, acceso completo, accesos por regalo vigentes, bloqueadas, avisos de aporte por estado (pendiente, en revisión, rechazado, activado, vencido o cancelado) y el total de USDC activado.
- **Usuarios** (solo lectura): correo, nombre visible (de Comunidad), país, idioma, estado de acceso, alta, fin de la prueba, acceso hasta y, si los dio en un aviso de aporte, nombre y teléfono de contacto. Tiene búsqueda por correo o nombre, filtro por estado y 50 por página. **Nunca** muestra Bitácora, fotos ni publicaciones. Cargar la lista **no** se anota; abrir la **ficha** de una persona **sí** (`user_viewed`).
- **Correos**: en cada aviso de aporte, en cada código canjeado y en cada usuario hay «Copiar correo» y «Escribir». «Escribir» abre tu programa de correo con el asunto «Mother Verde»; el panel nunca envía correos libres ni masivos.
- **Exportar CSV** (Usuarios, Avisos de aporte, Códigos de regalo, Registro):
  - Lo hace la función de servidor `admin_export_csv`, que exige admin + MFA.
  - El archivo va en UTF-8 con BOM, separado por comas, y protegido contra fórmulas (una celda que empiece por =, +, -, @, tabulador o salto lleva una comilla delante).
  - Como máximo **5000 filas** por exportación (se cambia con `update public.app_config set value = N where key = 'csv_export_max_rows';`). Si se corta, el panel lo avisa.
  - Antes de exportar Usuarios aparece el aviso de datos personales en tu idioma.
  - Cada exportación queda anotada en el registro (quién, pestaña, filtros, filas, si se cortó), **nunca** los datos.
  - Separador: si tu Excel muestra todo en una sola columna, ábrelo con Datos → Desde texto/CSV.

### Vista previa con datos de ejemplo (solo dev)
- Dónde: https://mother-verde-git-dev-bertha2.vercel.app. Abajo a la izquierda aparece un recuadro naranja **«VISTA PREVIA · solo dev»**; el «–» lo minimiza.
- **Estado de acceso**: visitante, correo sin confirmar, prueba de 24 h activa, prueba terminada, cuenta antigua sin prueba, acceso por regalo, acceso completo, acceso retirado.
- **Aviso de aporte**: ninguno, monto reservado, TXID enviado, en revisión, rechazado, vencido.
- Botones para ir a Desbloquear, Cuenta y la pantalla de acceso, y el enlace **«Panel de ejemplo»** (`/panel-mv.html?demo=1`).
- Qué puedes hacer ahí: reservar un monto, enviar un TXID o canjear un código; todo está **simulado**.
- **Nunca escribe en la base de datos**; está comprobado registrando todas las peticiones.
- **No existe en producción**:
  - El build de `main` no incluye el selector ni los datos de ejemplo.
  - Además, recorta del `main.js` las funciones de vista previa y falla si quedara alguna.
  - Está comprobado compilando como `main`.

## 9. Qué revisar tú fuera del código (D.5)

1. Supabase → Authentication → Emails: pegar las 13 plantillas y sus asuntos; activar las notificaciones de seguridad.
2. Authentication → URL Configuration: Site URL = `https://www.motherverdeny.com` (los enlaces de los correos salen de ahí).
3. Authentication → SMTP: el nombre del remitente («Mother Verde») y el límite de correos por hora.
4. Hostinger: firma o respuesta automática de `hello@motherverdeny.com` que mencione precios o suscripción.
5. PaymentCloud: la solicitud en revisión ya no hace falta con este modelo (decide si la retiras).
6. Google: los resultados de búsqueda pueden mostrar durante días la descripción vieja. Puedes pedir que se vuelva a rastrear en Search Console.
7. Perfiles o enlaces externos (redes, bio) que mencionen el precio de $7.10 o la prueba de 3 días.
8. **Supabase → Database → Backups**: revisa qué copias de seguridad incluye tu plan (cada cuánto y cuántos días se guardan) y define cada cuánto sacas tú una copia a mano (por ejemplo, una vez por semana y siempre antes de pegar migraciones).

---

### Para la Política de Privacidad (punto 8): campos de contacto opcionales
- **Qué**: nombre y WhatsApp o teléfono, **opcionales**, en el aviso de aporte.
- **Para qué**: solo para ayudar a la persona con ese aporte si hace falta (por ejemplo, si el monto no coincide).
- **Quién lo ve**: únicamente quien administra Mother Verde, en el panel protegido con verificación en dos pasos. Otras cuentas no pueden leerlo; ni siquiera la propia persona puede leerlo desde la app.
- **Cuánto tiempo**: mientras exista la cuenta; **se borra al eliminar la cuenta**. La base de datos borra en cascada los avisos de aporte con la cuenta, sin tocar `delete-account`; está comprobado en la simulación.
- **Ojo:**
  - El **registro de auditoría** conserva el correo de la cuenta en las acciones de administración (aprobaciones, envíos de códigos, fichas abiertas), también después de borrarse la cuenta, pero **no** el nombre ni el teléfono.
  - Los **CSV que exportes** quedan fuera de la app: la Política debe decir que se guardan de forma segura y se borran cuando ya no hagan falta.
  - **Propuesta para decidir con el abogado:** borrar o anonimizar el correo del registro pasado un plazo (por ejemplo, 24 meses).
- **Base legal** a confirmar con el abogado: consentimiento (es opcional y se explica al lado del campo).
- `[PENDIENTE: confirmar con contador y abogado]`

## 10. Checklist de lanzamiento (numerada)

1. ☐ Confirmar aquí que la prueba de $5 en USDC (Base) llegó → poner `SUPPORT_ADDRESS`.
2. ☐ Contador y abogado: textos de aportes, Términos §5 y Privacidad §4 (marcados `[PENDIENTE]`), representante UE y transferencias.
3. ☐ DeepL Pro: cambiar el secreto `DEEPL_API_KEY` y ejecutar `update public.app_config set value = <nuevo tope> where key = 'deepl_daily_char_cap';`
4. ☐ Pegar en el orden de la sección 5: A → E, merge (F), y después F.1–F.4: registrarte con `hello@motherverdeny.com` y confirmar → `grant-admin.sql` → panel + MFA → correo de prueba.
5. ☐ SMTP ya configurado por ti → probar el correo de confirmación con una cuenta desechable de prueba (y borrarla después).
6. ☐ El correo de prueba del panel llega a `hello@motherverdeny.com`. Si no llega: plan B Resend.
7. ☐ Enviar un código de regalo **a un correo distinto, un Gmail tuyo**, para ver si llega a la bandeja de entrada o cae en Spam; y canjearlo con una cuenta de prueba desechable.
8. ☐ Al día siguiente: `select * from public.cron_runs order by started_at desc limit 3;` debe mostrar `ok = true`.
9. ☐ Activar el hook siguiendo `hook-activation-plan.md` (solo después del punto 6).
10. ☐ (Opcional, más adelante) Encender la verificación automática, solo con tu aprobación escrita.
11. ☐ Revisar Supabase → Database → Backups (qué incluye tu plan) y decidir cada cuánto sacas una copia a mano.
12. ☐ Probar en el panel «Exportar CSV» de Usuarios y abrir el archivo en tu Excel (acentos y columnas).

---

## 11. Qué no entra en el primer lanzamiento y por qué

- **Verificación automática encendida**: queda apagada hasta que lo apruebes por escrito y se haya visto funcionar con pagos reales en modo manual.
- **Reescritura de Política y Términos**: depende del contador y del abogado (D.6). Ahora mismo solo se quitaron precios y suscripción, y se marcó lo que falta.
- **Fuentes de Google y banderas de flagcdn alojadas en el propio servidor**: pendiente; no bloquea el modelo de aportes, pero conviene antes del lanzamiento público por privacidad (las cargan servidores de terceros).
- **Fotos de la Comunidad en un bucket privado** (3b): después del lanzamiento, como acordamos.
- **Limpieza interna de `delete-account`**: después del lanzamiento (sin texto visible).
