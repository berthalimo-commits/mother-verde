# Staging (entorno de pruebas)

Actualizado el 14 de octubre de 2026.

## Situación actual: todavía no hay staging
Hay **un solo proyecto de Supabase**, y dev y producción usan la misma base (`docs/auditoria-verificacion.md`, punto 4).
Por eso, hasta que exista un proyecto de pruebas:
- todo se prueba con la **base simulada** de `tests/sim` (Postgres real con todas las migraciones, sin datos reales);
- **ningún SQL de `supabase/` se pega en Supabase** fuera del día del lanzamiento (`docs/lanzamiento-produccion.md`);
- la web de dev (rama `dev` en Vercel) sirve solo para ver la interfaz. Su «vista previa» (estados de ejemplo,
  «Ver como persona con prueba vencida») **nunca escribe** en la base.

## Cuando se cree el proyecto de pruebas: orden
El mismo que en producción, sobre el proyecto de pruebas y con una cuenta de prueba **distinta** de hello@:
1. `precheck-before-20261010.sql` (todas las filas `ok`).
2. Migraciones en orden: `20261010120000` → `seed-blocked-email-domains/part-01…07` → `20261010130000` →
   `20261011100000` → `20261011120000` → `20261011130000` → `20261013100000` → `20261013110000` →
   `20261013120000` → `20261014100000` → `20261014110000`.
3. Secretos → funciones (`support-claims`, `admin-send-gift-code`, `community-retranslate` y `signup-fix-email` con
   «Verify JWT» apagado; `community-publish-post` y `community-publish-comment`) → variables de Vercel del entorno
   **Preview** apuntando al proyecto de **pruebas** → plantillas de correo.
4. **Cuenta de administradora**: registrarse y confirmar el correo en la web de pruebas y pegar `grant-admin.sql`
   (PARTE 1 de solo lectura, luego el archivo entero). Deja esa cuenta como **admin + acceso completo sin fecha**.
   En pruebas, cambia el correo `hello@motherverdeny.com` del archivo por el de la cuenta de prueba (en todas las líneas
   donde aparece) y **no** subas ese cambio. Para deshacerlo: `rollback-grant-admin.sql`.
5. Activar el panel con la verificación en dos pasos.
6. Hook «Before User Created», siempre al final.

## Lo que hay que comprobar en Vercel antes de dar staging por bueno
- Settings → Environment Variables: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` de **Preview** deben ser los del
  proyecto de pruebas, y los de **Production**, los de producción. Si coinciden, Preview sigue usando la base real.
