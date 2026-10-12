// DEV PREVIEW — sample data for the admin panel (/panel-mv.html?demo=1).
// Only in builds made with the preview flag; the production build doesn't
// contain this file. Nothing here talks to Supabase: every call is answered
// from the arrays below, and every action that would change something
// answers "demo" (shown as "Vista previa: no se guarda nada").

const now = Date.now();
const iso = (h) => new Date(now + h * 3600000).toISOString();
const okChecks = { tx_found: true, tx_success: true, usdc_contract: true, destination: true, exact_amount: true, after_claim: true, confirmations: true, tx_unused: true, claim_open: true, auto_limit: true };

const CLAIMS = [
  { id: 101, user_id: 'u1', account_email: 'ana.ejemplo@example.com', flowers: 2, amount_usdc: 20.0042, tx_hash: '0x' + '4a'.repeat(32), status: 'submitted',
    created_at: iso(-30), submitted_at: iso(-29), expires_at: iso(42), review_reason: null, explorer_url: 'https://basescan.org/tx/0x' + '4a'.repeat(32),
    verification: { all_pass: true, checks: okChecks, detail: { confirmations: 812, received_units: ['20004200'] }, checked_at: iso(-28) } },
  { id: 102, user_id: 'u2', account_email: 'ben.example@example.org', flowers: 5, amount_usdc: 50.0017, tx_hash: '0x' + '7c'.repeat(32), status: 'manual_review',
    created_at: iso(-50), submitted_at: iso(-49), expires_at: iso(22), review_reason: 'monto_distinto', explorer_url: 'https://basescan.org/tx/0x' + '7c'.repeat(32),
    verification: { all_pass: false, checks: { ...okChecks, exact_amount: false }, detail: { confirmations: 1500, received_units: ['50000000'] }, checked_at: iso(-48) } },
  { id: 103, user_id: 'u3', account_email: 'clara.beispiel@example.de', flowers: 20, amount_usdc: 200.0073, tx_hash: null, status: 'awaiting_payment',
    created_at: iso(-3), submitted_at: null, expires_at: iso(69), review_reason: null, explorer_url: null, verification: null },
];
const GIFTS = [
  { id: 11, created_at: iso(-20), created_label: 'hello@motherverdeny.com', sent_to_email: 'amiga@example.com', days: 7, expires_at: iso(148), state: 'enviado', used_by_email: null, used_at: null, revoked_reason: null },
  { id: 10, created_at: iso(-90), created_label: 'hello@motherverdeny.com', sent_to_email: 'primo@example.com', days: 7, expires_at: iso(78), state: 'usado', used_by_email: 'primo@example.com', used_at: iso(-60), revoked_reason: null },
  { id: 9, created_at: iso(-400), created_label: 'sql-editor', sent_to_email: null, days: 7, expires_at: iso(-232), state: 'vencido', used_by_email: null, used_at: null, revoked_reason: null },
  { id: 8, created_at: iso(-500), created_label: 'hello@motherverdeny.com', sent_to_email: 'error@example.com', days: 7, expires_at: iso(-332), state: 'anulado', used_by_email: null, used_at: null, revoked_reason: 'Enviado por error' },
];
const AUDIT = [
  { at: iso(-20), actor_label: 'hello@motherverdeny.com', action: 'gift_code_sent', target_email: 'amiga@example.com', reason: null },
  { at: iso(-26), actor_label: 'hello@motherverdeny.com', action: 'claim_approved', target_email: 'dora@example.com', reason: 'Comprobado en Basescan' },
  { at: iso(-27), actor_label: 'hello@motherverdeny.com', action: 'test_email_sent', target_email: 'hello@motherverdeny.com', reason: null },
  { at: iso(-72), actor_label: 'sql-editor', action: 'admin_granted', target_email: 'hello@motherverdeny.com', reason: 'grant-admin.sql' },
];

const RPC = {
  admin_whoami: () => ({ admin: true, aal: 'aal2' }),
  admin_list_claims: (a) => CLAIMS.filter((c) => (a?.p_statuses || ['submitted', 'manual_review']).includes(c.status)),
  admin_list_gift_codes: () => GIFTS,
  admin_list_audit: () => AUDIT,
};
export const sb = {
  auth: {
    getSession: async () => ({ data: { session: { access_token: 'demo', user: { email: 'hello@motherverdeny.com' } } } }),
    signOut: async () => ({}),
    mfa: { listFactors: async () => ({ data: { totp: [{ id: 'demo', status: 'verified' }], all: [] } }) },
  },
  rpc: async (name, args) => (RPC[name] ? { data: RPC[name](args), error: null } : { data: null, error: { message: 'demo' } }),
};
export async function fn(name, body) {
  if (name === 'support-claims' && body.action === 'config') return { ok: true, auto_enabled: false, auto_max_usdc: 201, support_address_set: true };
  return { error: 'demo' };
}
