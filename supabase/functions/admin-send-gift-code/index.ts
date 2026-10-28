// admin-send-gift-code — admin panel: e-mail a gift code, or send a test
// e-mail to the admin's own address.
//
// Deployed by pasting this file into the Supabase dashboard (self-contained,
// no relative imports). The "MAIL" block below is identical in
// support-claims/index.ts — keep both copies the same.
//
// Request (POST, Authorization: the admin's session token):
//   { action: "send", email }   -> generates a code here, stores only its
//                                   hash, e-mails it (one e-mail, 4 languages)
//   { action: "test_email" }    -> sends a test e-mail to the admin's own
//                                   address; creates no code
// Response: { ok: true, ... } or { error: "<code>", detail? }
//
// Who may call it: an account in public.admin_users whose session passed MFA
// (aal2). Checked by the database itself (rpc is_admin_aal2 with the caller's
// token: PostgREST verifies the token's signature, so the aal claim can't be
// forged). Limits (20 codes/day in total, 3 per address), blocked e-mail
// domains and the audit log live in the database (svc_reserve_sent_gift_code,
// svc_finish_sent_gift_code). If the e-mail can't be sent, the code is voided
// and the error is returned. The code itself is never stored or logged.
//
// Secrets (Supabase -> Edge Functions -> Secrets), set by the owner:
//   MAIL_PROVIDER  "smtp" (default), "resend", or "smtp,resend" (Resend
//                  automatically when Hostinger still fails after its retry)
//   MAIL_RETRY_MS  optional, pause before the retry (default 2000)
//   MAIL_FROM      e.g. Mother Verde <hello@motherverdeny.com>
//   SMTP_HOST      smtp.hostinger.com    SMTP_PORT 465 (SSL)
//   SMTP_USER      hello@motherverdeny.com   SMTP_PASS  (mailbox password)
//   RESEND_API_KEY (for "resend" and "smtp,resend")
//   APP_URL        https://www.motherverdeny.com (link in the e-mail)

import { createClient } from "jsr:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.16";

const CODE_DAYS = 7;        // days of full access the code gives
const CODE_VALID_DAYS = 7;  // days to redeem it

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

// ===================================================================== MAIL
// Outputs, chosen with the MAIL_PROVIDER secret (tried in that order):
//   smtp         -> Hostinger SMTP, port 465 with SSL (Supabase blocks 25 and 587)
//   resend       -> Resend HTTPS API
//   smtp,resend  -> Hostinger first; if it still fails after its retry,
//                   Resend automatically (needs RESEND_API_KEY and the domain
//                   verified in Resend)
// Each output gets 2 tries (MAIL_RETRY_MS apart, default 2 s), except when a
// secret is missing. sendMail never throws: { ok, provider, attempts, error? }.
// deliver() also writes one mail_events row (kind, ok, provider, attempts,
// error) — never the address or the content — so a failure always shows up
// in the panel ("Correos fallidos en las últimas 24 h", Registro).
// Every e-mail: one sender (MAIL_FROM, "Mother Verde <hello@...>"), replies
// to hello@, an HTML part and a plain-text part.
const REPLY_TO = "hello@motherverdeny.com";
interface Mail { to: string; subject: string; html: string; text: string }
interface Sent { ok: boolean; provider: string; attempts: number; error?: string }
// E-mail addresses never go into a log or an error shown in the panel.
const redact = (s: string) => s.replace(/[^\s<>"'(),;:=]+@[^\s<>"'(),;:=]+/g, "<correo>");

async function sendMail(m: Mail): Promise<Sent> {
  const chain = (Deno.env.get("MAIL_PROVIDER") ?? "smtp").toLowerCase().split(/[\s,+]+/).filter(Boolean);
  const pause = Number(Deno.env.get("MAIL_RETRY_MS") ?? "2000");
  const errors: string[] = [];
  let attempts = 0;
  for (const provider of chain) {
    for (let i = 1; i <= 2; i++) {
      attempts++;
      const r = await sendVia(provider, m);
      if (r.ok) return { ok: true, provider, attempts, error: errors.length ? redact(errors.join("; ")).slice(0, 300) : undefined };
      errors.push(`${provider}#${i}: ${r.error}`);
      if (r.config) break;                       // a missing secret: trying again won't help
      if (i === 1 && pause > 0) await new Promise((res) => setTimeout(res, pause));
    }
  }
  return { ok: false, provider: chain.join(","), attempts, error: redact(errors.join("; ")).slice(0, 300) };
}

// deno-lint-ignore no-explicit-any
async function deliver(svc: any, m: Mail, kind: string, userId: string | null, ref: string | null): Promise<Sent> {
  const r = await sendMail(m);
  const { error } = await svc.rpc("svc_mail_event", {
    p_kind: kind, p_ok: r.ok, p_provider: r.provider, p_attempts: r.attempts, p_error: r.error ?? null, p_user: userId, p_ref: ref,
  });
  if (error) console.error("svc_mail_event:", error.message);
  if (!r.ok) console.error(`mail ${kind} failed after ${r.attempts} attempts:`, r.error);
  return r;
}

async function sendVia(provider: string, m: Mail): Promise<{ ok: boolean; error?: string; config?: boolean }> {
  const from = Deno.env.get("MAIL_FROM") ?? "Mother Verde <hello@motherverdeny.com>";
  try {
    if (provider === "resend") {
      const key = Deno.env.get("RESEND_API_KEY");
      if (!key) return { ok: false, error: "RESEND_API_KEY not set", config: true };
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [m.to], reply_to: REPLY_TO, subject: m.subject, html: m.html, text: m.text }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) return { ok: false, error: `Resend ${res.status}: ${(await res.text()).slice(0, 200)}` };
      return { ok: true };
    }
    if (provider !== "smtp") return { ok: false, error: `unknown MAIL_PROVIDER "${provider}"`, config: true };
    const user = Deno.env.get("SMTP_USER"), pass = Deno.env.get("SMTP_PASS");
    if (!user || !pass) return { ok: false, error: "SMTP_USER / SMTP_PASS not set", config: true };
    const port = Number(Deno.env.get("SMTP_PORT") ?? "465");
    const transport = nodemailer.createTransport({
      host: Deno.env.get("SMTP_HOST") ?? "smtp.hostinger.com",
      port,
      secure: port === 465, // SSL from the first byte (465); never plain text
      auth: { user, pass },
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
    });
    await transport.sendMail({ from, to: m.to, replyTo: REPLY_TO, subject: m.subject, html: m.html, text: m.text });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message ?? e).slice(0, 200) };
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

// One e-mail, four languages (Spanish first), inline styles, no images, light
// colours declared for dark-mode clients. blocks: [lang, title, paragraphs[]];
// "highlight" is shown big in every block.
function layout(blocks: [string, string, string[]][], highlight?: string, button?: { url: string; label: string }) {
  const sec = blocks.map(([lang, title, ps], i) => `
    <tr><td style="padding:${i ? "28px" : "8px"} 24px 8px 24px;${i ? "border-top:1px solid #e3e8e2;" : ""}" lang="${lang}">
      <h2 style="margin:0 0 12px 0;font-size:19px;color:#1f3d2b;font-family:Georgia,serif;">${esc(title)}</h2>
      ${ps.map((p) => `<p style="margin:0 0 12px 0;font-size:15px;line-height:1.55;color:#2b2b2b;">${p}</p>`).join("")}
      ${highlight ? `<p style="margin:16px 0;text-align:center;"><span style="display:inline-block;padding:12px 18px;background:#f1f6ef;border:1px solid #c9dbc4;border-radius:8px;font-family:Consolas,Menlo,monospace;font-size:22px;letter-spacing:2px;color:#1f3d2b;">${esc(highlight)}</span></p>` : ""}
      ${button ? `<p style="margin:16px 0;text-align:center;"><a href="${esc(button.url)}" style="display:inline-block;padding:12px 22px;background:#2f6b45;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:15px;">${esc(button.label)}</a></p>` : ""}
    </td></tr>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>Mother Verde</title></head>
<body style="margin:0;padding:0;background:#f4f6f3;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f3;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;">
<tr><td style="padding:24px 24px 8px 24px;font-family:Georgia,serif;font-size:22px;color:#2f6b45;font-weight:bold;">Mother Verde</td></tr>
${sec}
<tr><td style="padding:20px 24px 24px 24px;font-size:12px;line-height:1.5;color:#6b6b6b;border-top:1px solid #e3e8e2;">Mother Verde · hello@motherverdeny.com</td></tr>
</table></td></tr></table></body></html>`;
}
// Plain-text part: same words, the link once at the end.
function plain(blocks: [string, string, string[]][], highlight?: string, url?: string) {
  const strip = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&laquo;/g, "«").replace(/&raquo;/g, "»");
  return "Mother Verde\n\n" + blocks.map(([, t, ps]) =>
    `${t}\n\n${ps.map(strip).join("\n\n")}${highlight ? `\n\n    ${highlight}` : ""}`).join("\n\n----------\n\n") +
    (url ? `\n\n----------\n\n${url}` : "") + "\n\n--\nMother Verde · hello@motherverdeny.com\n";
}
// =================================================================== /MAIL

// Same alphabet and normalization as the database (gift_code_generate,
// gift_code_hash): no I, O, 0 or 1.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generateCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const c = [...bytes].map((b) => ALPHABET[b % 32]).join(""); // 256 % 32 = 0 -> uniform
  return `${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8, 12)}`;
}
async function codeHash(code: string): Promise<string> {
  const norm = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(norm));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fmtDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

function giftEmail(code: string, expiresAt: string, appUrl: string): Mail & { to: "" } {
  const d = CODE_DAYS;
  const blocks: [string, string, string[]][] = [
    ["es", "Tienes un código de regalo", [
      `Te regalamos ${d} días de acceso completo a Mother Verde.`,
      `Úsalo antes del ${fmtDate(expiresAt, "es-ES")} (UTC): inicia sesión, toca el icono de persona arriba a la derecha para abrir <b>Tu cuenta</b> y pulsa <b>&laquo;Tengo un código de regalo&raquo;</b>.`,
      "Necesitas una cuenta con el correo confirmado. El código sirve una sola vez. Si no esperabas este correo, puedes ignorarlo.",
    ]],
    ["en", "You have a gift code", [
      `We're giving you ${d} days of full access to Mother Verde.`,
      `Use it before ${fmtDate(expiresAt, "en-US")} (UTC): sign in, tap the person icon at the top right to open <b>Your account</b> and press <b>“I have a gift code”</b>.`,
      "You need an account with a confirmed e-mail. The code works only once. If you weren't expecting this e-mail, you can ignore it.",
    ]],
    ["de", "Du hast einen Geschenkcode", [
      `Wir schenken dir ${d} Tage Vollzugriff auf Mother Verde.`,
      `Löse ihn bis zum ${fmtDate(expiresAt, "de-DE")} (UTC) ein: Melde dich an, tippe oben rechts auf das Personen-Symbol, um <b>Dein Konto</b> zu öffnen, und wähle <b>„Ich habe einen Geschenkcode“</b>.`,
      "Du brauchst ein Konto mit bestätigter E-Mail-Adresse. Der Code gilt nur einmal. Falls du diese E-Mail nicht erwartet hast, kannst du sie ignorieren.",
    ]],
    ["fr", "Tu as un code cadeau", [
      `Nous t'offrons ${d} jours d'accès complet à Mother Verde.`,
      `Utilise-le avant le ${fmtDate(expiresAt, "fr-FR")} (UTC) : connecte-toi, touche l'icône de personne en haut à droite pour ouvrir <b>Ton compte</b> et appuie sur <b>« J'ai un code cadeau »</b>.`,
      "Il te faut un compte avec une adresse e-mail confirmée. Le code ne sert qu'une fois. Si tu n'attendais pas cet e-mail, tu peux l'ignorer.",
    ]],
  ];
  const btn = { url: appUrl, label: "Mother Verde" };
  return {
    to: "",
    subject: "Tu código de regalo · Your gift code",
    html: layout(blocks, code, btn),
    text: plain(blocks, code, appUrl),
  };
}

function testEmail(): Mail & { to: "" } {
  const at = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
  const blocks: [string, string, string[]][] = [
    ["es", "Correo de prueba", [`Si lees esto, el envío de correo desde las funciones de Mother Verde funciona. Enviado: ${at}.`]],
    ["en", "Test e-mail", [`If you can read this, sending e-mail from the Mother Verde functions works. Sent: ${at}.`]],
    ["de", "Test-E-Mail", [`Wenn du das liest, funktioniert der E-Mail-Versand aus den Mother-Verde-Funktionen. Gesendet: ${at}.`]],
    ["fr", "E-mail de test", [`Si tu lis ceci, l'envoi d'e-mails depuis les fonctions Mother Verde fonctionne. Envoyé : ${at}.`]],
  ];
  return { to: "", subject: "Prueba de envío · Test e-mail", html: layout(blocks), text: plain(blocks) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const url = Deno.env.get("SUPABASE_URL")!, anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const anon = createClient(url, anonKey);
  const { data: { user } } = await anon.auth.getUser(token);
  if (!user) return json({ error: "unauthorized" }, 401);

  // Admin + MFA, decided by the database with the caller's own token.
  const asCaller = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: isAdmin, error: admErr } = await asCaller.rpc("is_admin_aal2");
  if (admErr) { console.error("is_admin_aal2:", admErr.message); return json({ error: "could_not_verify_admin" }, 500); }
  if (isAdmin !== true) return json({ error: "not_allowed" }, 403);

  let body: { action?: unknown; email?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const svc = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const actorLabel = user.email ?? user.id;

  if (body.action === "test_email") {
    if (!user.email) return json({ error: "no_email_on_account" }, 400);
    const m = testEmail();
    const r = await deliver(svc, { ...m, to: user.email }, "test", user.id, null);
    await svc.rpc("admin_log", {
      p_action: r.ok ? "test_email_sent" : "test_email_failed", p_target_user: user.id,
      p_reason: r.ok ? null : r.error, p_details: { provider: r.provider, attempts: r.attempts }, p_actor_label: actorLabel,
    });
    return r.ok ? json({ ok: true, to: user.email, provider: r.provider, attempts: r.attempts, first_error: r.error })
                : json({ error: "email_failed", detail: r.error, attempts: r.attempts }, 502);
  }

  if (body.action !== "send") return json({ error: "bad_action" }, 400);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) return json({ error: "bad_email" }, 400);

  const code = generateCode();
  const { data: id, error: resErr } = await svc.rpc("svc_reserve_sent_gift_code", {
    p_hash: await codeHash(code), p_email: email, p_days: CODE_DAYS, p_valid_days: CODE_VALID_DAYS,
    p_actor: user.id, p_actor_label: actorLabel,
  });
  if (resErr) {
    const known = ["bad_email", "blocked_domain", "daily_limit_20", "email_limit_3"].find((k) => resErr.message.includes(k));
    if (!known) console.error("svc_reserve_sent_gift_code:", resErr.message);
    return json({ error: known ?? "could_not_create_code" }, known ? 400 : 500);
  }

  const expiresAt = new Date(Date.now() + CODE_VALID_DAYS * 86400000).toISOString();
  const m = giftEmail(code, expiresAt, Deno.env.get("APP_URL") ?? "https://www.motherverdeny.com");
  const r = await deliver(svc, { ...m, to: email }, "gift_code", null, `gift:${id}`);
  const { error: finErr } = await svc.rpc("svc_finish_sent_gift_code", {
    p_id: id, p_sent: r.ok, p_error: r.ok ? null : r.error, p_actor: user.id, p_actor_label: actorLabel,
  });
  if (finErr) console.error("svc_finish_sent_gift_code:", finErr.message);
  // Still not sent after every retry and provider: the code is voided (it
  // was never seen by anyone) and the failure is in mail_events + audit log.
  if (!r.ok) return json({ error: "email_failed", detail: r.error, attempts: r.attempts, voided: true }, 502);
  return json({ ok: true, id, to: email, expires_at: expiresAt, provider: r.provider, attempts: r.attempts, first_error: r.error });
});
