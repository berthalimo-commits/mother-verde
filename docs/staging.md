# Staging (entorno de pruebas permanente)

Actualizado el 20 de octubre de 2026. Todo lo que sigue lo haces tú, **en orden y de uno en uno**. Ningún paso
escribe en producción. Ningún valor secreto está en este documento: donde dice «pega el valor», lo copias del
panel correspondiente.

## Los dos proyectos de Supabase

| Proyecto | Para qué | Región | Datos | Lo usa en Vercel |
|---|---|---|---|---|
| **producción** (`mother-verde`) | la web pública `www.motherverdeny.com` | Central EU (Fráncfort) | personas reales | **Production** (rama `main`) |
| **`mother-verde-staging`** | solo pruebas | West US (Oregon) | **solo cuentas y datos de prueba** | **Preview** (todas las demás ramas: `dev`, `juego`…) |

Reglas de staging:
- **Nunca datos de personas reales.** Ni cuentas, ni correos, ni copias o exportaciones de producción.
- Todo SQL nuevo se pega **primero en staging** y, cuando funciona, en producción (lista en la sección 4).
- Las pruebas automáticas siguen usando la **base simulada** de `tests/sim` (ningún proyecto real).
- La web conectada a staging muestra abajo a la izquierda el aviso **«STAGING · pruebas»** (en los 4 idiomas) y
  el título de la pestaña empieza por `[STAGING]`, en la web y en el panel.

## 1. Variables de Vercel (B.1)

Vercel → proyecto `mother-verde` → **Settings → Environment Variables**. Cada variable se crea **una vez por
entorno**, con el mismo nombre y un valor distinto. Marca las secretas como **Sensitive**.

| Nombre | Production | Preview | Qué es |
|---|---|---|---|
| `VITE_SUPABASE_URL` | la URL de **producción** | la URL de **mother-verde-staging** | Supabase → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | la clave *anon* de producción | la clave *anon* de staging | misma pantalla, «anon public» (es pública, va dentro de la web) |
| `SUPABASE_SERVICE_ROLE_KEY` | la de producción (**Sensitive**) | la de staging (**Sensitive**) | solo la usa la tarea diaria `/api/subscription-cron` |
| `CRON_SECRET` | ya la tienes | no hace falta | Vercel ejecuta las tareas programadas solo en Production |
| `RETRANSLATE_SECRET` | el mismo valor que el secreto de Supabase de producción | el mismo valor que el secreto de staging | une la tarea diaria con `community-retranslate` |
| `RESEND_API_KEY` | si usas el formulario de anuncios | opcional | `/api/ad-inquiry` |

No crees nada en **Development** (no se usa).

**Qué pasa si falta una o está mal** (la web nunca falla en silencio): la compilación **se detiene** y el
despliegue queda en *Error*, con un mensaje que empieza por `[mother-verde]` en *Building* (por ejemplo «Falta
VITE_SUPABASE_URL»). La versión anterior sigue publicada. Se detiene también si:
- **Preview** (cualquier rama, también `dev` y `juego`) apunta a la base de **producción**;
- **Production** apunta a cualquier base que no sea la de producción.

Eso lo decide `vite.config.js` con `supabase/projects.json` (los nombres de los dos proyectos; son datos públicos,
no secretos). Si quieres que Preview compruebe además que es exactamente staging, escribe el *Reference ID* de
staging en `supabase/projects.json` → `staging.ref` (Project Settings → General). La tarea diaria (`/api/…`) no
compila: si le falta `SUPABASE_SERVICE_ROLE_KEY` responde con error y lo verás en Vercel → Logs.

Después de crear las variables: Vercel → *Deployments* → el último de `dev` → «…» → **Redeploy** (y lo mismo
con `juego`), para que usen las variables nuevas.

## 2. Preparar staging igual que producción (B.2)

Todo en el proyecto **`mother-verde-staging`** (comprueba arriba a la izquierda del panel de Supabase el nombre
y la región Oregon **antes de cada paste**). Cada archivo SQL se pega **entero** en *SQL Editor → New query* y
se ejecuta con *Run*. Cada uno va en una sola transacción: si algo falla, no se aplica nada de ese archivo.

### 2.1 Las migraciones que ya están en producción
Paso 1. Pega, en este orden, una por una (carpeta `supabase/migrations`):
`20260811205653` → `20260811210237` → `20260815000000` → `20260902220000` → `20260903120000` →
`20260904120000` → `20260904150000` → `20260905180000` → `20260906120000` → `20260907140000` →
`20260909130000` → `20260915120000` → `20260915121500` → `20260916100000` → `20261005120000`.

Paso 2. `supabase/admin/precheck-before-20261010.sql` (solo lectura). **Todas las filas `ok`.** Si alguna no:
paras y me mandas el resultado.

### 2.2 Las migraciones del lanzamiento (las mismas que irán a producción ese día)
Paso 3. En este orden:
`20261010120000` → `supabase/seed-blocked-email-domains/part-01.sql` … `part-07.sql` (semillas: la lista de
dominios de correo desechables) → `20261010130000` → `20261011100000` → `20261011120000` → `20261011130000` →
`20261013100000` → `20261013110000` → `20261013120000` → `20261014100000` → `20261014110000` →
`20261014120000` → `20261014130000` → `20261014140000` → `20261020100000`.

Paso 4. **Solo para probar el juego** (rama `juego`): en GitHub, rama `juego`, abre y pega primero
`supabase/admin/precheck-game.sql` (todas las filas `ok`) y luego `supabase/migrations/20261015100000_game_progress.sql`.
Es independiente: va en cualquier momento después del paso 3. En producción **no** se pega hasta que el juego se fusione.

Paso 5. **Tope de DeepL bajo** (en staging se traduce poco): pega
`update public.app_config set value = 2000 where key = 'deepl_daily_char_cap';`
(2.000 caracteres al día en total; cada persona puede gastar una novena parte).

### 2.3 Secretos de las funciones
Paso 6. Supabase → **Edge Functions → Secrets** (en staging), uno por uno:

| Secreto | Valor en staging |
|---|---|
| `MAIL_PROVIDER` | `smtp` |
| `MAIL_FROM` | `Mother Verde <hello@motherverdeny.com>` o el remitente del SMTP que ya configuraste en staging |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | los mismos que pusiste en el SMTP de staging (ya probado) |
| `APP_URL` | la dirección de la web de pruebas: Vercel → *Deployments* → rama `dev` → «Domains» (algo como `https://mother-verde-git-dev-….vercel.app`) |
| `SUPPORT_ADDRESS` | **una billetera de PRUEBA tuya** (en minúsculas). **Nunca** la de producción |
| `NOTIFY_TO` | un **buzón de prueba** (recibe el aviso de cada TXID) |
| `BASE_RPC_URL` | el mismo que en producción (la red Base es la misma) |
| `DEEPL_API_KEY` | una clave **gratuita** de DeepL (termina en `:fx`); mejor una cuenta distinta de la de producción |
| `RETRANSLATE_SECRET` | un valor nuevo largo (el mismo que pondrás en Vercel → Preview) |
| `RESEND_API_KEY` | solo si usas `smtp,resend` |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` las pone Supabase solo: no las crees.

**DeepL, qué dirección usa** (B.4): el código mira la clave. Si termina en `:fx` (gratuita) llama a
`api-free.deepl.com`; si no (Pro), a `api.deepl.com`. La clave solo se lee del secreto `DEEPL_API_KEY`
(prueba automática `deepl-endpoint`).

### 2.4 Funciones
Paso 7. Supabase → **Edge Functions → Deploy a new function → Via Editor**, una por una: nombre exacto, pegar el
`index.ts` entero de `supabase/functions/<nombre>/`, y la casilla **Verify JWT** así:

| Función | Verify JWT | Por qué |
|---|---|---|
| `support-claims` | **apagado** | comprueba la sesión ella misma (`auth.getUser`) y el panel exige MFA |
| `admin-send-gift-code` | **apagado** | igual: comprueba la sesión y que eres administradora con MFA |
| `community-retranslate` | **apagado** | la llama la tarea diaria con su clave secreta |
| `signup-fix-email` | **apagado** | la persona todavía no tiene sesión (comprueba la contraseña) |
| `community-publish-post` | **encendido** | solo con sesión |
| `community-publish-comment` | **encendido** | solo con sesión |
| `delete-account` | **encendido** | solo con sesión (y vuelve a pedir la contraseña) |

`community-translate` no hace falta (la app ya no la llama).

### 2.5 Correo y direcciones
Paso 8. Supabase → **Authentication** (en staging):
- **URL Configuration**: *Site URL* = la misma dirección de `APP_URL`. *Redirect URLs*: añade
  `https://*-<tu-equipo>.vercel.app/**` (el comodín cubre `dev`, `juego` y cualquier otra rama) y la de `APP_URL`
  seguida de `/**`. No pongas las de producción.
- **Emails → Templates**: las plantillas de `supabase/email-templates/` (confirmación, recuperación, cambio de
  correo, invitación, enlace mágico, reautenticación y las 7 de seguridad) con los asuntos de `SUBJECTS.md`.
  Activa las notificaciones de seguridad.
- **Providers → Email**: «Confirm email» y «Secure email change» **activados**.
- **Rate Limits**: «Rate limit for sending emails» en **30 por hora** (suficiente para pruebas; en producción, 150
  el día del lanzamiento). Los otros dos, como vienen (30 cada 5 minutos por IP).
- **SMTP**: ya está configurado y probado.

### 2.6 Vercel y la cuenta de administradora
Paso 9. Vercel: las variables de **Preview** de la sección 1 y *Redeploy* de `dev` (y de `juego`). Abre la web de
pruebas: abajo a la izquierda debe salir **«STAGING · pruebas»**. Si no sale, Preview sigue apuntando a otra base.

Paso 10. En la web de pruebas, regístrate con una **cuenta de prueba** (no hello@) y confirma el correo.

Paso 11. *SQL Editor* → `supabase/admin/grant-admin.sql`: **en tu copia** cambia `hello@motherverdeny.com` por el
correo de la cuenta de prueba (en todas las líneas) y **no** subas ese cambio. Primero la **PARTE 1** sola (debe
salir una fila con `email_confirmed = true`), luego el archivo entero. Para deshacerlo: `rollback-grant-admin.sql`.

Paso 12. Abre `/panel-mv.html` en la web de pruebas y activa la verificación en dos pasos. Guarda la clave.

Paso 13. **Al final de todo**: el hook «Before User Created», siguiendo `supabase/admin/hook-activation-plan.md`.

### Qué es distinto en staging (resumen)
- `SUPPORT_ADDRESS` = billetera de prueba; `NOTIFY_TO` = buzón de prueba.
- Tope de DeepL bajo (2.000 caracteres al día) y clave gratuita.
- Aviso **«STAGING · pruebas»** en la web y el panel (automático).
- La CSP de seguridad va **aplicada** (en producción, primero en modo de solo aviso).
- Las *Redirect URLs* y `APP_URL` son las de Vercel Preview, nunca las de producción.

## 3. Pruebas reales en staging (B.6)

Hazlas en la web de pruebas, con el aviso «STAGING · pruebas» a la vista. Anota ✔ o lo que falló.

1. ☐ **Registro con un Gmail nuevo**: llega el correo de confirmación (¿bandeja principal o spam?), el enlace abre
   la web y empiezan las 24 h de prueba.
2. ☐ **Registro con un Outlook/Hotmail nuevo**: lo mismo. Prueba también «Reenviar correo» y «¿Escribiste mal tu
   correo? Corrígelo».
3. ☐ **Límite de correos**: baja un momento «Rate limit for sending emails» a **2** y registra 3 cuentas seguidas:
   la tercera debe ver «Estamos recibiendo muchos registros…» y su cuenta **no** debe aparecer en
   Authentication → Users. Vuelve a ponerlo en 30.
4. ☐ **Administradora con MFA**: entrar a `/panel-mv.html`, código de 6 dígitos, ver las 5 pestañas.
5. ☐ **Código de regalo**: enviarlo desde el panel a una cuenta de prueba, canjearlo y ver los días.
6. ☐ **Aviso de aporte**: reservar un monto en Desbloquear, enviar un pago pequeño a la billetera de **prueba**,
   pegar el TXID y ver cómo se activa (o pasa a revisión).
7. ☐ **Pago tardío**: dejar vencer una reserva (o usar una vencida), pagar y pegar el TXID: debe ir a revisión
   manual con el aviso de pago tardío en el panel.
8. ☐ **Juego guardando progreso** (rama `juego`, paso 4 hecho): jugar unas semanas, recargar y seguir; abrir en otro
   navegador con la misma cuenta y seguir en la misma semana.
9. ☐ **Cambio de idioma**: ES → EN → DE → FR en Inicio, Cuenta, el panel y el aviso de staging.
10. ☐ **Cargando… colgado**: con la web abierta, apaga el wifi y recarga: en 12 s debe salir «No pudimos cargar tu
    cuenta» con «Reintentar» y «Cerrar sesión». Enciende el wifi y pulsa «Reintentar».
11. ☐ **Bitácora sin acceso**: con una cuenta de prueba vencida, la Bitácora se lee y se baja en PDF, pero no deja
    añadir ni borrar.
12. ☐ **Consola**: F12 → Console en Inicio, Cuenta, Comunidad y el panel: ningún aviso «Refused to…» (CSP).

## 4. Migraciones: primero staging, después producción (B.3)

**Regla**: cada migración nueva se pega **primero en staging**, se prueba (sección 3, lo que toque) y solo después,
el día que toque, en **producción**, en el mismo orden. Su reversa está en `supabase/admin/rollback-<fecha>.sql`.
Cada vez que haya cambios, te dejo aquí la fila nueva.

| Migración | Qué hace | Staging | Producción |
|---|---|---|---|
| `20261010120000` … `20261014140000` (+ semillas) | modelo de acceso, Comunidad, admin, aportes, regalos, correos, pago tardío, regla única | ☐ (paso 3) | ☐ el día del lanzamiento (`lanzamiento-produccion.md`, paso 6) |
| `20261015100000_game_progress` | progreso del juego (rama `juego`) | ☐ (paso 4) | **no** hasta fusionar el juego |
| `20261020100000_bitacora_read_only_without_access` | Bitácora de solo lectura sin acceso, en el servidor | ☐ (paso 3) | ☐ el día del lanzamiento, después de `20261014140000` |
