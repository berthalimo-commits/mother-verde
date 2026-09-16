# community-publish-post

Creates or updates a community post: translates the body (reusing the same
Azure-backed core as `community-translate`, see `../_shared/translate.ts`)
and writes the row with the service-role key. Replaces the old flow where
`src/mvCommunity.js` called `community-translate` and then inserted/updated
`community_posts` itself — that let a caller skip translation and write any
`body_i18n` it wanted. See the migration that revokes direct client
insert/update on `community_posts` once this function is deployed and
`src/mvCommunity.js` is switched over.

## Contract

```
POST  (Authorization: Bearer <supabase user jwt>)

Create:
  { "action": "create", "body"?: string, "photo_url"?: string,
    "post_type"?: "general"|"viajero"|"cultivo"|"diagnostico"|"pregunta",
    "meta"?: object, "sourceHint"?: "es"|"en"|"de"|"fr" }

Update:
  { "action": "update", "id": string, "body": string, "sourceHint"?: string }

200 → { "post": { ...the community_posts row... } }
400 → { "error": "empty post" | "body exceeds 2000 chars" | "missing id" | "invalid JSON" | "invalid action" }
401 → { "error": "unauthorized" }
404 → { "error": "not found" }              // update: no row with that id owned by the caller
500 → { "error": "could not create/update post" }
```

- `kind` is derived from whether `photo_url` is present — the client still
  uploads the photo to Storage first (unchanged) and only passes the URL here.
- `user_id` always comes from the caller's JWT, never from the request body.
- `featured` is never accepted here at all — only service-role seeding sets it.
- A down translation provider never blocks publishing: the row still gets
  created/updated with `translation_status: "failed"` and the original text
  in every language slot (same fallback the client used to do itself).

## Deploy

No new secrets — reuses `AZURE_TRANSLATOR_KEY` / `AZURE_TRANSLATOR_REGION`
already set for `community-translate`, plus the platform-injected
`SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`.

```bash
supabase functions deploy community-publish-post
```
