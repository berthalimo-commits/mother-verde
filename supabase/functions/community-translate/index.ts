// community-translate — translate one post/comment body into all four platform
// languages (es, en, de, fr). Historically called at publish time by the
// client; publishing itself has since moved server-side into
// community-publish-post / community-publish-comment, which call the same
// translateText() core directly (see ../_shared/translate.ts) instead of a
// second network hop to this function. This endpoint is kept as-is — same
// contract, same behavior — in case anything else still wants a standalone
// translation (e.g. a future edit-preview) without publishing.
//
// Request  (POST, requires a Supabase auth JWT):
//   { "text": "...", "sourceHint": "es" | "en" | "de" | "fr" }
// Response (200):
//   { "source_lang": "es", "body_i18n": { es, en, de, fr }, "status": "done" | "skipped" }
// On provider failure returns 502 so the caller can fall back to storing the
// original text only and let the backfill job fill the rest later.
//
// Secrets (supabase secrets set ...):
//   AZURE_TRANSLATOR_KEY       - Azure AI Translator resource key
//   AZURE_TRANSLATOR_REGION    - e.g. "eastus" (the resource's region)
//   AZURE_TRANSLATOR_ENDPOINT  - optional, defaults to the global endpoint
// Auto-injected by Supabase: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "jsr:@supabase/supabase-js@2";
import { CORS, isLang, json, resolveUser, translateCore, type Lang } from "../_shared/translate.ts";

const MAX_LEN = 2000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const user = await resolveUser(req, () =>
    createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!)
  );
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

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const result = await translateCore(admin, text, sourceHint);
    return json(result);
  } catch (err) {
    console.error("azureTranslate failed:", err);
    return json({ error: "translation provider unavailable" }, 502);
  }
});
