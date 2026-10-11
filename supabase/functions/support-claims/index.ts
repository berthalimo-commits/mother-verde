// support-claims — on-chain check of a support contribution (USDC on Base)
// and the admin decisions on it.
//
// Deployed by pasting this file into the Supabase dashboard (self-contained).
// The "MAIL" block below is identical in admin-send-gift-code/index.ts.
//
// Request (POST, Authorization: the caller's session token):
//   { action: "verify", claim_id }        the person who made the claim, after
//       giving the transaction code. Does something ONLY if automatic
//       verification is on (app_config claim_auto_verify_enabled = 1);
//       otherwise answers { mode: "manual" }.
//   { action: "config" }                  admin: is automatic verification on?
//   { action: "admin_check", claim_id }   admin: run the checks, store the
//       result, never activates.
//   { action: "admin_approve", claim_id, reason? }  admin: activate full
//       access (the database requires a reason unless every check passed),
//       then send the 4-language confirmation e-mail.
//   { action: "admin_reject", claim_id, reason }    admin.
// "admin" = in public.admin_users with an MFA (aal2) session, checked by the
// database with the caller's own token. The approve/reject functions in the
// database check it again and write admin_audit_log.
//
// The checks (all must pass to activate automatically):
//   tx_found         the transaction exists on Base
//   tx_success       it succeeded
//   usdc_contract    it contains a USDC Transfer from the official contract
//   destination      to the support address (secret SUPPORT_ADDRESS)
//   exact_amount     for exactly the reserved amount (6 decimals)
//   after_claim      in a block mined after the amount was reserved
//   confirmations    at least claim_min_confirmations blocks on top
//   tx_unused        the code isn't used by another claim (unique in the DB)
//   claim_open       the claim isn't expired / closed and belongs to the caller
//   auto_limit       whole USDC <= claim_auto_max_usdc (only for automatic;
//                    10 flowers = 100.00xx counts as 100)
// Anything that fails -> 'manual_review' with the reason, never activation.
// Not enough confirmations yet -> stays 'submitted', checked again later.
// If the Base endpoint fails or is rate limited -> 'manual_review' with
// reason "rpc_unavailable"; it never activates on doubt.
//
// Secrets: SUPPORT_ADDRESS (the receiving address, lower case),
//   BASE_RPC_URL (optional, default https://mainnet.base.org — free, no key,
//   rate limited), APP_URL, and the mail secrets (see the MAIL block).

import { createClient } from "jsr:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.16";

// Circle's official USDC contract on Base mainnet (chain id 8453).
const USDC_BASE = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const USER_RECHECK_SECONDS = 60; // a person can ask for a new check once a minute

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

// ===================================================================== MAIL
// Two outputs, chosen with the MAIL_PROVIDER secret:
//   smtp   -> Hostinger SMTP, port 465 with SSL (Supabase blocks 25 and 587)
//   resend -> Resend HTTPS API (plan B if port 465 is blocked too)
// sendMail never throws: it returns { ok, error? }.
interface Mail { to: string; subject: string; html: string; text: string }

async function sendMail(m: Mail): Promise<{ ok: boolean; error?: string }> {
  const provider = (Deno.env.get("MAIL_PROVIDER") ?? "smtp").toLowerCase();
  const from = Deno.env.get("MAIL_FROM") ?? "Mother Verde <hello@motherverdeny.com>";
  try {
    if (provider === "resend") {
      const key = Deno.env.get("RESEND_API_KEY");
      if (!key) return { ok: false, error: "RESEND_API_KEY not set" };
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [m.to], subject: m.subject, html: m.html, text: m.text }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) return { ok: false, error: `Resend ${res.status}: ${(await res.text()).slice(0, 200)}` };
      return { ok: true };
    }
    if (provider !== "smtp") return { ok: false, error: `unknown MAIL_PROVIDER "${provider}"` };
    const user = Deno.env.get("SMTP_USER"), pass = Deno.env.get("SMTP_PASS");
    if (!user || !pass) return { ok: false, error: "SMTP_USER / SMTP_PASS not set" };
    const port = Number(Deno.env.get("SMTP_PORT") ?? "465");
    const transport = nodemailer.createTransport({
      host: Deno.env.get("SMTP_HOST") ?? "smtp.hostinger.com",
      port,
      secure: port === 465, // SSL from the first byte (465); never plain text
      auth: { user, pass },
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
    });
    await transport.sendMail({ from, to: m.to, subject: m.subject, html: m.html, text: m.text });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message ?? e).slice(0, 200) };
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

// One e-mail, four languages (Spanish first), inline styles, no images.
// blocks: [lang, title, paragraphs[]]; "highlight" is shown big in every block.
function layout(blocks: [string, string, string[]][], highlight?: string, button?: { url: string; label: string }) {
  const sec = blocks.map(([lang, title, ps], i) => `
    <tr><td style="padding:${i ? "28px" : "8px"} 32px 8px 32px;${i ? "border-top:1px solid #e3e8e2;" : ""}" lang="${lang}">
      <h2 style="margin:0 0 12px 0;font-size:19px;color:#1f3d2b;font-family:Georgia,serif;">${esc(title)}</h2>
      ${ps.map((p) => `<p style="margin:0 0 12px 0;font-size:15px;line-height:1.55;color:#2b2b2b;">${p}</p>`).join("")}
      ${highlight ? `<p style="margin:16px 0;text-align:center;"><span style="display:inline-block;padding:12px 18px;background:#f1f6ef;border:1px solid #c9dbc4;border-radius:8px;font-family:Consolas,Menlo,monospace;font-size:22px;letter-spacing:2px;color:#1f3d2b;">${esc(highlight)}</span></p>` : ""}
      ${button ? `<p style="margin:16px 0;text-align:center;"><a href="${esc(button.url)}" style="display:inline-block;padding:12px 22px;background:#2f6b45;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:15px;">${esc(button.label)}</a></p>` : ""}
    </td></tr>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f3;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f3;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;">
<tr><td style="padding:24px 32px 8px 32px;font-family:Georgia,serif;font-size:22px;color:#2f6b45;font-weight:bold;">Mother Verde</td></tr>
${sec}
<tr><td style="padding:20px 32px 24px 32px;font-size:12px;line-height:1.5;color:#6b6b6b;border-top:1px solid #e3e8e2;">Mother Verde · hello@motherverdeny.com</td></tr>
</table></td></tr></table></body></html>`;
}
function plain(blocks: [string, string, string[]][], highlight?: string, url?: string) {
  const strip = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&laquo;/g, "«").replace(/&raquo;/g, "»");
  return "Mother Verde\n\n" + blocks.map(([, t, ps]) =>
    `${t}\n\n${ps.map(strip).join("\n\n")}${highlight ? `\n\n    ${highlight}` : ""}${url ? `\n\n${url}` : ""}`).join("\n\n----------\n\n") +
    "\n\n--\nMother Verde · hello@motherverdeny.com\n";
}
// =================================================================== /MAIL

// ------------------------------------------------------------ Base JSON-RPC
async function baseRpc(method: string, params: unknown[]) {
  const url = Deno.env.get("BASE_RPC_URL") || "https://mainnet.base.org";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`rpc_unavailable: HTTP ${res.status}`);
  const j = await res.json();
  if (j.error) throw new Error(`rpc_unavailable: ${String(j.error.message ?? j.error.code).slice(0, 120)}`);
  return j.result;
}

interface Claim {
  id: number; user_id: string; amount_units: number | string; status: string;
  created_at: string; expires_at: string; tx_hash: string | null; submitted_at: string | null;
  verification: { checked_at?: string } | null;
}
interface Ctx { claim: Claim; email: string; lang: string; min_confirmations: number; auto_max_usdc: number; auto_enabled: boolean }

type Checks = Record<string, boolean>;
interface CheckResult { checks: Checks; all_pass: boolean; pending: boolean; reason: string | null; detail: Record<string, unknown> }

// Runs every check. Never throws: an RPC failure becomes a failed check.
async function checkOnChain(ctx: Ctx, callerOwnsClaim: boolean): Promise<CheckResult> {
  const c = ctx.claim;
  const checks: Checks = {
    tx_found: false, tx_success: false, usdc_contract: false, destination: false, exact_amount: false,
    after_claim: false, confirmations: false,
    tx_unused: !!c.tx_hash, // unique index in the database: a stored code is used by this claim only
    claim_open: callerOwnsClaim && ["submitted", "manual_review"].includes(c.status) &&
      !!c.submitted_at && new Date(c.submitted_at) <= new Date(c.expires_at),
    // Whole USDC, ignoring the 0.0001–0.0099 identification suffix:
    // 10 flowers (100.00xx) still counts as 100.
    auto_limit: BigInt(c.amount_units) / 1000000n <= BigInt(ctx.auto_max_usdc),
  };
  const detail: Record<string, unknown> = {};
  const dest = (Deno.env.get("SUPPORT_ADDRESS") ?? "").toLowerCase();
  const fail = (reason: string): CheckResult => ({ checks, all_pass: false, pending: false, reason, detail });
  if (!c.tx_hash) return fail("no_tx_hash");
  if (!/^0x[0-9a-f]{40}$/.test(dest)) return fail("support_address_not_configured");
  try {
    const receipt = await baseRpc("eth_getTransactionReceipt", [c.tx_hash]);
    if (!receipt) return fail("tx_not_found");
    checks.tx_found = true;
    checks.tx_success = receipt.status === "0x1";
    const want = BigInt(c.amount_units);
    // deno-lint-ignore no-explicit-any
    const transfers = (receipt.logs ?? []).filter((l: any) =>
      String(l.address).toLowerCase() === USDC_BASE && l.topics?.[0] === TRANSFER_TOPIC && l.topics.length === 3);
    checks.usdc_contract = transfers.length > 0;
    // deno-lint-ignore no-explicit-any
    const toDest = transfers.filter((l: any) => "0x" + String(l.topics[2]).slice(-40).toLowerCase() === dest);
    checks.destination = toDest.length > 0;
    // deno-lint-ignore no-explicit-any
    const received = toDest.map((l: any) => BigInt(l.data));
    checks.exact_amount = received.some((v: bigint) => v === want);
    detail.received_units = received.map(String);
    const [head, block] = await Promise.all([
      baseRpc("eth_blockNumber", []),
      baseRpc("eth_getBlockByNumber", [receipt.blockNumber, false]),
    ]);
    const conf = Number(BigInt(head) - BigInt(receipt.blockNumber) + 1n);
    detail.confirmations = conf;
    checks.confirmations = conf >= ctx.min_confirmations;
    const mined = Number(BigInt(block?.timestamp ?? "0x0")) * 1000;
    detail.mined_at = mined ? new Date(mined).toISOString() : null;
    // 2 minutes of tolerance for clock differences.
    checks.after_claim = mined >= new Date(c.created_at).getTime() - 120000;
  } catch (e) {
    return fail(String((e as Error).message ?? e).slice(0, 200).startsWith("rpc_unavailable")
      ? String((e as Error).message).slice(0, 200) : "rpc_unavailable: " + String((e as Error).message ?? e).slice(0, 150));
  }
  const failed = Object.entries(checks).filter(([k, v]) => !v && k !== "auto_limit").map(([k]) => k);
  // Only "not enough confirmations yet" is worth waiting for.
  if (failed.length === 1 && failed[0] === "confirmations") {
    return { checks, all_pass: false, pending: true, reason: "waiting_confirmations", detail };
  }
  return { checks, all_pass: failed.length === 0, pending: false, reason: failed.length ? "failed: " + failed.join(", ") : null, detail };
}

function activationEmail(flowers: number, appUrl: string): Mail & { to: "" } {
  const blocks: [string, string, string[]][] = [
    ["es", "Tu acceso completo está activo", [
      `Recibimos tu aporte de ${flowers} ${flowers === 1 ? "flor" : "flores"} y ya activamos el acceso completo en tu cuenta de Mother Verde.`,
      "Gracias por apoyar Canna Wasi. Si no hiciste este aporte, responde a este correo.",
    ]],
    ["en", "Your full access is active", [
      `We received your contribution of ${flowers} ${flowers === 1 ? "flower" : "flowers"} and full access is now active on your Mother Verde account.`,
      "Thank you for supporting Canna Wasi. If you didn't make this contribution, reply to this e-mail.",
    ]],
    ["de", "Dein Vollzugriff ist aktiv", [
      `Wir haben deinen Beitrag von ${flowers} ${flowers === 1 ? "Blüte" : "Blüten"} erhalten, und der Vollzugriff ist in deinem Mother-Verde-Konto jetzt aktiv.`,
      "Danke, dass du Canna Wasi unterstützt. Falls du diesen Beitrag nicht geleistet hast, antworte auf diese E-Mail.",
    ]],
    ["fr", "Ton accès complet est actif", [
      `Nous avons reçu ta contribution de ${flowers} ${flowers === 1 ? "fleur" : "fleurs"} et l'accès complet est maintenant actif sur ton compte Mother Verde.`,
      "Merci de soutenir Canna Wasi. Si tu n'as pas fait cette contribution, réponds à cet e-mail.",
    ]],
  ];
  return {
    to: "",
    subject: "Acceso completo activo · Full access active · Vollzugriff aktiv · Accès complet actif — Mother Verde",
    html: layout(blocks, undefined, { url: appUrl, label: "Mother Verde" }),
    text: plain(blocks, undefined, appUrl),
  };
}

// deno-lint-ignore no-explicit-any
async function sendActivation(svc: any, ctx: Ctx, actor: string | null, label: string) {
  const flowers = Number((ctx.claim as unknown as { flowers: number }).flowers ?? 1);
  const m = activationEmail(flowers, Deno.env.get("APP_URL") ?? "https://www.motherverdeny.com");
  const r = await sendMail({ ...m, to: ctx.email });
  await svc.rpc("admin_log", {
    p_action: r.ok ? "activation_email_sent" : "activation_email_failed", p_target_user: ctx.claim.user_id,
    p_reason: r.ok ? null : r.error, p_details: { claim_id: ctx.claim.id, by: actor }, p_actor_label: label,
  });
  return r;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const url = Deno.env.get("SUPABASE_URL")!, anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const { data: { user } } = await createClient(url, anonKey).auth.getUser(token);
  if (!user) return json({ error: "unauthorized" }, 401);

  let body: { action?: unknown; claim_id?: unknown; reason?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const claimId = Number(body.claim_id);
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : null;

  const svc = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const asCaller = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const loadCtx = async (): Promise<Ctx | null> => {
    if (!Number.isInteger(claimId) || claimId <= 0) return null;
    const { data, error } = await svc.rpc("svc_claim_context", { p_claim_id: claimId });
    if (error) throw new Error(error.message);
    return data as Ctx | null;
  };
  const record = (r: CheckResult, toManual: boolean) => svc.rpc("svc_record_claim_check", {
    p_claim_id: claimId,
    p_verification: { ...r, checked_at: new Date().toISOString() },
    p_to_manual: toManual, p_reason: toManual ? r.reason : null,
  });

  try {
    // ---------------------------------------------------------- the person
    if (body.action === "verify") {
      const ctx = await loadCtx();
      if (!ctx || ctx.claim.user_id !== user.id) return json({ error: "not_found" }, 404);
      if (!ctx.auto_enabled) return json({ ok: true, mode: "manual", status: ctx.claim.status });
      if (ctx.claim.status !== "submitted") return json({ ok: true, mode: "auto", status: ctx.claim.status });
      const last = ctx.claim.verification?.checked_at ? new Date(ctx.claim.verification.checked_at).getTime() : 0;
      if (Date.now() - last < USER_RECHECK_SECONDS * 1000) return json({ error: "too_soon" }, 429);
      const r = await checkOnChain(ctx, true);
      if (r.pending) { await record(r, false); return json({ ok: true, mode: "auto", status: "submitted", pending: true }); }
      if (!r.all_pass || !r.checks.auto_limit) {
        if (r.all_pass) r.reason = "over_auto_limit";
        await record(r, true);
        return json({ ok: true, mode: "auto", status: "manual_review" });
      }
      await record(r, false);
      const { error: apErr } = await svc.rpc("svc_approve_claim", {
        p_claim_id: claimId, p_actor: null, p_actor_label: "auto-verify", p_reason: "all checks passed",
      });
      if (apErr) throw new Error(apErr.message);
      const mail = await sendActivation(svc, ctx, null, "auto-verify");
      return json({ ok: true, mode: "auto", status: "approved", email_sent: mail.ok });
    }

    // ---------------------------------------------------------- admins only
    const { data: isAdmin, error: admErr } = await asCaller.rpc("is_admin_aal2");
    if (admErr) throw new Error(admErr.message);
    if (isAdmin !== true) return json({ error: "not_allowed" }, 403);
    const label = user.email ?? user.id;

    if (body.action === "config") {
      const { data: on } = await svc.rpc("app_config_value", { p_key: "claim_auto_verify_enabled", p_default: 0 });
      return json({ ok: true, auto_enabled: on === 1, support_address_set: /^0x[0-9a-fA-F]{40}$/.test(Deno.env.get("SUPPORT_ADDRESS") ?? "") });
    }
    if (body.action === "admin_check") {
      const ctx = await loadCtx();
      if (!ctx) return json({ error: "not_found" }, 404);
      if (!["submitted", "manual_review"].includes(ctx.claim.status)) return json({ error: "claim_closed" }, 409);
      const r = await checkOnChain(ctx, true);
      const { error } = await record(r, !r.all_pass && !r.pending);
      if (error) throw new Error(error.message);
      return json({ ok: true, result: r });
    }
    if (body.action === "admin_approve") {
      const ctx = await loadCtx();
      if (!ctx) return json({ error: "not_found" }, 404);
      const { error } = await asCaller.rpc("admin_approve_claim", { p_claim_id: claimId, p_reason: reason });
      if (error) {
        const known = ["reason_required", "not_found_or_closed", "not_allowed"].find((k) => error.message.includes(k));
        return json({ error: known ?? "could_not_approve" }, known ? 400 : 500);
      }
      const mail = await sendActivation(svc, ctx, user.id, label);
      return json({ ok: true, status: "approved", email_sent: mail.ok, email_error: mail.ok ? undefined : mail.error });
    }
    if (body.action === "admin_reject") {
      const { error } = await asCaller.rpc("admin_reject_claim", { p_claim_id: claimId, p_reason: reason });
      if (error) {
        const known = ["reason_required", "not_found", "not_allowed"].find((k) => error.message.includes(k));
        return json({ error: known ?? "could_not_reject" }, known ? 400 : 500);
      }
      return json({ ok: true, status: "rejected" });
    }
    return json({ error: "bad_action" }, 400);
  } catch (e) {
    console.error("support-claims:", (e as Error).message);
    return json({ error: "server_error" }, 500);
  }
});
