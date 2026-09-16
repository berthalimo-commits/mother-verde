# community-publish-comment

Creates a comment on a community post: translates the body and writes the
row with the service-role key. Same reasoning as `community-publish-post` —
see that function's README.

Because this runs with the service-role key (bypasses RLS), it reproduces by
hand the eligibility rule that used to live only in the
`community_comments_insert_unlocked` RLS policy
(`20260907140000_community_featured_posts.sql`): you may comment on a post
if it's featured, if it's your own post, or if you and the post's author
mutually follow each other. Skipping that check here would silently remove
the gate for every post in the app — it's re-verified inside the function,
not assumed.

## Contract

```
POST  (Authorization: Bearer <supabase user jwt>)
body: { "post_id": string, "body": string, "sourceHint"?: "es"|"en"|"de"|"fr" }

200 → { "comment": { ...the community_comments row... } }
400 → { "error": "missing post_id" | "empty comment" | "comment exceeds 500 chars" | "invalid JSON" }
401 → { "error": "unauthorized" }
403 → { "error": "not allowed to comment on this post" }
404 → { "error": "post not found" }
500 → { "error": "could not create comment" | "could not verify post" | "could not verify comment eligibility" }
```

`user_id` always comes from the caller's JWT, never from the request body.

## Deploy

No new secrets needed (see community-publish-post's README).

```bash
supabase functions deploy community-publish-comment
```
