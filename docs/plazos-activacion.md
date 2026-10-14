# Plazos de activación: dónde se promete cada uno (A1.4)

Fecha: 14 de octubre de 2026 · Rama `dev` · **Solo revisión: no se cambió ningún texto.**
Texto aprobado: **«hasta 24 horas»**. Busqué en la app, el panel, las funciones del servidor y las 13 plantillas de correo,
en ES/EN/DE/FR, todo texto que prometa horas o días.

## 1. Promesas de plazo de activación (las que importan)

| Dónde | Clave | Qué dice hoy (ES) | Idiomas |
|---|---|---|---|
| Desbloquear, paso 4 (`src/desbloquear.js:247`) | `dsPaso4` | «Revisamos cada aporte **en un máximo de {h} horas** y activamos tu acceso completo.» | ES/EN/DE/FR (`main.js:5807-5810`) |
| Aviso pendiente en Desbloquear (`src/desbloquear.js:178`) | `dsPendingP` | «Lo revisamos **en un máximo de {h} horas**. Te avisaremos por correo cuando tu acceso esté activo.» | ES/EN/DE/FR (`main.js:6266-6269`) |
| Aviso pendiente en la pantalla de acceso (`main.js:6914`) | `dsPendingP` | igual que arriba | ídem |

**De dónde sale {h}:** `src/supportConfig.js:24` → `VERIFY_MAX_HOURS: 48`. Además, `main.js:6914` usa **48** por defecto si
no encuentra ese valor. **Hoy las tres pantallas dicen 48 horas.**

## 2. Contradicciones

1. 🟠 **48 horas en pantalla frente a «hasta 24 horas» aprobado.** El número viene de `VERIFY_MAX_HOURS` y del valor por
   defecto de `main.js:6914`.
2. 🟡 **«En un máximo de» frente a «hasta».** Dicen lo mismo, pero no es la redacción aprobada.
3. 🟡 **Pago tardío y revisión manual: dos mensajes a la vez.**
   - El tardío muestra «Te escribiremos cuando lo revisemos» (`dsTardeOk`, sin plazo) y, justo debajo, «máximo 48 horas».
   - La revisión manual muestra «Lo revisaremos manualmente y te escribiremos» (`dsRevisionManual`) junto al mismo plazo.
4. 🔵 **El panel resalta los avisos de más de 12 h.** Es un margen interno, coherente con 24 h, y no lo ve el público.

## 3. Otros plazos (no son de activación; todos coherentes)

- **Prueba gratis de 24 horas desde la confirmación del correo:** `accConfirmaH/P` (4 idiomas) y la tira de cuenta atrás.
- **Reserva del monto por 72 horas:** se muestra como fecha y hora («reservado hasta…»), no como un número de horas.
- **Códigos de regalo:** 7 días de acceso, canjeables durante 7 días (panel).
- **Demasiados intentos de canje:** «vuelve a intentarlo dentro de 24 horas» (`giftErrTooMany`).
- **Términos 5** (`tc5P`): sigue en `[PENDIENTE]`, y ahí deberá figurar el mismo plazo.
- **Correos** (activación, regalo, plantillas de Supabase): no prometen ningún plazo de activación.

## 4. Propuesta de corrección (para aprobar; no aplicada)

1. `src/supportConfig.js`: `VERIFY_MAX_HOURS: 24`. En `main.js:6914`, el valor por defecto también **24**.
2. Usar la redacción aprobada:

| Clave | ES | EN | DE | FR |
|---|---|---|---|---|
| `dsPaso4` | Pega aquí ese código. Revisamos cada aporte y activamos tu acceso completo en **hasta {h} horas**. | Paste that code here. We check every contribution and turn on your full access within **up to {h} hours**. | Füge diesen Code hier ein. Wir prüfen jeden Beitrag und schalten deinen Vollzugriff in **bis zu {h} Stunden** frei. | Colle ce code ici. Nous vérifions chaque contribution et activons ton accès complet en **jusqu’à {h} heures**. |
| `dsPendingP` | Lo revisamos en **hasta {h} horas**. Te avisaremos por correo cuando tu acceso esté activo. | We check it within **up to {h} hours**. We’ll e-mail you when your access is active. | Wir prüfen ihn in **bis zu {h} Stunden**. Wir schreiben dir eine E-Mail, sobald dein Zugang aktiv ist. | Nous la vérifions en **jusqu’à {h} heures**. Nous t’écrirons par e-mail quand ton accès sera actif. |

3. Pago tardío y revisión manual: mostrar **un solo mensaje**. Dos opciones:
   - **(a) Mismo plazo para todo** (recomendada si puedes cumplirla): en revisión manual, quitar la frase propia y dejar
     solo «Lo revisamos en hasta 24 horas…».
   - **(b) Sin plazo cuando la revisión es manual:** en tardíos y en revisión manual, ocultar `dsPendingP` y dejar solo
     «Lo revisaremos manualmente y te escribiremos». Así no se promete un plazo que un conflicto podría no permitir cumplir.

Dime **1 + 2** y **(a) o (b)**, y lo aplico con su prueba.
