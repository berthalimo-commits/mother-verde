# Puesta en producción de www.motherverdeny.com — preparación (13 de octubre de 2026; actualizado el 4 de noviembre de 2026)

**Última actualización:** 6 de noviembre de 2026.
- **Claves nuevas** de Supabase en Vercel Production. La clave secreta se cambia sin caída (9b); el 10c ya no hace falta.
- Las claves antiguas se desactivan **después** del lanzamiento y del ensayo en staging (paso 23).
- Antes: 4 de noviembre de 2026, sobre `dev` en `165180e` (revisión independiente).
- hello@ se registra antes de cerrar los registros (paso 4b).
- Archivos SQL numerados en `supabase/produccion/`.
- Comprobación final `32-read-only-checks.sql` (24 filas; renumerado el 2026-11-06 por la migración `20261106100000`).
- Variables de Vercel que faltaban, y rotar la clave de servicio.
- Migración `20261105100000`: la prueba de 24 h, una vez por persona.

El orden corto, paso a paso, está en `docs/plan-migracion.md`.

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
- La pantalla de Privacidad describe lo que la plataforma hace de verdad; desde el 2026-11-05 es el texto final, sin notas pendientes (ver `docs/legal-final-propuesta.md`).

### Lo que verá una persona que ya tiene cuenta
- **No recibe la prueba de 24 h**: en su primer inicio de sesión ve «Esta cuenta no tiene acceso activo»
  y el botón Desbloquear.
- Si tenía una prueba o un periodo del modelo viejo **todavía vigente**, lo conserva hasta que termine.
- **Betian y la cuenta oficial Mother Verde**: acceso completo, sin fecha (SQL `supporters-betian-mother-verde.sql`).
- **Cuentas del modelo viejo «active» sin fecha de fin:** desde `20261014140000` la app y el servidor dicen lo mismo
  (sin acceso; antes la app decía que sí). No se cambia ninguna: `supabase/admin/legacy-active-accounts.sql` (solo
  lectura) las lista para que decidas.
- **hello@motherverdeny.com (tú, administradora)**: acceso completo sin fecha **y** panel (SQL `grant-admin.sql`,
  paso 6d). Nunca ve la pantalla de bloqueo; para revisarla, en la web de dev: «Ver como persona con prueba vencida».
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

**Orden seguro confirmado** (actualizado el 2026-11-06):
registrar hello@ (4b, con los registros todavía abiertos) → cerrar registros → SQL → `grant-admin.sql` (6d) →
secretos → funciones → variables de Vercel (claves nuevas) → clave secreta nueva (9b, sin caída) → plantillas y ajustes de
correo → merge → verificación en dos pasos del panel → abrir registros unos minutos para «Corrígelo» y el hook (15b) →
hook al final → cerrar registros. **Después del lanzamiento**, y tras ensayarlo en staging: desactivar las claves antiguas (paso 23).
hello@ se registra **antes** de cerrar los registros y **antes del hook**, para que nada impida ese registro.

## 4. Plan de vuelta atrás

**Interruptor de emergencia del juego (si algo del juego falla y el resto de la web va bien):**
1. Vercel → mother-verde → Settings → Environment Variables → `MV_GAME` (Production) → «…» → **Remove**.
2. Vercel → Deployments → la última de Production → «…» → **Redeploy**. En unos 2–3 minutos la web sale **sin**
   el juego (sin el botón «¡Juega ya!»); la historia de bienvenida no cambia.
3. **No se toca la base**: las partidas guardadas se conservan y vuelven cuando se encienda otra vez (`MV_GAME` = `1`
   y Redeploy). **Quien ya tiene la web abierta sigue viendo el juego hasta que recarga la página.** Mientras tanto
   puede seguir jugando y guardando: la base no cambia. Puede que le salga el aviso «hay una versión nueva», pero
   no siempre. Al recargar, ya no tiene el juego.
4. Si el fallo es de la web entera, no del juego: *Instant Rollback* (abajo).
Solo si hubiera que quitar el juego también de la base (casi nunca): `rollback-20261031100000.sql` →
`rollback-20261029100000.sql` → `rollback-20261015100000.sql`, en ese orden; la última **borra todas las partidas**.

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
| Juego: `20261031100000` → `20261029100000` → `20261015100000` | `rollback-20261031100000.sql`, `rollback-20261029100000.sql`, `rollback-20261015100000.sql` (primero quitar `MV_GAME`, ver interruptor) | la última **borra todas las partidas guardadas** |
| `20261105100000` prueba una vez por persona | `rollback-20261105100000.sql` | se niega mientras haya huellas guardadas (son lo único que recuerda quién ya usó la prueba); vaciarlas es una decisión aparte |
| `20261104100000` propósito del aporte | `rollback-20261104100000.sql` | se niega si ya hay reservas con el propósito aceptado (nada se pierde por accidente) |
| `20261103100000` aportes manuales | `rollback-20261103100000.sql` | se niega si ya hay aportes manuales registrados |
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
3b. ☑ **Hecho (2026-11-06)**: producción y staging tienen las **claves nuevas** (`sb_publishable_…` / `sb_secret_…`).
   Las antiguas (`eyJ…`) siguen activas hasta el paso 23, después del lanzamiento. Se comprobó sin abrir ningún valor.
   Código listo en `dev`: las 7 Edge Functions leen primero las claves nuevas, y la tarea diaria manda la publicable
   solo en «apikey». Prueba `fn-e2e-newkeys`. Funciones publicadas en staging el 2026-11-07 (las 7, verificadas con su huella SHA-256 y con «Verify JWT» igual que en el plan).
4. ☐ **Yo** (si me lo pides): terminar los bloques «icono» y «velocidad y privacidad» y volver a pasar las pruebas.

**El día, en una sola sesión.** Todos los archivos SQL están numerados en `supabase/produccion/` (`00-LEEME.md`).
Se pegan uno a uno, en el orden de su número. La prueba `prod-files` los aplica así en un Postgres real.
4b. ☐ **Tú — ANTES de cerrar los registros**:
   1. En la web publicada ahora, regístrate con `hello@motherverdeny.com`.
   2. Confirma el correo.
   3. Comprueba en Authentication → Users que hello@ sale como «Confirmed».

   **Si el correo no llega:** Supabase puede estar usando aún su correo de prueba, que solo llega al equipo.
   - Configura antes el SMTP del paso 10 (no afecta a la web publicada) y pide otro enlace.
   - O usa Authentication → Users → «Add user» → «Create new user», con «Auto Confirm User».
   - «Invite user» también sirve: el enlace abre «Crea tu contraseña».

   **Después** cierra los registros: Authentication → Sign In / Providers → apagar «Allow new users to sign up».
5. ☐ **Tú**: SQL Editor → `01-precheck-before-20261010.sql`. Todas las filas `ok`. Si no: paras y me escribes.
6. ☐ **Tú**: SQL Editor, los archivos `02` a `27`, cada uno entero y en orden:
   `20261010120000` → `seed-blocked-email-domains/part-01` … `part-07` → `20261010130000` → `20261011100000` →
   `20261011120000` → `20261011130000` → `20261013100000` → `20261013110000` → `20261013120000` →
   `20261014100000` → `20261014110000` → `20261014120000` → `20261014130000` → `20261014140000` →
   `20261020100000` (Bitácora de solo lectura sin acceso, también en el servidor) →
   `20261103100000` (aportes manuales) → `20261104100000` (propósito del aporte + aviso «Ya tienes cuenta») →
   `20261105100000` (la prueba de 24 h, una vez por persona) →
   `20261106100000` (códigos de regalo creados desde SQL: 7 días para canjear) →
   `supporters-betian-mother-verde.sql` (PARTE 1: 2 cuentas; luego PARTE 2).
6b. ☐ **Tú — el juego SALE ENCENDIDO en el lanzamiento** (decisión de Bertha, 2026-11-04). Justo después del paso 6,
   cada archivo entero y en este orden: `supabase/admin/precheck-game.sql` (solo lectura: **todas las filas `ok`**;
   `FALTA` = falta el paso 6, `YA EXISTE` = ya estaba aplicado: paras y me escribes) →
   `20261015100000_game_progress` → `20261029100000_game_setup` → `20261031100000_game_plants`.
   Este orden exacto (plataforma → precheck → las 3 del juego) está probado en una base Postgres real:
   prueba `prod-game-db`. En staging ya están aplicadas (pasos 4b, 4c y 4d de `supabase/staging/`).
   El código del juego solo entra en la web si la compilación ve `MV_GAME=1`: ver paso 9.
   Son los archivos `28` (precheck) a `31` de `supabase/produccion/`.
6c. ☐ **Tú**: `32-read-only-checks.sql`. Es solo lectura y una sola consulta: las **24 filas** dicen `ok`.
   Revisa plataforma, aportes manuales, propósito, la prueba una vez por persona, juego, RLS y tus dos cuentas.
   **Nunca da error**: lo que falte sale como `FALTA`. Si una fila no dice `ok`, paras y me mandas la captura.
6d. ☐ **Tú**: SQL Editor → `grant-admin.sql` para hello@ (registrada en el paso 4b).
   1. Primero la **PARTE 1** sola (solo lectura): debe salir una fila, hello@motherverdeny.com, `email_confirmed = true`.
   2. Después el archivo entero: al final, una fila con `is_admin = true`, `subscription_status = supporter`,
      `full_access = true`.

   Si dice «NO SE HIZO NADA», lee el mensaje (cuenta sin crear o sin confirmar), arréglalo y vuelve a pegarlo: se
   puede pegar las veces que haga falta. Para deshacerlo: `rollback-grant-admin.sql`.
7. ☐ **Tú**: Edge Functions → Secrets: `MAIL_PROVIDER` (`smtp`, o `smtp,resend` si Resend está listo), `MAIL_FROM`,
   `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `APP_URL`, `RETRANSLATE_SECRET`, `SUPPORT_ADDRESS` (paso 1 hecho),
   `RESEND_API_KEY` si `MAIL_PROVIDER` incluye `resend`, y `DEEPL_API_KEY` (la usan las funciones de Comunidad para
   traducir; debería existir ya desde octubre: compruébalo).
   Opcional: `NOTIFY_TO` = dirección que recibe el aviso de cada TXID nuevo (si no se pone: hello@motherverdeny.com).
8. ☐ **Tú**: Edge Functions, pegar cada `index.ts` entero, con la casilla **Verify JWT** igual que en staging
   (`docs/staging.md` 2.4, donde está probada):
   - `support-claims`: **apagado** · `admin-send-gift-code`: **apagado** · `community-retranslate`: **apagado** ·
     `signup-fix-email`: **apagado**;
   - `community-publish-post`: **encendido** · `community-publish-comment`: **encendido**;
   - `delete-account` no se toca (encendido). `community-translate` ya no existe (borrada el 2026-11-06): no se despliega.
   **Importante:** `support-claims` tiene que ser la versión nueva (acción `submit_late`): con `20261014120000` el
   pago tardío ya no se puede registrar desde el navegador y solo pasa por esta función, que lo comprueba en Base.
9. ☐ **Tú**: Vercel → Settings → Environment Variables → **Production** (solo Production). Comprueba que están todas:
   - `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (producción);
   - `RETRANSLATE_SECRET` (el mismo valor que en las Edge Functions);
   - **`CRON_SECRET`** (faltaba). Una cadena larga al azar. Sin ella, la tarea diaria `/api/subscription-cron`
     rechaza todas las llamadas y no caduca avisos ni pruebas.
   - **`SUPABASE_SERVICE_ROLE_KEY`** (faltaba). La clave secreta de producción. Solo la usa la tarea diaria, en el
     servidor; márcala «Sensitive».
   - **`MV_GAME` = `1`**, antes del merge, para que la primera publicación ya lleve el juego. Ojo: una variable
     llamada `VITE_MV_GAME` **no hace nada**; tiene que llamarse exactamente `MV_GAME`.
   - `RESEND_API_KEY` si toca (formulario de anuncios).

   **Claves: las NUEVAS en las dos variables**:
   - `VITE_SUPABASE_ANON_KEY` = la publicable (`sb_publishable_…`);
   - `SUPABASE_SERVICE_ROLE_KEY` = la secreta nueva del 9b (`sb_secret_…`).

   El nombre de las variables no cambia. No pongas las antiguas (`eyJ…`).
9b. ☐ **Tú**: **cambiar la clave secreta de producción** y ponerla en Vercel Production. Una clave de servicio estuvo
   en un `.env.local` del ordenador, ya borrada de allí. **No tira la web ni cierra sesiones:**
   1. Supabase → Project Settings → API Keys → crear una clave secreta nueva.
   2. Ponerla en Vercel Production como `SUPABASE_SERVICE_ROLE_KEY` («Sensitive»).
   3. Redeploy.
   4. Borrar la clave secreta vieja en Supabase.

   Esto no anula la `service_role` antigua (`eyJ…`): se anula en el paso 23, después del lanzamiento.
10c. ☐ (**Ya no hace falta**: con claves nuevas no se rota el *JWT secret* y la web no se cae.)
10b. ☐ **BLOQUEO DEL MERGE — el juego verificado al 100 %.** No se hace el merge a `main` (paso 11) hasta que estén
   las cuatro cosas, por escrito en `docs/juego-validacion.md`:
   1. **Partidas completas** jugadas por Bertha en Preview (de germinación al final, varios sistemas y al menos
      una partida con problemas), guardando y volviendo a entrar.
   2. **Pruebas en verde**: la batería completa (`run-all`) más `game-polish` y `game-plants-ui` (no están en
      `run-all`), `prod-game-db` y `story-photos-ui`, sobre el commit exacto que se va a fusionar.
   3. **Revisión independiente** del código del juego (`docs/revision-independiente.md`), sin hallazgos graves abiertos.
   4. **El OK escrito de Bertha**: «EL JUEGO ESTÁ LISTO AL 100 %».
   Si falta una sola, el lanzamiento espera (o se lanza con el juego apagado: solo con una nueva decisión de Bertha).
10. ☐ **Tú**: Supabase → Authentication:
    - URL Configuration: Site URL `https://www.motherverdeny.com`; Redirect URLs `https://www.motherverdeny.com/**` y `https://motherverdeny.com/**`.
    - SMTP: remitente `hello@motherverdeny.com`, nombre `Mother Verde`.
    - Emails: las 13 plantillas con los asuntos de `SUBJECTS.md`; activar las notificaciones de seguridad.
    - Rate Limits: correos por hora a **150**.
    - Providers → Email: «Confirm email» y «Secure email change» activados.
11. ☐ **Tú**: escribirme «APRUEBO EL MERGE A MAIN». **Yo**: fusiono el pull request, espero a que Vercel
    diga READY y compruebo la web publicada sin iniciar sesión.
12. ☐ (Pasó al 4b: hello@ se registra antes de cerrar los registros.)
13. ☐ (Pasó al 6d: `grant-admin.sql` justo después del SQL.)
14. ☐ **Tú**: entrar con hello@ en `/panel-mv.html`, activar la verificación en dos pasos y **guardar la clave**.
15. ☐ **Tú**: en el panel, «Enviar correo de prueba a mi correo». Llega a hello@.
15b. ☐ **Tú**: **abre los registros unos minutos**, solo para los pasos 16 y 17 (Authentication → Sign In / Providers →
   «Allow new users to sign up» encendido). Al terminar el 17, **vuelve a apagarlo**. Sin esto no se puede crear la
   cuenta de prueba sin confirmar del 16 ni la cuenta nueva de la prueba 3 del hook.
16. ☐ **Tú**: con una cuenta de prueba **sin confirmar**, probar «Corrígelo» con una contraseña equivocada:
    tiene que decir «La contraseña no coincide». Si no, me avisas.
17. ☐ **Tú**: activar el hook «Before User Created» siguiendo `hook-activation-plan.md`. **Siempre al final.**
    Después de sus pruebas, **vuelve a cerrar los registros** (paso 15b).

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
23. ☐ **Después del lanzamiento, nunca el mismo día — desactivar las claves antiguas (`eyJ…`) de producción**
    (`docs/plan-migracion.md`, paso 19b). Primero, el **ensayo en staging**, con tu «APRUEBO»:
    - claves nuevas en Vercel Preview;
    - comprobar la web, la tarea diaria y las 7 funciones;
    - desactivar las antiguas en staging y repetir.

    Si sale bien, en producción:
    1. Supabase → Project Settings → API Keys → «View legacy API keys» → **Disable**.
    2. Comprobar la web, el panel y el correo de prueba.
    3. Al día siguiente, `cron_runs` con `ok = true`.

    Es **reversible** (se vuelven a activar en la misma pantalla). Así queda anulada también la `service_role` antigua.

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
