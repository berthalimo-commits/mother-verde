// community-translate — translate one post/comment body into all four platform
// languages (es, en, de, fr) at publish time.
//
// Request  (POST, requires a Supabase auth JWT):
//   { "text": "...", "sourceHint": "es" | "en" | "de" | "fr" }
// Response (200):
//   { "source_lang": "es", "body_i18n": { es, en, de, fr }, "status": "done" | "skipped" }
// On provider failure returns 502 so the client can fall back to storing the
// original text only and let the backfill job fill the rest later.
//
// Secrets (supabase secrets set ...):
//   AZURE_TRANSLATOR_KEY       - Azure AI Translator resource key
//   AZURE_TRANSLATOR_REGION    - e.g. "eastus" (the resource's region)
//   AZURE_TRANSLATOR_ENDPOINT  - optional, defaults to the global endpoint
// Auto-injected by Supabase: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "jsr:@supabase/supabase-js@2";

const PLATFORM_LANGS = ["es", "en", "de", "fr"] as const;
type Lang = (typeof PLATFORM_LANGS)[number];

const MAX_LEN = 2000;
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
    if (isLang(tr.to)) translations[tr.to] = tr.text;
  }
  return {
    detected: entry.detectedLanguage?.language ?? "",
    translations,
  };
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
  let azure: AzureResult;
  try {
    azure = await azureTranslate(text, targets);
  } catch (err) {
    console.error("azureTranslate failed:", err);
    return json({ error: "translation provider unavailable" }, 502);
  }

  // The authoritative source language is Azure's detection when it lands on a
  // platform language, otherwise the UI hint.
  const detected = isLang(azure.detected) ? azure.detected : sourceHint;

  const draft: Partial<Record<Lang, string>> = { ...azure.translations };
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
