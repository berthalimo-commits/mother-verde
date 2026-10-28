// signup-fix-email — "I mistyped my e-mail": correct the e-mail of an account
// that was just created and is still unconfirmed, without creating a second
// account. The app then asks Supabase to send the confirmation again to the
// corrected address (supabase.auth.resend), from the person's own browser.
//
// Deployed by pasting this file into the Supabase dashboard (self-contained).
// Turn OFF "Verify JWT" for this function: the person has no session yet
// (an unconfirmed account can't sign in).
//
// Request (POST): { old_email, new_email, password, captcha_token? }
// Proof that it's the person who created the account: the password. Supabase
// answers a sign-in with the right password on an unconfirmed account with
// "email_not_confirmed", and with "invalid_credentials" otherwise; the session
// of an already confirmed account is thrown away at once.
// Limits (svc_signup_fix_gate, checked BEFORE the password): 5 wrong
// passwords an hour or 10 attempts a day for the same old address, 3 a day
// towards the same new address, 60 an hour in total; at most 3 successful
// corrections per account. After a correction the link already sent to the
// old address no longer works (svc_signup_fix_finish).
// Responses:
//   200 { ok: true }
//   400 { error: "bad_email" | "same_email" | "invalid_json" }
//   403 { error: "wrong_password" }        (also for an unknown address: same answer)
//   409 { error: "already_confirmed" }     (sign in and change it in Cuenta)
//   409 { error: "not_allowed" }           (blocked domain, or it has an account)
//   409 { error: "too_old" }               (unconfirmed for more than 7 days)
//   409 { error: "limit_reached" }         (already corrected 3 times)
//   429 { error: "too_many_attempts" }
//   500 { error: "server_error" }
// Logged: signup_fix_attempts (address fingerprints only) and mail_events
// (kind signup_email_fixed, account id only).

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: { old_email?: unknown; new_email?: unknown; password?: unknown; captcha_token?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const oldEmail = typeof body.old_email === "string" ? body.old_email.trim().toLowerCase() : "";
  const newEmail = typeof body.new_email === "string" ? body.new_email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!EMAIL_RE.test(oldEmail) || !EMAIL_RE.test(newEmail) || newEmail.length > 254) return json({ error: "bad_email" }, 400);
  if (oldEmail === newEmail) return json({ error: "same_email" }, 400);
  if (!password) return json({ error: "wrong_password" }, 403);

  const url = Deno.env.get("SUPABASE_URL")!, anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const svc = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
  // Every request that gets this far is counted (only fingerprints of the
  // addresses are stored), whatever the outcome.
  const log = (outcome: string, user: string | null = null) =>
    svc.rpc("svc_signup_fix_log", { p_old: oldEmail, p_new: newEmail, p_user: user, p_outcome: outcome });
  try {
    // 0. Limits, BEFORE trying the password: no password guessing, no
    //    confirmation e-mails to many addresses (svc_signup_fix_gate).
    const { data: gate, error: gateErr } = await svc.rpc("svc_signup_fix_gate", { p_old: oldEmail, p_new: newEmail });
    if (gateErr) throw new Error(gateErr.message);
    if (gate !== "ok") return json({ error: "too_many_attempts" }, 429);

    // 1. The password, checked by Supabase itself.
    const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: oldEmail, password,
        ...(typeof body.captcha_token === "string" ? { gotrue_meta_security: { captcha_token: body.captcha_token } } : {}),
      }),
      signal: AbortSignal.timeout(10000),
    });
    const r = await res.json().catch(() => ({}));
    if (res.ok) {
      // Right password, but the account is already confirmed: no change here.
      if (r.access_token) {
        await fetch(`${url}/auth/v1/logout?scope=local`, { method: "POST", headers: { apikey: anonKey, Authorization: `Bearer ${r.access_token}` } }).catch(() => {});
      }
      await log("already_confirmed");
      return json({ error: "already_confirmed" }, 409);
    }
    const code = String(r.error_code ?? r.code ?? "");
    if (code !== "email_not_confirmed") {
      // Wrong password and unknown address: the same answer, counted the same.
      await log("wrong_password");
      return json({ error: "wrong_password" }, 403);
    }

    // 2. Same rules as a new sign-up for the corrected address, at most 3
    //    corrections per account, account not older than 7 days.
    const { data: id, error: chkErr } = await svc.rpc("svc_signup_email_fix", { p_old: oldEmail, p_new: newEmail });
    if (chkErr) {
      const known = ["bad_email", "not_found", "too_old", "limit_reached", "not_allowed"].find((k) => chkErr.message.includes(k));
      if (!known) throw new Error(chkErr.message);
      await log(known);
      // not_found = confirmed in the meantime.
      if (known === "bad_email") return json({ error: "bad_email" }, 400);
      return json({ error: known === "not_found" ? "already_confirmed" : known }, 409);
    }

    // 3. Change it (stays unconfirmed; profiles.email_normalized follows by
    //    trigger), then kill the link already sent to the old address.
    const { error: upErr } = await svc.auth.admin.updateUserById(id as string, { email: newEmail });
    if (upErr) throw new Error(upErr.message);
    const { error: finErr } = await svc.rpc("svc_signup_fix_finish", { p_user: id, p_old: oldEmail, p_new: newEmail });
    if (finErr) throw new Error(finErr.message);
    await svc.rpc("svc_mail_event", { p_kind: "signup_email_fixed", p_ok: true, p_provider: "supabase", p_attempts: 1, p_error: null, p_user: id, p_ref: null });
    return json({ ok: true });
  } catch (e) {
    // Never the addresses or the password in the log.
    console.error("signup-fix-email:", String((e as Error).message ?? e).replace(/[^\s@<>"']+@[^\s@<>"']+/g, "<correo>").slice(0, 200));
    return json({ error: "server_error" }, 500);
  }
});
