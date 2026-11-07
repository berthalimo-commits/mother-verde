-- STAGING · paso 6 · comprobación de SOLO LECTURA (no cambia nada).
-- Pegar en el SQL Editor de staging DESPUÉS de paso6-proposito.sql. Cada fila debe decir «ok».
select 'columna purpose_accepted_at (solo la fecha de aceptación)' as que,
       case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'support_claims' and column_name = 'purpose_accepted_at' and data_type like 'timestamp%') then 'ok' else 'FALTA' end as resultado
union all
select 'la persona puede leer su propia aceptación',
       case when has_column_privilege('authenticated', 'public.support_claims', 'purpose_accepted_at', 'select') then 'ok' else 'REVISAR' end
union all
select 'reservar con casilla: create_support_claim(flores, casilla) para cuentas con sesión',
       case when to_regprocedure('public.create_support_claim(integer, boolean)') is not null
             and has_function_privilege('authenticated', 'public.create_support_claim(integer, boolean)', 'execute')
             and not has_function_privilege('anon', 'public.create_support_claim(integer, boolean)', 'execute') then 'ok' else 'REVISAR' end
union all
select 'el navegador ya no puede reservar sin la casilla (función de 1 argumento cerrada)',
       case when not has_function_privilege('authenticated', 'public.create_support_claim(integer)', 'execute') then 'ok' else 'REVISAR' end
union all
select 'regla de registro: correo repetido -> account_exists',
       case when pg_get_functiondef('public.hook_before_user_created(jsonb)'::regprocedure) like '%account_exists%' then 'ok' else 'REVISAR' end
union all
select 'regla de registro: dominio desechable -> signup_not_allowed',
       case when pg_get_functiondef('public.hook_before_user_created(jsonb)'::regprocedure) like '%signup_not_allowed%' then 'ok' else 'REVISAR' end
union all
select 'la regla de registro sigue siendo solo para Supabase Auth',
       case when has_function_privilege('supabase_auth_admin', 'public.hook_before_user_created(jsonb)', 'execute')
             and not has_function_privilege('authenticated', 'public.hook_before_user_created(jsonb)', 'execute') then 'ok' else 'REVISAR' end;
