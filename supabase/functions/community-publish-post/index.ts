// community-publish-post — create/update a community post server-side.
//
// Replaces the old flow where the client called community-translate for a
// translation and then inserted/updated community_posts itself. That let a
// caller skip the real translation entirely and write any body_i18n it
// wanted (different, unrelated text per language) — see the audit finding
// this closes. Now the client can no longer write community_posts directly
// (see the migration that revokes insert/update once this function and the
// matching src/mvCommunity.js change are both confirmed live); this function
// does the translation AND the insert/update, with the service-role key.
//
// Request  (POST, requires a Supabase auth JWT):
//   create: { action: "create", body?, photo_url?, post_type?, meta?, sourceHint? }
//   update: { action: "update", id, body, sourceHint? }
// Response (200): { post: <the row, same shape community_posts always had> }
//
// SECURITY-CRITICAL: user_id on every write comes from the caller's JWT
// (resolveUser), never from the request body. This function runs with the
// service-role key, which bypasses RLS entirely — that check is the only
// thing standing between "publish my own post" and "publish as anyone."
// `featured` is never accepted from the request at all; only service-role
// seeding elsewhere sets it, same as before this change.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { CORS, isLang, json, resolveUser, translateText, type Lang } from "../_shared/translate.ts";

const POST_MAX_LEN = 2000;
const POST_TYPES = ["general", "viajero", "cultivo", "diagnostico", "pregunta"] as const;

function normalizePostType(x: unknown): typeof POST_TYPES[number] {
  return (POST_TYPES as readonly string[]).includes(x as string)
    ? (x as typeof POST_TYPES[number])
    : "general";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const user = await resolveUser(req, () =>
    createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!)
  );
  if (!user) return json({ error: "unauthorized" }, 401);

  let payload: {
    action?: unknown;
    id?: unknown;
    body?: unknown;
    photo_url?: unknown;
    post_type?: unknown;
    meta?: unknown;
    sourceHint?: unknown;
  };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }

  const sourceHint: Lang = isLang(payload.sourceHint) ? payload.sourceHint : "es";
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  if (payload.action === "create") {
    const photo_url = typeof payload.photo_url === "string" && payload.photo_url ? payload.photo_url : null;
    const kind = photo_url ? "photo" : "text";
    const trimmed = typeof payload.body === "string" ? payload.body.trim() : "";

    if (kind === "text" && !trimmed) return json({ error: "empty post" }, 400);
    if (trimmed.length > POST_MAX_LEN) return json({ error: "body exceeds " + POST_MAX_LEN + " chars" }, 400);

    // deno-lint-ignore no-explicit-any
    const row: Record<string, any> = {
      user_id: user.id, // never from the client
      kind,
      body: trimmed || null,
      photo_url,
      post_type: normalizePostType(payload.post_type),
      meta: payload.meta ?? null,
    };

    if (trimmed) {
      const t = await translateText(admin, trimmed, sourceHint);
      row.body_i18n = t.body_i18n;
      row.source_lang = t.source_lang;
      row.translation_status = t.status;
    } else {
      row.translation_status = "skipped";
    }

    const { data, error } = await admin.from("community_posts").insert(row).select().single();
    if (error) {
      console.error("community-publish-post create:", error);
      return json({ error: "could not create post" }, 500);
    }
    return json({ post: data });
  }

  if (payload.action === "update") {
    const id = typeof payload.id === "string" ? payload.id : "";
    if (!id) return json({ error: "missing id" }, 400);
    const trimmed = typeof payload.body === "string" ? payload.body.trim() : "";
    if (!trimmed) return json({ error: "empty post" }, 400);
    if (trimmed.length > POST_MAX_LEN) return json({ error: "body exceeds " + POST_MAX_LEN + " chars" }, 400);

    const t = await translateText(admin, trimmed, sourceHint);
    const { data, error } = await admin
      .from("community_posts")
      .update({
        body: trimmed,
        body_i18n: t.body_i18n,
        source_lang: t.source_lang,
        translation_status: t.status,
      })
      // Ownership check done here explicitly — the service-role client
      // bypasses RLS, so nothing else enforces "only your own post."
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .maybeSingle();

    if (error) {
      console.error("community-publish-post update:", error);
      return json({ error: "could not update post" }, 500);
    }
    if (!data) return json({ error: "not found" }, 404);
    return json({ post: data });
  }

  return json({ error: "invalid action" }, 400);
});
