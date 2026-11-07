-- STAGING · paso 5 · comprobación de SOLO LECTURA (no cambia nada).
-- Pegar en el SQL Editor de staging DESPUÉS de paso5-aportes-manuales.sql.
-- Cada fila debe decir «ok». Si alguna dice «FALTA» o «REVISAR», no sigas.
select 'tabla manual_contributions' as que,
       case when to_regclass('public.manual_contributions') is not null then 'ok' else 'FALTA' end as resultado
union all
select 'RLS activada en la tabla (el navegador no la lee)',
       case when (select relrowsecurity from pg_class where oid = to_regclass('public.manual_contributions')) then 'ok' else 'REVISAR' end
union all
select 'sin permisos de tabla para anon ni authenticated',
       case when not has_table_privilege('anon', 'public.manual_contributions', 'select')
             and not has_table_privilege('authenticated', 'public.manual_contributions', 'select')
             and not has_table_privilege('authenticated', 'public.manual_contributions', 'insert') then 'ok' else 'REVISAR' end
union all
select 'protección: no se borra ni se cambia (disparador)',
       case when exists (select 1 from pg_trigger where tgname = 'manual_contributions_guard' and not tgisinternal) then 'ok' else 'FALTA' end
union all
select 'función común de acceso (svc_grant_full_access), sin acceso para el navegador',
       case when to_regprocedure('public.svc_grant_full_access(uuid)') is not null
             and not has_function_privilege('authenticated', 'public.svc_grant_full_access(uuid)', 'execute') then 'ok' else 'REVISAR' end
union all
select 'la aprobación de USDC usa la función común',
       case when pg_get_functiondef('public.svc_approve_claim(bigint, uuid, text, text)'::regprocedure) like '%svc_grant_full_access%' then 'ok' else 'REVISAR' end
union all
select 'registrar / anular / listar: solo para cuentas con sesión (y dentro, solo admin AAL2)',
       case when has_function_privilege('authenticated', 'public.admin_record_manual_contribution(text, text, numeric, text, numeric, text, date, integer, boolean, text)', 'execute')
             and not has_function_privilege('anon', 'public.admin_record_manual_contribution(text, text, numeric, text, numeric, text, date, integer, boolean, text)', 'execute')
             and not has_function_privilege('anon', 'public.admin_void_manual_contribution(bigint, text)', 'execute')
             and not has_function_privilege('anon', 'public.admin_list_manual_contributions(uuid, integer)', 'execute') then 'ok' else 'REVISAR' end
union all
select 'exportación CSV con la pestaña «manual»',
       case when pg_get_functiondef('public.admin_export_csv(text, jsonb)'::regprocedure) like '%''manual''%' then 'ok' else 'REVISAR' end
union all
select 'aportes manuales guardados (debe ser 0 recién aplicado)',
       case when (select count(*) from public.manual_contributions) = 0 then 'ok' else 'hay ' || (select count(*) from public.manual_contributions) end;
