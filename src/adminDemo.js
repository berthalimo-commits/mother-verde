// DEV PREVIEW — sample data for the admin panel (/panel-mv.html?demo=1).
// Only in builds made with the preview flag; the production build doesn't
// contain this file. Nothing here talks to Supabase: every call is answered
// from the arrays below, and every action that would change something
// answers "demo" (shown as "Vista previa: no se guarda nada").

const now = Date.now();
const iso = (h) => new Date(now + h * 3600000).toISOString();
const okChecks = { tx_found: true, tx_success: true, usdc_contract: true, destination: true, exact_amount: true, after_claim: true, confirmations: true, tx_unused: true, claim_open: true, auto_limit: true };

const CLAIMS = [
  { id: 101, user_id: 'u1', account_email: 'ana.ejemplo@example.com', flowers: 2, amount_usdc: '20.0040', tx_hash: '0x' + '4a'.repeat(32), status: 'submitted',
    created_at: iso(-30), submitted_at: iso(-29), expires_at: iso(42), review_reason: null, explorer_url: 'https://basescan.org/tx/0x' + '4a'.repeat(32),
    verification: { all_pass: true, checks: okChecks, detail: { confirmations: 812, received_units: ['20004000'] }, checked_at: iso(-28) } },
  { id: 102, user_id: 'u2', account_email: 'ben.example@example.org', flowers: 5, amount_usdc: '50.0017', tx_hash: '0x' + '7c'.repeat(32), status: 'manual_review',
    created_at: iso(-50), submitted_at: iso(-49), expires_at: iso(22), review_reason: 'monto_distinto', explorer_url: 'https://basescan.org/tx/0x' + '7c'.repeat(32),
    verification: { all_pass: false, checks: { ...okChecks, exact_amount: false }, detail: { confirmations: 1500, received_units: ['50000000'] }, checked_at: iso(-48) } },
  { id: 103, user_id: 'u3', account_email: 'clara.beispiel@example.de', flowers: 20, amount_usdc: '200.0090', tx_hash: null, status: 'awaiting_payment',
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

const USERS = [
  { user_id: 'u1', email: 'ana.ejemplo@example.com', display_name: 'Ana', country: 'PE', lang: 'es', state: 'prueba_vencida', created_at: iso(-80), trial_ends_at: iso(-56), access_until: null, contact_name: 'Ana Ejemplo', contact_phone: '+51 900 000 000' },
  { user_id: 'u2', email: 'ben.example@example.org', display_name: 'Ben', country: 'US', lang: 'en', state: 'acceso_completo', created_at: iso(-300), trial_ends_at: iso(-276), access_until: null, contact_name: null, contact_phone: null },
  { user_id: 'u3', email: 'clara.beispiel@example.de', display_name: null, country: null, lang: 'de', state: 'prueba_activa', created_at: iso(-5), trial_ends_at: iso(19), access_until: null, contact_name: null, contact_phone: null },
  { user_id: 'u4', email: 'primo@example.com', display_name: 'Primo', country: 'MX', lang: 'es', state: 'regalo', created_at: iso(-200), trial_ends_at: iso(-176), access_until: iso(100), contact_name: null, contact_phone: null },
];
const RPC = {
  admin_summary: () => ({ accounts: 4, new_7d: 2, states: { prueba_activa: 1, prueba_vencida: 1, acceso_completo: 1, regalo: 1 }, claims: { pendiente: 2, en_revision: 1, activado: 1 }, usdc_activated: '10.0030' }),
  admin_list_users: (a) => {
    const q = (a?.p_search || '').toLowerCase();
    const rows = USERS.filter((u) => (!q || u.email.includes(q) || (u.display_name || '').toLowerCase().includes(q)) && (!a?.p_state || u.state === a.p_state));
    return rows.map((u) => ({ ...u, total: rows.length }));
  },
  admin_get_user: (a) => ({ ...USERS.find((u) => u.user_id === a.p_user_id), claims: [], gift_codes: [] }),
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
