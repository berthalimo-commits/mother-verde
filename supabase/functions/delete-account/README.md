# delete-account

Permanently deletes the caller's account and everything tied to it. Called
from Cuenta → "Eliminar mi cuenta" (`src/auth.js`). The order of the steps,
and why, is documented at the top of `index.ts`.

Self-contained (no shared module) so it can be pasted straight into the
Supabase dashboard's function editor, same as the community-publish-*
functions. Uses only the default secrets every Edge Function already has
(`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) — no new
secret to set.

## Contract

```
POST  (Authorization: Bearer <supabase user jwt>)
  { "password": string, "confirm": "DELETE" }

200 → { "ok": true, "removed": { "files": n, "cacheRows": n } }
400 → { "error": "confirmation required" | "missing password" | "invalid JSON" }
401 → { "error": "unauthorized" }
403 → { "error": "wrong password" }
409 → { "error": "official account" | "active subscription" }
500 → { "error": "could not delete account", "step": "<which step failed>" }
```

`confirm` is always the literal `"DELETE"`; the word the person types is
localized in the UI and checked there.

## What it removes

- Files under `<uid>/` in the `community-photos` bucket (avatar, post photos).
- `translation_cache` rows whose hash matches the person's current post and
  comment bodies. Older versions of a post that was later edited aren't
  known any more and can't be matched.
- The auth user, which cascades to `profiles`, `bitacora_entries`,
  `community_members`, `community_posts`, `community_comments`,
  `community_follows`, `community_swipes`, `community_reports` — including
  other people's comments on this person's posts.

Any failure before the last step aborts with the account intact, so the
person can simply try again.
