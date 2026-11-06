-- STAGING · usuario de SOLO LECTURA para las copias de seguridad diarias (mv_backup)
-- Pegar ENTERO en el SQL Editor de STAGING (ciqdnrdtaxbmcjvxljvq). NO en producción:
-- producción tendrá su propio archivo, solo con la autorización escrita de Bertha.
-- Este archivo NO lleva contraseña. La contraseña la genera tools/copias/guardar-secretos.ps1
-- en la laptop, la guarda en la bóveda de Windows y copia al portapapeles solo su huella SCRAM
-- (alter role mv_backup with password 'SCRAM-SHA-256$...'), que se pega después aparte.
-- Se puede pegar más de una vez: si el usuario ya existe, solo se le vuelven a poner los permisos.
--
-- Qué puede hacer mv_backup:
--   - leer todas las tablas (pg_read_all_data), también las protegidas por reglas por fila
--     (bypassrls: sin esto pg_dump se para en las tablas con RLS), para que la copia sea completa;
--   - nada más: cada transacción suya es de solo lectura, no puede crear ni cambiar nada,
--     no es superusuario, no crea bases ni roles, y como mucho abre 2 conexiones.
begin;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'mv_backup') then
    create role mv_backup with login nosuperuser nocreatedb nocreaterole noreplication bypassrls connection limit 2;
  else
    alter role mv_backup with login nosuperuser nocreatedb nocreaterole noreplication bypassrls connection limit 2;
  end if;
end $$;

grant pg_read_all_data to mv_backup;
alter role mv_backup set default_transaction_read_only = on;
alter role mv_backup set statement_timeout = '15min';

commit;

-- Comprobación (solo lectura): una fila con todo «ok».
select 'mv_backup' as usuario,
       case when r.rolcanlogin and not r.rolsuper and not r.rolcreatedb and not r.rolcreaterole and r.rolbypassrls
                 and r.rolconnlimit = 2 then 'ok' else 'REVISAR' end as permisos,
       case when pg_has_role('mv_backup', 'pg_read_all_data', 'USAGE') then 'ok' else 'FALTA' end as leer_todo,
       case when exists (select 1 from pg_db_role_setting s where s.setrole = r.oid
                         and 'default_transaction_read_only=on' = any (s.setconfig)) then 'ok' else 'FALTA' end as solo_lectura
from pg_roles r
where r.rolname = 'mv_backup';
-- (La contraseña no se ve aquí: se comprueba en la laptop con la primera copia.)
