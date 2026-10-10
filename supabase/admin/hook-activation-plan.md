# Activar el hook "Before User Created" (al final)

El hook bloquea registros con dominios desechables y un segundo registro con
el mismo Gmail normalizado. Se activa **al final**, cuando todo lo demás ya
está en producción. Si algo falla, se desactiva con un interruptor y los
registros vuelven a funcionar al instante.

## Antes de empezar (comprobaciones de solo lectura)

1. La migración `20261010120000_access_support_model.sql` está aplicada.
2. Las 7 partes de la lista están cargadas. Debe dar **9222**:
   ```sql
   select count(*) from public.blocked_email_domains;
   ```
3. Authentication → "Confirm email" está **activado**.
4. Tienes a mano un correo de prueba nuevo, que nunca se registró en Mother
   Verde (por ejemplo, un alias de un correo que controlas en otro proveedor).

## Activar

Authentication → Hooks → **Before User Created** → tipo **Postgres** →
schema `public` → función `hook_before_user_created` → Guardar.

## Probar (en este orden, en una ventana de incógnito)

| # | Qué hacer | Resultado esperado |
|---|---|---|
| 1 | Crear cuenta con `prueba@mailinator.com` | **Rechazado.** La app muestra el aviso genérico; no se crea ninguna cuenta. |
| 2 | Crear cuenta con una variante de un Gmail que ya tiene cuenta, p. ej. `bertha.limo+prueba@gmail.com` | **Rechazado** (mismo Gmail normalizado). No se crea nada. |
| 3 | Crear cuenta con el **correo de prueba nuevo** | **Aceptado.** Llega el correo de confirmación. |
| 4 | Antes de confirmar, comprobar el perfil (consulta de abajo) | `subscription_status = 'none'`, sin fechas de prueba. |
| 5 | Confirmar el correo desde el enlace recibido | — |
| 6 | Volver a comprobar el perfil | `trialing`, `trial_ends_at` = confirmación + 24 h exactas. |
| 7 | Entrar en la app con esa cuenta | Acceso completo y franja con el tiempo restante. |
| 8 | Borrar la cuenta de prueba desde Cuenta → "Eliminar mi cuenta" | Borrada; la consulta de abajo ya no devuelve filas. |

Consulta de solo lectura para los pasos 4, 6 y 8 (cambia el correo):
```sql
select u.email, u.email_confirmed_at, p.subscription_status, p.trial_started_at,
       p.trial_ends_at, p.trial_eligible, p.email_normalized
from auth.users u join public.profiles p on p.id = u.id
where u.email = 'CORREO-DE-PRUEBA';
```

## Si algo sale mal

- **Nadie puede registrarse** (también con correos normales): desactiva el
  hook en Authentication → Hooks. Los registros vuelven a funcionar al
  momento; no hace falta tocar SQL.
- **Se bloqueó un dominio legítimo:** bórralo de la lista:
  ```sql
  delete from public.blocked_email_domains where domain = 'dominio.com';
  ```
- **Hay que deshacer toda la migración:** primero desactiva el hook, y luego
  pega `supabase/admin/rollback-20261010120000.sql`.

## Límites honestos

- Quien use correos nuevos y reales (otro proveedor, otro Gmail distinto)
  puede repetir la prueba de 24 h. Es un riesgo aceptado.
- La lista de desechables es pública y no está completa; aparecen dominios
  nuevos cada semana.
- La normalización solo une variantes de **Gmail** (puntos y `+alias`).
  Otros proveedores con alias no se unen.
- Si una persona borra su cuenta, su correo normalizado se borra con ella, y
  podría registrarse de nuevo y recibir otra prueba.
