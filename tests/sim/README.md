# Pruebas con base de datos simulada

Nada de esto toca producción: la base de datos es PGlite (PostgreSQL en
memoria) con las migraciones reales del repositorio; Base, DeepL, SMTP y
Resend están simulados. No se envía ningún correo real.

Una vez: `cd tests/sim && npm install`

| Prueba | Cómo | Qué cubre |
|---|---|---|
| Base de datos | `node test.mjs` | migraciones, permisos, aportes, admin + MFA, códigos, auditoría, reversas |
| Funciones | `node fn-e2e.mjs` | admin-send-gift-code, support-claims, community-retranslate, cron |
| Navegador (necesitan los dos servidores de abajo) | `node lang-live.mjs`, `node app-ui.mjs`, `node panel-ui.mjs`, `node screens-scan.mjs` | cambio de idioma en vivo y al recargar; Desbloquear + código de regalo; panel con MFA; barrido de textos del modelo viejo |

Servidores para las pruebas de navegador (dos terminales, desde la raíz del repo):
1. `node tests/sim/fakeserver.mjs` (Supabase simulado en el puerto 54321)
2. `VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_ANON_KEY=anon npx vite --port 5174`

Reinicia `fakeserver.mjs` antes de `lang-live.mjs` y antes de `app-ui.mjs` (empiezan con la base limpia;
`panel-ui.mjs` puede ir justo después de `app-ui.mjs`). Necesitan Google Chrome instalado en la ruta por defecto de Windows.
Las capturas quedan en `tests/sim/out/`.
