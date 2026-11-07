# Pruebas con base de datos simulada

Nada de esto toca producción: la base de datos es PGlite (PostgreSQL en
memoria) con las migraciones reales del repositorio; Base, DeepL, SMTP y
Resend están simulados. No se envía ningún correo real.

Una vez: `cd tests/sim && npm install`

| Prueba | Cómo | Qué cubre |
|---|---|---|
| Base de datos | `node test.mjs` | migraciones, permisos, aportes, admin + MFA, códigos, auditoría, reversas |
| Funciones | `node fn-e2e.mjs` | admin-send-gift-code, support-claims, community-retranslate, cron |
| Correos: base de datos | `node mail-db.mjs` | permisos de mail_events y del panel, direcciones tapadas, reglas para corregir el correo de registro, email_normalized |
| Correos: plantillas | `node mail-content.mjs` | las 13 plantillas de Supabase: 4 idiomas, enlaces, imágenes, asuntos, spam, 360 px claro/oscuro (solo Chrome, sin servidores) |
| Correos: navegador (servidores de abajo, fakeserver recién arrancado) | `node mail-links-ui.mjs`, `node mail-signup-ui.mjs`, `node mail-flow-ui.mjs`, `node mail-panel-ui.mjs` | enlaces caducados/usados, recuperar contraseña, cambio de correo, pantalla «revisa tu correo» (reenvío 60 s / 3 por hora, corrección), recorridos completos con enlaces de un solo uso, aviso «Correos fallidos en las últimas 24 h» |
| Cuenta hello@ = admin + acceso completo | `node owner-account.mjs` (base y funciones) · `node owner-ui.mjs` (navegador, fakeserver recién arrancado) | `grant-admin.sql` y su reversa; todas las zonas sin bloqueo; panel solo con MFA (comprobado en la base y en las funciones); los permisos siguen tras salir y entrar, cambiar idioma y contraseña; ni secretos ni códigos de regalo en claro; botón de dev «Ver como persona con prueba vencida» |
| Navegador (necesitan los dos servidores de abajo) | `node lang-live.mjs`, `node app-ui.mjs`, `node panel-ui.mjs`, `node screens-scan.mjs` | cambio de idioma en vivo y al recargar; Desbloquear + código de regalo; panel con MFA; barrido de textos del modelo viejo |

Servidores para las pruebas de navegador (dos terminales, desde la raíz del repo):
1. `node tests/sim/fakeserver.mjs` (Supabase simulado en el puerto 54321)
2. `VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_ANON_KEY=anon npx vite --port 5174`

Reinicia `fakeserver.mjs` antes de `lang-live.mjs` y antes de `app-ui.mjs` (empiezan con la base limpia;
`panel-ui.mjs` puede ir justo después de `app-ui.mjs`). Necesitan Google Chrome instalado en la ruta por defecto de Windows.
Las capturas quedan en `tests/sim/out/`.

**Todo de una vez:** con Vite en marcha (paso 2), `node tests/sim/run-all.mjs` ejecuta todas las pruebas y arranca un `fakeserver.mjs` limpio para cada prueba de navegador.
