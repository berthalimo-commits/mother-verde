# Staging (entorno de pruebas)

Actualizado el 15 de octubre de 2026.

## Los dos proyectos de Supabase

| Proyecto | Para qué | Región | Datos |
|---|---|---|---|
| **producción** (`mother-verde`) | la web pública `www.motherverdeny.com` | Central EU (Fráncfort), `eu-central-1` | personas reales |
| **`mother-verde-staging`** | solo pruebas | West US (Oregon) | **solo cuentas y datos de prueba** |

Reglas de staging:
- **Nunca datos de personas reales.** Ni cuentas, ni correos, ni copias o exportaciones de producción. Solo se usan
  cuentas de prueba creadas para eso (por ejemplo, `prueba+algo@…`).
- Como no tiene datos reales, que esté en otra región no afecta a la política de privacidad, que describe producción.
- Todo SQL nuevo se pega **primero en staging** y, cuando funciona, el día del lanzamiento, en producción.
- Las pruebas automáticas siguen usando la **base simulada** de `tests/sim` (sin ningún proyecto real).
- La «vista previa» de la web de dev (estados de ejemplo, «Ver como persona con prueba vencida») **nunca escribe** en la
  base, apunte a donde apunte.

## Qué falta para que dev y producción dejen de compartir la base
**SIN VERIFICAR:** si las variables de Vercel ya están separadas. Hasta comprobarlo, se da por hecho que la web de
`dev`/Preview sigue usando la base de producción (`docs/auditoria-verificacion.md`, punto 4).
- Vercel → Settings → Environment Variables:
  - **Preview**: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` del proyecto **`mother-verde-staging`**.
  - **Production**: los de producción.
  - Si las dos dicen lo mismo, Preview sigue apuntando a la base real.
- Después, hay que volver a desplegar la rama `dev` para que use las variables nuevas.

## Orden para preparar staging (el mismo que en producción)
Todo en `mother-verde-staging`, con una cuenta de prueba **distinta** de hello@:
1. `precheck-before-20261010.sql` (todas las filas `ok`).
2. Migraciones en orden: `20261010120000` → `seed-blocked-email-domains/part-01…07` → `20261010130000` →
   `20261011100000` → `20261011120000` → `20261011130000` → `20261013100000` → `20261013110000` →
   `20261013120000` → `20261014100000` → `20261014110000` → `20261014120000` → `20261014130000` → `20261014140000`.
3. Secretos → funciones (`support-claims`, `admin-send-gift-code`, `community-retranslate` y `signup-fix-email` con
   «Verify JWT» apagado; `community-publish-post` y `community-publish-comment`) → variables de Vercel del entorno
   **Preview** apuntando a staging → plantillas de correo.
   - En staging, `SUPPORT_ADDRESS` debe ser una billetera **de prueba**, nunca la de producción.
   - `NOTIFY_TO` debe ser un buzón de prueba.
4. **Cuenta de administradora**: registrarse y confirmar el correo en la web de pruebas y pegar `grant-admin.sql`
   (PARTE 1 de solo lectura, luego el archivo entero). Deja esa cuenta como **admin + acceso completo sin fecha**.
   En staging, cambia el correo `hello@motherverdeny.com` del archivo por el de la cuenta de prueba (en todas las líneas
   donde aparece) y **no** subas ese cambio. Para deshacerlo: `rollback-grant-admin.sql`.
5. Activar el panel con la verificación en dos pasos.
6. Hook «Before User Created», siempre al final.
