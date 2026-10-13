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
