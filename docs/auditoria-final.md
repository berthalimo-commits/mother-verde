# Auditoría de la plataforma — Informe final (Ronda 4 de 4)

Fecha: 13 de octubre de 2026 · Rama `dev` (`7dc4369`) · **Solo lectura**: no se cambió código, base ni configuración,
no se envió ningún correo y no se tocaron las cuentas Betian ni Mother Verde.
Rondas anteriores: `docs/auditoria-ronda-1.md` (arquitectura, navegación, rutas, roles, autenticación),
`docs/auditoria-ronda-2.md` (base de datos, flujos de datos, negocio, sincronía, contradicciones, dependencias),
`docs/auditoria-ronda-3.md` (errores, seguridad, rendimiento, código, consistencia).
Prioridades: 🔴 P0 · 🟠 P1 · 🟡 P2 · 🔵 P3 · ⚪ P4. **SIN VERIFICAR** = requiere prueba real.

---

## 17. Escenarios reales de punta a punta (simulados)

Cómo se simularon: con las pruebas automáticas del repositorio (Supabase imitado sobre Postgres real con todas las
migraciones, funciones empaquetadas como en producción y Chrome sin pantalla). Las 17 pasaron hoy (613 comprobaciones).
Donde no hay prueba, se siguió el código paso a paso.

| Escenario | Resultado | Cómo se comprobó | Problemas encontrados |
|---|---|---|---|
| **A. Persona nueva**: registro → confirmación → 24 h → vence → flores → monto → copiar → TXID → revisión → activación | ✅ con reservas | `mail-flow-ui` (registro, enlace en otro navegador, 24 h corriendo), `amount-ui` (monto, decimales, copiar con punto), `app-ui` (reservar, TXID, pendiente), `fn-e2e` (comprobaciones en Base, aprobar, correo de activación) | tras activar, la app abierta sigue bloqueada hasta recargar (9.1); nadie avisa a la admin de que hay un TXID nuevo (19, imprescindible); si paga después de 72 h no puede enviar el TXID (8.1) |
| **B. Persona con cuenta**: entrar, recorrer zonas, editar, guardar, recargar | ⚠️ | `lang-live` (idioma se mantiene al recargar), `screens-scan` (20 pantallas × 4 idiomas × estados sin errores de JS) | **SIN VERIFICAR**: guardar en Bitácora y en el perfil de Comunidad y comprobar tras recargar (no hay prueba automática); el botón atrás del navegador saca de la web (2.1) |
| **C. Sin permiso intentando entrar** | ✅ | `test.mjs` (RLS como anónimo y como cuenta normal), `panel-ui` (cuenta normal y admin sin MFA rechazadas), `fn-e2e` (funciones con 401/403) | el contenido educativo se ve desde la consola (3.1); la Bitácora acepta escrituras sin acceso (4.1) |
| **D. Administradora**: panel con MFA → usuarios → aviso → regalo → registro → exportación | ✅ | `panel-ui`, `panel-users-ui` (Resumen, Usuarios, ficha anotada, CSV real descargado), `mail-panel-ui` (correos fallidos) | dar días, revocar y crear códigos sueltos solo por SQL (7.7); los reportes de Comunidad no aparecen en ningún sitio (4.8) |
| **E. Aporte rechazado y reintento** | ⚠️ | `fn-e2e` (rechazo con motivo → `rejected`), código (`create_support_claim` permite uno nuevo tras rechazo) | **SIN VERIFICAR** con prueba automática el reintento completo; el pago anterior queda sin relación con el nuevo aviso (8.5) |
| **F. Código de regalo**: canjeado, repetido, vencido | ✅ | `test-part2` y `fn-e2e`: válido, repetido, vencido, 5 fallos → bloqueo, cuenta revocada, cuenta supporter (no lo gasta) | — |
| **G. Cuenta borrada con aviso abierto** | ⚠️ | `test-part3`: el aviso y el contacto se borran en cascada | **se pierde la constancia de un pago enviado** (6.1) |
| **H. Correo mal escrito al registrarse** | ✅ | `mail-signup-ui` (misma cuenta, sin duplicar, reenvío al correo nuevo), `signup-fix-attacks` (30 ataques) | **SIN VERIFICAR** con Supabase real: que se compruebe la contraseña antes de «sin confirmar» |
| **I. Enlace de correo caducado o usado dos veces** (añadido) | ✅ | `mail-flow-ui`, `mail-links-ui` | — |
| **J. Fallo de envío de correo** (añadido) | ✅ | `fn-e2e` (reintento, Resend, todo falla → código anulado y aviso en el panel) | los correos de Supabase (confirmación) no tienen plan B (11) |
| **K. Prueba que vence con la app abierta** (añadido) | ✅ | temporizador de 15 s en `main.js`, `preview-ui` | usa la hora del dispositivo (5.6) |
| **L. Publicar en Comunidad con la prueba vencida** (añadido) | ✅ | funciones `is_premium` → `no_access` → la app refresca y bloquea | — |
| **M. Primer día de lanzamiento con 100 registros en una hora** (añadido) | ❌ con la configuración actual | límite de Supabase de unos 30 correos por hora | hay que subir el límite antes (informe de correos) |

---

## 18. Matriz de funciones

Leyenda: ✅ funciona · ⚠️ parcial · ❌ roto · 🚧 sin hacer · 🔴 crítico.
Servidor/Base: dónde se aplica la regla de verdad.

| Función | Pantalla | Frontend | Servidor | Base de datos | Permisos | Navegación | Estado | Problemas |
|---|---|---|---|---|---|---|---|---|
| Pregunta de edad | modal | ✅ | — | — | todos | ✅ | ✅ | solo en el navegador (normal) |
| Idiomas ES/EN/DE/FR | todas | ✅ | — | `preferred_lang` | todos | ✅ | ✅ | 3 idiomas extra en cada descarga (14.1) |
| Registro | Cuenta | ✅ | Supabase Auth + hook | `profiles`, disparador | visitante | ✅ | ⚠️ | captcha apagado, hook pendiente (5.1) |
| Confirmación + 24 h | Acceso | ✅ | Supabase Auth | disparador `on_auth_email_confirmed` | — | ✅ | ✅ | depende de «Confirm email» activado (5.5) |
| Reenvío / corregir correo | Acceso | ✅ | `signup-fix-email` | `signup_fix_attempts` | sin confirmar | ✅ | ✅ | — |
| Recuperar contraseña | Cuenta | ✅ | Supabase Auth | — | todos | ✅ | ✅ | — |
| Cambiar contraseña con sesión | — | 🚧 | — | — | — | — | 🚧 | solo por recuperación (5.2) |
| Cambiar correo de inicio de sesión | Cuenta | ✅ | Supabase Auth | disparador `email_normalized` | con sesión | ✅ | ✅ | — |
| Borrar cuenta | Cuenta | ✅ | `delete-account` | cascadas | con sesión | ✅ | ⚠️ | borra avisos con pago enviado (6.1) |
| Carga de perfil y estado | todas | ⚠️ | — | `profiles` (RLS propio) | con sesión | — | ⚠️ | «Cargando…» sin salida si falla (12.1) |
| Bloqueo por estado | todas | ✅ | parcial | `is_premium()` | — | ⚠️ | ⚠️ | visual para el contenido educativo (3.1) |
| Contenido educativo | 15 pantallas | ✅ | — | — | con acceso (visual) | ⚠️ sin atrás ni enlaces (2.1, 2.2) | ⚠️ | público en el código |
| Búsqueda | modal | ✅ | — | — | todos | ⚠️ | ✅ | — |
| Calculadoras | Calculadoras | ✅ | — | — | con acceso | ✅ | ✅ | — |
| Bitácora + PDF | Bitácora | ✅ | — | `bitacora_entries` (RLS propio) | propia | ⚠️ en «Más» | ⚠️ | escribible sin acceso (4.1) |
| Registro de tricomas | Cultivo → Cosecha | ✅ | — | `bitacora_entries` | propia | ⚠️ enterrado (1.2) | ✅ | — |
| Comunidad: feed | Comunidad | ✅ | — | RLS + `has_full_access` | con acceso | ✅ | ⚠️ | solo 40, sin «ver más» (7.4) |
| Comunidad: publicar/comentar | Comunidad | ✅ | `community-publish-*` (`is_premium`, límites, DeepL) | `community_posts/comments` | con acceso | ✅ | ✅ | `photo_url` sin validar (4.5) |
| Comunidad: directorio/perfiles | Comunidad, Perfil | ✅ | — | RLS | con acceso | ⚠️ «Directorio» doble (1.1) | ⚠️ | 200/500 en el navegador (14.3); URLs de imagen libres (4.4) |
| Comunidad: seguir / descubrir | Comunidad | ✅ | — | RLS | con acceso | ✅ | ✅ | relaciones consultables (4.2) |
| Comunidad: reportar | Comunidad | ✅ | — | `community_reports` | con acceso | ✅ | 🔴 | **nadie lee los reportes** (4.8) |
| Fotos de Comunidad | Comunidad | ✅ | — | bucket público | con acceso (API) | — | ⚠️ | públicas por enlace (4.3) |
| Desbloquear: flores + monto | Desbloquear | ✅ | — | `create_support_claim` | confirmada | ✅ | ✅ | — |
| Enviar TXID | Desbloquear | ✅ | `support-claims` (verify) | `submit_support_claim_tx` | propia | ✅ | ⚠️ | no avisa a la admin (19); tarde = rechazado (8.1) |
| Verificación en Base | panel | ✅ | `support-claims` | `svc_record_claim_check` | admin MFA | ✅ | ✅ | automática apagada (correcto) |
| Aprobar / rechazar | panel | ✅ | `support-claims` | `admin_approve/reject_claim` | admin MFA | ✅ | ✅ | sin plazo de 48 h (8.2) |
| Correo de activación | — | — | `support-claims` (reintento, Resend) | `mail_events` | — | — | ✅ | la app no se entera hasta recargar (9.1) |
| Códigos de regalo: enviar | panel | ✅ | `admin-send-gift-code` | `gift_codes` (huella) | admin MFA | ✅ | ✅ | — |
| Códigos de regalo: canjear | Cuenta | ✅ | — | `redeem_gift_code` | confirmada | ✅ | ✅ | — |
| Dar días / revocar / códigos sueltos | — | 🚧 | — | `admin_grant_days`, `admin_revoke_access`, `admin_create_gift_codes` | admin MFA | SQL Editor | ⚠️ | sin botones; no hay «devolver acceso» (7.7) |
| Panel: Resumen, Usuarios, ficha, CSV, Registro | panel | ✅ | — | `admin_*` | admin MFA | ✅ | ✅ | listas de avisos sin paginar (6.9) |
| Aviso «correos fallidos 24 h» | panel | ✅ | funciones de correo | `mail_events` | admin MFA | ✅ | ✅ | no cubre los correos de Supabase |
| Tarea diaria | — | — | Vercel Cron | `expire_support_claims`, `cron_runs` | `CRON_SECRET` | — | ✅ | **SIN VERIFICAR** que corra en producción |
| Traducción automática + reintento | Comunidad | ✅ | DeepL, `community-retranslate` | tope diario | — | — | ⚠️ | DeepL Free y datos personales (pendiente de pasar a Pro) |
| Formulario de publicidad | modal | ✅ | `/api/ad-inquiry` | — | todos | ✅ | ⚠️ | sin límite de envíos; sin Resend → mailto |
| Términos / Privacidad | pantallas | ✅ | — | — | todos | ✅ | ⚠️ | textos `[PENDIENTE]`; el borrador contradice la base (10.1) |
| Página 404 / enlaces profundos | — | 🚧 | — | — | — | ❌ | 🚧 | (2.2, 3.2) |

---

## 19. Funciones que faltan

**Suposición** = no viene de un requisito escrito, sino de lo que suele necesitar una plataforma así.

**Imprescindibles**
1. **Aviso a la administradora cuando llega un TXID** (correo a hello@ o al menos un número en rojo en el panel, como el de correos fallidos). Sin esto, la promesa de 48 h depende de entrar al panel a mirar. *(Del requisito «verificación en 48 h como máximo».)*
2. **Revisar los reportes de Comunidad** (pestaña en el panel con ocultar o borrar). Hoy un reporte no le llega a nadie. *(Suposición razonable: la función «reportar» ya existe para el público.)*
3. **No perder un aviso con pago enviado al borrar la cuenta**: impedir el borrado mientras haya un aviso en revisión, o conservar el aviso sin datos personales. *(Suposición: hace falta constancia de los pagos recibidos; confirmar con el contador.)*
4. **Camino «pagué después de que venciera la reserva»**: un texto claro con el contacto, y en el panel poder registrar a mano un TXID para una cuenta. *(Del requisito de 72 h.)*
5. **Textos legales finales** (Términos y Privacidad sin `[PENDIENTE]`, y corregido el párrafo del directorio). *(Requisito del propio proyecto.)*
6. **Salir del «Cargando…» si falla el perfil**: botón de reintentar y mensaje. *(Requisito «nunca quedar en un estado roto».)*

**Probablemente necesarias**
7. Botón atrás que funcione y direcciones propias por pantalla (`/seguridad/mascotas`), con página 404 propia. *(Suposición.)*
8. Cabeceras de seguridad (CSP, impedir marcos, `Referrer-Policy`). *(Suposición, buena práctica.)*
9. Que la app se entere sola de una activación o una revocación (consulta al volver a la pestaña o cada pocos minutos). *(Suposición.)*
10. Botones del panel para dar días, revocar y **devolver** el acceso. *(Suposición; hoy existe por SQL.)*
11. «Ver más» en el feed y búsqueda en el servidor para el directorio. *(Suposición, crecimiento.)*
12. «Cambiar contraseña» dentro de Cuenta. *(Suposición.)*
13. Un proyecto de Supabase separado para pruebas (hoy dev y producción comparten la base). *(Suposición, riesgo estructural.)*
14. Copias de seguridad propias antes de cada migración y con calendario. *(Del checklist anterior.)*

**Recomendadas**
15. Partir `main.js` por idioma y minificarlo; llevar el contenido educativo al servidor (para que el bloqueo sea real).
16. Fuentes y banderas alojadas en el propio dominio.
17. DeepL Pro antes de abrir al público (decisión ya tomada).
18. Plazos de conservación y limpieza de registros (`admin_audit_log`, `mail_events`, intentos).
19. Plan B para los correos de Supabase (Auth Hook «Send Email» con nuestro envío con reintento).

**Opcionales**
20. Verificación en dos pasos para miembros y lista de sesiones abiertas.
21. Notificaciones (nuevo seguidor, comentario).
22. Estadísticas de uso respetuosas con la privacidad.

---

## 20. Viabilidad (de 1 a 10)

| Aspecto | Nota | Por qué |
|---|---|---|
| Técnica | **6** | La parte nueva (base, reglas, funciones, pruebas) es sólida y está probada; el frente es un único archivo enorme sin compilar. |
| Funcional | **7** | Los flujos principales funcionan de punta a punta en la simulación; faltan avisos a la admin, moderación y casos límite de pago. |
| Experiencia de usuario | **5** | Textos claros en 4 idiomas, pero sin botón atrás ni enlaces, una primera carga muy lenta y funciones escondidas. |
| Seguridad | **6** | Datos personales bien protegidos en la base y sin secretos expuestos; sin cabeceras de seguridad, contenido de pago público e imágenes externas libres. |
| Base de datos | **7** | Bien normalizada, con transacciones, reversas y precheck; cascada peligrosa en avisos, columnas heredadas y registros sin limpieza. |
| Escalabilidad | **4** | Límites de correos, de DeepL y de la red Base, directorio y feed en el navegador, revisión 100 % manual y 3 MB de JavaScript. |
| Mantenimiento | **4** | 9.700 líneas en un archivo, reglas de acceso en tres sitios y lógica vieja mezclada; lo compensan las pruebas automáticas. |
| Capacidad de crecer | **5** | Se puede crecer, pero antes conviene separar el frente en módulos y pasar el contenido al servidor. |

---

## 21. Informe final

### A) Resumen ejecutivo
La plataforma está **lista para un lanzamiento controlado** si se siguen el orden y la lista de `docs/lanzamiento-produccion.md`.
La base de datos, las reglas de acceso, los avisos de aporte, los códigos de regalo, el panel y los correos están bien
construidos y probados (17 pruebas, 613 comprobaciones). **No encontré ningún fallo que exponga datos personales de otras
personas.** Los riesgos están en otros cuatro sitios: (1) la puesta en marcha, porque la base es compartida y la web
depende del SQL; (2) **procesos alrededor del dinero**: nadie avisa de un TXID nuevo, un pago tardío no tiene camino y
borrar la cuenta borra el aviso; (3) **la experiencia en móvil**: sin botón atrás y una primera carga muy pesada; y (4)
**protecciones que faltan**: cabeceras, captcha y hook, contenido de pago público y moderación.

### B) Arquitectura
Web estática en Vercel (un `index.html` con todo el contenido y un `main.js` de 3 MB) + módulos (`src/`) para cuenta,
Comunidad, Desbloquear y panel; Supabase (Auth, Postgres con RLS, Storage, Edge Functions); servicios externos: SMTP de
Hostinger, Resend opcional, DeepL, red Base y Vercel Cron. Detalle y dependencias: ronda 2, punto 11.

### C) Navegación
Pestañas y «Más ▾» claras en escritorio y móvil, pero: sin botón atrás, sin enlaces profundos, logo sin acción, «Directorio»
y «Diagnóstico» repetidos, y Bitácora y Seguridad escondidas (ronda 1, puntos 1 y 2).

### D) Qué funciona de verdad (comprobado en simulación)
Registro, confirmación y 24 h; enlaces caducados; recuperar contraseña; cambio y corrección de correo con límites;
bloqueo por estado; Desbloquear con monto único exacto, QR y TXID; comprobaciones en Base; aprobar y rechazar con motivo;
regalos (envío, canje, límites, bloqueo); panel con MFA (Resumen, Usuarios, ficha anotada, CSV seguro, Registro, correos
fallidos); Comunidad cerrada en el servidor; borrar cuenta; 4 idiomas en vivo y tras recargar; compilación de producción
sin la vista previa de dev.

### E) Problemas críticos primero
1. 🔴 **Publicar la web antes del SQL** rompe acceso, aportes y panel (7.1). Lo controla el orden del lanzamiento.
2. 🔴 **Base compartida entre dev y producción** (11): cualquier prueba con la base afecta a producción.
3. 🟠 **Nadie avisa de un TXID nuevo** y no hay plazo de 48 h (8.2, 19.1).
4. 🟠 **Borrar la cuenta borra avisos con pago enviado** (6.1).
5. 🟠 **Pago después de 72 h sin camino** (8.1).
6. 🟠 **«Cargando…» sin salida** si falla el perfil (12.1).
7. 🟠 **Sin cabeceras de seguridad** (13.1).
8. 🟠 **Botón atrás saca de la web** y no hay enlaces profundos (2.1, 2.2).
9. 🟠 **3 MB de JavaScript** en la primera visita (14.1).
10. 🟠 **El borrador de privacidad contradice la base** sobre el directorio (10.1).
11. 🟠 **La dirección USDC en dos sitios** sin control de que coincidan (7.2), y publicada con el merge antes de la prueba de $5.

### F) Flujos rotos o incompletos
Moderación de reportes (no existe); pago tardío; revisión sin aviso ni plazo; activación sin reflejo inmediato; cambio de
contraseña con sesión; dar días, revocar y devolver acceso solo por SQL; feed sin «ver más»; 404 y enlaces profundos.

### G) Seguridad
Bien: RLS en todo, admin con MFA dentro de la base, sin secretos expuestos, sin XSS encontrado, CSV seguro, funciones sin
JWT protegidas (secreto o contraseña con límites). A mejorar: CSP y marcos, contenido de pago público, URLs de imagen
libres, fotos públicas por enlace, relaciones de seguimiento consultables, `community-translate` sin uso, captcha y hook,
terceros que reciben la IP de cada visita (ronda 3, punto 13).

### H) Base de datos
22 tablas bien relacionadas con cascadas coherentes, salvo la de avisos (6.1). Reportes sin clave, nombre visible y correo
duplicados, columnas heredadas del modelo de tarjeta, registros sin limpieza, índices suficientes para hoy (ronda 2, punto 6).

### I) Escalabilidad
Con 1.000 o más personas fallarían antes que nada: el límite de correos de Supabase, la cuota de DeepL Free, la revisión
manual de avisos, el directorio y el feed en el navegador, y el peso de la primera visita (ronda 3, punto 14).

### J) Funciones que faltan
Ver el punto 19 (6 imprescindibles, 8 probablemente necesarias, 5 recomendadas, 3 opcionales).

### K) Arquitectura recomendada (a medio plazo)
1. **Dos proyectos de Supabase** (pruebas y producción) y migraciones que se aplican primero en pruebas.
2. **El frente pasa por Vite entero**: `main.js` partido en módulos (navegación, acceso, Comunidad, calculadoras) y los
   textos en un archivo por idioma, cargando solo el elegido; minificado y con huella en el nombre.
3. **Rutas reales** (`/cultivo/cosecha`, `/desbloquear`…) con `history.pushState` y una página 404 propia.
4. **Contenido educativo servido por el servidor** a quien tiene acceso (una función o una tabla con RLS), para que el
   bloqueo deje de ser visual.
5. **Una sola regla de acceso**: la de la base (`is_premium`), que la app consulta (`has_full_access`) en vez de recalcular.
6. **Panel con notificaciones** (TXID nuevo, avisos de más de 24 h, reportes, correos fallidos) y con las acciones que hoy
   son SQL.
7. **Cabeceras de seguridad** en `vercel.json` y recursos propios (fuentes, banderas).

### L) Plan de acción por prioridad

**Arreglar ya (antes o junto con el lanzamiento)**
1. Confirmar la prueba de $5 antes del merge (la dirección se publica).
2. Seguir el orden del lanzamiento; subir el límite de correos de Supabase; activar el hook al final; decidir sobre el captcha.
3. Aviso a la admin cuando llega un TXID (correo o señal en el panel).
4. No borrar avisos en revisión al borrar la cuenta (o impedir ese borrado mientras tanto).
5. Botón «reintentar» si falla la carga del perfil.
6. Cabeceras de seguridad básicas (`frame-ancestors`, `Referrer-Policy`, `X-Content-Type-Options`); CSP en modo «solo informar» primero.
7. Corregir el párrafo del directorio en el borrador de privacidad.
8. Igualar `computeIsPremium()` con `is_premium()` (cuentas heredadas `active` sin fecha).

**Arreglar después (primeras semanas)**
9. Moderación de reportes en el panel.
10. Camino para pagos tardíos y registro manual de TXID en el panel.
11. Botón atrás y enlaces profundos; página 404.
12. Botones de panel para dar días, revocar y devolver acceso.
13. Que la app consulte el estado al volver a la pestaña.
14. Bitácora: decidir si sin acceso se puede escribir (y alinear base y pantalla).
15. Validar `photo_url`, `avatar_url` y `cover_photo_url` (solo direcciones del bucket propio).
16. Borrar `community-translate` del proyecto de Supabase.
17. Fotos de Comunidad en un bucket privado con enlaces firmados (3b).

**Mejorar**
18. «Ver más» en el feed; búsqueda del directorio en el servidor.
19. «Cambiar contraseña» en Cuenta; «Directorio» y «Diagnóstico» con nombres distintos; logo hacia Inicio.
20. Fuentes y banderas alojadas en el dominio; DeepL Pro.

**Optimizar más adelante**
21. Partir y minificar `main.js` por idioma; contenido al servidor; quitar la lógica «Premium» vieja.
22. Proyecto de Supabase de pruebas; copias programadas; limpieza de registros.

**Opcional**
23. MFA para miembros, notificaciones, estadísticas.

### Pruebas reales que tienes que hacer tú (en español sencillo)
1. **Antes del merge**: en Supabase, ejecutar el precheck y mirar que todas las filas digan `ok`. Si alguna no lo dice, no seguir.
2. Después del SQL, mirar en Supabase si hay cuentas con estado `active` y sin fecha de fin (te doy la consulta de solo lectura si la quieres).
3. Con una cuenta de prueba **nueva**: registrarte, recibir el correo (mirar en spam), abrir el enlace **en el móvil** y comprobar que empiezan las 24 h.
4. Abrir **otra vez** ese mismo enlace: debe decir «Este enlace ya no sirve».
5. Con una cuenta de prueba **sin confirmar**: «Corrígelo» con una contraseña **equivocada** → debe decir «La contraseña no coincide».
6. «¿Olvidaste tu contraseña?» con la cuenta de prueba: llega el correo, eliges otra contraseña y entras.
7. Reservar 1 flor, enviar un TXID de prueba y comprobar que aparece en el panel. (Hoy **nadie te avisa**: tienes que entrar a mirar.)
8. En el panel, aprobar ese aviso y comprobar que llega el correo de activación. En la app de esa cuenta, **recargar** y ver el acceso.
9. Enviar un código de regalo a un Gmail tuyo, canjearlo con otra cuenta de prueba y ver los 7 días en «Tu acceso».
10. Publicar algo en Comunidad con la cuenta de prueba en sus 24 h; dejar que venza y comprobar que ya no puede publicar.
11. En el móvil, navegar a Cultivo → Cosecha y pulsar «atrás» del teléfono: hoy **sale de la web** (esperado, por arreglar).
12. Medir la primera visita en el móvil con datos (no wifi) y en una ventana privada: anotar cuántos segundos tarda.
13. Al día siguiente: `select * from public.cron_runs order by started_at desc limit 3;` → `ok = true`.
14. Mirar en Supabase → Edge Functions si sigue existiendo `community-translate` (si existe, decirme).
15. Borrar la cuenta de prueba desde Cuenta y comprobar que ya no aparece en el panel.
