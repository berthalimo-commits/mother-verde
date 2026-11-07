-- Mother Verde · comprobación de SOLO LECTURA para las copias de seguridad.
-- Para cada tabla de los esquemas public, auth y storage: número de filas y una huella (md5) de todo su contenido.
-- Se ejecuta con psql en la base original y en la restaurada: si las dos listas son iguales, los datos coinciden.
--   psql ... -X -A -t -F "|" -f comprobar.sql
-- No cambia nada: solo SELECT (los SET de abajo solo afectan a esta sesión, para que el texto salga igual en las dos).
set timezone = 'UTC';
set datestyle = 'ISO, YMD';
set intervalstyle = 'postgres';
set extra_float_digits = 1;
set bytea_output = 'hex';

select format(
  'select %L, count(*), md5(coalesce(string_agg(h, '','' order by h), '''')) from (select md5(t::text) as h from %I.%I t) s',
  n.nspname || '.' || c.relname, n.nspname, c.relname)
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r', 'p')
  and not c.relispartition
  and n.nspname in ('public', 'auth', 'storage')
order by n.nspname, c.relname
\gexec
