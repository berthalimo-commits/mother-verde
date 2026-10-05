// delete-account — permanently delete the caller's account and everything
// tied to it (GDPR right to erasure, offered from Cuenta → "Eliminar mi cuenta").
//
// Order matters, and every step must succeed before the next one runs:
//   1. Who: the caller comes from their JWT, never from the request body.
//   2. Re-check the password here, server-side — a stolen session token alone
//      must not be enough to wipe an account.
//   3. Refuse the official Mother Verde account and anyone with a live
//      payment-processor subscription (they'd keep being charged with no
//      account to cancel from).
//   4. Delete translation_cache rows built from their posts/comments — that
//      table stores the full text and would otherwise outlive the account.
//   5. Delete every file under <uid>/ in the community-photos bucket
//      (avatar + post photos). Done before the user row so that a failure
//      here aborts with the account intact and the person can simply retry,
//      instead of leaving orphaned public photos behind a "deleted" account.
//   6. Delete the auth user. Every user-owned table references auth.users
//      with ON DELETE CASCADE (profiles, bitacora_entries, community_members,
//      community_posts, community_comments, community_follows,
//      community_swipes, community_reports), so the rows go with it.
//      Comments other people left on this person's posts go too (post_id
//      cascade).
//
// Deployed by pasting into the Supabase dashboard function editor (no CLI
// login in this environment) — self-contained on purpose, like the
// community-publish-* functions.
//
// Request  (POST, requires a Supabase auth JWT):
//   { "password": string, "confirm": "DELETE" }
// Responses:
//   200 { ok: true, removed: { files, cacheRows } }
//   400 { error: "confirmation required" | "invalid JSON" | "missing password" }
//   401 { error: "unauthorized" }
//   403 { error: "wrong password" }
//   409 { error: "official account" | "active subscription" }
//   500 { error: "could not delete account", step }

import { createClient } from "jsr:@supabase/supabase-js@2";

const BUCKET = "community-photos";

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

// Must match normalizeForHash/sha256Hex in the community-publish-* functions,
// which is how translation_cache keys are built.
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

class StepError extends Error {
  constructor(public step: string, message: string) {
    super(message);
  }
}

// deno-lint-ignore no-explicit-any
async function must<T>(query: PromiseLike<{ data: T; error: any }>, step: string): Promise<T> {
  const { data, error } = await query;
  if (error) throw new StepError(step, error.message ?? String(error));
  return data;
}

// Storage list() is one level deep: folders come back with id === null.
// deno-lint-ignore no-explicit-any
async function listAllFiles(admin: any, prefix: string): Promise<string[]> {
  const files: string[] = [];
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const entries = await must<{ name: string; id: string | null }[]>(
      admin.storage.from(BUCKET).list(prefix, { limit: PAGE, offset }),
      "storage: list",
    );
    for (const e of entries ?? []) {
      const path = `${prefix}/${e.name}`;
      if (e.id === null) files.push(...await listAllFiles(admin, path));
      else files.push(path);
    }
    if (!entries || entries.length < PAGE) break;
  }
  return files;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

  // 1. Who is calling.
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const anon = createClient(url, anonKey, noSession);
  const { data: { user } } = await anon.auth.getUser(token);
  if (!user || !user.email) return json({ error: "unauthorized" }, 401);

  let payload: { password?: unknown; confirm?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }
  if (payload.confirm !== "DELETE") return json({ error: "confirmation required" }, 400);
  const password = typeof payload.password === "string" ? payload.password : "";
  if (!password) return json({ error: "missing password" }, 400);

  // 2. Re-check the password. A throwaway client, so the session it creates
  //    isn't kept anywhere; it dies with the user in step 6 anyway.
  const verifier = createClient(url, anonKey, noSession);
  const { error: pwError } = await verifier.auth.signInWithPassword({
    email: user.email,
    password,
  });
  if (pwError) return json({ error: "wrong password" }, 403);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, noSession);
  const uid = user.id;

  try {
    // 3. Accounts that must not be deleted this way.
    const member = await must<{ verified_type: string | null } | null>(
      admin.from("community_members").select("verified_type").eq("user_id", uid).maybeSingle(),
      "check: member",
    );
    if (member?.verified_type === "official") return json({ error: "official account" }, 409);

    const profile = await must<{ payment_subscription_id: string | null; subscription_status: string | null } | null>(
      admin.from("profiles").select("payment_subscription_id, subscription_status").eq("id", uid).maybeSingle(),
      "check: profile",
    );
    // TODO(payment-cloud): once the processor is live, cancel the processor
    // subscription here instead of refusing.
    if (
      profile?.payment_subscription_id &&
      ["trialing", "active", "past_due"].includes(profile.subscription_status ?? "")
    ) {
      return json({ error: "active subscription" }, 409);
    }

    // 4. Cached translations of their own texts.
    const posts = await must<{ body: string | null }[]>(
      admin.from("community_posts").select("body").eq("user_id", uid),
      "cache: posts",
    );
    const comments = await must<{ body: string | null }[]>(
      admin.from("community_comments").select("body").eq("user_id", uid),
      "cache: comments",
    );
    const texts = [...posts, ...comments].map((r) => r.body).filter((b): b is string => !!b && !!b.trim());
    const hashes = [...new Set(await Promise.all(texts.map((t) => sha256Hex(normalizeForHash(t)))))];
    let cacheRows = 0;
    for (let i = 0; i < hashes.length; i += 100) {
      const deleted = await must<unknown[]>(
        admin.from("translation_cache").delete().in("content_hash", hashes.slice(i, i + 100)).select("content_hash"),
        "cache: delete",
      );
      cacheRows += deleted?.length ?? 0;
    }

    // 5. Their files in Storage.
    const files = await listAllFiles(admin, uid);
    for (let i = 0; i < files.length; i += 100) {
      await must(admin.storage.from(BUCKET).remove(files.slice(i, i + 100)), "storage: remove");
    }
    const left = await listAllFiles(admin, uid);
    if (left.length) throw new StepError("storage: verify", `${left.length} file(s) still present`);

    // 6. The account itself (cascades to every user-owned table).
    const { error: delError } = await admin.auth.admin.deleteUser(uid);
    if (delError) throw new StepError("auth: delete user", delError.message);

    return json({ ok: true, removed: { files: files.length, cacheRows } });
  } catch (err) {
    const step = err instanceof StepError ? err.step : "unknown";
    console.error("delete-account failed:", step, err);
    return json({ error: "could not delete account", step }, 500);
  }
});
