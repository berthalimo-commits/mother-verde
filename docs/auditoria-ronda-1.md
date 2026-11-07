# Auditoría de la plataforma — Ronda 1 de 4

Fecha: 13 de octubre de 2026 · Rama: `dev` (commit `7dc4369`) · **Solo lectura**: no se cambió código, base ni configuración.
Cómo se revisó: lectura del código (`index.html`, `public/main.js`, `src/*.js`, `panel-mv.html`, migraciones, Edge Functions)
y una copia de la base en el simulador (PGlite con todas las migraciones) para leer las reglas reales (RLS, permisos,
funciones). Lo que solo se puede comprobar en el Supabase o el Vercel reales está marcado **SIN VERIFICAR**.

Prioridades: 🔴 P0 crítico · 🟠 P1 alto · 🟡 P2 medio · 🔵 P3 bajo · ⚪ P4 opcional.

---

## 1. Arquitectura de la información

### Mapa jerárquico (una sola página: `index.html`, 3.802 líneas, 20 pantallas)

```
Pregunta de edad (modal, siempre primero)
Cabecera: logo · Buscar (modal) · icono de cuenta · idioma ES/EN/DE/FR
Pestañas: Inicio · Cultivo · Elaboración · Legal · Ciencia · Más ▾
│
├─ Inicio (home): tarjetas a Cultivo, Elaboración, Legal, Negocio, Desbloquear
├─ Cultivo (12 sub): Sistemas · Métodos · Iluminación · Sustrato · Entrenamiento · Diagnóstico ·
│                    Genética · Ciclo · Cosecha (incluye el registro de tricomas) · Propagación · Ambiental · Equipo
├─ Elaboración (7 sub): Procesos · Concentrados · Tinturas · Vapes · Comestibles · Skincare · Etiquetado
├─ Legal: mapa/listado de países → Ficha de país (pantalla «detail»)
├─ Ciencia (7 sub): Papers · Científicos · Médico (selector de condiciones) · Cannabinoides menores ·
│                   Terpenos · Mitos · Sistema endocannabinoide
├─ Más ▾
│   ├─ Comunidad (feed, directorio de miembros, «Descubrir», publicar, comentarios)
│   │     └─ Perfil (propio o de otra persona)
│   ├─ Seguridad (10 sub): Mascotas · Interacciones · Manejo · Embarazo · Salud femenina · Salud mental ·
│   │                      Ocupacional · Deporte · Mayores · Corazón  (+ recuadro Emergencia)
│   ├─ Historia global · Glosario · Calculadoras · Bitácora de cultivo · Variedades · Negocio
│   │                                         (Negocio: Licencias · Trazabilidad · Directorio · Carreras · Educación · Plantillas)
├─ Cuenta (icono de cuenta si no hay sesión): entrar/crear cuenta, olvidé la contraseña, «Tu acceso»,
│   código de regalo, datos, correo de inicio de sesión, idioma, eliminar cuenta, Legal
├─ Acceso (pantalla de bloqueo / entrada / «confirma tu correo»)
├─ Desbloquear (flores, monto exacto, QR, aviso con TXID)
├─ Términos · Privacidad
Modales: edad · búsqueda · recorte de avatar · solicitud de publicidad
Aparte: /panel-mv.html (panel de administración, sin enlace)
```

### Hallazgos

| # | Prioridad | Hallazgo |
|---|---|---|
| 1.1 | 🟠 P1 | **«Directorio» significa dos cosas**: Negocio → Directorio (proveedores) y el directorio de miembros de Comunidad. **«Diagnóstico» también**: Cultivo → Diagnóstico (problemas de la planta) y un tipo de publicación de Comunidad. Ya estaba en la auditoría de octubre y sigue abierto. |
| 1.2 | 🟡 P2 | **Funciones enterradas**: la Bitácora (una de las pocas cosas que se conservan sin acceso) está dentro de «Más ▾». El registro de tricomas está en Cultivo → Cosecha y no en la Bitácora, aunque se guarda en la misma tabla (`bitacora_entries`). |
| 1.3 | 🟡 P2 | «Más ▾» mezcla cosas muy distintas (Comunidad, Seguridad, Calculadoras, Negocio). Seguridad, que es gratis y se muestra a quien no tiene acceso, queda escondida en un menú. |
| 1.4 | 🟡 P2 | **Dos «cuentas»**: el icono de persona abre **Perfil** (identidad pública de Comunidad) si hay sesión, y **Cuenta** (ajustes privados) si no. A quien no tiene acceso, Perfil se le cambia en silencio por Cuenta. El regalo y «Tu acceso» están en Cuenta, y desde Perfil solo se llega por el botón «Configuración de cuenta». |
| 1.5 | 🔵 P3 | La pantalla «detail» (ficha de país) no tiene entrada propia y depende de Legal (correcto), pero no tiene dirección web: no se puede compartir ni guardar. |
| 1.6 | 🔵 P3 | Inicio no lleva a Ciencia, Seguridad ni Comunidad con tarjetas propias (solo a Cultivo, Elaboración, Legal y Negocio). |
| 1.7 | ⚪ P4 | La cabecera conserva el texto «Codex global · cannabis medicinal & recreacional»; revisar si encaja con el modelo de aporte y la imagen pública. |
| 1.8 | 🟡 P2 | **Huérfanas o sin salida**: ninguna pantalla queda sin salida (todas tienen «← Volver» o pestañas). Pero «acceso» y «desbloquear» solo se abren con JavaScript y no tienen dirección propia. Sin páginas duplicadas. |

---

## 2. Navegación

| # | Prioridad | Hallazgo |
|---|---|---|
| 2.1 | 🟠 P1 | **El botón «atrás» del navegador o del móvil saca a la persona de la web.** La app cambia de pantalla sin tocar la dirección (`showScreen` no usa `history.pushState` y nada escucha `popstate`). En Android el gesto de volver cierra Mother Verde, aunque la persona esté tres pantallas adentro. |
| 2.2 | 🟠 P1 | **No hay enlaces profundos**: todas las pantallas viven en `/`. No se puede enviar un enlace a «Seguridad → Mascotas», a una ficha de país ni a Desbloquear. Los correos solo pueden llevar a la página de inicio. Tampoco se puede recargar y seguir en la misma pantalla. |
| 2.3 | 🟡 P2 | **El logo no lleva a Inicio** (`.brand` no tiene acción). Ya figuraba en la auditoría de octubre y sigue abierto. |
| 2.4 | 🟡 P2 | Con la cuenta bloqueada, cualquier pestaña (Cultivo, Ciencia…) **cambia en silencio** a la pantalla de acceso. Además, la pestaña tocada no queda marcada, y la persona no sabe si tocó mal o si está bloqueada. El mensaje existe, pero no dice «esta sección necesita acceso completo». |
| 2.5 | 🔵 P3 | Los resultados de búsqueda que llevan a contenido bloqueado terminan en la pantalla de acceso, sin explicar por qué. **SIN VERIFICAR** en navegador con cuenta bloqueada. |
| 2.6 | 🔵 P3 | Enlaces externos: las fuentes científicas abren en otra pestaña con `rel="noopener noreferrer"` (correcto). No se comprobó cuántos siguen vivos en esta ronda (en septiembre había páginas que bloqueaban robots). **SIN VERIFICAR**. |
| 2.7 | 🔵 P3 | Móvil: las pestañas y «Más ▾» funcionan con toque. El selector de idioma y el icono de cuenta comparten fila con «Buscar», que es estrecha. Las capturas de esta sesión (390 px) no muestran desbordes. |
| 2.8 | ⚪ P4 | «Volver a Inicio» siempre lleva a Inicio, no a la pantalla anterior. Es coherente, pero en las subsecciones profundas la persona pierde el contexto. |

---

## 3. Rutas

| Ruta | Qué es | Protección | Observación |
|---|---|---|---|
| `/` (`index.html`) | toda la app | pública; el bloqueo de contenido es **visual** | el contenido educativo viaja completo en `index.html`/`main.js` |
| `/panel-mv.html` | panel de administración | pública como página; los datos exigen admin + MFA en la base | `noindex`; sin enlace; correcto |
| `/panel-mv.html?demo=1` | panel de ejemplo | solo existe en compilaciones de dev | comprobado: la compilación de `main` no lo incluye |
| `/api/subscription-cron` | tarea diaria (Vercel) | `CRON_SECRET` | nombre obsoleto («subscription») |
| `/api/ad-inquiry` | formulario de publicidad | ninguna | sin límite de envíos; sin `RESEND_API_KEY` responde 503 y ofrece mailto |
| `/main.js`, `/style.css`, `/service-worker.js`, `/manifest.webmanifest`, `/icons/*`, `/downloads/*` | archivos estáticos | públicos | `main.js` sin minificar (3 MB) |
| Enlaces de correo | vuelven a `/` con `#access_token…` o `#error…` | Supabase | ahora se procesan y se limpian (bloque de correos) |
| Cualquier otra ruta | 404 de Vercel | — | **no hay página 404 propia** |

| # | Prioridad | Hallazgo |
|---|---|---|
| 3.1 | 🟠 P1 | **El contenido «de pago» es público por ruta**: cualquiera puede descargar `/main.js` e `index.html` y leer todo lo educativo, o escribir `isPremium = true; applyTier()` en la consola. Está aceptado como «opción A» hasta pasarlo al servidor, pero la web no debe afirmar que está «protegido». |
| 3.2 | 🟡 P2 | **No hay página 404 ni redirecciones propias** (`vercel.json` solo tiene la tarea diaria). `/desbloquear`, `/cuenta` o un enlace viejo terminan en el 404 genérico de Vercel, en inglés. |
| 3.3 | 🔵 P3 | **Nombres de rutas obsoletos**: `api/subscription-cron.js` ya no tiene nada que ver con suscripciones, y `docs/trial-reminder-email.md` se borró. Confunden a quien mantenga el código. |
| 3.4 | 🔵 P3 | **SIN VERIFICAR**: si `motherverdeny.com` (sin www) redirige a `www`. Las sesiones son distintas por dominio (`mother-verde.vercel.app` y `www` no comparten sesión). |
| 3.5 | ⚪ P4 | `/panel-mv.html` se puede encontrar adivinando. No es un riesgo (la base protege los datos), pero se podría servir solo tras iniciar sesión. |

---

## 4. Roles y permisos

Fuente: reglas de la base leídas en el simulador después de **todas** las migraciones (RLS, permisos de tabla y columna, funciones).

| Rol | Qué ve (pantalla) | Qué puede hacer de verdad (servidor/base) |
|---|---|---|
| **Visitante** | edad, entrada, Seguridad (Mascotas, Manejo, Emergencia), Desbloquear informativo, Términos, Privacidad, Cuenta (entrar/crear) | nada en la base (todas las tablas devuelven 0 filas a `anon`); `/api/ad-inquiry` |
| **Sin confirmar** | «Confirma tu correo» | nada con sesión; puede llamar a `signup-fix-email` (con su contraseña) |
| **Prueba activa (24 h)** | todo | Comunidad completa (publicar por función, seguir, deslizar, reportar, subir fotos); Bitácora; reservar monto; canjear regalo |
| **Prueba vencida / sin prueba** | bloqueo + Bitácora en solo lectura + PDF, Cuenta, Seguridad parcial, Desbloquear | leer sus propios datos; reservar monto, enviar TXID, canjear regalo, borrar cuenta; **escribir en su Bitácora** (ver 4.1) |
| **Aporte activo (`supporter`)** | todo, sin fecha | como la prueba activa, sin límite de tiempo; no puede reservar otro monto (`already_supporter`) |
| **Acceso por regalo** | todo hasta `access_until` | igual que la prueba activa hasta esa fecha |
| **Aporte rechazado** | bloqueo + aviso «rechazado» | puede reservar otro monto |
| **Revocado** | bloqueo con texto propio | no puede reservar monto (`not_allowed`); un regalo **no** le devuelve el acceso (`revoked` gana) |
| **Admin con MFA (aal2)** | la app según su propio acceso + `/panel-mv.html` | funciones `admin_*`: aprobar/rechazar avisos, regalos, dar días, revocar, listas, CSV, registro. Todas comprueban `is_admin_aal2()` en la base |
| **Admin sin MFA** | panel: pide activar MFA | ninguna función `admin_*` (comprobado en pruebas) |

| # | Prioridad | Hallazgo |
|---|---|---|
| 4.1 | 🟡 P2 | **Bitácora: la pantalla dice «solo lectura», pero la base deja escribir.** Las reglas de `bitacora_entries` solo exigen que la fila sea de la persona, no acceso completo. Una cuenta vencida puede crear, editar y borrar entradas desde la consola. No es una escalada sobre otras personas, pero es una contradicción entre la pantalla y el servidor. |
| 4.2 | 🟡 P2 | **`community_can_view(viewer, owner)` y `community_is_mutual(a, b)` aceptan cualquier par de cuentas** y cualquier cuenta con sesión puede llamarlas. Cualquiera puede saber si dos personas se siguen mutuamente, aunque sin acceso no vea sus publicaciones. Es una filtración de relaciones pequeña. |
| 4.3 | 🟡 P2 | **Las fotos de Comunidad son públicas por enlace**: el «bucket» es público. La regla de lectura con `has_full_access()` solo vale para la API; la dirección directa de la imagen funciona para cualquiera que la tenga, incluso sin sesión. Ya estaba acordado como tarea posterior al lanzamiento (3b). |
| 4.4 | 🟡 P2 | **`avatar_url` y `cover_photo_url` aceptan cualquier dirección** (la persona puede escribirlas directamente). Con eso se pueden mostrar imágenes de otro servidor que registren quién mira el perfil (dirección IP). La foto de portada va dentro de `style="background-image:url('…')"`: escapar el texto no impide romper el CSS (solo apariencia, no ejecuta código). |
| 4.5 | 🔵 P3 | `photo_url` de las publicaciones: la función de publicar acepta **cualquier texto** como dirección de foto (no comprueba que sea del bucket). Mismo riesgo de seguimiento por imagen externa. Ya estaba en la auditoría de octubre. |
| 4.6 | 🔵 P3 | `handle_new_user` y `handle_community_swipe` (funciones de disparador) se pueden llamar como RPC desde `anon`. Postgres lo rechaza («solo como disparador»), así que es inofensivo, pero conviene quitar el permiso. |
| 4.7 | ✅ | Sin escaladas encontradas: `profiles` solo deja cambiar 5 columnas (estado, prueba y fechas **no**). `support_claims` no se puede escribir directamente, solo con funciones que comprueban la cuenta. Las tablas de admin, códigos, registro, configuración, correos e intentos tienen RLS sin reglas (nadie desde el navegador). Publicar y comentar solo por función, con `is_premium`. Las reglas de Comunidad exigen `has_full_access()`. |
| 4.8 | 🔵 P3 | **Moderación ausente**: `community_reports` recibe reportes, pero **ni el panel ni nadie los lee** (no hay pestaña ni función de admin para reportes). Un reporte hoy no llega a ninguna persona. (Ver también ronda 4, funciones que faltan.) |
| 4.9 | 🔵 P3 | La cuenta de la administradora está bloqueada en la app cuando vence su prueba (el panel sigue funcionando). Correcto por diseño, pero incómodo: para ver la web como miembro necesita darse días o acceso completo. |

---

## 5. Autenticación y cuenta

| Flujo | Estado | Observaciones |
|---|---|---|
| Registro | ✅ | correo + contraseña de 8 o más caracteres; idioma guardado; hook contra dominios desechables y Gmail duplicado (se activa al final) |
| Confirmación | ✅ | enlace válido en cualquier navegador; arranca las 24 h por disparador; aviso si caducó o ya se usó |
| Entrar / salir | ✅ | «Correo o contraseña incorrectos»; salir cierra la sesión (Supabase, por defecto en todos los dispositivos: **SIN VERIFICAR**) |
| Olvidé la contraseña | ✅ | nuevo en dev; respuesta neutra; formulario de contraseña nueva |
| Cambiar contraseña (con sesión) | 🚧 | **no existe** fuera del enlace de recuperación (ver 5.2) |
| Cambiar el correo de inicio de sesión | ✅ | nuevo en dev; confirma por enlace (y por el correo viejo si «Secure email change» está activo) |
| Corregir correo mal escrito | ✅ | `signup-fix-email` con límites (reforzado hoy) |
| Sesión y caducidad | ⚠️ | la sesión se guarda en `localStorage` y se renueva sola; ver 5.3 |
| Borrar cuenta | ✅ | contraseña + palabra; servidor; borra fotos, caché de traducción y todo en cascada |
| Editar perfil público | ✅/⚠️ | solo con acceso completo (base); sin acceso, Perfil se cambia por Cuenta |
| Acceso no autorizado | ✅ | la base devuelve 0 filas o error; la app muestra la pantalla de acceso |

| # | Prioridad | Hallazgo |
|---|---|---|
| 5.1 | 🟠 P1 | **Captcha apagado y hook todavía sin activar** al publicar: hasta que se active el hook (último paso) y se pongan las claves de Cloudflare, el registro admite dominios desechables y no tiene captcha. Las 24 h se repiten creando correos nuevos (riesgo ya aceptado, pero el captcha lo reduciría). |
| 5.2 | 🟡 P2 | **No hay «cambiar contraseña» dentro de Cuenta.** Hoy hay que salir y usar «¿Olvidaste tu contraseña?». Funciona, pero no es lo esperado y depende de que llegue el correo. |
| 5.3 | 🟡 P2 | **La sesión vive en `localStorage`**, así que si alguna vez hubiera un fallo XSS, el atacante podría llevársela. Hoy no se encontró ningún XSS (ronda 3), pero tampoco hay CSP que limite el daño (ronda 3, 13.x). |
| 5.4 | 🟡 P2 | **Correo de contacto ≠ correo de inicio de sesión**: Cuenta tiene «Correo de contacto» (`profiles.contact_email`) y ahora también «Correo para iniciar sesión». No se dice para qué sirve el de contacto ni quién lo usa: los correos del sistema van al de inicio de sesión. Puede confundir. |
| 5.5 | 🟡 P2 | **«Confirm email» debe estar activado en Supabase**: si alguien lo apaga, el disparador de las 24 h nunca se dispara (falla cerrado: nadie tiene prueba). **SIN VERIFICAR**: el valor actual en el panel de Supabase. |
| 5.6 | 🔵 P3 | **Hora del dispositivo**: la cuenta atrás y el bloqueo de la pantalla usan la hora del teléfono, pero el servidor usa la suya. Con la hora mal puesta, la pantalla puede mostrar «acceso» mientras el servidor ya rechaza la Comunidad (o al revés). |
| 5.7 | 🔵 P3 | Borrar la cuenta y registrarse otra vez con el mismo correo da **otras 24 h** (riesgo aceptado). El registro de auditoría conserva el correo de las acciones de admin después del borrado (pendiente con el abogado). |
| 5.8 | 🔵 P3 | **SIN VERIFICAR: requiere prueba real**: que Supabase compruebe la contraseña **antes** de decir «correo sin confirmar» (en eso se basa `signup-fix-email`). |
| 5.9 | ⚪ P4 | No hay verificación en dos pasos para miembros (solo para admin), ni lista de sesiones abiertas. |
