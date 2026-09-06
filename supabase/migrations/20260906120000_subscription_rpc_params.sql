-- Follow-up to 20260905180000_subscription_trial.sql
--
-- PostgREST would not expose the zero-argument RPCs cancel_subscription() /
-- reactivate_subscription() over /rest/v1/rpc (PGRST202: "without parameters
-- ... no matches were found in the schema cache"), even though the functions
-- exist in Postgres and start_free_trial (which has parameters) resolves fine.
-- Giving each an optional parameter makes the signature unambiguous for
-- PostgREST, matching the pattern that already works. The client sends
-- { p_confirm: true }.
--
-- A signature change can't be done with CREATE OR REPLACE, so drop + recreate.

drop function if exists public.cancel_subscription();
drop function if exists public.reactivate_subscription();

create function public.cancel_subscription(p_confirm boolean default true)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  row public.profiles;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if p_confirm is not true then raise exception 'not confirmed'; end if;
  update public.profiles set
    cancel_at_period_end = true,
    canceled_at = now()
  where id = me and subscription_status in ('trialing','active')
  returning * into row;
  if row.id is null then raise exception 'nothing to cancel'; end if;
  return row;
  -- TODO(payment-nerds): also cancel the subscription on the processor so no
  -- renewal is attempted.
end;
$$;

create function public.reactivate_subscription(p_confirm boolean default true)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  row public.profiles;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if p_confirm is not true then raise exception 'not confirmed'; end if;
  update public.profiles set
    cancel_at_period_end = false,
    canceled_at = null
  where id = me
    and subscription_status in ('trialing','active')
    and cancel_at_period_end = true
    and coalesce(trial_ends_at, subscription_expires_at) > now()
  returning * into row;
  if row.id is null then raise exception 'nothing to reactivate'; end if;
  return row;
end;
$$;

grant execute on function public.cancel_subscription(boolean) to authenticated;
grant execute on function public.reactivate_subscription(boolean) to authenticated;

notify pgrst, 'reload schema';
