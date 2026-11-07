# Prioritario 1: informe breve

Fecha: 14 de octubre de 2026 · Rama `dev` · Nada en producción, sin merge. No se tocaron las cuentas Betian ni Mother Verde.
Origen: `docs/auditoria-verificacion.md` (hallazgos N1, N2, N7 y N8).

| Paso | Commit | Qué cambió |
|---|---|---|
| 1. Agujero del pago tardío (N1) | `75192a8` | El TXID tardío solo entra por la función `support-claims` (`submit_late`). Antes de guardar nada, comprueba en Base que sea USDC, a nuestra dirección y por **exactamente** el monto de la reserva vencida **propia**. Un TXID que ya está en otro aviso ya no da «ya usado»: crea un **conflicto** que solo ve el panel, y a la persona se le dice «Lo revisaremos manualmente». Ningún aviso con un conflicto abierto se activa, ni sola ni desde el panel, hasta que la admin lo resuelve con un motivo escrito (queda en el registro de auditoría). |
| 2. Panel (N2) | `d7c8bea` | Marca «Pago tardío / reserva vencida» y «Conflicto abierto». Historial de motivos por aviso: «Comprobar en Base» suma, nunca borra. Recuadro «Conflictos por resolver» con los dos avisos lado a lado y botones «El pago es del aviso #…», con motivo obligatorio. |
| 3. Privacidad de la app (N7) | `7dc7f16` | La pantalla dice solo lo que hace el código (navegador, cuenta en Supabase, aportes y cadena de bloques, proveedores, quién ve qué, opciones, 18+). Lo legal queda visible como `[PENDIENTE: revisión de abogada]`. El borrador de `docs/` ya no dice que el directorio sea público. |
| 4. Comunidad (N8) | `d95ab25` | Sin «próximamente», «plan de construcción» ni «verificados». Se ve con acceso completo y las fotos están en un almacenamiento público. Las preguntas sí se pueden responder. Se quitó «próximamente» de la tarjeta de Inicio y se borraron dos textos del modelo viejo. |
| 5. Documentos | (este) | `docs/lanzamiento-produccion.md` (orden, reversa, función que va junto), `docs/staging.md` y el precheck (`support_claim_conflicts`, `support_claims.review_history`). |

## Base de datos
- **Migración:** `20261014120000_late_payment_conflicts.sql`, después de `20261014110000`.
- **Reversa:** `rollback-20261014120000.sql`. Se pierden la lista de conflictos y el historial; antes conviene exportarlos.
- **Va junto con** la versión nueva de la función `support-claims`. Sin ella, el formulario de pago tardío no funciona.

## Ataques simulados (`tests/sim/a1-money.mjs`)
- **El ladrón registra el TXID de la víctima ANTES que ella.** Él recibe una respuesta neutra. La víctima envía su TXID y **no** recibe «ya usado»: su aviso queda en revisión. Se abren dos conflictos (mismo monto y mismo TXID) y nadie recibe acceso. El panel no deja activar mientras el conflicto esté abierto. Al resolverlo a favor de la víctima, ella recibe el TXID y se activa; el ladrón queda rechazado.
- **El ladrón llega DESPUÉS de la dueña.** Respuesta neutra y conflicto. Con la verificación automática encendida, el aviso en conflicto **no** se activa solo. Se resuelve a favor de la dueña.
- **Otros casos:** un monto distinto al de su reserva, un TXID que no existe en Base, la reserva de otra persona y una reserva todavía vigente se rechazan, con un mensaje y salida clara.
- **Privacidad entre las dos personas:** ninguna ve la palabra «conflicto» ni el aviso de la otra, ni en la respuesta ni al leer su propio aviso.

## Pruebas
`test.mjs` 248 · `a1-money` 45 · `fn-e2e` 117 · `panel-conflicts-ui` 10 · `texts-truth` 25 · `screens-scan`, `lang-live`, `app-ui`, `preview-ui` sin fallos. La ejecución completa va en el resumen del bloque 2.

## Lo que queda para ti
- Revisar con la abogada todo lo marcado `[PENDIENTE]` en la pantalla de Privacidad.
- Confirmar la región del servidor de Supabase (Settings → General) para escribirla en la política.
