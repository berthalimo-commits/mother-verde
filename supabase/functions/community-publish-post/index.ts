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
// module. It duplicates the same Azure + translation_cache core as
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

const AZURE_ENDPOINT =
  (Deno.env.get("AZURE_TRANSLATOR_ENDPOINT") ??
    "https://api.cognitive.microsofttranslator.com").replace(/\/+$/, "");

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

interface AzureResult {
  detected: string;
  translations: Partial<Record<Lang, string>>;
}

async function azureTranslate(text: string, targets: Lang[]): Promise<AzureResult> {
  const key = Deno.env.get("AZURE_TRANSLATOR_KEY");
  const region = Deno.env.get("AZURE_TRANSLATOR_REGION");
  if (!key || !region) throw new Error("Azure Translator secrets not configured");

  const params = new URLSearchParams({ "api-version": "3.0" });
  for (const t of targets) params.append("to", t);

  const res = await fetch(`${AZURE_ENDPOINT}/translate?${params.toString()}`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Ocp-Apim-Subscription-Region": region,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([{ Text: text }]),
  });

  if (!res.ok) {
    throw new Error(`Azure ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }

  const data = await res.json();
  const entry = Array.isArray(data) ? data[0] : null;
  if (!entry?.translations) throw new Error("Azure: unexpected response shape");

  const translations: Partial<Record<Lang, string>> = {};
  for (const tr of entry.translations) {
    if (isLang(tr.to)) translations[tr.to as Lang] = tr.text;
  }
  return {
    detected: entry.detectedLanguage?.language ?? "",
    translations,
  };
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
    const azure = await azureTranslate(text, targets);
    const detected = isLang(azure.detected) ? azure.detected : sourceHint;

    const draft: Partial<Record<Lang, string>> = { ...azure.translations };
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
    console.error("translateText: azureTranslate failed:", err);
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
