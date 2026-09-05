-- 3-day free trial -> auto-subscription ($7.10/month), built to plug into
-- Payment Nerds when the processor is connected. This migration is the data
-- model + the two authoritative state-change RPCs. The actual charge, the
-- webhook receiver, and the reminder email are wired later (marked
-- TODO(payment-nerds) / TODO(email) in the code).

-- ---------------------------------------------------------------------------
-- 1. Subscription state on profiles.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column subscription_status text not null default 'none'
    check (subscription_status in ('none','trialing','active','canceled','past_due','blocked')),
  add column trial_started_at        timestamptz,
  add column trial_ends_at           timestamptz,
  add column canceled_at             timestamptz,
  add column cancel_at_period_end    boolean not null default false,
  add column trial_reminder_sent_at  timestamptz,
  add column payment_customer_id     text,   -- Payment Nerds ids, null until integrated
  add column payment_subscription_id text;

-- ---------------------------------------------------------------------------
-- 2. Lock down direct client writes to billing columns. RLS controls the row;
--    column privileges control which fields. The client keeps only what it
--    legitimately edits; every subscription field moves through the RPCs /
--    webhook (which run as the table owner and bypass this).
-- ---------------------------------------------------------------------------
revoke update on public.profiles from authenticated;
grant update (display_name, preferred_lang, contact_email, age_verified, onboarding_seen)
  on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Canonical Premium check — trialing (within trial) or active (not expired).
--    Access continues through a pending cancellation until the period ends; a
--    scheduled job (or the webhook) flips the row to 'canceled'/'blocked' after.
-- ---------------------------------------------------------------------------
create or replace function public.is_premium(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select
      (subscription_status = 'trialing' and trial_ends_at is not null and trial_ends_at > now())
      or
      (subscription_status = 'active' and subscription_expires_at is not null and subscription_expires_at > now())
      or
      -- legacy rows set before this migration
      (subscription_status = 'none' and subscription_active
        and (subscription_expires_at is null or subscription_expires_at > now()))
    from public.profiles where id = uid
  ), false);
$$;

-- ---------------------------------------------------------------------------
-- 4. Start the free trial. One per account ever (trial_started_at gates it).
--    p_customer_id / p_subscription_id are the Payment Nerds handles once the
--    client has tokenized a card; null in the card-less pre-integration path.
-- ---------------------------------------------------------------------------
create function public.start_free_trial(p_customer_id text default null, p_subscription_id text default null)
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
  select * into row from public.profiles where id = me;
  if row.trial_started_at is not null then
    raise exception 'trial already used';
  end if;
  if row.subscription_status in ('active','trialing') then
    raise exception 'already subscribed';
  end if;
  update public.profiles set
    subscription_status  = 'trialing',
    trial_started_at     = now(),
    trial_ends_at        = now() + interval '3 days',
    cancel_at_period_end = false,
    canceled_at          = null,
    trial_reminder_sent_at = null,
    payment_customer_id     = coalesce(p_customer_id, payment_customer_id),
    payment_subscription_id = coalesce(p_subscription_id, payment_subscription_id),
    subscription_source  = 'payment_nerds'
  where id = me
  returning * into row;
  return row;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Cancel — never charges again; access runs out at the end of the current
--    trial/paid period, then a job flips the row to 'canceled'.
-- ---------------------------------------------------------------------------
create function public.cancel_subscription()
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

-- ---------------------------------------------------------------------------
-- 6. Undo a pending cancellation while still inside the period.
-- ---------------------------------------------------------------------------
create function public.reactivate_subscription()
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

grant execute on function public.start_free_trial(text, text) to authenticated;
grant execute on function public.cancel_subscription() to authenticated;
grant execute on function public.reactivate_subscription() to authenticated;
