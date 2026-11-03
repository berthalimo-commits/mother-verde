# Revisión final independiente — qué mirar con ojos limpios

Para una sesión **nueva** de Claude Code, sin el historial de esta. Rama `dev` (igual a `juego`).
Reglas para esa sesión: solo leer y probar en local o en staging (`ciqdnrdtaxbmcjvxljvq`); **nada** en `main`, en
producción (`uobailsjmjoubvnagxht`) ni con `.env.local` (apunta a producción). Las pruebas locales están en
`tests/sim/` (`README`; `node tests/sim/run-all.mjs <filtro>`).

Texto para pegar al empezar la sesión nueva:

> Haz una revisión de seguridad y correctitud de la rama `dev` de este repositorio antes de su lanzamiento.
> Solo lectura y pruebas locales o en staging; no toques `main`, producción ni `.env.local`. Sigue
> `docs/revision-independiente.md`, empieza por las áreas de más riesgo y dame una lista de hallazgos
> ordenada por gravedad, cada uno con archivo, línea y cómo reproducirlo.

## Áreas, de más a menos riesgo

1. **Dinero (aportes en USDC y manuales)**
   - ¿Alguien puede darse acceso completo sin pagar? Revisar quién puede llamar a `create_support_claim`,
     `submit_support_claim_tx`, `svc_approve_claim`, `svc_grant_full_access`, `admin_record_manual_contribution`
     (migraciones `20261011120000`, `20261014110000`, `20261014120000`, `20261103100000`).
   - La función `supabase/functions/support-claims/index.ts`: comprobación en Base (contrato USDC oficial, dirección
     de destino, monto exacto, confirmaciones, TXID no reutilizado, pago tardío).
   - Que la dirección de la billetera (`src/supportConfig.js`) sea la correcta y no se pueda cambiar desde el navegador.
2. **Acceso (quién ve qué)**
   - Una sola regla: `access_info` / `is_premium` (`20261014140000`). Buscar cualquier camino que dé contenido de pago
     sin ella: pantallas en `public/main.js`, reglas RLS de cada tabla, la vista previa de staging (`mvDevPreview`).
   - Prueba de 24 h: solo cuentas nuevas y confirmadas, una sola vez.
   - Bitácora sin acceso: solo lectura también en el servidor (`20261020100000`).
3. **Correos y cuentas**
   - Registro, confirmación, «Corrígelo» (`supabase/functions/signup-fix-email`), reenvíos, recuperación, cambio de
     correo: que no se pueda tomar la cuenta de otra persona ni saber si un correo tiene cuenta.
   - Hook «Before User Created»: dominios desechables y variantes de Gmail.
   - Límites de intentos (códigos de regalo, «Corrígelo»).
4. **Privacidad**
   - Qué datos personales lee el navegador de otras personas (perfiles, correos, Comunidad); fotos en el bucket público
     (decisión documentada en `20260902220000`).
   - Borrado de cuenta (`delete-account`): qué se borra y qué queda (avisos de aporte de cuentas borradas).
   - Cabeceras y CSP (`vercel.json`), nada de datos personales en URLs.
5. **Red social (Comunidad)**
   - Publicar, comentar, seguir, denunciar: RLS de `community_*`, traducción automática (DeepL) y sus límites.
   - Inyección de HTML en publicaciones, comentarios, biografías y nombres.
   - Hoy **no hay moderación en el panel** (ver `docs/plan-migracion.md`, paso 7): revisar qué puede hacer un abusador.
6. **Panel de administración** (`/panel-mv.html`, `src/admin.js`)
   - Todo exige admin + verificación en dos pasos (AAL2) **en el servidor**, no solo en la pantalla.
   - Exportar CSV (inyección de fórmulas), registro de auditoría completo, nada se borra sin motivo.
7. **Juego** (apagado en producción): confirmar que un build normal no lo incluye (`MV_GAME` sin poner).
