# Auditoría de la plataforma — Ronda 2 de 4

Fecha: 13 de octubre de 2026 · Rama `dev` · **Solo lectura**. Base revisada en el simulador con todas las migraciones,
incluidas las que todavía no están en producción. Prioridades: 🔴 P0 · 🟠 P1 · 🟡 P2 · 🔵 P3 · ⚪ P4.

---

## 6. Base de datos

### Tablas (22 en `public`) y relaciones

```
auth.users ─┬─< profiles (1:1, cascada)                 estado de acceso, prueba, idioma, contacto
            ├─< bitacora_entries (cascada)              diario de cultivo + tricomas
            ├─< community_members (1:1, cascada)        perfil público
            ├─< community_posts (cascada) ─< community_comments (cascada por post y por autor)
            ├─< community_follows (seguidor y seguido, cascada)
            ├─< community_swipes (cascada) · community_reports (por quien reporta, cascada)
            ├─< community_usage_log (cascada)           límites diarios
            ├─< support_claims (cascada)                avisos de aporte
            ├─< gift_redeem_attempts (cascada)
            ├─< admin_users (cascada)
            └─< gift_codes.used_by (SET NULL)
Sin clave hacia cuentas (a propósito): admin_audit_log, mail_events, signup_fix_attempts, cron_runs,
  translation_cache, deepl_usage_daily, app_config, blocked_email_domains
Vista: community_translation_backlog (aplica las reglas de quien consulta: no filtra datos)
```

| # | Prioridad | Hallazgo |
|---|---|---|
| 6.1 | 🟠 P1 | **Borrar una cuenta borra sus avisos de aporte**, aunque estén en revisión con un TXID enviado (cascada en `support_claims`). Si alguien pagó, envió el TXID y luego borra la cuenta, el panel pierde el aviso. Solo queda la huella en el registro de auditoría si ya hubo una acción de admin. Para pagos reales es arriesgado: no queda constancia de un dinero recibido. |
| 6.2 | 🟡 P2 | **`community_reports.target_id` no tiene clave**: si se borra la publicación o el comentario reportado, el reporte queda huérfano. Tampoco hay índice por objetivo ni forma de leerlos (ver 4.8). |
| 6.3 | 🟡 P2 | **Nombre visible duplicado**: `profiles.display_name` y `community_members.display_name` existen los dos (decisión anterior, «Cuenta vs Perfil»). El panel muestra el de Comunidad. Cambiar uno no cambia el otro. |
| 6.4 | 🟡 P2 | **Correo en tres sitios**: `auth.users.email` (inicio de sesión), `profiles.contact_email` (contacto) y `profiles.email_normalized` (control de duplicados, ahora sincronizado por disparador). `gift_codes.sent_to_email` guarda la dirección como texto y no sigue un cambio de correo (correcto como histórico). |
| 6.5 | 🔵 P3 | **`profiles.email_normalized` no es único**: el control «una cuenta por Gmail» lo hace el hook antes de crear la cuenta. Dos registros simultáneos con el mismo Gmail escrito distinto podrían pasar los dos. Poco probable. |
| 6.6 | 🔵 P3 | **Columnas del modelo viejo**: `subscription_active`, `subscription_expires_at`, `payment_subscription_id`, `cancel_at_period_end`, `trial_reminder_sent_at` siguen en `profiles` y se leen en `is_premium()` y en la tarea diaria. Funcionan como estado heredado, pero complican la lógica (ver 8.x y 10.2). |
| 6.7 | 🔵 P3 | **Registros que crecen sin límite ni limpieza**: `admin_audit_log`, `mail_events`, `signup_fix_attempts`, `community_usage_log`, `gift_redeem_attempts`, `cron_runs`, `translation_cache`. Ninguno se purga. Con miles de personas no es un problema de espacio a corto plazo, pero sí de privacidad (plazos de conservación pendientes con el abogado). |
| 6.8 | 🔵 P3 | **Índices**: están los necesarios para las consultas actuales (feed por fecha, comentarios por post, seguidos, avisos abiertos únicos por monto y por persona, límites por persona y hora). Falta uno de `community_posts (user_id, created_at)`: el perfil de una persona ordena sus publicaciones por fecha con solo el índice de `user_id`. Con pocas publicaciones por persona da igual. |
| 6.9 | 🔵 P3 | **Consultas sin límite**: `admin_list_claims` (todos los avisos abiertos), los comentarios de un post (todos) y `admin_list_gift_codes` (200). Hoy no importa; con mucho volumen, el panel se volverá lento. |
| 6.10 | ✅ | Montos únicos por índice parcial; un aviso abierto por persona; TXID usado una sola vez (índice único); códigos guardados solo como huella SHA-256; contraseñas nunca en tablas propias. |

---

## 7. Frontend ↔ servidor ↔ base (de punta a punta)

Todas las llamadas del navegador apuntan a funciones y tablas que **existen** en la base nueva: `create_support_claim`,
`submit_support_claim_tx`, `cancel_my_support_claim`, `redeem_gift_code`, `community_*`, `admin_*` (13),
`support_claims`, `profiles`, `bitacora_entries`, `community_*`. Funciones: `support-claims`, `signup-fix-email`,
`delete-account`; publicar y comentar (dentro de `mvCommunity.js`).

| # | Prioridad | Hallazgo |
|---|---|---|
| 7.1 | 🔴 P0 (para el lanzamiento) | **Con la base de producción actual, la web nueva llama a funciones que no existen** (todas las de aportes, regalos y panel). Si se publica antes del SQL, falla todo eso y las cuentas quedan bloqueadas (detalle en `docs/lanzamiento-produccion.md`, sección 3). No es un fallo del código, pero sí el mayor riesgo de la puesta en marcha. |
| 7.2 | 🟠 P1 | **La dirección USDC está en dos sitios que deben coincidir**: `src/supportConfig.js` (lo que ve la persona) y el secreto `SUPPORT_ADDRESS` (lo que comprueba el servidor). Si un día se cambia solo uno, la persona paga a la dirección que ve y el servidor marca `destino_distinto`. Nada avisa del desajuste. |
| 7.3 | 🟡 P2 | **`community-translate` sigue en el repositorio** (y, según la auditoría de octubre, desplegada). Nada la usa. Cualquiera con sesión puede gastar la cuota de DeepL. **SIN VERIFICAR**: si sigue desplegada en producción. |
| 7.4 | 🟡 P2 | **El feed carga las 40 publicaciones más recientes y no tiene «ver más»** (`listFeedPosts` acepta `before`, pero la pantalla no lo usa). Lo anterior a esas 40 deja de verse. El directorio carga 200 o 500 miembros de una vez y filtra en el navegador. |
| 7.5 | 🟡 P2 | **`photo_url` no se valida en el servidor** (ver 4.5). El navegador sube al bucket, pero la función acepta cualquier texto. |
| 7.6 | 🔵 P3 | **Condiciones de carrera**: reservar monto (índices únicos y reintento: bien), canjear regalo (`for update`: bien), aprobar un aviso dos veces (la función exige estado abierto: bien). Doble clic en «Reenviar correo» y «Corrígelo»: los botones se desactivan, y hay límite de 60 s. |
| 7.7 | 🟡 P2 | **Funciones del servidor que el panel no ofrece**: `admin_grant_days` (dar días), `admin_revoke_access` (quitar acceso por fraude) y `admin_create_gift_codes` (códigos para repartir a mano) **solo se usan desde el SQL Editor** (`supabase/admin/access-admin.sql`); el panel no tiene botones para ellas (comprobado en `src/admin.js`). No existe ninguna función para **devolver** el acceso a una cuenta revocada. `community-translate` sin uso (7.3). |
| 7.8 | 🔵 P3 | **Validación doble**: el monto y el TXID se validan en la pantalla y en la base (66 caracteres, `0x…`). Las flores, de 1 a 20, en las dos. Nombre y teléfono de contacto, en la base. Bien. |

---

## 8. Lógica de negocio

Suposiciones (de los requisitos aprobados y del código): 1 flor = 10 USDC; 1 a 20 flores; sufijo único 0,0001–0,0099;
reserva de 72 h; prueba de 24 h desde la confirmación del correo, una vez por cuenta y solo para cuentas nuevas;
regalo de 7 días canjeable durante 7 días; verificación prometida en 48 h como máximo; verificación automática apagada.

**Estados de la cuenta** (`profiles.subscription_status` + fechas):
```
none ──(confirma correo, cuenta nueva)──► trialing (24 h) ──(vence)──► [bloqueo por fecha; el estado sigue «trialing»]
any ──(admin aprueba aporte)──► supporter            any ──(admin revoca)──► revoked
any ──(regalo / admin da días)──► access_until en el futuro (estado sin cambiar)
legado: active / canceled / past_due / blocked (modelo de tarjeta)
```
**Estados del aviso**: `awaiting_payment` (72 h) → `submitted` (TXID) → `manual_review` → `approved` / `rejected`;
`awaiting_payment` → `expired` / `canceled`.

| # | Prioridad | Hallazgo |
|---|---|---|
| 8.1 | 🟠 P1 | **Pagar tarde = dinero sin aviso**: si la persona paga después de las 72 h, `submit_support_claim_tx` rechaza el TXID (`expired`). Solo le queda escribir a hello@. El dinero llegó, pero el sistema no tiene cómo registrarlo. Falta un camino «pagué después de que venció». |
| 8.2 | 🟠 P1 | **No hay plazo ni aviso para la revisión manual**: se promete «48 h como máximo», pero un aviso `submitted` o `manual_review` puede quedarse para siempre. Nada avisa a la admin cuando un aviso lleva más de 24 o 48 h esperando (el Resumen solo cuenta). |
| 8.3 | 🟡 P2 | **El estado «trialing» no cambia al vencer**: el bloqueo depende de la fecha, y la tarea diaria no lo toca. Es correcto (falla cerrado), pero en el panel y en las consultas `subscription_status = 'trialing'` no significa «en prueba». El panel lo resuelve con `admin_access_state()`, pero cualquier consulta escrita a mano se equivoca. |
| 8.4 | 🟡 P2 | **Un `supporter` con días de regalo**: el regalo no se gasta (bien). Pero un `revoked` que tenía `access_until` futuro conserva esa fecha; si la admin «des-revoca» a mano, recupera los días. No hay función para quitar la revocación: se hace por SQL. |
| 8.5 | 🟡 P2 | **Rechazado y vuelta a empezar**: tras un rechazo, la persona puede reservar otro monto, pero el pago anterior (si existió) queda sin relación con el nuevo aviso. No hay «reabrir aviso». |
| 8.6 | 🔵 P3 | **Montos**: 99 sufijos por cantidad de flores; con más de 99 personas reservando la misma cantidad a la vez, aparece «no queda ningún monto libre». Para el volumen previsto sobra, pero es un tope duro. |
| 8.7 | 🔵 P3 | **Aceptar hasta 0,50 USDC menos** (decisión de la dueña) solo se puede hacer a mano: la comprobación automática exige el monto exacto (correcto, porque está apagada). |
| 8.8 | 🔵 P3 | **Cuentas antiguas sin confirmar** que confirman después del SQL: no reciben prueba (fueron creadas antes) y ven «sin acceso». Es coherente con la regla, aunque puede sorprender a esa persona. |
| 8.9 | ✅ | Las 24 h y los 7 días se calculan en el servidor (`now()`), los montos en unidades enteras (6 decimales) y se muestran con 4 decimales como texto. No hay decimales de coma flotante en la comparación. |

---

## 9. Estado y sincronía

| # | Prioridad | Hallazgo |
|---|---|---|
| 9.1 | 🟡 P2 | **Activar un aporte no se refleja al momento en la app abierta de la persona**: la app vuelve a leer su perfil al iniciar sesión, al recargar o cuando Supabase renueva la sesión (más o menos cada hora). El temporizador de 15 s solo recalcula fechas, no consulta el servidor. Recibe el correo de activación, pero si mira la app sin recargar sigue bloqueada. |
| 9.2 | 🟡 P2 | **Revocar tampoco es inmediato en pantalla**: la persona revocada sigue viendo el contenido educativo hasta recargar (la Comunidad sí se le cierra en el servidor al instante). |
| 9.3 | 🔵 P3 | **Varias pestañas**: el correo pendiente de confirmar vive en `sessionStorage` (por pestaña); los límites de reenvío, en `localStorage` (compartidos). Abrir la app en otra pestaña antes de confirmar muestra «visitante» en vez de «confirma tu correo». |
| 9.4 | 🔵 P3 | **El trabajador de servicio** guarda la portada; el aviso «hay una versión nueva» solo aparece si cambia `service-worker.js`, y este lanzamiento no lo cambia (sigue `mv-shell-v4`). HTML y JS se piden primero a la red, así que una recarga normal carga la versión nueva. **SIN VERIFICAR** con un móvil que tenga la versión vieja guardada. |
| 9.5 | ✅ | Tras canjear un regalo, enviar un TXID o ser rechazado por el servidor en Comunidad (`no_access`), la app vuelve a leer el perfil y redibuja todo (`mvRefreshAuth`). El cambio de idioma redibuja los textos construidos en JavaScript. |

---

## 10. Contradicciones lógicas (lo más importante)

| # | Prioridad | Contradicción | Dónde |
|---|---|---|---|
| 10.1 | 🟠 P1 | **El borrador de la política de privacidad dice que el directorio de Comunidad «puede verlo cualquier persona que abra la app, aunque no tenga cuenta»**, pero la base ahora solo deja verlo a quien tiene acceso completo (`community_members_select_access`). Si se publicara así, la política diría algo falso. | `docs/politica-privacidad-borrador-es.md` frente a la migración `20261010130000` |
| 10.2 | 🟡 P2 | **«Activa» en la pantalla y «sin acceso» en el servidor para cuentas heredadas `active` sin fecha de fin**: `computeIsPremium()` en `src/auth.js` da acceso si `subscription_expires_at` está vacío. `is_premium()` en la base exige una fecha futura. Esa persona vería todo, pero la Comunidad la rechazaría. **SIN VERIFICAR** si existe alguna fila así en producción (consulta de lectura en el paso del precheck). | `src/auth.js` frente a la migración `20261010120000` |
| 10.3 | 🟡 P2 | **Bitácora «solo lectura» en pantalla, escribible en la base** para cuentas sin acceso. | `main.js` (`renderBitacoraGate`) frente a las reglas de `bitacora_entries` |
| 10.4 | 🟡 P2 | **Promesa de 48 h sin mecanismo** que la haga cumplir o avise. | texto de Desbloquear frente a la base |
| 10.5 | 🟡 P2 | **La persona ve su aporte activado por correo, pero la app sigue bloqueada** hasta recargar (9.1). | correo de activación frente al estado en pantalla |
| 10.6 | 🟡 P2 | **Fotos «solo con acceso» en la base, públicas por enlace** (bucket público). | reglas de `storage.objects` frente al bucket |
| 10.7 | 🔵 P3 | **Hora del dispositivo frente a la hora del servidor** en la cuenta atrás (5.6). | `main.js` frente a `is_premium()` |
| 10.8 | 🔵 P3 | **Lógica de «gratis frente a Premium» de antes, todavía en el código** (`FULL_GATES`, `applyTier`, comentarios de «filosofía Premium»). Con el modelo nuevo todo es «con acceso» o «sin acceso». Hoy no se contradice en pantalla porque `isPremium = !bloqueado`, pero confunde y podría reactivarse por error. | `public/main.js` |
| 10.9 | 🔵 P3 | **Aviso borrado con la cuenta** que en el registro de auditoría sigue apareciendo (aprobación o rechazo con correo), sin el aviso al que se refiere. | cascada frente a `admin_audit_log` |
| 10.10 | 🔵 P3 | El panel dice «Usuarios» y la app dice «cuenta»; «Avisos de aporte» en el panel y «aviso» en la app. Están alineados. Pero `subscription_status`, `subscription-cron` y `is_premium` hablan de suscripción y Premium, palabras prohibidas en la cara pública. Solo afecta al código. | nombres internos |

---

## 11. Mapa de dependencias

```
                         ┌──────────── Vercel (web estática + /api) ─────────────┐
 Navegador ──► index.html/main.js ──► Supabase Auth ──► SMTP Hostinger (correos de cuenta)
     │                     │                 └──► Hook «Before User Created» (función SQL)
     │                     ├──► Supabase PostgREST (RLS) ──► Postgres (todo el estado)
     │                     ├──► Edge Functions ──► community-publish-*  ──► DeepL (traducción)
     │                     │                   ├─► support-claims      ──► red Base (mainnet.base.org) + SMTP/Resend
     │                     │                   ├─► admin-send-gift-code ──► SMTP Hostinger / Resend
     │                     │                   ├─► signup-fix-email    ──► Supabase Auth
     │                     │                   └─► delete-account
     │                     └──► Google Fonts, flagcdn.com (banderas), Cloudflare Turnstile (si se enciende)
 Vercel Cron 23:00 UTC ──► /api/subscription-cron ──► Postgres (expira reservas) ──► community-retranslate ──► DeepL
```

| Dependencia | Si falla… | Falla en cadena | Prioridad |
|---|---|---|---|
| **Supabase (proyecto único)** | no entra nadie, no carga nada protegido | **total**: dev y producción usan el mismo proyecto, así que una migración probada en dev ya está en producción | 🔴 P0 (riesgo estructural) |
| **SMTP de Supabase (Hostinger)** | no llegan las confirmaciones ni las recuperaciones | **nadie nuevo puede empezar las 24 h**; no hay plan B para estos correos (Resend solo cubre nuestras funciones) | 🟠 P1 |
| **Límite de correos por hora de Supabase** | «no podemos enviar más correos» | registros bloqueados el día del lanzamiento | 🟠 P1 (ver el informe de correos) |
| **Hook de registro** | si la función SQL da error, **nadie puede registrarse** | total para registros | 🟡 P2 (se activa al final con prueba) |
| **Red Base (endpoint público)** | la comprobación pasa a revisión manual | ninguna: nunca activa con dudas | 🔵 P3 |
| **DeepL** | se publica sin traducir y se reintenta | ninguna | 🔵 P3 |
| **Vercel Cron** | las reservas vencidas no se marcan (crear una nueva igual las expira) y no se reintentan traducciones | baja | 🔵 P3 |
| **Google Fonts / flagcdn** | se ve con otra letra y sin banderas | ninguna; pero mandan la IP de cada visitante a terceros (privacidad) | 🟡 P2 |
| **Navegador sin JavaScript** | la página no funciona | — | ⚪ P4 |
