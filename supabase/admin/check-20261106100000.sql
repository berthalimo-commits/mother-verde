-- Read-only check for 20261106100000_gift_codes_7_days.sql. Changes nothing. Must say 'ok'.
select 'códigos de regalo creados desde SQL: 7 días para canjear por defecto' as que,
       case when pg_get_function_arguments('public.admin_create_gift_codes(integer, integer, integer)'::regprocedure) like '%p_valid_days integer DEFAULT 7%'
            then 'ok' else 'FALTA' end as resultado;
