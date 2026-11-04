-- PRODUCCIÓN · archivo 26 de 31 · Acceso completo para tus dos cuentas. Ejecuta primero solo la PARTE 1 (lectura) y comprueba que salen exactamente esas dos cuentas; después la PARTE 2.
-- Dos partes: lee la explicación de abajo antes de ejecutar.
-- Copia exacta de supabase/admin/supporters-betian-mother-verde.sql (generado por tools/build-produccion.mjs; no editar a mano).

-- Full access for the owner's two accounts, so they are never blocked.
-- Paste in the Supabase SQL Editor AFTER the 20261010120000 migration.
-- Run PART 1 first (read-only) and check it shows exactly these two
-- accounts; only then run PART 2.

-- PART 1 (read-only): which rows PART 2 would change.
select u.id, u.email, m.display_name, p.subscription_status
from auth.users u
join public.profiles p on p.id = u.id
left join public.community_members m on m.user_id = u.id
where (u.email = 'berthalimo@gmail.com' and m.display_name = 'Betian')
   or (u.id = '5bcf51c6-db9d-4965-906e-c1fb426eb0b3' and u.email = 'berthalimo@proton.me');

-- PART 2: mark both as 'supporter' (full access, no end date). One transaction.
begin;
update public.profiles p
set subscription_status = 'supporter'
from auth.users u
left join public.community_members m on m.user_id = u.id
where p.id = u.id
  and ((u.email = 'berthalimo@gmail.com' and m.display_name = 'Betian')
    or (u.id = '5bcf51c6-db9d-4965-906e-c1fb426eb0b3' and u.email = 'berthalimo@proton.me'))
returning p.id, u.email, p.subscription_status;
commit;
