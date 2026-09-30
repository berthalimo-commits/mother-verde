// community-translate — translate one post/comment body into all four platform
// languages (es, en, de, fr). Historically called at publish time by the
// client; publishing itself has since moved server-side into
// community-publish-post / community-publish-comment, which do their own
// translation using the same core logic below instead of a second network
// hop to this function. This endpoint is kept as-is — same contract, same
// behavior — in case anything else still wants a standalone translation
// (e.g. a future edit-preview) without publishing.
//
// Deployed by pasting this file directly into the Supabase dashboard's
// function editor (no CLI/browser login available in this environment), so
// this file is intentionally self-contained — no relative imports to a
// shared module. community-publish-post and community-publish-comment carry
// their own copies of the same translate core for the same reason; if CLI
// deploy access is restored later, consolidating the three into one shared
// module (supabase/functions/_shared/) is a nice-to-have, not required.
//
// Request  (POST, requires a Supabase auth JWT):
//   { "text": "...", "sourceHint": "es" | "en" | "de" | "fr" }
// Response (200):
//   { "source_lang": "es", "body_i18n": { es, en, de, fr }, "status": "done" | "skipped" }
// On provider failure returns 502 so the caller can fall back to storing the
// original text only and let the backfill job fill the rest later.
//
// Secrets (supabase secrets set ...):
//   DEEPL_API_KEY  - DeepL API key (Free keys end in ":fx" and are routed to
//                     the free endpoint automatically; Pro keys hit the Pro
//                     endpoint — see deeplEndpoint() below)
// Auto-injected by Supabase: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "jsr:@supabase/supabase-js@2";

const PLATFORM_LANGS = ["es", "en", "de", "fr"] as const;
type Lang = (typeof PLATFORM_LANGS)[number];

const MAX_LEN = 2000;

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

// Strip emoji, punctuation, whitespace and URLs; what's left is the "real"
// content. Fewer than 3 letters/digits => not worth a translation call.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  // Identify the caller. verify_jwt is on for this function, so a bad token
  // never reaches here, but we still resolve the user to be explicit.
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const anon = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );
  const { data: { user } } = await anon.auth.getUser(token);
  if (!user) return json({ error: "unauthorized" }, 401);

  let payload: { text?: unknown; sourceHint?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }

  const text = typeof payload.text === "string" ? payload.text : "";
  const sourceHint: Lang = isLang(payload.sourceHint) ? payload.sourceHint : "es";

  if (!text.trim()) return json({ error: "empty text" }, 400);
  if (text.length > MAX_LEN) return json({ error: "text too long" }, 400);

  // Trivial content: store the original in every slot, skip the API entirely.
  if (isTrivial(text)) {
    const body_i18n = Object.fromEntries(
      PLATFORM_LANGS.map((l) => [l, text] as const),
    ) as Record<Lang, string>;
    return json({ source_lang: sourceHint, body_i18n, status: "skipped" });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const contentHash = await sha256Hex(normalizeForHash(text));

  // Cache hit — reuse and bump the counter.
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
    return json({
      source_lang: sourceHint,
      body_i18n: cached.translations,
      status: "done",
    });
  }

  // Miss — translate into the three languages other than the hinted source.
  const targets = PLATFORM_LANGS.filter((l) => l !== sourceHint);
  let deepl: DeepLResult;
  try {
    deepl = await deeplTranslate(text, targets);
  } catch (err) {
    console.error("deeplTranslate failed:", err);
    return json({ error: "translation provider unavailable" }, 502);
  }

  // The authoritative source language is DeepL's detection when it lands on a
  // platform language, otherwise the UI hint.
  const detected = isLang(deepl.detected) ? deepl.detected : sourceHint;

  const draft: Partial<Record<Lang, string>> = { ...deepl.translations };
  draft[detected] = text; // the original text IS the real source-language version
  for (const l of PLATFORM_LANGS) if (!draft[l]) draft[l] = text; // never leave a hole
  const body_i18n = draft as Record<Lang, string>;

  // Cache under the hint key (that is what the next identical publish will look up).
  await admin.from("translation_cache").upsert({
    source_lang: sourceHint,
    content_hash: contentHash,
    translations: body_i18n,
    hit_count: 0,
    last_hit_at: null,
  });

  return json({ source_lang: detected, body_i18n, status: "done" });
});
