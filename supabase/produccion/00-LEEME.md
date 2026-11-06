# Archivos SQL para el día del lanzamiento (producción)

Generados por `node tools/build-produccion.mjs` a partir de `supabase/migrations/`, `supabase/admin/` y
`supabase/seed-blocked-email-domains/`. **No los edites a mano**: si cambia una migración, vuelve a generarlos.
La prueba `tests/sim/prod-files.mjs` los aplica en este orden sobre un Postgres real y falla si están desactualizados.

Pasos del plan (`docs/plan-migracion.md`): archivo 01 = paso 11 · archivos 02–27 = paso 12 ·
archivos 28–31 = paso 12b (juego) · archivo 32 = paso 13.

**Cómo pegarlos:** Supabase (producción) → SQL Editor → New query → copiar el archivo **entero** → Run. Uno a uno, en
este orden. Los de «SOLO LECTURA» no cambian nada: si alguna fila no dice «ok», **para** y manda la captura.

1. `01-precheck-before-20261010.sql` — Comprobación ANTES de empezar (paso 11): todas las filas «ok». Si no, PARA.
2. `02-20261010120000_access_support_model.sql` — Modelo de acceso: prueba de 24 h, aporte único, regla de registro.
3. `03-dominios-bloqueados-part-01.sql` — Dominios de correo desechable bloqueados, parte 1 de 7.
4. `04-dominios-bloqueados-part-02.sql` — Dominios de correo desechable bloqueados, parte 2 de 7.
5. `05-dominios-bloqueados-part-03.sql` — Dominios de correo desechable bloqueados, parte 3 de 7.
6. `06-dominios-bloqueados-part-04.sql` — Dominios de correo desechable bloqueados, parte 4 de 7.
7. `07-dominios-bloqueados-part-05.sql` — Dominios de correo desechable bloqueados, parte 5 de 7.
8. `08-dominios-bloqueados-part-06.sql` — Dominios de correo desechable bloqueados, parte 6 de 7.
9. `09-dominios-bloqueados-part-07.sql` — Dominios de correo desechable bloqueados, parte 7 de 7.
10. `10-20261010130000_community_full_access.sql` — Plataforma: community full access.
11. `11-20261011100000_admin_and_audit.sql` — Plataforma: admin and audit.
12. `12-20261011120000_support_claims.sql` — Plataforma: support claims.
13. `13-20261011130000_gift_codes_and_access.sql` — Plataforma: gift codes and access.
14. `14-20261013100000_mail_delivery.sql` — Plataforma: mail delivery.
15. `15-20261013110000_mail_failures_panel.sql` — Plataforma: mail failures panel.
16. `16-20261013120000_signup_fix_limits.sql` — Plataforma: signup fix limits.
17. `17-20261014100000_claims_survive_account_deletion.sql` — Plataforma: claims survive account deletion.
18. `18-20261014110000_late_payment.sql` — Plataforma: late payment.
19. `19-20261014120000_late_payment_conflicts.sql` — Plataforma: late payment conflicts.
20. `20-20261014130000_pending_claims_counter.sql` — Plataforma: pending claims counter.
21. `21-20261014140000_one_access_rule.sql` — Plataforma: one access rule.
22. `22-20261020100000_bitacora_read_only_without_access.sql` — Plataforma: bitacora read only without access.
23. `23-20261103100000_manual_contributions.sql` — Aportes manuales (PayPal, Cash App…).
24. `24-20261104100000_purpose_and_signup_message.sql` — Propósito del aporte (casilla) + «Ya tienes cuenta».
25. `25-20261105100000_trial_once_per_person.sql` — Prueba de 24 h una sola vez por persona (huella del correo al borrar la cuenta).
26. `26-20261106100000_gift_codes_7_days.sql` — Códigos de regalo creados desde SQL: 7 días para canjear por defecto.
27. `27-supporters-betian-mother-verde.sql` — Acceso completo para tus dos cuentas. Ejecuta primero solo la PARTE 1 (lectura) y comprueba que salen exactamente esas dos cuentas; después la PARTE 2.
28. `28-precheck-game.sql` — Comprobación ANTES del juego (paso 12b): todas las filas «ok». Si sale FALTA o YA EXISTE, PARA.
29. `29-20261015100000_game_progress.sql` — Juego: partidas guardadas.
30. `30-20261029100000_game_setup.sql` — Juego: equipo de la carpa.
31. `31-20261031100000_game_plants.sql` — Juego: varias plantas y machos.
32. `32-read-only-checks.sql` — Comprobación final (paso 13): todas las filas «ok».
