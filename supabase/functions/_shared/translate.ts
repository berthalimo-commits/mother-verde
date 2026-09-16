// Shared translation core (Azure AI Translator + translation_cache), used by
// community-translate (kept as its own callable endpoint) and by the
// community-publish-post / community-publish-comment functions, which call
// this directly instead of doing a second network hop to community-translate.
// One implementation, so the three callers can never drift out of sync.

export const PLATFORM_LANGS = ["es", "en", "de", "fr"] as const;
export type Lang = (typeof PLATFORM_LANGS)[number];

const AZURE_ENDPOINT =
  (Deno.env.get("AZURE_TRANSLATOR_ENDPOINT") ??
    "https://api.cognitive.microsofttranslator.com").replace(/\/+$/, "");

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

export function isLang(x: unknown): x is Lang {
  return typeof x === "string" && (PLATFORM_LANGS as readonly string[]).includes(x);
}

// Strip emoji, punctuation, whitespace and URLs; what's left is the "real"
// content. Fewer than 3 letters/digits => not worth a translation call.
export function isTrivial(text: string): boolean {
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

export interface TranslateResult {
  source_lang: Lang;
  body_i18n: Record<Lang, string>;
  status: "done" | "skipped" | "failed";
}

// deno-lint-ignore no-explicit-any
type AdminClient = any; // the service-role SupabaseClient created by the caller

// Trivial-check + cache lookup/write + the Azure call. Rethrows whatever
// azureTranslate throws (provider down, bad secrets, bad response shape) —
// callers decide what that means for them (community-translate turns it into
// a 502; the publish functions swallow it into a 'failed' row so a down
// provider never blocks publishing). Kept as one function so the cache
// lookup/write logic — the part most worth not duplicating — lives once.
export async function translateCore(
  admin: AdminClient,
  text: string,
  sourceHint: Lang,
): Promise<TranslateResult> {
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
  const azure = await azureTranslate(text, targets); // throws on failure — not caught here

  const detected = isLang(azure.detected) ? azure.detected : sourceHint;
  const draft: Partial<Record<Lang, string>> = { ...azure.translations };
  draft[detected] = text; // the original text IS the real source-language version
  for (const l of PLATFORM_LANGS) if (!draft[l]) draft[l] = text; // never leave a hole
  const body_i18n = draft as Record<Lang, string>;

  await admin.from("translation_cache").upsert({
    source_lang: sourceHint,
    content_hash: contentHash,
    translations: body_i18n,
    hit_count: 0,
    last_hit_at: null,
  });

  return { source_lang: detected, body_i18n, status: "done" };
}

// Same as translateCore, but never throws: a provider failure falls back to
// the original text in every slot with status 'failed', exactly like the
// client-side fallback this replaces (src/mvCommunity.js translatedFields,
// pre-server-side-publish). Used by community-publish-post/-comment, where a
// down Azure must never block someone from publishing.
export async function translateText(
  admin: AdminClient,
  text: string,
  sourceHint: Lang,
): Promise<TranslateResult> {
  try {
    return await translateCore(admin, text, sourceHint);
  } catch (err) {
    console.error("translateText: azureTranslate failed:", err);
    return {
      source_lang: sourceHint,
      body_i18n: { [sourceHint]: text } as Record<Lang, string>,
      status: "failed",
    };
  }
}

// Resolve the caller from the Supabase auth JWT. Returns null if missing/bad
// — verify_jwt is on for every function that uses this, so a malformed token
// never reaches here, but we still need the actual user id for RLS-equivalent
// checks the service-role client no longer gets from Postgres for free.
export async function resolveUser(
  req: Request,
  // deno-lint-ignore no-explicit-any
  createAnonClient: () => any,
) {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const anon = createAnonClient();
  const { data: { user } } = await anon.auth.getUser(token);
  return user ?? null;
}
