-- READ-ONLY queries for the Supabase SQL Editor. None of them changes data.
-- Run each block separately. They show e-mail addresses: owner use only.

-- 1) Existing accounts that never started a trial (they will NOT get the
--    new 24 h trial automatically: trial_eligible is false for them).
select count(*) as cuentas_sin_prueba_nunca
from public.profiles
where trial_started_at is null;

select p.subscription_status, p.trial_eligible, count(*) as cuentas
from public.profiles p
group by 1, 2
order by 1, 2;

-- 2) Suspicious signups ------------------------------------------------------

-- 2a) Bursts: 10-minute windows with 3 or more new accounts.
select date_trunc('hour', created_at)
         + floor(extract(minute from created_at) / 10) * interval '10 minutes' as ventana_10_min,
       count(*) as cuentas_nuevas,
       array_agg(email order by created_at) as correos
from auth.users
group by 1
having count(*) >= 3
order by 1 desc;

-- 2b) Similar addresses: same local part once digits and . _ + - are removed
--     (e.g. ana.1@…, ana2@…, ana+x@… on any domain).
select regexp_replace(split_part(lower(email), '@', 1), '[0-9._+-]', '', 'g') as base,
       count(*) as cuentas,
       array_agg(email order by created_at) as correos
from auth.users
where email is not null
group by 1
having count(*) > 1
order by cuentas desc;

-- 2c) Same normalized e-mail on more than one account (should be empty once
--     the Before User Created hook is on).
select email_normalized, count(*) as cuentas
from public.profiles
where email_normalized is not null
group by 1
having count(*) > 1;

-- 2d) Trial ended and never came back (no sign-in after the trial ended).
select u.email, p.trial_started_at, p.trial_ends_at, u.last_sign_in_at, p.subscription_status
from public.profiles p
join auth.users u on u.id = p.id
where p.trial_ends_at < now()
  and p.subscription_status in ('trialing', 'blocked')
  and (u.last_sign_in_at is null or u.last_sign_in_at <= p.trial_ends_at)
order by p.trial_ends_at desc;
