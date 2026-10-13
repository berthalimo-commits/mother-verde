# Puesta en producción de www.motherverdeny.com — preparación (13 de octubre de 2026)

**Nada está publicado.** Producción sigue en `d58f1aa` (Vercel `dpl_AYSGmSZc98Jy2kumc7zzaRaVzcZ5`).
El merge a `main` se hace solo cuando escribas exactamente: «APRUEBO EL MERGE A MAIN».

## 1. Compilación final y pruebas

- **Compilación de producción** (como la haría `main`): termina bien. Quita la vista previa de dev
  (el selector de estados y el panel de ejemplo no salen). El `main.js` pesa ~3 MB (~165 KB comprimido
  el paquete principal): sigue siendo lenta la primera visita (pendiente de «velocidad»).
- **Pruebas** (`node tests/sim/run-all.mjs`): **17 de 17 sin fallos, 613 comprobaciones**, más
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

### Lo que verá una persona que ya tiene cuenta
- **No recibe la prueba de 24 h**: en su primer inicio de sesión ve «Esta cuenta no tiene acceso activo»
  y el botón Desbloquear.
- Si tenía una prueba o un periodo del modelo viejo **todavía vigente**, lo conserva hasta que termine.
- **Betian y la cuenta oficial Mother Verde**: acceso completo, sin fecha (SQL `supporters-betian-mother-verde.sql`).
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
cuenta de administradora → hook al final.

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
| `20261013110000` panel de correos | `rollback-20261013110000.sql` | nada |
| `20261013100000` correos | `rollback-20261013100000.sql` | el registro de envíos (`mail_events`) |
| `20261011130000` códigos de regalo | `rollback-20261011130000.sql` | todos los códigos; los días ya dados se quedan hasta la última reversa |
| `20261011120000` aportes | `rollback-20261011120000.sql` | todos los avisos de aporte (quien ya es `supporter` lo sigue siendo) |
| `20261011100000` admin y registro (incluye `grant-admin.sql`) | `rollback-20261011100000.sql` | la lista de admins y todo el registro de auditoría |
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
   `20261011120000` → `20261011130000` → `20261013100000` → `20261013110000` →
   `supporters-betian-mother-verde.sql` (PARTE 1: 2 cuentas; luego PARTE 2).
7. ☐ **Tú**: Edge Functions → Secrets: `MAIL_PROVIDER` (`smtp`, o `smtp,resend` si Resend está listo), `MAIL_FROM`,
   `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `APP_URL`, `RETRANSLATE_SECRET`, `SUPPORT_ADDRESS` (paso 1 hecho),
   y `RESEND_API_KEY` si toca.
8. ☐ **Tú**: Edge Functions, pegar cada `index.ts` entero: `community-publish-post`, `community-publish-comment`,
   `support-claims`, `admin-send-gift-code`, `community-retranslate` (**Verify JWT apagado**) y
   `signup-fix-email` (**Verify JWT apagado**). `delete-account` no se toca.
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
13. ☐ **Tú**: SQL Editor → `grant-admin.sql` (al final muestra una sola fila: hello@).
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
