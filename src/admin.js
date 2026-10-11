// Admin panel (/panel-mv.html). Not linked from the app. Being hidden is NOT
// the protection: every action is checked by the server (admin_users + an MFA
// session, aal2) in the database functions and the Edge Functions.
//
// Flow: signed in? -> admin? (admin_whoami) -> MFA: enroll a TOTP app the
// first time, otherwise enter the 6-digit code -> panel (aal2).
// Shows only what's needed to decide: account e-mail, amounts, transaction
// codes, check results, gift-code states, the audit log. No private content.
import { createClient } from '@supabase/supabase-js';

const sb = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
const app = document.getElementById('app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const when = (iso) => (iso ? new Date(iso).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const usdc = (units) => (Number(units) / 1e6).toFixed(4);

const ERR = {
  not_allowed: 'No permitido: hace falta una cuenta de administración con verificación en dos pasos.',
  reason_required: 'Escribe un motivo (al menos 5 caracteres).',
  not_found: 'No encontrado.', not_found_or_closed: 'Ese aviso ya está cerrado.', claim_closed: 'Ese aviso ya está cerrado.',
  bad_email: 'Ese correo no parece válido.', blocked_domain: 'Ese dominio de correo está bloqueado (correo desechable).',
  daily_limit_20: 'Ya se crearon 20 códigos hoy (límite diario).', email_limit_3: 'Ese correo ya recibió 3 códigos (límite).',
  email_failed: 'No se pudo enviar el correo. El código quedó ANULADO.', not_found_or_not_active: 'Ese código ya no está activo.',
  could_not_verify_admin: 'No se pudo comprobar el permiso de administración.', server_error: 'Error del servidor. Inténtalo de nuevo.',
};
const errText = (e, detail) => (ERR[e] || e || 'Error') + (detail ? ` (${detail})` : '');

async function fn(name, body) {
  const { data: { session } } = await sb.auth.getSession();
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session?.access_token ?? ''}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json().catch(() => ({ error: 'server_error' }));
}
const rpcErr = (error) => { const m = error?.message || ''; return Object.keys(ERR).find((k) => m.includes(k)) || m; };

// ------------------------------------------------------------ gatekeeping
async function start() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    app.innerHTML = `<div class="card"><p>Inicia sesión en <a href="/">Mother Verde</a> con tu cuenta de administración y vuelve a esta página.</p></div>`;
    return;
  }
  const { data: who, error } = await sb.rpc('admin_whoami');
  if (error || !who?.admin) {
    app.innerHTML = `<div class="card"><p>Esta cuenta no tiene acceso al panel.</p><p class="muted"><a href="/">Volver a Mother Verde</a></p></div>`;
    return;
  }
  if (who.aal !== 'aal2') return mfaStep();
  return panel(session.user.email);
}

async function mfaStep() {
  const { data, error } = await sb.auth.mfa.listFactors();
  if (error) { app.innerHTML = `<div class="card bad">${esc(error.message)}</div>`; return; }
  const verified = (data.totp || []).find((f) => f.status === 'verified');
  if (verified) {
    app.innerHTML = `<div class="card"><h2>Verificación en dos pasos</h2>
      <p>Escribe el código de 6 dígitos de tu app de autenticación.</p>
      <div class="row"><input id="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" style="max-width:160px">
      <button id="go">Verificar</button></div><p class="msg" id="msg"></p></div>`;
    document.getElementById('go').onclick = () => verify(verified.id);
    return;
  }
  // First time: remove half-finished enrollments, then enroll a TOTP app.
  for (const f of data.all || []) if (f.status !== 'verified') await sb.auth.mfa.unenroll({ factorId: f.id });
  const en = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Mother Verde admin' });
  if (en.error) { app.innerHTML = `<div class="card bad">${esc(en.error.message)}</div>`; return; }
  app.innerHTML = `<div class="card"><h2>Activa la verificación en dos pasos (obligatoria)</h2>
    <ol><li>Abre tu app de autenticación (Google Authenticator, Microsoft Authenticator, 1Password, Authy…).</li>
    <li>Escanea este código QR, o escribe la clave a mano.</li>
    <li>Escribe aquí el código de 6 dígitos que muestra la app.</li></ol>
    <div class="qr"><img alt="Código QR para la app de autenticación" src="${esc(en.data.totp.qr_code)}"></div>
    <p class="muted">Clave: <span class="mono">${esc(en.data.totp.secret)}</span></p>
    <div class="row"><input id="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" style="max-width:160px">
    <button id="go">Activar</button></div><p class="msg" id="msg"></p>
    <p class="muted">Guarda una copia de la clave en un lugar seguro: si pierdes el teléfono, sin ella no podrás entrar al panel.</p></div>`;
  document.getElementById('go').onclick = () => verify(en.data.id);
}

async function verify(factorId) {
  const code = document.getElementById('code').value.trim();
  const msg = document.getElementById('msg');
  if (!/^\d{6}$/.test(code)) { msg.textContent = 'El código tiene 6 dígitos.'; return; }
  const { error } = await sb.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) { msg.textContent = 'Código incorrecto o caducado. Prueba con el siguiente.'; return; }
  start();
}

// ------------------------------------------------------------ panel
let tab = 'claims';
async function panel(email) {
  app.innerHTML = `
    <div class="row" style="justify-content:space-between;margin-bottom:10px">
      <span class="muted">Sesión: ${esc(email)} · verificación en dos pasos ✓</span>
      <button class="ghost" id="out">Cerrar sesión</button></div>
    <div class="tabs">
      <button data-t="claims">Avisos de aporte</button>
      <button data-t="gifts">Códigos de regalo</button>
      <button data-t="audit">Registro</button></div>
    <div id="view"></div>`;
  document.getElementById('out').onclick = async () => { await sb.auth.signOut(); location.href = '/'; };
  app.querySelectorAll('.tabs button').forEach((b) => { b.onclick = () => { tab = b.dataset.t; show(); }; });
  show();
}
function show() {
  app.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === tab));
  ({ claims: claimsView, gifts: giftsView, audit: auditView })[tab]();
}
const view = () => document.getElementById('view');

// ------------------------------------------------------------ claims
const CHECK_LABEL = {
  tx_found: 'La transacción existe en Base', tx_success: 'La transacción se completó',
  usdc_contract: 'Es USDC (contrato oficial de Circle)', destination: 'Llegó a nuestra dirección',
  exact_amount: 'Monto exacto', after_claim: 'Enviada después de reservar el monto',
  confirmations: 'Confirmaciones suficientes', tx_unused: 'Código no usado en otro aviso',
  claim_open: 'Aviso vigente y de esa cuenta', auto_limit: 'Dentro del límite automático (≤ 100 USDC)',
};
const STATUS = { submitted: 'código recibido', manual_review: 'revisión manual', awaiting_payment: 'esperando pago' };
let showAwaiting = false;

async function claimsView() {
  view().innerHTML = '<p class="muted">Cargando…</p>';
  const [cfg, list] = await Promise.all([
    fn('support-claims', { action: 'config' }),
    sb.rpc('admin_list_claims', { p_statuses: showAwaiting ? ['awaiting_payment'] : ['submitted', 'manual_review'] }),
  ]);
  if (list.error) { view().innerHTML = `<div class="card bad">${esc(errText(rpcErr(list.error)))}</div>`; return; }
  const mode = cfg.auto_enabled
    ? '<span class="ok">Verificación automática: ACTIVA</span> (solo activa sola si todo pasa y es ≤ 100 USDC)'
    : '<b class="warn">Verificación manual</b> — comprueba cada transferencia (botón «Comprobar en Base» o el enlace al explorador) antes de activar.';
  view().innerHTML = `
    <div class="card"><p>${mode}</p>${cfg.support_address_set === false ? '<p class="bad">Falta el secreto SUPPORT_ADDRESS en la función support-claims: las comprobaciones fallarán.</p>' : ''}
      <div class="row"><button class="ghost" id="tg">${showAwaiting ? 'Ver avisos por decidir' : 'Ver montos reservados sin pagar'}</button>
      <button class="ghost" id="rl">Actualizar</button></div></div>
    ${list.data.length ? list.data.map(claimCard).join('') : '<p class="muted">No hay nada aquí.</p>'}`;
  document.getElementById('tg').onclick = () => { showAwaiting = !showAwaiting; claimsView(); };
  document.getElementById('rl').onclick = claimsView;
  view().querySelectorAll('[data-act]').forEach((b) => { b.onclick = () => claimAction(b.dataset.act, Number(b.dataset.id)); });
}

function claimCard(c) {
  const v = c.verification || null;
  const checks = v?.checks ? Object.entries(CHECK_LABEL).filter(([k]) => k in v.checks)
    .map(([k, label]) => `<li class="${v.checks[k] ? 'ok' : 'bad'}">${v.checks[k] ? '✓' : '✗'} ${label}</li>`).join('') : '';
  const allPass = v?.all_pass === true;
  const open = c.status === 'submitted' || c.status === 'manual_review';
  return `<div class="card">
    <div class="row" style="justify-content:space-between"><b>${esc(c.account_email)}</b><span class="pill">${esc(STATUS[c.status] || c.status)}</span></div>
    <p><b class="mono" style="font-size:18px">${esc(Number(c.amount_usdc).toFixed(4))} USDC</b> · ${c.flowers} ${c.flowers === 1 ? 'flor' : 'flores'}</p>
    <p class="muted">Reservado: ${when(c.created_at)} · Código recibido: ${when(c.submitted_at)} · Vence: ${when(c.expires_at)}</p>
    ${c.tx_hash ? `<p>TXID: <span class="mono">${esc(c.tx_hash)}</span><br><a href="${esc(c.explorer_url)}" target="_blank" rel="noopener noreferrer">Ver en el explorador de Base (Basescan) ↗</a></p>` : ''}
    ${c.review_reason ? `<p class="warn">Motivo: ${esc(c.review_reason)}</p>` : ''}
    ${v ? `<p class="muted">Última comprobación: ${when(v.checked_at)}${v.detail?.confirmations != null ? ` · ${v.detail.confirmations} confirmaciones` : ''}${v.detail?.received_units?.length ? ` · recibido: ${v.detail.received_units.map(usdc).join(', ')} USDC` : ''}</p><ul class="checks">${checks}</ul>` : '<p class="muted">Sin comprobar todavía.</p>'}
    ${open ? `
      <div class="row">
        <button data-act="check" data-id="${c.id}">Comprobar en Base</button>
        <button data-act="approve" data-id="${c.id}" ${allPass ? '' : 'disabled title="Solo si todas las comprobaciones pasan"'}>Activar acceso completo</button>
      </div>
      <p class="muted" style="margin-top:10px">Activación manual o rechazo (motivo obligatorio, queda en el registro):</p>
      <textarea id="r${c.id}" maxlength="500" placeholder="Motivo…"></textarea>
      <div class="row" style="margin-top:6px">
        <button class="ghost" data-act="manual" data-id="${c.id}">Activar manualmente con este motivo</button>
        <button class="danger" data-act="reject" data-id="${c.id}">Rechazar con este motivo</button>
      </div>
      <p class="msg" id="m${c.id}"></p>` : ''}
  </div>`;
}

async function claimAction(act, id) {
  const msg = document.getElementById('m' + id);
  const reason = document.getElementById('r' + id)?.value.trim() || '';
  if ((act === 'manual' || act === 'reject') && reason.length < 5) { msg.textContent = ERR.reason_required; return; }
  view().querySelectorAll(`[data-id="${id}"]`).forEach((b) => { b.disabled = true; });
  msg.textContent = 'Un momento…';
  const body = { claim_id: id };
  if (act === 'check') body.action = 'admin_check';
  if (act === 'approve') body.action = 'admin_approve';
  if (act === 'manual') { body.action = 'admin_approve'; body.reason = reason; }
  if (act === 'reject') { body.action = 'admin_reject'; body.reason = reason; }
  const r = await fn('support-claims', body);
  if (r.error) { msg.textContent = errText(r.error); setTimeout(claimsView, 2500); return; }
  if (body.action === 'admin_approve' && r.email_sent === false) alertBox(`Acceso activado, pero el correo de confirmación NO se pudo enviar (${r.email_error || 'error'}).`);
  claimsView();
}
function alertBox(text) {
  const d = document.createElement('div');
  d.className = 'card warn'; d.textContent = text;
  view().prepend(d);
}

// ------------------------------------------------------------ gift codes
async function giftsView() {
  view().innerHTML = `
    <div class="card"><h2>Enviar un código de regalo (7 días de acceso, válido 7 días)</h2>
      <div class="row"><input id="ge" type="email" placeholder="correo@ejemplo.com" maxlength="254" style="max-width:340px">
      <button id="gs">Enviar código</button></div>
      <p class="msg" id="gm"></p>
      <p class="muted">Límites: 20 códigos al día en total y 3 por correo. El código solo viaja en el correo: aquí no se puede ver.</p>
      <div class="row"><button class="ghost" id="gt">Enviar correo de prueba a mi correo</button></div>
      <p class="msg" id="gtm"></p></div>
    <div class="card"><h2>Códigos</h2><div id="gl" class="scroll"><p class="muted">Cargando…</p></div></div>`;
  document.getElementById('gs').onclick = async () => {
    const m = document.getElementById('gm'); const email = document.getElementById('ge').value.trim();
    if (!email) { m.textContent = ERR.bad_email; return; }
    document.getElementById('gs').disabled = true; m.textContent = 'Enviando…';
    const r = await fn('admin-send-gift-code', { action: 'send', email });
    document.getElementById('gs').disabled = false;
    m.className = 'msg ' + (r.ok ? 'ok' : 'bad');
    m.textContent = r.ok ? `Enviado a ${r.to}. Caduca: ${when(r.expires_at)}.` : errText(r.error, r.detail);
    if (r.ok) document.getElementById('ge').value = '';
    loadGifts();
  };
  document.getElementById('gt').onclick = async () => {
    const m = document.getElementById('gtm'); m.textContent = 'Enviando…';
    const r = await fn('admin-send-gift-code', { action: 'test_email' });
    m.className = 'msg ' + (r.ok ? 'ok' : 'bad');
    m.textContent = r.ok ? `Correo de prueba enviado a ${r.to}. Revisa también la carpeta de spam.` : errText(r.error, r.detail);
  };
  loadGifts();
}
const GSTATE = { creado: '', enviado: 'ok', usado: 'muted', vencido: 'muted', anulado: 'bad' };
async function loadGifts() {
  const { data, error } = await sb.rpc('admin_list_gift_codes', { p_limit: 200 });
  const box = document.getElementById('gl');
  if (error) { box.innerHTML = `<p class="bad">${esc(errText(rpcErr(error)))}</p>`; return; }
  if (!data.length) { box.innerHTML = '<p class="muted">Todavía no hay códigos.</p>'; return; }
  box.innerHTML = `<table><tr><th>Creado</th><th>Para</th><th>Días</th><th>Caduca</th><th>Estado</th><th>Usado por</th><th></th></tr>
    ${data.map((g) => `<tr><td>${when(g.created_at)}<br><span class="muted">${esc(g.created_label)}</span></td>
      <td>${esc(g.sent_to_email || '—')}</td><td>${g.days}</td><td>${when(g.expires_at)}</td>
      <td class="${GSTATE[g.state] || ''}">${esc(g.state)}${g.revoked_reason ? `<br><span class="muted">${esc(g.revoked_reason)}</span>` : ''}</td>
      <td>${esc(g.used_by_email || '')}${g.used_at ? `<br><span class="muted">${when(g.used_at)}</span>` : ''}</td>
      <td>${g.state === 'enviado' || g.state === 'creado' ? `<button class="ghost" data-void="${g.id}">Anular</button>` : ''}</td></tr>
      <tr id="vr${g.id}" hidden><td colspan="7"><div class="row"><input id="vi${g.id}" placeholder="Motivo de la anulación" maxlength="300" style="max-width:420px">
        <button class="danger" data-voidok="${g.id}">Confirmar anulación</button><span class="msg" id="vm${g.id}"></span></div></td></tr>`).join('')}</table>`;
  box.querySelectorAll('[data-void]').forEach((b) => { b.onclick = () => { document.getElementById('vr' + b.dataset.void).hidden = false; }; });
  box.querySelectorAll('[data-voidok]').forEach((b) => {
    b.onclick = async () => {
      const id = Number(b.dataset.voidok); const reason = document.getElementById('vi' + id).value.trim();
      const m = document.getElementById('vm' + id);
      if (reason.length < 5) { m.textContent = ERR.reason_required; return; }
      const { error: e } = await sb.rpc('admin_revoke_gift_code', { p_id: id, p_reason: reason });
      if (e) { m.textContent = errText(rpcErr(e)); return; }
      loadGifts();
    };
  });
}

// ------------------------------------------------------------ audit log
async function auditView() {
  view().innerHTML = '<div class="card scroll"><p class="muted">Cargando…</p></div>';
  const { data, error } = await sb.rpc('admin_list_audit', { p_limit: 300 });
  if (error) { view().innerHTML = `<div class="card bad">${esc(errText(rpcErr(error)))}</div>`; return; }
  view().innerHTML = `<div class="card scroll"><p class="muted">Solo lectura. Nadie puede editar ni borrar este registro desde la app.</p>
    <table><tr><th>Cuándo</th><th>Quién</th><th>Acción</th><th>Cuenta</th><th>Motivo</th></tr>
    ${data.map((a) => `<tr><td>${when(a.at)}</td><td>${esc(a.actor_label)}</td><td>${esc(a.action)}</td><td>${esc(a.target_email || '')}</td><td>${esc(a.reason || '')}</td></tr>`).join('')}</table></div>`;
}

start();
