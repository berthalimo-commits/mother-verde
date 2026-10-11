// community-retranslate — once a day, retries posts and comments that were
// published untranslated (translation_status = 'failed').
//
// Called by the daily Vercel job (api/subscription-cron.js, 23:00 UTC) with
// the header  x-retranslate-secret: <RETRANSLATE_SECRET>. Any other caller
// gets 401. Deployed by pasting this file into the Supabase dashboard
// (self-contained). The DeepL + translation_cache core is the same as in
// community-publish-post/index.ts.
//
// Per run: at most MAX_ROWS rows, oldest first. Each retry reserves its
// characters from the same global daily counter (deepl_reserve_chars), so the
// daily cap in public.app_config holds for publishing and retrying together.
//   translated            -> 'done'
//   daily cap reached     -> stop the run, the row keeps its attempts
//   DeepL 456 (quota)     -> stop the run, the row keeps its attempts
//   any other failure     -> attempts + 1; at MAX_ATTEMPTS -> 'gave_up'
//                            (stays in its original language, with the
//                            "translation pending" note)
// Response: { ok, done, failed, gave_up, stopped: null | "cap" | "quota" }
//
// Secrets: RETRANSLATE_SECRET (same value as in Vercel), DEEPL_API_KEY.

import { createClient } from "jsr:@supabase/supabase-js@2";

const MAX_ROWS = 20;
const MAX_ATTEMPTS = 5;
const PLATFORM_LANGS = ["es", "en", "de", "fr"] as const;
type Lang = (typeof PLATFORM_LANGS)[number];
const DEEPL_TARGET_LANG: Record<Lang, string> = { es: "ES", en: "EN-US", de: "DE", fr: "FR" };

const isLang = (x: unknown): x is Lang => typeof x === "string" && (PLATFORM_LANGS as readonly string[]).includes(x);
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

async function sha256Hex(input: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function sameSecret(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

class QuotaError extends Error {}

async function deeplTranslate(text: string, targets: Lang[]) {
  const key = Deno.env.get("DEEPL_API_KEY");
  if (!key) throw new Error("DeepL API key not configured");
  const endpoint = key.endsWith(":fx") ? "https://api-free.deepl.com/v2/translate" : "https://api.deepl.com/v2/translate";
  const results = await Promise.all(targets.map(async (target) => {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `DeepL-Auth-Key ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text: [text], target_lang: DEEPL_TARGET_LANG[target] }),
    });
    if (res.status === 456) throw new QuotaError("DeepL 456: quota exceeded");
    if (!res.ok) throw new Error(`DeepL ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const entry = (await res.json())?.translations?.[0];
    if (!entry?.text) throw new Error("DeepL: unexpected response shape");
    return { target, text: entry.text as string, detected: String(entry.detected_source_language ?? "").toLowerCase() };
  }));
  const translations: Partial<Record<Lang, string>> = {};
  for (const r of results) translations[r.target] = r.text;
  return { detected: results[0]?.detected ?? "", translations };
}

type Outcome =
  | { kind: "done"; body_i18n: Record<Lang, string>; source_lang: Lang }
  | { kind: "cap" } | { kind: "quota" } | { kind: "error"; message: string };

// deno-lint-ignore no-explicit-any
async function retranslate(admin: any, text: string, source: Lang): Promise<Outcome> {
  const contentHash = await sha256Hex(text.trim().replace(/\s+/g, " ").toLowerCase());
  const { data: cached } = await admin.from("translation_cache").select("translations")
    .eq("source_lang", source).eq("content_hash", contentHash).maybeSingle();
  if (cached?.translations) return { kind: "done", body_i18n: cached.translations, source_lang: source };

  const targets = PLATFORM_LANGS.filter((l) => l !== source);
  const { data: allowed, error: capErr } = await admin.rpc("deepl_reserve_chars", { p_chars: text.length * targets.length });
  if (capErr) return { kind: "error", message: "deepl_reserve_chars: " + capErr.message };
  if (allowed !== true) return { kind: "cap" };
  try {
    const deepl = await deeplTranslate(text, targets);
    const detected = isLang(deepl.detected) ? deepl.detected : source;
    const draft: Partial<Record<Lang, string>> = { ...deepl.translations, [detected]: text };
    for (const l of PLATFORM_LANGS) if (!draft[l]) draft[l] = text;
    await admin.from("translation_cache").upsert({
      source_lang: source, content_hash: contentHash, translations: draft, hit_count: 0, last_hit_at: null,
    });
    return { kind: "done", body_i18n: draft as Record<Lang, string>, source_lang: detected };
  } catch (e) {
    if (e instanceof QuotaError) return { kind: "quota" };
    return { kind: "error", message: String((e as Error).message ?? e).slice(0, 200) };
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!sameSecret(req.headers.get("x-retranslate-secret") ?? "", Deno.env.get("RETRANSLATE_SECRET") ?? "")) {
    return json({ error: "unauthorized" }, 401);
  }
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const rows: { table: string; id: string; body: string; source_lang: string; translation_attempts: number; created_at: string }[] = [];
  for (const table of ["community_posts", "community_comments"]) {
    const { data, error } = await admin.from(table)
      .select("id, body, source_lang, translation_attempts, created_at")
      .eq("translation_status", "failed").lt("translation_attempts", MAX_ATTEMPTS)
      .order("created_at", { ascending: true }).limit(MAX_ROWS);
    if (error) return json({ error: `select ${table}: ${error.message}` }, 500);
    for (const r of data ?? []) rows.push({ table, ...r });
  }
  rows.sort((a, b) => a.created_at.localeCompare(b.created_at));

  const out = { ok: true, done: 0, failed: 0, gave_up: 0, stopped: null as null | "cap" | "quota", errors: [] as string[] };
  for (const r of rows.slice(0, MAX_ROWS)) {
    if (!r.body || !r.body.trim()) continue;
    const res = await retranslate(admin, r.body, isLang(r.source_lang) ? r.source_lang : "es");
    if (res.kind === "cap" || res.kind === "quota") { out.stopped = res.kind; break; }
    const now = new Date().toISOString();
    let patch: Record<string, unknown>;
    if (res.kind === "done") {
      patch = { body_i18n: res.body_i18n, source_lang: res.source_lang, translation_status: "done",
                translation_attempts: r.translation_attempts + 1, translation_last_attempt_at: now };
      out.done++;
    } else {
      const attempts = r.translation_attempts + 1;
      const gaveUp = attempts >= MAX_ATTEMPTS;
      patch = { translation_attempts: attempts, translation_last_attempt_at: now, translation_status: gaveUp ? "gave_up" : "failed" };
      if (gaveUp) out.gave_up++; else out.failed++;
      out.errors.push(`${r.table} ${r.id}: ${res.message}`);
    }
    const { error } = await admin.from(r.table).update(patch).eq("id", r.id).eq("translation_status", "failed");
    if (error) out.errors.push(`update ${r.table} ${r.id}: ${error.message}`);
  }
  if (out.errors.length) console.error("community-retranslate:", JSON.stringify(out.errors));
  return json(out);
});
