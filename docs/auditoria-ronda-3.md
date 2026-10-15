# Auditoría de la plataforma — Ronda 3 de 4

Fecha: 13 de octubre de 2026 · Rama `dev` · **Solo lectura**. Prioridades: 🔴 P0 · 🟠 P1 · 🟡 P2 · 🔵 P3 · ⚪ P4.

---

## 12. Manejo de errores y estados

Leyenda: ✅ explica y se puede seguir · ⚠️ explica a medias o en genérico · ❌ queda roto o sin mensaje.

| Función | Falla la API o la base | Sin internet | Sesión caducada | Dato inválido | Sin permiso | Duplicado | Carga / vacío |
|---|---|---|---|---|---|---|---|
| Registro / entrar | ✅ mensajes por tipo (límite, SMTP, credenciales, contraseña corta, correo inválido) | ⚠️ «Algo salió mal» | — | ✅ | ✅ | ✅ «ya tiene cuenta» | ✅ «Cargando…» y botón desactivado |
| Confirmar / reenviar | ✅ | ⚠️ genérico | — | ✅ | — | ✅ 60 s / 3 por hora | ✅ |
| Recuperar contraseña | ✅ respuesta neutra | ⚠️ | — | ✅ | — | ✅ | ✅ |
| Corregir correo | ✅ 8 casos con mensaje propio | ⚠️ «No pudimos enviar…» | — | ✅ | ✅ | ✅ límites | ✅ |
| **Cargar el perfil al entrar** | ❌ **queda en «Cargando…» para siempre** (ver 12.1) | ❌ | ⚠️ | — | — | — | ❌ sin reintento |
| Desbloquear: reservar, TXID, cancelar | ✅ códigos de error con texto (`dsErr*`) | ⚠️ | ⚠️ pide entrar | ✅ 66 caracteres, 1–20 flores | ✅ | ✅ monto único, TXID único | ✅ |
| Canjear regalo | ✅ error genérico a propósito | ⚠️ | ⚠️ | ✅ | ✅ 5 fallos → bloqueo 24 h | ✅ | ✅ |
| Comunidad: publicar, comentar | ✅ incluye `no_access` → pantalla de acceso; límites diarios | ⚠️ | ✅ refresca y bloquea | ✅ longitud | ✅ | ⚠️ doble clic **SIN VERIFICAR** | ✅ |
| Comunidad: feed y directorio | ⚠️ mensaje genérico | ⚠️ | ⚠️ | — | ✅ 0 filas sin acceso | — | ⚠️ sin «ver más» |
| Bitácora | ⚠️ | ⚠️ | ⚠️ | ⚠️ pocos controles de rango (pH, EC…) **SIN VERIFICAR** | ⚠️ ver 4.1 | — | ✅ |
| Borrar cuenta | ✅ contraseña, palabra, cuenta oficial | ⚠️ | ✅ | ✅ | ✅ | — | ✅ |
| Panel (todas las pestañas) | ✅ muestra el error del servidor | ⚠️ | ✅ vuelve a pedir MFA | ✅ | ✅ «no tiene acceso al panel» | ✅ | ✅ |
| Funciones de correo | ✅ reintento + Resend + registro | — | — | ✅ | ✅ | — | — |

| # | Prioridad | Hallazgo |
|---|---|---|
| 12.1 | 🟠 P1 | **Si falla la carga del perfil, la persona queda bloqueada en «Cargando…» sin salida.** `loadProfile()` devuelve vacío ante cualquier error (red, base caída, perfil inexistente). El estado pasa a `loading`, que se trata como bloqueado, y no hay botón de reintentar ni mensaje: solo se arregla recargando. Una cuenta antigua sin fila en `profiles` (**SIN VERIFICAR** si existe alguna) quedaría así siempre. |
| 12.2 | 🟡 P2 | **Sin internet no hay un mensaje propio** en ningún flujo: las acciones muestran el error genérico del caso («Algo salió mal», «No pudimos enviar…»). El trabajador de servicio sirve la portada sin conexión, pero no avisa «estás sin conexión». |
| 12.3 | 🟡 P2 | **Mensajes en 4 idiomas**: todos los textos nuevos están en ES/EN/DE/FR (barrido de 880 combinaciones sin claves vacías). Excepción: los errores que vienen tal cual del servidor en el **panel** (por ejemplo `detail` de SMTP) salen en inglés técnico. Es aceptable para la admin, no para el público. |
| 12.4 | 🔵 P3 | La página 404 de Vercel sale en inglés y sin diseño (ver 3.2). |
| 12.5 | 🔵 P3 | El formulario de publicidad sin `RESEND_API_KEY` responde 503 y ofrece mailto (bien), pero no tiene límite de envíos (ver 13.9). |

---

## 13. Seguridad

### Comprobado
- **Secretos**: no hay claves en el código, en `dist/` ni en el historial de git. Se buscaron JWT (`eyJ…`), claves de Resend, Stripe y DeepL, y contraseñas SMTP; los resultados no se copian aquí. `.env` y `.env.local` están en `.gitignore` y nunca se subieron; solo `.env.example`, que está vacío.
- **Control de acceso en la base**: lo hace RLS en todas las tablas. Las tablas internas no tienen reglas, así que nadie entra desde el navegador. Las funciones `admin_*` comprueban admin + MFA (aal2) dentro de la base. `profiles` solo deja cambiar 5 columnas.
- **Referencias a objetos de otros**: avisos, Bitácora, perfil privado y seguimientos solo se ven si son propios; para Comunidad hacen falta acceso y reglas de visibilidad. No se encontró ninguna forma de leer datos privados ajenos.
- **XSS**: los textos de miembros (publicaciones, comentarios, nombres, biografía) se escapan antes de insertarse en la pantalla, y «ver original» usa `textContent`. Las traducciones (`data-i18n`) usan `innerHTML`, pero son textos propios.
- **Inyección SQL**: las funciones usan parámetros. El único SQL dinámico (`execute … using`) usa parámetros. El CSV neutraliza fórmulas.
- **Subida de archivos**: el bucket limita los tipos de imagen (migración `20260915121500`) y la carpeta propia (`<uid>/`).
- **Funciones con «Verify JWT» apagado**:
  - `community-retranslate`: solo responde con la clave secreta, que se compara en tiempo constante; si no, 401.
  - `signup-fix-email`: reforzada hoy (límites antes de la contraseña, 3 correcciones por cuenta, enlace viejo anulado; 30 ataques simulados superados).
- **npm audit**: 1 aviso **bajo** (`dompurify`, que llega con `jspdf`), en un modo (`IN_PLACE`) que la app no usa.

| # | Prioridad | Hallazgo |
|---|---|---|
| 13.1 | 🟠 P1 | **No hay cabeceras de seguridad**: ni CSP, ni `X-Frame-Options` / `frame-ancestors`, ni `Referrer-Policy`, ni `Permissions-Policy` (`vercel.json` no tiene `headers`; `index.html` no tiene CSP). Cualquier página puede meter Mother Verde en un marco (*clickjacking*), por ejemplo sobre «Eliminar mi cuenta» o el panel. Sin CSP, un XSS futuro podría llevarse la sesión de `localStorage`. **SIN VERIFICAR**: qué cabeceras pone Vercel por defecto (solo HSTS, normalmente). |
| 13.2 | 🟠 P1 | **El contenido «con acceso» es público** (ver 3.1): bloqueo visual, se salta con la consola. Aceptado temporalmente (opción A). No es una brecha de datos personales, pero sí del modelo de aporte. |
| 13.3 | 🟡 P2 | **`community-translate` sin uso, posiblemente desplegada** (7.3): gasto de la cuota de DeepL por cualquiera con sesión. **SIN VERIFICAR** en Supabase. |
| 13.4 | 🟡 P2 | **Imágenes de terceros que rastrean** (4.4 y 4.5): `avatar_url`, `cover_photo_url` y `photo_url` aceptan cualquier dirección. Una imagen alojada fuera registra la IP de quien mira. La portada permite inyectar CSS en su propio recuadro. |
| 13.5 | 🟡 P2 | **Fotos públicas por enlace** (4.3). |
| 13.6 | 🟡 P2 | **Relaciones de seguimiento consultables** con `community_is_mutual` y `community_can_view` (4.2). |
| 13.7 | 🟡 P2 | **Terceros que reciben la IP de cada visita**: Google Fonts (2 enlaces) y flagcdn.com (34 banderas en `index.html`). Ya está pendiente para la política de privacidad y la «privacidad» del bloque de velocidad. |
| 13.8 | 🟡 P2 | **Captcha apagado y hook pendiente** (5.1): sin protección contra registros automáticos hasta que se activen. Los límites por IP de Supabase protegen algo. **SIN VERIFICAR**: valores actuales en el panel de Supabase. |
| 13.9 | 🔵 P3 | **`/api/ad-inquiry` sin límite de envíos**: con `RESEND_API_KEY` puesta, alguien podría hacer que mandemos muchos correos a hello@ (solo a nosotras, no a terceros). |
| 13.10 | 🔵 P3 | **CSRF**: no aplica a la API de Supabase, que usa el token en la cabecera y no cookies. `/api/ad-inquiry` acepta POST de cualquier origen: es un formulario público, y el riesgo es el mismo que 13.9. |
| 13.11 | 🔵 P3 | **`mvAvatarHtml` no escapa nada si `mvCommunity` todavía no cargó** (`esc = … : (s => s)`). En la práctica los avatares se pintan con datos que trae `mvCommunity`, así que ya está cargado. Pero es una trampa para el futuro. |
| 13.12 | 🔵 P3 | **El panel es una página pública** (`/panel-mv.html`) que carga el código del panel para cualquiera. No expone datos (todo lo decide la base), pero muestra la estructura de las funciones de admin. |
| 13.13 | 🔵 P3 | **Permiso de ejecución innecesario** en funciones de disparador (`handle_new_user`, `handle_community_swipe`) para `anon` (4.6). Inofensivo. |
| 13.14 | ⚪ P4 | La sesión en `localStorage` es lo habitual en Supabase. Con CSP (13.1) el riesgo baja mucho. |

---

## 14. Rendimiento y escalabilidad

Medido en la compilación de producción (comprimido con gzip, parecido a lo que envía Vercel):

| Archivo | Sin comprimir | Comprimido | Nota |
|---|---|---|---|
| `index.html` | 591 KB | 154 KB | todo el contenido de todas las pantallas, en español, dentro del HTML |
| `main.js` | **2,97 MB** | **987 KB** | sin minificar; contiene el contenido en **los 4 idiomas** y toda la lógica; no pasa por Vite (sin huella en el nombre) |
| `assets/main-*.js` | 500 KB | 162 KB | Supabase, módulos de la app y QR |
| `assets/index-*.js` + `index.es-*` + `html2canvas` + `purify` | ~600 KB | ~165 KB | PDF de la Bitácora (debería cargarse solo al pedir el PDF; **SIN VERIFICAR** si ya es así) |
| `style.css` | 50 KB | 10 KB | |

Primera visita: **~1,3–1,5 MB comprimidos** antes de ver la página completa. En una medición anterior desde aquí,
la primera visita a dev tardó **26 s**.

| # | Prioridad | Hallazgo |
|---|---|---|
| 14.1 | 🟠 P1 | **`main.js` de 3 MB, sin minificar y con los 4 idiomas a la vez.** Cada persona descarga tres idiomas que no usa. En un móvil con mala señal la primera visita tarda decenas de segundos, y además causa el «parpadeo» de la pregunta de edad que se arregló con un parche. Es el mayor problema de rendimiento. |
| 14.2 | 🟡 P2 | **`main.js` no tiene huella en el nombre**: no se puede guardar en caché «para siempre». Se revalida en cada visita (es correcto que lo haga, pero cuesta una petición cada vez). |
| 14.3 | 🟡 P2 | **Directorio**: carga 200 o 500 miembros de una vez y filtra en el navegador. Con 10.000 miembros, solo se verían los últimos 500 y la pantalla sería lenta. |
| 14.4 | 🟡 P2 | **Feed**: solo las últimas 40 publicaciones, sin «ver más» (7.4). Con mucha actividad, lo de ayer ya no aparece. |
| 14.5 | 🟡 P2 | **Límites que se alcanzan con 1.000 personas**: 30 correos por hora de Supabase (registros), tope diario de DeepL (14.000 caracteres: unas pocas publicaciones largas), endpoint público de Base («con límite, no para producción»), 99 montos abiertos por cantidad de flores, 20 regalos al día. |
| 14.6 | 🔵 P3 | **Panel**: `admin_list_claims` sin paginar, CSV con tope de 5.000 filas (avisa si corta), Usuarios con 50 por página (bien). |
| 14.7 | 🔵 P3 | **Funciones `is_premium` / `has_full_access` en cada fila de las reglas RLS**: se evalúan por fila, pero están marcadas `stable`, y Postgres las resuelve una vez por consulta en casos sencillos. Con feeds grandes conviene medir. **SIN VERIFICAR** con datos reales. |
| 14.8 | 🔵 P3 | Imágenes de la Comunidad sin redimensionar en el servidor (se recortan en el navegador, **SIN VERIFICAR** el tamaño final). |
| 14.9 | ⚪ P4 | Plan gratuito de Supabase: sin copias programadas y con límites de conexiones y ancho de banda (**SIN VERIFICAR** los números actuales). |

**Qué funciona hoy y fallaría con 1.000 o 10.000 personas**: el límite de correos por hora, el directorio entero en el
navegador, el feed sin paginar, la cuota de DeepL Free, la revisión manual de avisos (1 persona revisando a mano) y el
peso de la primera visita.

---

## 15. Arquitectura del código

| # | Prioridad | Hallazgo |
|---|---|---|
| 15.1 | 🟠 P1 | **`public/main.js` es un único archivo de 9.711 líneas**, sin módulos, con variables globales (`isPremium`, `currentLang`…), todo el texto en 4 idiomas, la navegación, el acceso, la Comunidad, las calculadoras y efectos visuales. Además no pasa por Vite. Es el principal freno para mantener y crecer, y la causa de 14.1. |
| 15.2 | 🟡 P2 | **Dos sistemas de bloqueo superpuestos**: el viejo «gratis frente a Premium» (`isPremium`, `applyTier`, `FULL_GATES`, comentarios de «filosofía Premium») y el nuevo `mv-locked` por estados. Hoy encajan (`isPremium = !bloqueado`), pero duplican la lógica. |
| 15.3 | 🟡 P2 | **La regla de acceso está en tres sitios**: `is_premium()` en la base, `computeIsPremium()` en `src/auth.js` y `mvAccessState()` en `main.js`. Ya difieren en un caso (10.2). |
| 15.4 | 🟡 P2 | **Código duplicado**: el bloque MAIL en dos funciones (a propósito, por pegar en el panel, con una prueba que exige que sea idéntico); `community-publish-post` y `-comment` repiten límites, traducción y comprobaciones; hay al menos 4 copias de `esc()`; textos que se añaden con `translations.xx.clave = …` en vez de estar en su objeto. |
| 15.5 | 🔵 P3 | **Código muerto o sobrante**: `community-translate`, la clave `accOtroCorreo` (ya sin uso), el selector de vista previa `tierSwitch` (solo localhost), `setIsPremium`, comentarios del modelo de tarjeta y nombres como `subscription-cron`. |
| 15.6 | 🔵 P3 | **Estilos dentro del HTML**: cientos de `style="…"` en `index.html` (por ejemplo, en el formulario de Cuenta). Mezclan diseño y contenido y dificultan la coherencia visual. |
| 15.7 | 🔵 P3 | **Sin dependencias circulares** entre módulos de `src/`. Se comunican por `window.*` (por ejemplo `window.mvRefreshAuth` o `window.mvCommunity`), que funciona pero esconde quién depende de quién. |
| 15.8 | ✅ | Puntos fuertes: migraciones con transacción, reversas probadas, precheck, pruebas automáticas amplias (17 archivos, 613 comprobaciones), funciones del servidor bien comentadas y textos en un solo lugar para lo nuevo. |

---

## 16. Consistencia

| # | Prioridad | Hallazgo |
|---|---|---|
| 16.1 | 🟡 P2 | **Palabras internas frente a públicas**: la web dice «aporte», «acceso completo», «Desbloquear» y «flor» de forma coherente (barrido: 0 textos del modelo viejo). En el código y en la base siguen «subscription», «Premium», «trial» y «blocked». No lo ve el público, pero sí el panel en algunos sitios (`subscription_status` dentro del CSV, **SIN VERIFICAR** el nombre de la columna exportada). |
| 16.2 | 🟡 P2 | **«Directorio» y «Diagnóstico» con dos significados** (1.1). |
| 16.3 | 🔵 P3 | **Formas de botón**: conviven `btn btn-primary`, `btn btn-ghost`, enlaces subrayados (`auth-link-btn`, `acc-note a`) y `span` con `onclick` («Cerrar sesión», «¿No tienes cuenta?»). Los `span` no son botones de verdad: no se alcanzan con el teclado ni los lee bien un lector de pantalla. |
| 16.4 | 🔵 P3 | **Mensajes de error**: el tono (tú) y la forma («No pudimos…», «Espera…») son coherentes en lo nuevo. Quedan genéricos antiguos («Algo salió mal. Intenta de nuevo.»). |
| 16.5 | 🔵 P3 | **Estados en el panel frente a la app**: el panel dice «Prueba vencida», «Acceso completo», «Acceso por regalo», «Bloqueado»; la app dice «Tu prueba gratis terminó», «Esta cuenta no tiene acceso activo», «acceso retirado». Son equivalentes, aunque con nombres distintos. |
| 16.6 | 🔵 P3 | **URLs**: no hay estructura (todo es `/`), así que no hay incoherencias, pero tampoco nombres (ver 2.2). |
| 16.7 | ⚪ P4 | Asuntos de correo en ES·EN mientras el cuerpo va en 4 idiomas (decisión del bloque de correos). |
