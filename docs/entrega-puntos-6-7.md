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
| Base de datos (PGlite) | migraciones, permisos, aportes, admin + MFA, códigos, auditoría, reversas con esquema idéntico | **156 / 156** |
| Funciones de punta a punta | admin-send-gift-code, support-claims, community-retranslate, cron de Vercel | **69 / 69** |
| Panel en navegador | MFA, comprobar en Base, activar, códigos, anular, correo de prueba, registro | **19 / 19** |
| App en navegador | Desbloquear con monto exacto, envío del TXID, código de regalo | **10 / 10** |
| Idioma en vivo | cambio ES/EN/DE/FR con la pantalla abierta + recarga, 6 pantallas | **29 / 29** |
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
  ni escribir). Solo se añade con `grant-admin.sql` desde el SQL Editor. Cada
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
- `20261011120000_support_claims.sql` (reescrita: monto único)
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
9. `supabase/admin/grant-admin.sql`: tu cuenta `berthalimo@gmail.com` **ya existe**, no hace falta registrarla (el hook de Gmail no interviene).

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

**F. Merge `dev` → `main`**, solo con tu aprobación escrita.

**G. Hook** «Before User Created», al final, siguiendo `supabase/admin/hook-activation-plan.md`.

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
- Si se agota (HTTP 429) o falla: el aviso pasa a **revisión manual** con el motivo `rpc_unavailable`, **nunca se activa**. Probado.
- Comprobaciones: la transacción existe y se completó; contrato oficial de USDC de Circle (`0x8335…2913`); destino = `SUPPORT_ADDRESS`; monto exacto; transferencia posterior a la reserva; 30 confirmaciones; TXID no usado; aviso vigente y de esa cuenta; ≤ 100 USDC para la automática (10 flores = 100,00xx cuenta como 100).
- Estado: la parte automática está **apagada**. Para encenderla (solo con tu aprobación escrita): `update public.app_config set value = 1 where key = 'claim_auto_verify_enabled';`
- Si algún día hace falta más capacidad: Alchemy (gratis, con clave) en `BASE_RPC_URL`. Etherscan gratis no cubre Base.

---

## 8. Panel de administración

- Dirección: `https://www.motherverdeny.com/panel-mv.html` (no está enlazada en ningún sitio y tiene `noindex`).
- Primera vez: entra en Mother Verde con `berthalimo@gmail.com`, abre el panel y escanea el QR con tu app de autenticación. **Guarda la clave.**
- Pestañas: **Avisos de aporte** (correo, monto, TXID, fecha, cada comprobación con ✓/✗, enlace a Basescan; «Activar acceso completo» solo se habilita si todo pasa; la activación manual y el rechazo exigen motivo), **Códigos de regalo** (enviar, lista con estados, anular con motivo, correo de prueba), **Registro** (solo lectura).
- Idioma del panel: ES/EN/DE/FR, con selector propio; abre en el idioma elegido en la app.
- Si pierdes el teléfono del MFA, en el SQL Editor:
  `delete from auth.mfa_factors where user_id = (select id from auth.users where email = 'berthalimo@gmail.com');`
  y vuelve a activarlo en el panel.

En la app, el código de regalo está en el icono de persona (arriba a la derecha), en la pantalla de cuenta de cada idioma:
**Tu cuenta** → «Tengo un código de regalo» (ES) · **Your account** → "I have a gift code" (EN) · **Dein Konto** → „Ich habe einen Geschenkcode“ (DE) · **Ton compte** → « J’ai un code cadeau » (FR).

---

## 9. Qué revisar tú fuera del código (D.5)

1. Supabase → Authentication → Emails: pegar las 13 plantillas y sus asuntos; activar las notificaciones de seguridad.
2. Authentication → URL Configuration: Site URL = `https://www.motherverdeny.com` (los enlaces de los correos salen de ahí).
3. Authentication → SMTP: el nombre del remitente («Mother Verde») y el límite de correos por hora.
4. Hostinger: firma o respuesta automática de `hello@motherverdeny.com` que mencione precios o suscripción.
5. PaymentCloud: la solicitud en revisión ya no hace falta con este modelo (decide si la retiras).
6. Google: los resultados de búsqueda pueden mostrar durante días la descripción vieja. Puedes pedir que se vuelva a rastrear en Search Console.
7. Perfiles o enlaces externos (redes, bio) que mencionen el precio de $7.10 o la prueba de 3 días.

---

## 10. Checklist de lanzamiento (numerada)

1. ☐ Confirmar aquí que la prueba de $5 en USDC (Base) llegó → poner `SUPPORT_ADDRESS`.
2. ☐ Contador y abogado: textos de aportes, Términos §5 y Privacidad §4 (marcados `[PENDIENTE]`), representante UE y transferencias.
3. ☐ DeepL Pro: cambiar el secreto `DEEPL_API_KEY` y ejecutar `update public.app_config set value = <nuevo tope> where key = 'deepl_daily_char_cap';`
4. ☐ Pegar en el orden de la sección 5 (A → G).
5. ☐ SMTP ya configurado por ti → probar el correo de confirmación con una cuenta desechable de prueba (y borrarla después).
6. ☐ Abrir el panel, activar el MFA y pulsar «Enviar correo de prueba a mi correo». Si no llega: plan B Resend.
7. ☐ Enviarte un código de regalo a un correo tuyo distinto y canjearlo con una cuenta de prueba desechable.
8. ☐ Al día siguiente: `select * from public.cron_runs order by started_at desc limit 3;` debe mostrar `ok = true`.
9. ☐ Activar el hook siguiendo `hook-activation-plan.md`.
10. ☐ (Opcional, más adelante) Encender la verificación automática, solo con tu aprobación escrita.

---

## 11. Qué no entra en el primer lanzamiento y por qué

- **Verificación automática encendida**: queda apagada hasta que lo apruebes por escrito y se haya visto funcionar con pagos reales en modo manual.
- **Reescritura de Política y Términos**: depende del contador y del abogado (D.6). Ahora mismo solo se quitaron precios y suscripción, y se marcó lo que falta.
- **Fuentes de Google y banderas de flagcdn alojadas en el propio servidor**: pendiente; no bloquea el modelo de aportes, pero conviene antes del lanzamiento público por privacidad (las cargan servidores de terceros).
- **Fotos de la Comunidad en un bucket privado** (3b): después del lanzamiento, como acordamos.
- **Limpieza interna de `delete-account`**: después del lanzamiento (sin texto visible).
