-- STAGING · paso 7 · comprobación de SOLO LECTURA (no cambia nada)
-- Pegar DESPUÉS de paso7-prueba-una-vez.sql. Las 6 filas deben decir «ok».
-- Copia exacta de supabase/admin/check-20261105100000.sql.

-- Read-only check for 20261105100000_trial_once_per_person.sql. Changes nothing.
-- Every row must say 'ok'.
select 'tabla de huellas, sin acceso desde el navegador' as que,
       case when to_regclass('public.trial_email_hashes') is not null
             and (select relrowsecurity from pg_class where oid = 'public.trial_email_hashes'::regclass)
             and not has_table_privilege('authenticated', 'public.trial_email_hashes', 'select')
             and not has_table_privilege('anon', 'public.trial_email_hashes', 'select')
            then 'ok' else 'FALTA' end as resultado
union all
select 'pimienta secreta creada una vez, sin acceso desde el navegador',
       case when to_regclass('public.trial_pepper') is not null
             and (select count(*) from public.trial_pepper) = 1
             and not has_table_privilege('authenticated', 'public.trial_pepper', 'select')
            then 'ok' else 'FALTA' end
union all
select 'disparador al borrar cuenta',
       case when exists (select 1 from pg_trigger where tgname = 'on_auth_user_delete_trial' and tgrelid = 'auth.users'::regclass)
            then 'ok' else 'FALTA' end
union all
select 'la prueba de 24 h consulta las huellas',
       case when pg_get_functiondef('public.start_trial_on_email_confirmed()'::regprocedure) like '%trial_email_used%'
            then 'ok' else 'FALTA' end
union all
select 'normalización de alias (Gmail, Outlook, iCloud, Proton)',
       case when public.trial_email_key('A.Na+x@GoogleMail.com') = 'ana@gmail.com'
             and public.trial_email_key('ana+x@hotmail.es') = 'ana@hotmail.es'
             and public.trial_email_key('ana+x@me.com') = 'ana@icloud.com'
             and public.trial_email_key('ana+x@pm.me') = 'ana@proton.me'
             and public.trial_email_key('a.na+x@example.org') = 'a.na+x@example.org'
            then 'ok' else 'FALLA' end
union all
select 'funciones internas no ejecutables desde el navegador',
       case when not has_function_privilege('authenticated', 'public.trial_email_hash(text)', 'execute')
             and not has_function_privilege('authenticated', 'public.trial_email_used(uuid, text)', 'execute')
             and not has_function_privilege('anon', 'public.trial_email_key(text)', 'execute')
            then 'ok' else 'FALLA' end;
