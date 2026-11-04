# Plan de migración a www.motherverdeny.com — pasos pequeños (borrador, 2026-11-03; juego encendido desde 2026-11-04)

**Cambio 2026-11-04 (Bertha): lanzamos con el juego ENCENDIDO.** Pasos 12b, 16 y 18b; interruptor de emergencia en
la sección E.

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
| 10 | **Cerrar registros nuevos** mientras dura el cambio: Supabase → Authentication → Sign In / Providers → apagar «Allow new users to sign up». Quien ya tiene cuenta puede seguir entrando. | B | 2 min | bajo | no |
| 11 | `precheck-before-20261010.sql` (solo lectura): todas las filas `ok`. Si alguna no lo está, **paras** y me lo mandas. | B | 5 min | bajo | no |
| 12 | SQL Editor, cada archivo entero y **en este orden**: `20261010120000` → `seed-blocked-email-domains/part-01…07` → `20261010130000` → `20261011100000` → `20261011120000` → `20261011130000` → `20261013100000` → `20261013110000` → `20261013120000` → `20261014100000` → `20261014110000` → `20261014120000` → `20261014130000` → `20261014140000` → `20261020100000` → **`20261103100000` (aportes manuales)** → **`20261104100000` (propósito del aporte + «Ya tienes cuenta»)** → `supporters-betian-mother-verde.sql` (PARTE 1, luego PARTE 2). Las 3 del juego van aparte, justo después (paso 12b). | B (C prepara los archivos en `supabase/produccion/` con encabezados, como en staging) | 45 min | **alto** (cada archivo es una sola transacción: si falla, no se aplica nada de ese archivo) | **sí** |
| 12b | **Juego (sale encendido):** `supabase/admin/precheck-game.sql` (solo lectura, **todas las filas `ok`**; si sale `FALTA` o `YA EXISTE`, **paras** y me lo mandas) → `20261015100000_game_progress` → `20261029100000_game_setup` → `20261031100000_game_plants`, cada archivo entero y en este orden. Orden probado en Postgres real: prueba `prod-game-db` (plataforma → precheck → juego; pegarlas dos veces no rompe nada). | B | 10 min | medio (cada archivo es una transacción) | **sí** (con el 12) |
| 13 | Comprobación de solo lectura de todo lo anterior (todas las filas `ok`). | B (C la prepara) | 5 min | bajo | no |
| 14 | Edge Functions → Secrets (`MAIL_PROVIDER`, `MAIL_FROM`, `SMTP_*`, `APP_URL`, `RETRANSLATE_SECRET`, `SUPPORT_ADDRESS`, `NOTIFY_TO` opcional). `BASE_RPC_URL` es opcional. | B | 15 min | medio | no |
| 15 | Edge Functions: pegar `community-publish-post`, `community-publish-comment`, `support-claims`, `admin-send-gift-code`, `community-retranslate` y `signup-fix-email` (las dos últimas con Verify JWT apagado). | B | 20 min | medio | no |
| 16 | Vercel → Settings → Environment Variables → **Production**: `RETRANSLATE_SECRET` y **`MV_GAME` = `1`** (solo Production, antes del merge: así la primera publicación ya lleva el juego). Tiene que llamarse exactamente `MV_GAME` (`VITE_MV_GAME` no hace nada). | B | 5 min | bajo | no |
| 17 | Supabase → Authentication: URLs del sitio, SMTP de hello@, las 13 plantillas, límite de correos a 150/hora, «Confirm email» y «Secure email change» encendidos. | B | 30 min | medio | no |
| 18 | **Limpiar los usuarios de prueba de producción**: `cannawasi@gmail.com` y `berthalimo+prueba2@gmail.com` (Authentication → Users → ⋯ → Delete user). Claude no borra cuentas. Antes, mira si tienen publicaciones o aportes que quieras guardar: al borrar la cuenta se borra su perfil, y los avisos de aporte quedan marcados como de «cuenta borrada». | B | 10 min | medio (no se puede deshacer) | no |

## C. Merge y apertura

| # | Paso | Quién | Dura | Riesgo | APRUEBO |
|---|---|---|---|---|---|
| 18b | **BLOQUEO: el juego verificado al 100 %.** Sin estas cuatro cosas **no hay merge** (paso 19): (1) partidas completas jugadas por Bertha en Preview, guardando y volviendo a entrar; (2) pruebas en verde sobre el commit exacto que se fusiona: `run-all` + `game-polish` + `game-plants-ui` + `prod-game-db` + `story-photos-ui`; (3) revisión independiente (`docs/revision-independiente.md`) sin hallazgos graves abiertos; (4) tu OK escrito: **«EL JUEGO ESTÁ LISTO AL 100 %»**. Todo anotado en `docs/juego-validacion.md`. | B + C (+ revisor) | — | — | **sí, esa frase** |
| 19 | **Merge a `main`** (publica la web nueva). Solo con tu frase exacta **«APRUEBO EL MERGE A MAIN»**. Claude fusiona, espera a que Vercel diga READY y revisa la web sin iniciar sesión. | C | 15 min | **alto** | **sí, esa frase exacta** |
| 20 | Registrarte con hello@, confirmar el correo, pegar `grant-admin.sql`, activar la verificación en dos pasos del panel y guardar la clave. | B | 20 min | medio | no |
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
