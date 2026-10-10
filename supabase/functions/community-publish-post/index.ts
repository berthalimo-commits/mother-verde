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
// Deployed by pasting this file directly into the Supabase dashboard's
// function editor (no CLI/browser login available in this environment), so
// this file is self-contained — no relative import of a shared translate
// module. It duplicates the same DeepL + translation_cache core as
// community-translate/index.ts on purpose, for the same reason.
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

const PLATFORM_LANGS = ["es", "en", "de", "fr"] as const;
type Lang = (typeof PLATFORM_LANGS)[number];

const POST_MAX_LEN = 2000;
const POST_TYPES = ["general", "viajero", "cultivo", "diagnostico", "pregunta"] as const;

// Daily limits per person (rolling 24 h), against spam and DeepL quota abuse.
// Must match community-publish-comment. Counted in community_usage_log, which
// deleting a post does not reset.
const LIMITS = { postsPerDay: 5, commentsPerDay: 20, translatedCharsPerDay: 6000 };

// deno-lint-ignore no-explicit-any
async function usageLast24h(admin: any, userId: string) {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data, error } = await admin
    .from("community_usage_log")
    .select("kind, chars")
    .eq("user_id", userId)
    .gte("created_at", since);
  if (error) throw error;
  let posts = 0, comments = 0, chars = 0;
  for (const r of data ?? []) {
    if (r.kind === "post") posts++;
    if (r.kind === "comment") comments++;
    chars += r.chars ?? 0;
  }
  return { posts, comments, chars };
}

// deno-lint-ignore no-explicit-any
async function logUsage(admin: any, userId: string, kind: string, chars: number) {
  const { error } = await admin.from("community_usage_log").insert({ user_id: userId, kind, chars });
  if (error) console.error("community_usage_log insert:", error);
}

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

function normalizePostType(x: unknown): typeof POST_TYPES[number] {
  return (POST_TYPES as readonly string[]).includes(x as string)
    ? (x as typeof POST_TYPES[number])
    : "general";
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

  // Community is part of full access (24 h trial or verified contribution).
  const { data: hasAccess, error: accessErr } = await admin.rpc("is_premium", { uid: user.id });
  if (accessErr) {
    console.error("community-publish-post is_premium:", accessErr);
    return json({ error: "could not verify access" }, 500);
  }
  if (!hasAccess) return json({ error: "no_access" }, 403);

  let usage;
  try {
    usage = await usageLast24h(admin, user.id);
  } catch (e) {
    console.error("community-publish-post usage:", e);
    return json({ error: "could not check limits" }, 500);
  }

  if (payload.action === "create") {
    const photo_url = typeof payload.photo_url === "string" && payload.photo_url ? payload.photo_url : null;
    const kind = photo_url ? "photo" : "text";
    const trimmed = typeof payload.body === "string" ? payload.body.trim() : "";

    if (kind === "text" && !trimmed) return json({ error: "empty post" }, 400);
    if (trimmed.length > POST_MAX_LEN) return json({ error: "body exceeds " + POST_MAX_LEN + " chars" }, 400);
    if (usage.posts >= LIMITS.postsPerDay) return json({ error: "daily_post_limit" }, 429);
    if (usage.chars + trimmed.length > LIMITS.translatedCharsPerDay) return json({ error: "daily_char_limit" }, 429);

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
    await logUsage(admin, user.id, "post", trimmed.length);
    return json({ post: data });
  }

  if (payload.action === "update") {
    const id = typeof payload.id === "string" ? payload.id : "";
    if (!id) return json({ error: "missing id" }, 400);
    const trimmed = typeof payload.body === "string" ? payload.body.trim() : "";
    if (!trimmed) return json({ error: "empty post" }, 400);
    if (trimmed.length > POST_MAX_LEN) return json({ error: "body exceeds " + POST_MAX_LEN + " chars" }, 400);
    if (usage.chars + trimmed.length > LIMITS.translatedCharsPerDay) return json({ error: "daily_char_limit" }, 429);

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
    await logUsage(admin, user.id, "post_edit", trimmed.length);
    return json({ post: data });
  }

  return json({ error: "invalid action" }, 400);
});
