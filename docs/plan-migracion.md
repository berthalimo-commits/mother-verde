# Plan de migración a www.motherverdeny.com — pasos pequeños (borrador, 2026-11-03; juego encendido desde 2026-11-04)

**Cambio 2026-11-04 (Bertha): lanzamos con el juego ENCENDIDO.** Pasos 12b, 16 y 18b; interruptor de emergencia en
la sección E.

**Revisión independiente (2026-11-04, con «APRUEBO»):**
- hello@ se registra **antes** de cerrar los registros (paso 9b), y `grant-admin.sql` pasa al 13b.
- Los archivos SQL del día están en **`supabase/produccion/`**, numerados en el orden exacto (01–31, ver su `00-LEEME.md`), con la comprobación final `31-read-only-checks.sql`.
- Paso 16: faltaban `CRON_SECRET` y `SUPABASE_SERVICE_ROLE_KEY` en Vercel Production. Nuevo paso 16b: rotar la clave de servicio.
- Nueva migración `20261105100000` (la prueba de 24 h, una vez por persona).

Basado en `docs/lanzamiento-produccion.md` (los detalles técnicos de cada paso siguen allí). Nada de esto se ha
hecho todavía: es un plan. Claude **no lee ni escribe** en Supabase de producción ni en Vercel Production.

**Leyenda.**
- **Quién:** B = Bertha, C = Claude.
- **Riesgo:** bajo / medio / alto.
- **APRUEBO:** si hace falta tu «APRUEBO» antes de empezar.

Los precios y límites son los que publicaban las webs de cada servicio en noviembre de 2026. **Compruébalos en sus
páginas oficiales antes de pagar**: cambian sin aviso.

## A. Antes del día (decisiones y pagos)

| # | Paso | Quién | Dura | Riesgo | APRUEBO |
|---|---|---|---|---|---|
| 1 | **Supabase Pro** para el proyecto de producción: **25 USD/mes** por organización. Incluye copias de seguridad diarias (7 días) y el proyecto nunca se «duerme». En el plan gratis no hay copias diarias, y el proyecto se pausa tras una semana sin actividad. | B | 10 min | bajo | no (es tu pago) |
| 2 | **Vercel Pro**: **20 USD/mes** por persona del equipo. El plan Hobby (gratis) es **solo para uso personal y no comercial**; una web que recibe aportes cuenta como comercial. | B | 10 min | bajo | no |
| 3 | Revisar los límites y anotar el «qué pasa si…» (tabla C, abajo). | C (escrito) + B (lee) | 15 min | — | no |
| 4 | Confirmar que el aporte de prueba de 5 USDC llegó a tu billetera (la dirección quedará pública). | B | 5 min | medio | no |
| 5 | Tener a mano la contraseña del buzón hello@ y la clave de Resend si se usa. | B | 5 min | bajo | no |
| 6 | Cierre del prototipo en `dev` (parte 1 de este pedido: «Cuenta» en el menú, mensaje de correo repetido…) y batería completa en verde. | C | 1–2 h | bajo | **sí** (cambios de plataforma) |
| 7 | **Moderación de la Comunidad.** Hoy la gente puede **denunciar** publicaciones, comentarios y perfiles (tabla `community_reports`), pero el panel **no muestra las denuncias ni permite borrar u ocultar publicaciones**. Solo se puede desde Supabase → Table Editor, lo cual es arriesgado. **Propuesta:** pestaña «Denuncias» en el panel (ver la publicación denunciada, ocultarla o borrarla con motivo, marcar la denuncia como atendida, todo en el Registro) y probarla en staging. | C | 1 día | medio | **sí** |
| 8 | Ensayo general en staging con la misma lista del día (pasos 11–24) y la batería en verde. | C + B | 1 h | bajo | no |

## B. El día — la base de datos queda lista ANTES del merge

| # | Paso | Quién | Dura | Riesgo | APRUEBO |
|---|---|---|---|---|---|
| 9 | Copia de la base de producción (Supabase → Database → Backups → copia manual o exportar). | B | 10 min | bajo | no |
| 9b | **Registrar hello@ ANTES de cerrar los registros.**<br>1. En la web que está publicada ahora, regístrate con `hello@motherverdeny.com` y una contraseña nueva. Guárdala en tu gestor de contraseñas.<br>2. Abre el correo de confirmación en el buzón hello@ y pulsa el enlace.<br>3. Comprueba en Supabase → Authentication → Users que hello@ aparece con «Confirmed».<br>**Si el correo no llega en 5 minutos:** puede que Supabase todavía use su correo de prueba, que solo llega a miembros del equipo. Haz antes la parte «SMTP» del paso 17 (no afecta a la web publicada) y pide otro enlace.<br>**Alternativa** (si sigue sin llegar): Authentication → Users → «Add user» → «Create new user», con «Auto Confirm User» marcado. Invitarla («Invite user») también sirve: el enlace abre «Crea tu contraseña».<br>Los permisos de administradora llegan en el paso 13b. | B | 10 min | bajo | no |
| 10 | **Cerrar registros nuevos** mientras dura el cambio (después del 9b): Supabase → Authentication → Sign In / Providers → apagar «Allow new users to sign up». Quien ya tiene cuenta puede seguir entrando. | B | 2 min | bajo | no |
| 11 | `supabase/produccion/01-precheck-before-20261010.sql` (solo lectura): todas las filas `ok`. Si alguna no lo está, **paras** y me lo mandas. | B | 5 min | bajo | no |
| 12 | SQL Editor: los archivos **02 a 26** de `supabase/produccion/`, uno a uno, cada uno entero y **en el orden de su número**. En detalle:<br>- `20261010120000`<br>- los dominios bloqueados, partes 1 a 7<br>- `20261010130000` → … → `20261020100000`<br>- **`20261103100000`** (aportes manuales)<br>- **`20261104100000`** (propósito del aporte + «Ya tienes cuenta»)<br>- **`20261105100000`** (la prueba de 24 h, una vez por persona)<br>- `supporters-betian-mother-verde.sql` (PARTE 1 sola; luego PARTE 2)<br>Las 3 del juego van aparte, justo después (paso 12b). | B (C genera los archivos con `tools/build-produccion.mjs`; la prueba `prod-files` los aplica en este orden en un Postgres real) | 45 min | **alto** (cada archivo es una sola transacción: si falla, no se aplica nada de ese archivo) | **sí** |
| 12b | **Juego (sale encendido):** archivos **27 a 30**.<br>- `27-precheck-game.sql` es solo lectura: **todas las filas `ok`**. Si sale `FALTA` o `YA EXISTE`, **paras** y me lo mandas.<br>- Después `20261015100000_game_progress` → `20261029100000_game_setup` → `20261031100000_game_plants`, cada uno entero y en este orden.<br>Orden probado en Postgres real (pruebas `prod-game-db` y `prod-files`): pegarlas dos veces no rompe nada. | B | 10 min | medio (cada archivo es una transacción) | **sí** (con el 12) |
| 13 | `31-read-only-checks.sql` (solo lectura, una sola consulta): las **23 filas** dicen `ok`. Revisa plataforma, aportes manuales, propósito, la prueba una vez por persona, juego, RLS y tus dos cuentas. Si una dice `FALTA` o `REVISAR`, **paras** y me mandas la captura. | B (C la prepara) | 5 min | bajo | no |
| 13b | **Administradora:** SQL Editor → `supabase/admin/grant-admin.sql` para hello@ (registrada en el 9b).<br>1. Primero la **PARTE 1** sola (solo lectura): una fila, hello@motherverdeny.com, `email_confirmed = true`.<br>2. Después el archivo entero: `is_admin = true`, `subscription_status = supporter`, `full_access = true`.<br>Va aquí porque necesita las tablas del panel (paso 12). | B | 5 min | medio | no |
| 14 | Edge Functions → Secrets (`MAIL_PROVIDER`, `MAIL_FROM`, `SMTP_*`, `APP_URL`, `RETRANSLATE_SECRET`, `SUPPORT_ADDRESS`, `NOTIFY_TO` opcional). `BASE_RPC_URL` es opcional. | B | 15 min | medio | no |
| 15 | Edge Functions: pegar `community-publish-post`, `community-publish-comment`, `support-claims`, `admin-send-gift-code`, `community-retranslate` y `signup-fix-email` (las dos últimas con Verify JWT apagado). `support-claims` tiene que ser la versión del commit que se fusiona: lleva en sus correos la frase de SUNY, que se cambia en `src/purposeTexts.js` y se copia con `node tools/apply-purpose-texts.mjs`. | B | 20 min | medio | no |
| 16 | Vercel → mother-verde → Settings → Environment Variables → **Production** (solo Production). Comprueba que están todas. Las que no ves, las añades.<br>- `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`: las del proyecto de **producción**. La compilación se para si apuntan a otro.<br>- `RETRANSLATE_SECRET`: el mismo valor que en los Secrets de las Edge Functions.<br>- **`CRON_SECRET`** (faltaba): una cadena larga al azar, por ejemplo de un gestor de contraseñas, 40 caracteres o más. Sin ella, la tarea diaria `/api/subscription-cron` rechaza todas las llamadas: no caduca avisos ni pruebas.<br>- **`SUPABASE_SERVICE_ROLE_KEY`** (faltaba): la clave **secreta** de producción. Supabase → Project Settings → API Keys. La usa solo la tarea diaria, en el servidor; nunca llega al navegador. Márcala como «Sensitive».<br>- **`MV_GAME` = `1`**, antes del merge, para que la primera publicación ya lleve el juego. Tiene que llamarse exactamente `MV_GAME` (`VITE_MV_GAME` no hace nada).<br>- Opcional: `RESEND_API_KEY` (formulario de anuncios; sin ella, el formulario ofrece un enlace a hello@).<br>**Formato de las claves:** Supabase tiene dos tipos.<br>- Las **antiguas** son JWT: empiezan por `eyJ…` («anon» y «service_role»).<br>- Las **nuevas** empiezan por `sb_publishable_…` y `sb_secret_…`.<br>Usa **el mismo tipo** en `VITE_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`, el mismo que usan las Edge Functions. El código acepta los dos tipos (supabase-js 2.112), pero **dime cuál ves en el panel** antes de ponerlas: si son las nuevas, compruebo la tarea diaria en staging con ese formato. | B | 10 min | medio | no |
| 16b | **Rotar la clave de servicio de producción** y actualizarla en Vercel Production. La clave estuvo en un archivo local (`.env.local`, ya borrada de allí el 2026-11-04).<br>**Con claves nuevas** (`sb_secret_…`), no afecta a nadie:<br>1. Supabase → Project Settings → API Keys → crear una clave secreta nueva.<br>2. Ponerla en Vercel Production como `SUPABASE_SERVICE_ROLE_KEY`.<br>3. Redeploy.<br>4. Borrar la clave vieja en Supabase.<br>**Con claves antiguas** (`eyJ…`): rotarla es cambiar el *JWT secret*.<br>- Cambian **también** la anon y la service_role, y se cierran todas las sesiones.<br>- Hazlo con los registros cerrados (paso 10) y **antes del merge**.<br>- Actualiza en Vercel `VITE_SUPABASE_ANON_KEY` **y** `SUPABASE_SERVICE_ROLE_KEY`. Las Edge Functions reciben las nuevas solas.<br>Pásame captura de la pantalla de claves, sin los valores, y te digo cuál de los dos casos es. | B | 15 min | medio | no |
| 17 | Supabase → Authentication: URLs del sitio, SMTP de hello@, las 13 plantillas, límite de correos a 150/hora, «Confirm email» y «Secure email change» encendidos. | B | 30 min | medio | no |
| 18 | **Limpiar los usuarios de prueba de producción**: `cannawasi@gmail.com` y `berthalimo+prueba2@gmail.com` (Authentication → Users → ⋯ → Delete user). Claude no borra cuentas. Antes, mira si tienen publicaciones o aportes que quieras guardar: al borrar la cuenta se borra su perfil, y los avisos de aporte quedan marcados como de «cuenta borrada». | B | 10 min | medio (no se puede deshacer) | no |

## C. Merge y apertura

| # | Paso | Quién | Dura | Riesgo | APRUEBO |
|---|---|---|---|---|---|
| 18b | **BLOQUEO: el juego verificado al 100 %.** Sin estas cuatro cosas **no hay merge** (paso 19): (1) partidas completas jugadas por Bertha en Preview, guardando y volviendo a entrar; (2) pruebas en verde sobre el commit exacto que se fusiona: `run-all` + `game-polish` + `game-plants-ui` + `prod-game-db` + `story-photos-ui`; (3) revisión independiente (`docs/revision-independiente.md`) sin hallazgos graves abiertos; (4) tu OK escrito: **«EL JUEGO ESTÁ LISTO AL 100 %»**. Todo anotado en `docs/juego-validacion.md`. | B + C (+ revisor) | — | — | **sí, esa frase** |
| 19 | **Merge a `main`** (publica la web nueva). Solo con tu frase exacta **«APRUEBO EL MERGE A MAIN»**. Claude fusiona, espera a que Vercel diga READY y revisa la web sin iniciar sesión. | C | 15 min | **alto** | **sí, esa frase exacta** |
| 20 | Entrar con hello@ (registrada en el 9b, administradora desde el 13b) en `/panel-mv.html`, activar la verificación en dos pasos y **guardar la clave**. | B | 10 min | medio | no |
| 21 | Panel → «Enviar correo de prueba a mi correo»; «Corrígelo» con una contraseña equivocada debe decir «La contraseña no coincide». | B | 10 min | bajo | no |
| 22 | Activar el hook «Before User Created» (`hook-activation-plan.md`). Siempre al final. | B | 10 min | medio | no |
| 23 | **Etapa 1, grupo de confianza (10–20 personas):** con los registros todavía cerrados, invítalas desde Authentication → Users → «Invite user». Les llega un correo para crear su cuenta. Una semana: errores en la consola, correos que no llegan, preguntas. | B | 1 semana | bajo | no |
| 24 | **Etapa 2 (hasta ~50):** abre los registros (paso 10 al revés) y avisa a un grupo más. Mira en el panel «Cuentas en total». Cuando llegue a ~50, apaga los registros otra vez y revisa. | B | 1 semana | medio | no |
| 25 | **Etapa 3 (hasta ~200)**, igual que la 2. Después, apertura general. | B | 1–2 semanas | medio | no |
| 26 | Durante la primera semana: consola del navegador (avisos «[Report Only] Refused…»). Si en una semana no hay ninguno, Claude cambia la CSP a modo estricto. | B + C | 5 min/día | bajo | sí (es un cambio en producción) |
| 27 | Al día siguiente: `cron_runs` con `ok = true`; mail-tester.com 9/10 o más; SPF, DKIM y DMARC en Hostinger. | B | 30 min | bajo | no |

**Vuelta atrás:** `docs/lanzamiento-produccion.md`, sección 4. Primero la web, con *Instant Rollback* en Vercel; justo
después, el SQL en orden inverso.

## D. Límites de los planes y qué pasa si entra mucha gente a la vez

| Servicio | Límite que importa | Qué pasa si se supera | Qué hacer |
|---|---|---|---|
| **Supabase Free → Pro** | Free: 500 MB de base, 50.000 usuarios activos/mes, 5 GB de tráfico, 2 proyectos, sin copias diarias, pausa tras 7 días sin uso. Pro: mucho más margen, más uso pagado aparte. | En Free, al llegar al límite el proyecto puede quedar restringido. | Pro antes de abrir (paso 1). |
| **Correos de Supabase Auth** | El límite que pongas en Rate Limits: 150/hora el día del lanzamiento. | La persona número 151 de esa hora ve «Estamos recibiendo muchos registros…» y su cuenta **no** se crea; puede volver a intentarlo después. | Subir el límite si el buzón lo aguanta; abrir por etapas (pasos 23–25). |
| **Buzón hello@ (Hostinger Business Starter)** | Unos **1.000 correos al día por buzón** (24 h móviles). No publican límite por hora; su sistema antiabuso puede frenar ráfagas. | Los correos de confirmación dejan de salir hasta que pase el día. | Con más de ~500 registros al día, usar Resend como segunda vía (`MAIL_PROVIDER=smtp,resend`) o subir a Business Premium (3.000/día). |
| **DeepL API Free** | **500.000 caracteres al mes** (traducir cada publicación a 3 idiomas multiplica por 3). | Las publicaciones **se publican igual**; la traducción se reintenta después (la tarea `community-retranslate` se para con «quota» y sigue el mes siguiente). | DeepL API Pro (unos 5,49 USD/mes + 25 USD por millón de caracteres) si la Comunidad crece. |
| **Vercel Pro** | Margen amplio de tráfico (en Hobby el sitio se pausa al pasar los límites). | — | Pro (paso 2). |
| **Red de Base** (comprobar pagos) | La red pública gratis, sin clave. | Si se satura, «Comprobar en Base» tarda o falla; el aporte queda en revisión manual, sin perderse. | Opcional: un proveedor con clave (Alchemy) en `BASE_RPC_URL`. |

## E. Interruptor de emergencia del juego

Si algo del **juego** falla y el resto de la web va bien (B, unos 5 minutos, sin tocar la base):
1. Vercel → mother-verde → Settings → Environment Variables → `MV_GAME` (Production) → «…» → **Remove**.
2. Vercel → Deployments → la última de Production → «…» → **Redeploy**. En 2–3 minutos la web sale sin el juego.
3. Las partidas guardadas **se conservan**; para volver a encenderlo: `MV_GAME` = `1` y Redeploy.
4. Si falla la web entera: *Instant Rollback* (`docs/lanzamiento-produccion.md`, sección 4).
Quitar el juego también de la base es casi nunca necesario y **borra todas las partidas** (reversas en la sección 4).

## F. Si hay una caída: cómo avisar

1. **Mira dónde está el problema**: la página de estado de Supabase (status.supabase.com) y la de Vercel (vercel-status.com).
2. **Avisa por fuera de la web**: un mensaje corto en tus redes y una respuesta preparada en hello@. Por ejemplo:
   «Mother Verde tiene un problema técnico; tus datos están a salvo; te avisamos aquí cuando vuelva».
3. **Dentro de la web**, si la base no carga, cada persona ya ve «No pudimos cargar tu cuenta» con «Reintentar» y
   el correo hello@ (comprobado en staging, prueba 9).
4. **Si la web nueva falla y la vieja no**: *Instant Rollback* en Vercel (sección 4 del documento de lanzamiento).
5. **Mejora opcional** (necesita «APRUEBO»): un aviso general que Bertha pueda encender desde el panel, del tipo
   «Estamos haciendo mantenimiento», sin tocar el código.
