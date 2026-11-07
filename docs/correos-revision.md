# Revisión del envío de correos — 13 de octubre de 2026

Objetivo: que nadie se quede sin entrar porque un correo no le llegó.
Todo está en la rama `dev`. **Nada está en producción** y no se envió ningún correo real
(las pruebas usan un Supabase simulado).

## 1. Recorrido de cada correo

| Correo | Enlace y regreso a la app | Móvil / sin sesión previa | Si caducó o ya se usó | Si el envío falla |
|---|---|---|---|---|
| Confirmación de cuenta | Vuelve a la página donde se pidió (`emailRedirectTo`); si esa dirección no está en la lista de Supabase, Supabase usa el Site URL | Sí: enlace de flujo «implícito», funciona en cualquier navegador o teléfono | Aviso «Este enlace ya no sirve» en 4 idiomas + botón para pedir otro | Mensaje claro (límite por hora / no se pudo enviar + hello@) |
| Recuperar contraseña | **No existía en la app.** Ahora: «¿Olvidaste tu contraseña?» → enlace → formulario «Elige una contraseña nueva» | Sí | Mismo aviso + «Enviar enlace para cambiar la contraseña» | Igual que arriba; respuesta neutra (no revela si la cuenta existe) |
| Cambio de correo | **No existía en la app** (solo el «correo de contacto»). Ahora: Cuenta → «Correo para iniciar sesión» → Cambiar | Sí | Mismo aviso; si solo se abrió uno de los dos enlaces, la app lo explica | Mensaje claro |
| Corregir correo mal escrito al registrarse | Nuevo: misma cuenta, sin crear otra (función `signup-fix-email`) | — | — | Mensaje claro por cada caso |
| Código de regalo | Botón a APP_URL (https://www.motherverdeny.com) | Sí (el código se canjea después de iniciar sesión) | Lo controla la base de datos (7 días, un uso) | Reintento, Resend si se permite, código anulado y aviso en el panel |
| Activación por aporte | Botón a APP_URL | Sí | — | Reintento, Resend si se permite; el acceso se activa igual y el fallo sale en el panel |
| Avisos de seguridad (7) | Sin enlace (solo informan) | — | — | Los envía Supabase (ver punto 6) |

Detalle importante: algunos correos de empresa y Outlook «abren» los enlaces para revisarlos
antes que la persona. Eso gasta el enlace (pero confirma la cuenta). Por eso el aviso dice
«Si ya confirmaste tu correo, solo tienes que iniciar sesión».

### Errores que no se veían
- Funciones: ya no hay fallos silenciosos. Cada envío devuelve un error claro y queda en
  `mail_events` (tipo, resultado, salida, intentos y error), **sin direcciones de correo**:
  se cambian por `<correo>`.
- App: «Algo salió mal» se separó en «Ahora mismo no podemos enviar más correos» (límite de
  Supabase) y «No pudimos enviar el correo… escríbenos a hello@motherverdeny.com» (SMTP).

### Límites de envío (hoy)
No puedo ver tu panel de Supabase desde aquí, así que esto es lo que se sabe:
- **Supabase**: con SMTP propio, el límite por defecto que reportan las guías es **30 correos por
  hora para todo el proyecto** (la documentación oficial no da la cifra; mira el número real en
  Authentication → Rate Limits). Cuenta cada confirmación, reenvío, recuperación y cambio de correo.
- **Hostinger**: según su ayuda, **1.000 correos al día** (Business Starter) o **3.000** (Business
  Premium), contados en 24 h móviles. Mira tu plan en hPanel → Correos.
- **¿Alcanza para el lanzamiento?** Con 30 por hora, **no**. Si se registran 60 personas en una hora,
  a la mitad Supabase les dice que espere. Cada registro gasta 1 correo, más los reenvíos que pida.
  Recomendación: subirlo a **150 por hora** el día del lanzamiento. Con Business Starter, eso
  todavía cabe en 1.000 al día, siempre que el pico dure pocas horas.

## 2. Pantalla «revisa tu correo»
Frase de spam pedida, aviso discreto para Gmail y Outlook/Hotmail, «Reenviar correo» con 60 s
entre envíos (contados desde el registro) y 3 por hora, «¿Sigues sin recibirlo? Escríbenos a
hello@motherverdeny.com», «Ya lo confirmé: iniciar sesión» y «¿Escribiste mal tu correo? Corrígelo».
Lo que cambié de un texto aprobado: quité la frase final «Si no lo ves, revisa la carpeta de spam»
de `accConfirmaP` (en los 4 idiomas), porque la línea nueva dice lo mismo con más detalle.

## 3. Contenido de los 13 correos de Supabase
- Asuntos más cortos (de ~100 a ≤ 67 caracteres): **español · inglés**. El cuerpo sigue en los 4
  idiomas y el remitente ya dice «Mother Verde». Sin MAYÚSCULAS, sin «!», sin palabras de spam.
- «Si el botón no funciona, copia este enlace…» ahora sale una sola vez al final, no una vez por
  idioma. El correo de confirmación pasa de 12 enlaces a 5.
- Colores claros declarados para el modo oscuro y márgenes más estrechos para el móvil.
  Sin imágenes ni acortadores. Ningún texto cambió de significado.
- Correos de nuestras funciones: Reply-To hello@, texto plano, el enlace una sola vez en el texto
  plano y asuntos cortos («Tu código de regalo · Your gift code», «Tu acceso completo está activo ·
  Your full access is active», «Prueba de envío · Test e-mail»).
- Límite de Supabase: sus plantillas solo aceptan HTML. No hay campo para texto plano ni para
  Reply-To. Como el remitente es hello@, las respuestas llegan ahí igual.

## 4. Si el envío falla
`MAIL_PROVIDER`: `smtp` (Hostinger), `resend`, o **`smtp,resend`**. Cada salida se intenta 2 veces,
con 2 s entre intentos (`MAIL_RETRY_MS`). Con `smtp,resend`, si Hostinger falla dos veces, el correo
sale solo por Resend. Un código que no se pudo enviar por ninguna vía queda **anulado**: nadie lo
vio, así que no se pierde nada, pero hay que enviar otro. Panel: aviso rojo
**«Correos fallidos en las últimas 24 h: N»** encima de todas las pestañas, el número en Resumen
y la lista de envíos en Registro.

## 5. Pruebas (tests/sim, `node run-all.mjs`)
Nuevas: `mail-links-ui` (enlaces, recuperación, cambio de correo), `mail-signup-ui` (pantalla
de revisa tu correo, límites, corrección), `mail-flow-ui` (recorridos completos con enlaces de un
solo uso: correcto, usado dos veces, caducado, recuperación, cambio de correo, 4 idiomas,
Supabase sin poder enviar), `mail-content` (las 13 plantillas), `mail-db` (permisos y reglas),
`mail-panel-ui` (aviso del panel) y 14 casos nuevos en `fn-e2e`. Todas las anteriores siguen pasando.

## 6. Lo que tienes que hacer tú (no lo puedo hacer desde aquí)

**A. Antes de publicar (Supabase → SQL Editor y Edge Functions)**
1. Pega y ejecuta `supabase/migrations/20261013100000_mail_delivery.sql` y después
   `20261013110000_mail_failures_panel.sql`. (Reversas, en este orden: `supabase/admin/rollback-20261013110000.sql` y `rollback-20261013100000.sql`.)
2. Edge Functions: crea `signup-fix-email` con `supabase/functions/signup-fix-email/index.ts` y
   **desactiva «Verify JWT»** en esa función (la persona todavía no tiene sesión). Actualiza
   `admin-send-gift-code` y `support-claims` con sus archivos nuevos.
3. Prueba una vez con una cuenta de prueba **sin confirmar**: «Corrígelo» con una contraseña
   **equivocada** tiene que decir «La contraseña no coincide». Si no lo dice, avísame antes de seguir.

**B. Supabase → Authentication**
4. *URL Configuration* → **Site URL**: `https://www.motherverdeny.com`.
   **Redirect URLs**: `https://www.motherverdeny.com/**`, `https://motherverdeny.com/**` y, si quieres
   que los enlaces pedidos desde la versión de prueba vuelvan a ella, la dirección de dev de Vercel con `/**`.
5. *Emails → SMTP Settings*: Sender email `hello@motherverdeny.com`, **Sender name `Mother Verde`**,
   host `smtp.hostinger.com`, puerto `465`.
6. *Emails → Templates* y *Security notifications*: vuelve a pegar las 13 plantillas de
   `supabase/email-templates/` con los **asuntos nuevos** de `SUBJECTS.md`.
7. *Rate Limits* → «Rate limit for sending emails»: mira el número actual. Para el lanzamiento,
   ponlo en **150 por hora**, y después bájalo si quieres.
8. *Providers → Email*: deja «Confirm email» y «Secure email change» activados.
   «Email OTP expiration» puede quedarse en 3600 s (1 h): si caduca, la app ya ofrece pedir otro.

**C. Reputación del dominio (Hostinger → DNS, una sola vez)**
9. **SPF**, **DKIM** y **DMARC** de Hostinger activados (hPanel → Correos → Autenticación).
   Para empezar, DMARC: `v=DMARC1; p=none; rua=mailto:hello@motherverdeny.com`.
10. Si vas a usar Resend como plan B: verifica `motherverdeny.com` en Resend (te da 3 registros
    DNS), pon el secreto `RESEND_API_KEY` y cambia `MAIL_PROVIDER` a `smtp,resend`.
11. Prueba de entrega: abre mail-tester.com, copia la dirección que te da, y envíale el «Correo de
    prueba» del panel y una confirmación de registro. Objetivo: 9/10 o más. Haz lo mismo con una
    cuenta Gmail y una Outlook, y mira si los correos llegan a la bandeja principal.
12. Hostinger: confirma en hPanel cuántos correos al día permite tu plan.
