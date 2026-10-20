-- ROLLBACK of migration 20261013100000_mail_delivery.sql.
-- !! Deletes the e-mail send log (mail_events). Only after putting back the
-- previous versions of admin-send-gift-code and support-claims (the new ones
-- write to mail_events) and removing signup-fix-email.
-- Run AFTER rollback-20261013110000. Runs as ONE transaction.
begin;
drop function if exists public.svc_signup_email_fix(text, text);
drop trigger if exists on_auth_email_changed on auth.users;
drop function if exists public.sync_email_normalized();
drop function if exists public.svc_mail_event(text, boolean, text, integer, text, uuid, text);
drop function if exists public.redact_emails(text);
drop table if exists public.mail_events;
commit;
