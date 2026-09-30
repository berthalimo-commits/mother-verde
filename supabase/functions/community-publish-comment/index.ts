// community-publish-comment — create a comment on a community post
// server-side. Same reasoning as community-publish-post: the old flow let a
// client skip the real translation and write any body_i18n it wanted.
//
// Deployed by pasting this file directly into the Supabase dashboard's
// function editor (no CLI/browser login available in this environment), so
// this file is self-contained — no relative import of a shared translate
// module. It duplicates the same DeepL + translation_cache core as
// community-translate/index.ts on purpose, for the same reason.
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

const PLATFORM_LANGS = ["es", "en", "de", "fr"] as const;
type Lang = (typeof PLATFORM_LANGS)[number];

const COMMENT_MAX_LEN = 500;

// DeepL requires a regional variant for English as a translation target
// (plain "EN" is source-only); the other three platform languages don't need one.
const DEEPL_TARGET_LANG: Record<Lang, string> = {
  es: "ES",
  en: "EN-US",
  de: "DE",
  fr: "FR",
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function isLang(x: unknown): x is Lang {
  return typeof x === "string" && (PLATFORM_LANGS as readonly string[]).includes(x);
}

function isTrivial(text: string): boolean {
  const stripped = text
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
  return stripped.length < 3;
}

function normalizeForHash(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface DeepLResult {
  detected: string;
  translations: Partial<Record<Lang, string>>;
}

function deeplEndpoint(key: string): string {
  return key.endsWith(":fx")
    ? "https://api-free.deepl.com/v2/translate"
    : "https://api.deepl.com/v2/translate";
}

// DeepL translates to exactly one target language per call, unlike Azure's
// single multi-target request — so one call per target, run in parallel.
async function deeplTranslate(text: string, targets: Lang[]): Promise<DeepLResult> {
  const key = Deno.env.get("DEEPL_API_KEY");
  if (!key) throw new Error("DeepL API key not configured");

  const endpoint = deeplEndpoint(key);
  const results = await Promise.all(
    targets.map(async (target) => {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": `DeepL-Auth-Key ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: [text], target_lang: DEEPL_TARGET_LANG[target] }),
      });

      if (!res.ok) {
        throw new Error(`DeepL ${res.status}: ${(await res.text()).slice(0, 300)}`);
      }

      const data = await res.json();
      const entry = data?.translations?.[0];
      if (!entry?.text) throw new Error("DeepL: unexpected response shape");
      return {
        target,
        text: entry.text as string,
        detected: typeof entry.detected_source_language === "string"
          ? entry.detected_source_language.toLowerCase()
          : "",
      };
    }),
  );

  const translations: Partial<Record<Lang, string>> = {};
  for (const r of results) translations[r.target] = r.text;

  return { detected: results[0]?.detected ?? "", translations };
}

interface TranslateResult {
  source_lang: Lang;
  body_i18n: Record<Lang, string>;
  status: "done" | "skipped" | "failed";
}

// deno-lint-ignore no-explicit-any
async function translateText(admin: any, text: string, sourceHint: Lang): Promise<TranslateResult> {
  if (isTrivial(text)) {
    const body_i18n = Object.fromEntries(
      PLATFORM_LANGS.map((l) => [l, text] as const),
    ) as Record<Lang, string>;
    return { source_lang: sourceHint, body_i18n, status: "skipped" };
  }

  const contentHash = await sha256Hex(normalizeForHash(text));

  const { data: cached } = await admin
    .from("translation_cache")
    .select("translations, hit_count")
    .eq("source_lang", sourceHint)
    .eq("content_hash", contentHash)
    .maybeSingle();

  if (cached?.translations) {
    await admin
      .from("translation_cache")
      .update({
        hit_count: (cached.hit_count ?? 0) + 1,
        last_hit_at: new Date().toISOString(),
      })
      .eq("source_lang", sourceHint)
      .eq("content_hash", contentHash);
    return { source_lang: sourceHint, body_i18n: cached.translations, status: "done" };
  }

  const targets = PLATFORM_LANGS.filter((l) => l !== sourceHint);
  try {
    const deepl = await deeplTranslate(text, targets);
    const detected = isLang(deepl.detected) ? deepl.detected : sourceHint;

    const draft: Partial<Record<Lang, string>> = { ...deepl.translations };
    draft[detected] = text;
    for (const l of PLATFORM_LANGS) if (!draft[l]) draft[l] = text;
    const body_i18n = draft as Record<Lang, string>;

    await admin.from("translation_cache").upsert({
      source_lang: sourceHint,
      content_hash: contentHash,
      translations: body_i18n,
      hit_count: 0,
      last_hit_at: null,
    });

    return { source_lang: detected, body_i18n, status: "done" };
  } catch (err) {
    console.error("translateText: deeplTranslate failed:", err);
    return {
      source_lang: sourceHint,
      body_i18n: { [sourceHint]: text } as Record<Lang, string>,
      status: "failed",
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const anon = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );
  const { data: { user } } = await anon.auth.getUser(token);
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
