# Puesta en producción de www.motherverdeny.com — preparación (13 de octubre de 2026)

**Nada está publicado.** Producción sigue en `d58f1aa` (Vercel `dpl_AYSGmSZc98Jy2kumc7zzaRaVzcZ5`).
El merge a `main` se hace solo cuando escribas exactamente: «APRUEBO EL MERGE A MAIN».

## 1. Compilación final y pruebas

- **Compilación de producción** (como la haría `main`): termina bien. Quita la vista previa de dev
  (el selector de estados y el panel de ejemplo no salen). El `main.js` pesa ~3 MB (~165 KB comprimido
  el paquete principal): sigue siendo lenta la primera visita (pendiente de «velocidad»).
- **Pruebas** (`node tests/sim/run-all.mjs`): **25 de 25 sin fallos, 835 comprobaciones** (14 de octubre de 2026), más
  880 combinaciones de pantalla × idioma × estado revisadas (0 textos del modelo viejo, 0 errores de JavaScript).

| Prueba | Resultado |
|---|---|
| Base de datos (migraciones, permisos, reversas) | 229 ok |
| Base de datos de correos | 19 ok |
| Funciones (códigos, aportes, traducciones, tarea diaria, fallos de envío) | 117 ok |
| Plantillas de correo | 16 ok |
| Cambio de idioma en vivo | 29 ok |
| App: Desbloquear + código de regalo | 10 ok |
| Panel con verificación en dos pasos | 20 ok |
| Panel: Resumen, Usuarios, CSV | 32 ok |
| Monto exacto | 19 ok |
| Vista previa de dev | 14 ok |
| 20 flores | 14 ok |
| Flor de Desbloquear | 6 ok |
| Enlaces de correo | 28 ok |
| Pantalla «revisa tu correo» | 30 ok |
| Recorridos completos de correo | 21 ok |
| Aviso de correos fallidos en el panel | 9 ok |
| Barrido de pantallas | 0 textos viejos, 0 errores |

## 2. Qué cambia en la web pública

### Lo que verá una persona nueva
- Después de la pregunta de edad, una **pantalla de entrada corta**: «Crear cuenta» o «Entrar».
  Sin cuenta solo se puede ver: Seguridad (Mascotas, Manejo y el recuadro de Emergencia),
  Desbloquear (informativo), Términos y Privacidad.
- Al crear la cuenta: pantalla **«Confirma tu correo»** con ayuda de spam, reenvío (60 s, 3 por hora),
  corregir el correo mal escrito y el contacto hello@motherverdeny.com.
- Al confirmar el correo: **24 horas de acceso completo**, con una franja que cuenta el tiempo que queda.
- Pasadas las 24 h, **todo se bloquea**, salvo lo de arriba, su propia Bitácora (solo lectura + PDF) y su cuenta.
  Para seguir: **Desbloquear**, un aporte único de apoyo en USDC (red Base) desde 1 flor = 10 USDC,
  con un monto exacto propio, o un **código de regalo**.
- Ya no aparecen precios mensuales, «$7.10», «prueba de 3 días», «suscripción» ni «Premium».
- Nuevo: «¿Olvidaste tu contraseña?», aviso claro si un enlace caducó y cambio del correo de inicio de sesión en Cuenta.
- La Comunidad solo funciona con acceso completo (lo controla el servidor, no solo la pantalla).
- Pago tardío: con la reserva vencida se puede registrar el TXID; antes de guardarlo se comprueba en Base que sea el
  monto exacto de **su** reserva, y siempre pasa a revisión manual. Un TXID que ya registró otra cuenta abre un conflicto
  que solo ve el panel; la persona solo lee «Lo revisaremos manualmente».
- Si la administradora activa o retira el acceso, la app abierta se entera sola: al volver a la pestaña o, en la
  pantalla de bloqueo, en un minuto como mucho.
- La pantalla de Privacidad describe lo que la plataforma hace de verdad (con lo legal marcado `[PENDIENTE]`).

### Lo que verá una persona que ya tiene cuenta
- **No recibe la prueba de 24 h**: en su primer inicio de sesión ve «Esta cuenta no tiene acceso activo»
  y el botón Desbloquear.
- Si tenía una prueba o un periodo del modelo viejo **todavía vigente**, lo conserva hasta que termine.
- **Betian y la cuenta oficial Mother Verde**: acceso completo, sin fecha (SQL `supporters-betian-mother-verde.sql`).
- **Cuentas del modelo viejo «active» sin fecha de fin:** desde `20261014140000` la app y el servidor dicen lo mismo
  (sin acceso; antes la app decía que sí). No se cambia ninguna: `supabase/admin/legacy-active-accounts.sql` (solo
  lectura) las lista para que decidas.
- **hello@motherverdeny.com (tú, administradora)**: acceso completo sin fecha **y** panel (SQL `grant-admin.sql`,
  paso 13). Nunca ve la pantalla de bloqueo; para revisarla, en la web de dev: «Ver como persona con prueba vencida».
- Su Bitácora, sus publicaciones y su perfil no se borran. Si está bloqueada, puede leer y descargar
  su Bitácora y eliminar su cuenta.
- Ya no tiene que cancelar ninguna suscripción: no se cobra nada automáticamente.

### Lo que no se ve (pero está)
- El panel privado `/panel-mv.html` (sin enlace, con `noindex`): solo admin + verificación en dos pasos.
- Bloqueo de correos desechables y de Gmail duplicados al registrarse (hook, se activa al final).

## 3. Si la web nueva saliera ANTES de pegar el SQL

Se rompería esto:
1. **Todas las cuentas quedarían bloqueadas**, incluidas Betian y Mother Verde: la web nueva solo
   abre con un estado que todavía no existe en la base (`supporter`, `access_until`).
2. **Las personas nuevas nunca empezarían sus 24 h**: el disparador que las arranca al confirmar el
   correo está en el SQL. Confirmarían y quedarían bloqueadas al momento.
3. Desbloquear (reservar monto, enviar TXID), canjear códigos de regalo, «Corrígelo», el panel y la
   tarea diaria darían error (las tablas y funciones no existen).
4. La Comunidad seguiría abierta en el servidor para cualquiera con sesión (las reglas nuevas también van en el SQL).

Y al revés (SQL pegado y la web vieja todavía publicada): el botón de prueba de 3 días falla y la
Comunidad rechaza a quien no tenga acceso completo. Por eso todo va **seguido, en una misma sesión**.

**Orden seguro confirmado** (el del informe, con lo nuevo de correos):
SQL → secretos → funciones → variables de Vercel → plantillas y ajustes de correo → merge →
cuenta de administradora (`grant-admin.sql`: admin + acceso completo) → hook al final.
La cuenta de administradora va **después del merge** porque hello@ se registra y confirma en la web nueva, y
**antes del hook** para que el hook no pueda impedir ese registro.

## 4. Plan de vuelta atrás

**Web (un clic):** Vercel → proyecto mother-verde → *Deployments* → la versión de producción
`d58f1aa` (`dpl_AYSGmSZc98Jy2kumc7zzaRaVzcZ5`, «Merge branch 'main' into dev») → «…» → **Instant Rollback**
(o *Promote to Production*). Está lista y marcada como candidata a vuelta atrás.
Ojo: eso vuelve atrás solo la web. Si también deshaces el SQL, hazlo **justo después** (la web vieja
no funciona bien con la base nueva y la nueva no funciona con la vieja).

**Base de datos** (SQL Editor, cada archivo entero, **en este orden**; probado: el esquema queda igual que antes):

| Paso que deshace | Archivo de reversa | Qué se pierde |
|---|---|---|
| Hook | (sin SQL) Authentication → Hooks → apagar «Before User Created». **Primero esto.** | — |
| `grant-admin.sql` (hello@ admin + acceso completo) | `rollback-grant-admin.sql` (PARTE 1 solo lectura, luego PARTE 2) | hello@ deja de ser admin y vuelve al estado de acceso que tenía antes (lo guarda el registro de auditoría) |
| `20261020100000` Bitácora de solo lectura sin acceso | `rollback-20261020100000.sql` | nada: vuelven las reglas anteriores (sin acceso se podía escribir) |
| `20261014140000` regla de acceso única | `rollback-20261014140000.sql` (deshacer antes la web) | nada: vuelve la versión anterior de `is_premium`, con los mismos resultados |
| `20261014130000` contador «Avisos sin revisar» | `rollback-20261014130000.sql` | nada (solo un contador de lectura) |
| `20261014120000` conflictos de TXID y historial de motivos | `rollback-20261014120000.sql` | la lista de conflictos y el historial de motivos (exportarlos antes: `select * from public.admin_list_claim_conflicts(true);`); vuelve el pago tardío directo desde el navegador |
| `20261014110000` pago tardío | `rollback-20261014110000.sql` | nada (los avisos tardíos se conservan); si hay un tardío abierto con el mismo monto que otro aviso abierto, ciérralo antes |
| `20261014100000` avisos de cuentas borradas | `rollback-20261014100000.sql` | **borra** los avisos de cuentas ya borradas (expórtalos antes con el CSV) |
| `20261013120000` límites de «Corrígelo» | `rollback-20261013120000.sql` | el registro de intentos de corrección |
| `20261013110000` panel de correos | `rollback-20261013110000.sql` | nada |
| `20261013100000` correos | `rollback-20261013100000.sql` | el registro de envíos (`mail_events`) |
| `20261011130000` códigos de regalo | `rollback-20261011130000.sql` | todos los códigos; los días ya dados se quedan hasta la última reversa |
| `20261011120000` aportes | `rollback-20261011120000.sql` | todos los avisos de aporte (quien ya es `supporter` lo sigue siendo) |
| `20261011100000` admin y registro | `rollback-20261011100000.sql` | la lista de admins y todo el registro de auditoría |
| `20261010130000` Comunidad | `rollback-20261010130000.sql` | nada (vuelven las reglas viejas) |
| `20261010120000` modelo de acceso + dominios bloqueados + `supporters-…sql` | `rollback-20261010120000.sql` | la lista de dominios; `supporter` pasa al estado antiguo de acceso completo |

**Funciones:** vuelve a pegar las versiones de `main` de `community-publish-post` y `community-publish-comment`;
borra `support-claims`, `admin-send-gift-code`, `community-retranslate` y `signup-fix-email`.
`delete-account` no cambia. Los secretos y las plantillas pueden quedarse (no rompen nada).

## 5. Cuentas que ya existen en producción

- **Nada se borra**: el SQL solo añade columnas, tablas y reglas.
- **Sin prueba automática**: las cuentas que ya existen quedan con `trial_eligible = false`, así que la
  prueba de 24 h no se les activa nunca. Solo la tienen las cuentas creadas después.
- **Periodos viejos vigentes**: la regla de acceso (`is_premium`) sigue respetando una prueba o un periodo
  activo del modelo viejo hasta su fecha de fin. La tarea diaria solo ordena los que ya vencieron, y no cobra nada.
- **Betian y Mother Verde**: `supporters-betian-mother-verde.sql` primero muestra las 2 cuentas (PARTE 1)
  y luego las pasa a acceso completo (PARTE 2). La tercera cuenta queda bloqueada, como decidiste.
- **Caso raro**: una cuenta creada antes y **sin confirmar** el correo, si lo confirma después, tampoco recibe
  prueba (fue creada antes). Verá Desbloquear.
- **Qué protege el precheck** (`precheck-before-20261010.sql`, solo lectura): no toca cuentas. Comprueba que
  la base de producción tiene exactamente lo que el SQL espera reemplazar (reglas, funciones, disparadores,
  la restricción de estados) y que todavía **no** existe nada de lo que el SQL va a crear (ahora también lo de
  correos). Si alguna fila no dice `ok`, **no pegues nada** y mándame el resultado: así nunca se aplica el SQL
  sobre una base distinta de la que probamos, que es lo que podría dejar cuentas a medias.
- Cada archivo SQL va en **una sola transacción**: si algo falla, no se aplica nada de ese archivo.

## 6. Lista para el día del lanzamiento

**Antes del día (sin prisa)**
1. ☐ **Tú**: confirmar que el aporte de prueba de $5 en USDC (Base) llegó a tu billetera. **Condición para el merge**:
   la dirección ya está en `src/supportConfig.js` y quedará pública con el merge.
2. ☐ **Tú**: hacer una copia de la base (Supabase → Database → Backups, o exportar) justo antes de empezar.
3. ☐ **Tú**: tener a mano la contraseña del buzón hello@ y, si usarás Resend, su clave.
4. ☐ **Yo** (si me lo pides): terminar los bloques «icono» y «velocidad y privacidad» y volver a pasar las pruebas.

**El día, en una sola sesión**
5. ☐ **Tú**: SQL Editor → `precheck-before-20261010.sql`. Todas las filas `ok`. Si no: paras y me escribes.
6. ☐ **Tú**: SQL Editor, cada archivo entero y en orden:
   `20261010120000` → `seed-blocked-email-domains/part-01` … `part-07` → `20261010130000` → `20261011100000` →
   `20261011120000` → `20261011130000` → `20261013100000` → `20261013110000` → `20261013120000` →
   `20261014100000` → `20261014110000` → `20261014120000` → `20261014130000` → `20261014140000` →
   `20261020100000` (Bitácora de solo lectura sin acceso, también en el servidor) →
   `supporters-betian-mother-verde.sql` (PARTE 1: 2 cuentas; luego PARTE 2).
   (La del juego, `20261015100000_game_progress.sql`, **no** va en producción hasta que el juego se fusione: vive
   en la rama `juego` y se prueba en staging.)
7. ☐ **Tú**: Edge Functions → Secrets: `MAIL_PROVIDER` (`smtp`, o `smtp,resend` si Resend está listo), `MAIL_FROM`,
   `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `APP_URL`, `RETRANSLATE_SECRET`, `SUPPORT_ADDRESS` (paso 1 hecho),
   y `RESEND_API_KEY` si toca.
   Opcional: `NOTIFY_TO` = dirección que recibe el aviso de cada TXID nuevo (si no se pone: hello@motherverdeny.com).
8. ☐ **Tú**: Edge Functions, pegar cada `index.ts` entero: `community-publish-post`, `community-publish-comment`,
   `support-claims`, `admin-send-gift-code`, `community-retranslate` (**Verify JWT apagado**) y
   `signup-fix-email` (**Verify JWT apagado**). `delete-account` no se toca.
   **Importante:** `support-claims` tiene que ser la versión nueva (acción `submit_late`): con `20261014120000` el
   pago tardío ya no se puede registrar desde el navegador y solo pasa por esta función, que lo comprueba en Base.
9. ☐ **Tú**: Vercel → Environment Variables: `RETRANSLATE_SECRET` (el mismo valor).
10. ☐ **Tú**: Supabase → Authentication:
    - URL Configuration: Site URL `https://www.motherverdeny.com`; Redirect URLs `https://www.motherverdeny.com/**` y `https://motherverdeny.com/**`.
    - SMTP: remitente `hello@motherverdeny.com`, nombre `Mother Verde`.
    - Emails: las 13 plantillas con los asuntos de `SUBJECTS.md`; activar las notificaciones de seguridad.
    - Rate Limits: correos por hora a **150**.
    - Providers → Email: «Confirm email» y «Secure email change» activados.
11. ☐ **Tú**: escribirme «APRUEBO EL MERGE A MAIN». **Yo**: fusiono el pull request, espero a que Vercel
    diga READY y compruebo la web publicada sin iniciar sesión.
12. ☐ **Tú**: registrarte en la web con `hello@motherverdeny.com` y confirmar el correo (comprueba que llega).
13. ☐ **Tú**: SQL Editor → `grant-admin.sql`. Primero **PARTE 1** sola (solo lectura): debe salir una fila,
    hello@motherverdeny.com, `email_confirmed = true`. Después el archivo entero: al final, una fila con
    `is_admin = true`, `subscription_status = supporter`, `full_access = true`. Si dice «NO SE HIZO NADA», lee el
    mensaje (cuenta sin crear o sin confirmar), arréglalo y vuelve a pegarlo: se puede pegar las veces que haga falta.
    Para deshacerlo: `rollback-grant-admin.sql`.
14. ☐ **Tú**: abrir `/panel-mv.html`, activar la verificación en dos pasos y **guardar la clave**.
15. ☐ **Tú**: en el panel, «Enviar correo de prueba a mi correo». Llega a hello@.
16. ☐ **Tú**: con una cuenta de prueba **sin confirmar**, probar «Corrígelo» con una contraseña equivocada:
    tiene que decir «La contraseña no coincide». Si no, me avisas.
17. ☐ **Tú**: activar el hook «Before User Created» siguiendo `hook-activation-plan.md`. **Siempre al final.**

**Después**
18. ☐ **Tú**: al día siguiente, `select * from public.cron_runs order by started_at desc limit 3;` → `ok = true`.
19. ☐ **Tú**: enviar un código de regalo a un Gmail tuyo (¿bandeja principal o spam?) y canjearlo con una cuenta de prueba.
20. ☐ **Tú**: mail-tester.com con el correo de prueba y una confirmación de registro: objetivo 9/10 o más.
    Configurar SPF, DKIM y DMARC en Hostinger si no lo están.
21. ☐ **Si algo sale mal**: sección 4 (primero la web en Vercel, luego el SQL en orden).
22. ☐ **Tú, durante la primera semana**: abre la web publicada con la consola del navegador (F12 → Console) en
    Inicio, Cuenta, la Comunidad y el panel. Si aparece algún aviso que empieza por
    «[Report Only] Refused to…», mándamelo. Si en una semana no aparece ninguno: **Yo** cambio en `vercel.json`
    la clave `Content-Security-Policy-Report-Only` por `Content-Security-Policy` (la de producción) y lo publico.

## 7. Robustez y seguridad (A2, 20 de octubre de 2026, en `dev`)

| Qué | Cómo queda | Dónde |
|---|---|---|
| «Cargando…» eterno | Si la sesión, el perfil o el acceso no cargan: salida con «Reintentar», «Cerrar sesión» y hello@motherverdeny.com, **enseguida** si la carga falló y **a los 12 s** si se queda colgada. En la pantalla de bloqueo, en Cuenta → «Tu acceso» y en cada recuadro del panel (inicio, Resumen, Usuarios, Avisos, Regalos, Registro, ficha). «Cerrar sesión» funciona aunque el servidor no responda. 4 idiomas. | `src/auth.js`, `public/main.js`, `src/admin.js`; prueba `stuck-ui` |
| Cabeceras de seguridad | `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` (cámara, micrófono, ubicación, pagos… apagados), HSTS de 2 años (sin «preload»: se añade solo si se decide). **CSP**: solo nuestro dominio, Supabase, Google Fonts y flagcdn.com (**quitar estos dos cuando alojemos las fuentes y las banderas**) y Turnstile si se activa el captcha; `frame-ancestors 'none'`. En producción va primero en **Report-Only** (no bloquea, solo avisa: paso 22) y fijada al proyecto de producción; en Preview, `dev` y `juego` va **aplicada**, con el proyecto de staging. | `vercel.json`; prueba `csp-ui` (20 pantallas y sus secciones × 4 idiomas, panel, instalación como app, 404: 0 infracciones) |
| Página 404 | Propia, oscura, 4 idiomas, botón «Ir a Inicio». No afecta a ninguna ruta válida ni a los enlaces de los correos (`/`, `/?…`, `/#…`, `/panel-mv.html`). | `public/404.html` |
| Bitácora sin acceso | El servidor ahora también es de solo lectura (antes solo lo era la pantalla): sin acceso se puede leer y bajar el PDF, pero no añadir, editar ni borrar. | migración `20261020100000`; prueba `bitacora-db` (20) |
| Límite de correos al registrarse | Mensaje propio en 4 idiomas: «Estamos recibiendo muchos registros. Inténtalo de nuevo en unos minutos.» | `src/auth.js`; prueba `mail-flow-ui` |
| Finales de línea | `.gitattributes`: todo LF en el repositorio y en la copia de trabajo, en cualquier equipo. `fn-e2e` pasa completa. | `.gitattributes` |

### Límite de correos de Supabase: qué cambiar (tú)
- **Hoy**: con SMTP propio, Supabase permite por defecto **unos 30 correos por hora para todo el proyecto**
  (cada confirmación, reenvío, recuperación y cambio de correo cuenta). No puedo ver tu panel: mira el número real
  en **Authentication → Rate Limits → «Rate limit for sending emails»**.
- **La persona número 31** en la misma hora: Supabase rechaza el registro con «límite de correos» y la cuenta
  **no se crea** (según el funcionamiento de Supabase Auth; lo comprobamos en staging, prueba 3 de
  `docs/staging.md`). La web le dice «Estamos recibiendo muchos registros. Inténtalo de nuevo en unos minutos» y,
  pasado el pico, puede registrarse con el mismo correo.
- **Ajustes (Authentication → Rate Limits)**: «Rate limit for sending emails» a **150 por hora** el día del lanzamiento
  (cabe en los 1.000 correos al día de Hostinger Business Starter si el pico dura pocas horas); «Rate limit for
  sign ups and sign ins» déjalo en **30 cada 5 minutos por IP** (el valor por defecto; frena robots, no a personas);
  «Rate limit for token verifications» igual (**30 cada 5 minutos por IP**). En staging: **20 por hora** (solo pruebas).
