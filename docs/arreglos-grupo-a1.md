# Arreglos de la auditoría — Grupo A1: dinero y acceso

Todo en `dev`. Nada en producción. Cada paso tiene su commit, su migración (si toca la base), su reversa y su prueba.

## Paso 1 — Borrar una cuenta con avisos de aporte
**Decisión:** al borrar una cuenta, los avisos **sin TXID** (solo un monto reservado) se borran como antes; los avisos
**con TXID** se conservan como constancia del pago, separados de la persona: `user_id`, nombre y teléfono pasan a vacío y
se anota `account_deleted_at`. Quedan TXID, monto, flores, fechas, estado y revisión. El correo nunca estuvo en el aviso.
- Panel: el aviso aparece con **«Cuenta borrada»** y una explicación; se puede **aprobar** (queda «pago recibido», sin
  cuenta que activar ni correo que enviar) o **rechazar**. El CSV pone «cuenta borrada» en la columna del correo.
- La base impide un aviso sin cuenta que no esté marcado como borrado.
- Migración `20261014100000_claims_survive_account_deletion.sql` · reversa `rollback-20261014100000.sql`
  (**borra** esos avisos anónimos: exportarlos antes) · prueba `tests/sim/a1-money.mjs` (11 comprobaciones).
- Política de privacidad (borrador, sección 7): explicado, con `[PENDIENTE: revisión de abogada]` sobre la base legal y el plazo.

## Paso 2 — Pago tardío (la reserva de 72 h venció)
**Antes:** si la reserva vencía, la app solo decía «escríbenos a hello@… con el código»; el TXID no se podía registrar.
**Ahora:** con la reserva vencida (marcada o aún sin marcar) y sin TXID, la pantalla Desbloquear muestra
**«¿Ya enviaste el pago?»** con un campo para el TXID. Ese aviso:
- pasa **siempre** a revisión manual con motivo `reserva_vencida` y la marca `late = true`; nunca se activa solo, aunque la
  verificación automática esté encendida; aprobarlo exige un motivo escrito en el panel;
- puede tener el mismo monto que una reserva nueva de otra persona (los tardíos quedan fuera de la regla «un aviso abierto
  por monto»); el TXID sigue siendo único;
- si la persona tiene otra reserva nueva sin pagar, esa se cancela; si ya tiene otro aviso en revisión, se responde
  `claim_in_review` («Ya tienes otro aviso en revisión…») y no se toca nada.
- Textos en es/en/de/fr. El panel muestra el motivo `reserva_vencida` como los demás códigos.
- Migración `20261014110000_late_payment.sql` · reversa `rollback-20261014110000.sql` (si hay un tardío abierto con el mismo
  monto que otro aviso abierto, cerrarlo antes) · prueba `tests/sim/a1-money.mjs` (ahora 21 comprobaciones); la prueba
  vieja «solicitud vencida -> no acepta código» de `test-part2.mjs` se cambió a la regla nueva.

## Paso 2b — El agujero del pago tardío, cerrado (Prioritario 1)
Ver `docs/prioritario-1.md`: comprobación en Base antes de guardar, conflictos que solo ve el panel, sin activación
con conflicto abierto, historial de motivos. Migración `20261014120000`.

## Paso 3 — Aviso cuando llega un TXID nuevo
Un correo corto en español a soporte (`NOTIFY_TO`, por defecto hello@) con número de aviso, monto, estado y enlace
al panel, sin datos personales y uno solo por aviso. Si falla, el aviso se guarda igual y el fallo sale en «Correos
fallidos». Panel: «Avisos sin revisar» arriba de todas las pestañas y resaltado de los que esperan más de 12 h.
Migración `20261014130000` (contador).

## Paso 4 — Un solo plazo
Solo revisión, sin cambios: `docs/plazos-activacion.md`. Hoy las pantallas dicen 48 h frente al texto aprobado
«hasta 24 horas»; la corrección propuesta está ahí, a la espera de tu aprobación.

## Paso 5 — Regla de acceso única
`access_info(uid)` en la base es el único sitio donde vive la regla. La leen `is_premium`/`has_full_access` (RLS
y funciones), el panel y la app (`my_access()`). La app solo compara «hasta cuándo» con la hora del servidor. Da los
mismos resultados que antes en las 432 combinaciones probadas. Las cuentas «active» sin fecha no se tocan; para verlas,
el SQL de solo lectura `supabase/admin/legacy-active-accounts.sql`. Migración `20261014140000`.

## Paso 6 — Activación en vivo
Al volver a la pestaña y cada 60 s en la pantalla de bloqueo o en Desbloquear. Como mucho una consulta cada 30 s y
ninguna con la pestaña oculta. Si una consulta falla, se queda con la última respuesta.
