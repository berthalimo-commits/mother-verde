-- Verified accounts on the community directory. Two kinds:
--   'official'     — the Mother Verde platform account(s).
--   'professional' — a registered pro whose posts are distinguished
--                    (matches the "insignia verificada" the app's own copy
--                    already describes; not assigned to anyone yet).
--
-- Only service-role can set it: the client's INSERT/UPDATE privileges are
-- narrowed to exactly the columns upsertMyMemberProfile() writes, so a member
-- cannot flag their own account verified via the API. Same pattern as the
-- billing-column lockdown on profiles (20260905180000).

alter table public.community_members
  add column verified_type text
    check (verified_type in ('official','professional'));

revoke insert, update on public.community_members from authenticated;
grant insert (user_id, display_name, country, profile_type, bio, cover_photo_url, avatar_url)
  on public.community_members to authenticated;
grant update (display_name, country, profile_type, bio, cover_photo_url, avatar_url)
  on public.community_members to authenticated;

-- The Mother Verde official account.
update public.community_members
  set verified_type = 'official'
  where user_id = '5bcf51c6-db9d-4965-906e-c1fb426eb0b3';
