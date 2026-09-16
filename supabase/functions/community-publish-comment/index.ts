// community-publish-comment — create a comment on a community post
// server-side. Same reasoning as community-publish-post: the old flow let a
// client skip the real translation and write any body_i18n it wanted.
//
// Request  (POST, requires a Supabase auth JWT):
//   { post_id, body, sourceHint? }
// Response (200): { comment: <the row> }
//
// SECURITY-CRITICAL, two separate things this function must get right on its
// own, because the service-role key bypasses RLS entirely:
//   1. user_id on the insert comes from the caller's JWT, never the body.
//   2. The comment-eligibility rule that RLS used to enforce
//      (community_comments_insert_unlocked in
//      20260907140000_community_featured_posts.sql) is reproduced here by
//      hand: you may comment on a post if it's featured, if it's your own,
//      or if you and the author mutually follow each other. Skipping this
//      check would silently remove that gate for every post in the app.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { CORS, isLang, json, resolveUser, translateText, type Lang } from "../_shared/translate.ts";

const COMMENT_MAX_LEN = 500;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const user = await resolveUser(req, () =>
    createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!)
  );
  if (!user) return json({ error: "unauthorized" }, 401);

  let payload: { post_id?: unknown; body?: unknown; sourceHint?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }

  const post_id = typeof payload.post_id === "string" ? payload.post_id : "";
  const trimmed = typeof payload.body === "string" ? payload.body.trim() : "";
  const sourceHint: Lang = isLang(payload.sourceHint) ? payload.sourceHint : "es";

  if (!post_id) return json({ error: "missing post_id" }, 400);
  if (!trimmed) return json({ error: "empty comment" }, 400);
  if (trimmed.length > COMMENT_MAX_LEN) return json({ error: "comment exceeds " + COMMENT_MAX_LEN + " chars" }, 400);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: post, error: postErr } = await admin
    .from("community_posts")
    .select("id, user_id, featured")
    .eq("id", post_id)
    .maybeSingle();
  if (postErr) {
    console.error("community-publish-comment: post lookup:", postErr);
    return json({ error: "could not verify post" }, 500);
  }
  if (!post) return json({ error: "post not found" }, 404);

  let allowed = post.featured || post.user_id === user.id;
  if (!allowed) {
    const { data: mutual, error: mutualErr } = await admin.rpc("community_is_mutual", {
      a: user.id,
      b: post.user_id,
    });
    if (mutualErr) {
      console.error("community-publish-comment: community_is_mutual:", mutualErr);
      return json({ error: "could not verify comment eligibility" }, 500);
    }
    allowed = !!mutual;
  }
  if (!allowed) return json({ error: "not allowed to comment on this post" }, 403);

  const t = await translateText(admin, trimmed, sourceHint);
  const { data, error } = await admin
    .from("community_comments")
    .insert({
      post_id,
      user_id: user.id, // never from the client
      body: trimmed,
      body_i18n: t.body_i18n,
      source_lang: t.source_lang,
      translation_status: t.status,
    })
    .select()
    .single();

  if (error) {
    console.error("community-publish-comment create:", error);
    return json({ error: "could not create comment" }, 500);
  }
  return json({ comment: data });
});
