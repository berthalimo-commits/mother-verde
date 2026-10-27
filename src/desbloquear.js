// Desbloquear screen (#desbloquear): the one-time support contribution page.
// Payment data comes ONLY from src/supportConfig.js. If the address is missing
// or malformed, the page says "Próximamente" and shows no address, QR or form.
// The QR is generated here (qrcode, MIT) — no external service is contacted.
import QRCode from 'qrcode';
import { SUPPORT, SUPPORT_RECIPIENT_TEXT, supportAddressIsValid } from './supportConfig.js';

let flowers = 1;
// main.js (classic script) can't import the config; it reads this.
// The one line that tells the person how their claim is being checked. Normal
// check: "hasta {h} horas". Manual review: no hours at all (and only ONE line).
function pendingLine(c) {
  if (c && c.late) return t('dsTardeOk');
  if (c && c.status === 'manual_review') return t('dsRevisionManual');
  return fmt(t('dsPendingP'), { h: SUPPORT.NORMAL_REVIEW_HOURS });
}
window.mvPendingLine = pendingLine;

const t = (k) => (window.t ? window.t(k) : k);
const lang = () => (window.getCurrentLang ? window.getCurrentLang() : 'es');

// Approved flower (outline v2, never filled): #mvBud full drawing, #mvBudS
// simplified for small sizes. "ds-bud-on" = chosen: app green, amber hairs,
// thicker line (style.css); otherwise a soft grey outline.
function bud(size, extraClass = '') {
  const sym = size <= 40 ? '#mvBudS' : '#mvBud';
  return `<svg class="ds-bud ${extraClass}" width="${size}" height="${Math.round(size * 96 / 84)}" viewBox="0 0 84 96" aria-hidden="true" focusable="false"><use href="${sym}"/></svg>`;
}

function fmt(template, vars) {
  return Object.entries(vars).reduce((s, [k, v]) => s.split('{' + k + '}').join(String(v)), template);
}

// All 20 places are always shown (5 × 4 on phones, 10 × 2 on wide screens);
// the chosen ones are filled, the rest are an outline. Tapping a place picks
// that many flowers.
function gardenHtml() {
  let html = '';
  for (let i = 1; i <= SUPPORT.MAX_FLOWERS; i++) {
    const on = i <= flowers;
    const label = fmt(t(i === 1 ? 'dsFlorN1' : 'dsFlorN'), { n: i });
    html += `<button type="button" class="ds-slot${on ? ' on' : ''}" data-n="${i}" aria-pressed="${on}" aria-label="${label}">${bud(30, on ? 'ds-bud-on' : 'ds-bud-off')}<span class="ds-slot-mark" aria-hidden="true"></span></button>`;
  }
  return html;
}

function totalLine() {
  const key = flowers === 1 ? 'dsRamoUna' : 'dsRamoVarias';
  return fmt(t(key), { n: flowers, usdc: flowers * SUPPORT.FLOWER_USDC, cur: SUPPORT.CURRENCY });
}

// Contribution with a UNIQUE AMOUNT (support_claims, migration 20261011120000).
// The database does the real work and enforces every rule: it reserves
// N x 10 USDC + 0.0001–0.0099 that no other open request has, for 72 h; it
// accepts one transaction code per request, used only once ever; the browser
// can only call these three functions and read its own requests.
// Statuses: awaiting_payment -> submitted -> (manual_review) -> approved |
// rejected; awaiting_payment can also end as expired or canceled.
const TX_RE = /^0x[0-9a-fA-F]{64}$/;
// Same rule as the database (support_claims.contact_phone).
const PHONE_RE = /^[+]?[0-9][0-9 ().-]{5,23}$/;
const OPEN = ['submitted', 'manual_review'];
let syncedFromClaim = null; // claim id whose flower count the picker already took

const claimNow = () => window.mvLatestClaim || null;
// Preview mode (localhost / dev build): simulated, never calls the database.
const isLocalPreview = () => !!(window.mvPreviewOn && window.mvPreviewOn())
  && ((claimNow() && claimNow().id === 0) || !!(window.mvIsPreviewSignedIn && window.mvIsPreviewSignedIn()));
// Exact amount: text from integer units (main.js mvUsdcText), 4 decimals always.
const amountText = (units) => window.mvUsdcText(units, true);  // shown: language's separator
const amountCopy = (units) => window.mvUsdcText(units, false); // copied: always a dot
const fmtWhen = (iso) => (window.mvFmtDateTime ? window.mvFmtDateTime(iso) : new Date(iso).toLocaleString());
function awaiting(c) { return c && c.status === 'awaiting_payment' && new Date(c.expires_at).getTime() > Date.now(); }
// The reservation whose payment instructions are shown: only while the picker
// matches its flowers. Another count -> "Ver mi monto" again; the old one stays
// open until a new amount is asked for (create_support_claim cancels it then),
// so a person who already sent it can go back and register the code.
function shownClaim() { const c = claimNow(); return awaiting(c) && c.flowers === flowers ? c : null; }
const flowersText = (n) => fmt(t(n === 1 ? 'dsFlorN1' : 'dsFlorN'), { n });

const RPC_ERR = {
  email_not_confirmed: 'dsErrConfirm', no_free_amount: 'dsErrBusy', expired: 'dsErrExpired',
  bad_contact_name: 'dsErrContactoNombre', bad_contact_phone: 'dsErrContactoTel',
  bad_tx_format: 'dsFormErrTx', tx_already_used: 'dsFormErrDup', already_supporter: 'dsYaTienes',
  claim_in_review: 'dsErrEnRevision',
};
// Late payment answers from the support-claims function.
const LATE_ERR = { late_amount_mismatch: 'dsErrTardeMonto', late_tx_not_found: 'dsErrTardeNoEncontrada', not_late: 'dsFormErrGeneric' };
const errKey = (error) => { const m = (error && error.message) || ''; const k = Object.keys(RPC_ERR).find((x) => m.includes(x)); return k ? RPC_ERR[k] : 'dsFormErrGeneric'; };

async function reserve() {
  const msg = document.getElementById('dsClaimMsg');
  if (isLocalPreview()) {
    window.mvLatestClaim = { id: 0, status: 'awaiting_payment', flowers, amount_units: flowers * 10000000 + 4000, expires_at: new Date(Date.now() + 72 * 3600000).toISOString() };
    renderDesbloquear(); return;
  }
  if (msg) msg.textContent = t('dsFormSending');
  const { data, error } = await window.mvSupabase.rpc('create_support_claim', { p_flowers: flowers });
  if (error) { if (msg) msg.textContent = fmt(t(errKey(error)), { n: flowers }); return; }
  window.mvLatestClaim = data;
  renderDesbloquear();
}

async function cancelReservation() {
  const c = claimNow();
  if (!c) return;
  if (!isLocalPreview()) {
    const { error } = await window.mvSupabase.rpc('cancel_my_support_claim', { p_claim_id: c.id });
    if (error) { document.getElementById('dsClaimMsg').textContent = t('dsFormErrGeneric'); return; }
  }
  window.mvLatestClaim = { ...c, status: 'canceled' };
  renderDesbloquear();
}

async function submitTx(ev) {
  ev.preventDefault();
  const msg = document.getElementById('dsClaimMsg');
  const btn = document.getElementById('dsClaimBtn');
  const tx = document.getElementById('dsClaimTx').value.trim();
  const contactName = document.getElementById('dsContactName').value.replace(/\s+/g, ' ').trim();
  const contactPhone = document.getElementById('dsContactPhone').value.replace(/\s+/g, ' ').trim();
  if (!TX_RE.test(tx)) { msg.textContent = t('dsFormErrTx'); return; }
  if (contactName && (contactName.length > 80 || /[<>\u0000-\u001f]/.test(contactName))) { msg.textContent = t('dsErrContactoNombre'); return; }
  if (contactPhone && !PHONE_RE.test(contactPhone)) { msg.textContent = t('dsErrContactoTel'); return; }
  const c = claimNow();
  if (isLocalPreview()) { window.mvLatestClaim = { ...c, status: 'submitted', tx_hash: tx.toLowerCase() }; window.mvApplyAccessState?.(); renderDesbloquear(); return; }
  if (!window.mvSupabase || !window.mvCurrentUser || !c) { msg.textContent = t('dsFormErrGeneric'); return; }
  btn.disabled = true;
  msg.textContent = t('dsFormSending');
  const { data, error } = await window.mvSupabase.rpc('submit_support_claim_tx', {
    p_claim_id: c.id, p_tx_hash: tx, p_contact_name: contactName || null, p_contact_phone: contactPhone || null,
  });
  if (error) { msg.textContent = t(errKey(error)); btn.disabled = false; return; }
  window.mvLatestClaim = data;
  // Automatic verification (only does anything if it was switched on).
  try { await window.mvSupabase.functions.invoke('support-claims', { body: { action: 'verify', claim_id: data.id } }); } catch (e) {}
  await window.mvRefreshAuth?.();
  renderDesbloquear();
}

// A reservation that ran out without a transaction code: the person may have
// paid anyway (late payment, migration 20261014110000). They can still give
// the TXID; it always goes to manual review ('reserva_vencida').
function lateCandidate(c) {
  return !!c && !c.tx_hash && (c.status === 'expired' || (c.status === 'awaiting_payment' && !awaiting(c)));
}
let lateJustSent = false;
function lateFormHtml(c) {
  return `
    <form class="ds-claim ds-late" id="dsLateForm" novalidate>
      <h3>${t('dsTardeH')}</h3>
      <p>${fmt(t('dsTardeP'), { a: `<b class="ds-amount-inline">${amountText(c.amount_units)}</b>` })}</p>
      <label for="dsLateTx">${t('dsFormTx')}</label>
      <input type="text" id="dsLateTx" maxlength="66" autocomplete="off" spellcheck="false" placeholder="0x…">
      <p class="ds-claim-help">${t('dsFormAyuda')}</p>
      <button type="submit" class="btn btn-ghost" id="dsLateBtn">${t('dsTardeBtn')}</button>
      <p class="ds-claim-msg" id="dsLateMsg" aria-live="polite"></p>
    </form>`;
}
async function submitLate(ev) {
  ev.preventDefault();
  const msg = document.getElementById('dsLateMsg');
  const btn = document.getElementById('dsLateBtn');
  const tx = document.getElementById('dsLateTx').value.trim();
  const c = claimNow();
  if (!TX_RE.test(tx)) { msg.textContent = t('dsFormErrTx'); return; }
  if (isLocalPreview()) { window.mvLatestClaim = { ...c, status: 'manual_review', late: true, review_reason: 'reserva_vencida', tx_hash: tx.toLowerCase() }; lateJustSent = true; window.mvApplyAccessState?.(); renderDesbloquear(); return; }
  if (!window.mvSupabase || !window.mvCurrentUser || !c) { msg.textContent = t('dsFormErrGeneric'); return; }
  btn.disabled = true;
  msg.textContent = t('dsFormSending');
  // Checked on Base first by the server (exact amount of THIS reservation);
  // only then stored, always for manual review (migration 20261014120000).
  const { error } = await window.mvSupabase.functions.invoke('support-claims', { body: { action: 'submit_late', claim_id: c.id, tx_hash: tx } });
  if (error) {
    let code = '';
    try { code = (await error.context.json()).error || ''; } catch (e) {}
    msg.textContent = t(LATE_ERR[code] || errKey({ message: code }));
    btn.disabled = false;
    return;
  }
  lateJustSent = true;
  await window.mvRefreshAuth?.();
  renderDesbloquear();
}

function claimHtml() {
  const c = claimNow();
  const access = window.mvAccessStateNow ? window.mvAccessStateNow() : '';
  if (access === 'supporter') return `<div class="note-box">${t('dsYaTienes')}</div>`;
  if (c && OPEN.includes(c.status)) {
    return `<div class="ds-claim-pending" role="status"><b>${t('dsPendingH')}</b><br><span class="ds-pending-line">${pendingLine(lateJustSent ? { ...c, late: true } : c)}</span>${c.amount_units ? `<br>${fmt(t('dsMontoPendiente'), { a: `<b class="ds-amount-inline">${amountText(c.amount_units)}</b>` })}` : ''}</div>`;
  }
  const notes = (c && c.status === 'rejected' ? `<p class="ds-claim-rejected">${t('dsRejectedP')}</p>` : '')
    + (c && (c.status === 'expired' || (c.status === 'awaiting_payment' && !awaiting(c))) ? `<p class="ds-claim-rejected">${t('dsVencidoP')}</p>` : '');
  if (!shownClaim()) {
    const changed = awaiting(c)
      ? `<div class="note-box ds-change-note" id="dsCambioNota">${fmt(t('dsCambioNota'), { a: amountText(c.amount_units), f: flowersText(c.flowers) })}</div>` : '';
    return `
      <div class="ds-claim">
        <h3>${t('dsReservarH')}</h3>
        ${notes}${changed}
        <p>${fmt(t('dsReservarP'), { usdc: flowers * SUPPORT.FLOWER_USDC, cur: SUPPORT.CURRENCY })}</p>
        <button type="button" class="btn btn-primary" id="dsReservarBtn">${t('dsReservarBtn')}</button>
        <p class="ds-claim-msg" id="dsClaimMsg" aria-live="polite"></p>
      </div>${lateCandidate(c) ? lateFormHtml(c) : ''}`;
  }
  const amount = amountText(c.amount_units);
  return `
    <div class="ds-amount" role="note">
      <div class="ds-amount-label">${t('dsEnviaExacto')}</div>
      <div class="ds-amount-big"><span id="dsAmount">${amount}</span> ${SUPPORT.CURRENCY}</div>
      <div class="ds-amount-net">${fmt(t('dsEnRed'), { net: SUPPORT.NETWORK })}</div>
      <p class="ds-amount-warn">${t('dsExactoAviso')}</p>
      <button type="button" class="btn btn-ghost ds-copy" id="dsCopyAmount" data-amount="${amountCopy(c.amount_units)}">${t('dsCopiarMonto')}</button>
      <span class="ds-copied" id="dsAmountCopied" aria-live="polite"></span>
      <p class="ds-amount-note">${t('dsDecimalesP')}</p>
      <p class="ds-amount-note">${fmt(t('dsValidoHasta'), { d: fmtWhen(c.expires_at) })}</p>
    </div>
    <form class="ds-claim" id="dsClaimForm" novalidate>
      <h3>${t('dsFormH3')}</h3>
      <label for="dsClaimTx">${t('dsFormTx')}</label>
      <input type="text" id="dsClaimTx" maxlength="66" autocomplete="off" spellcheck="false" placeholder="0x…">
      <p class="ds-claim-help">${t('dsFormAyuda')}</p>
      <label for="dsContactName">${t('dsContactoNombre')}</label>
      <input type="text" id="dsContactName" maxlength="80" autocomplete="name">
      <label for="dsContactPhone">${t('dsContactoTel')}</label>
      <input type="tel" id="dsContactPhone" maxlength="25" autocomplete="tel" inputmode="tel">
      <p class="ds-claim-help">${t('dsContactoNota')}</p>
      <button type="submit" class="btn btn-primary" id="dsClaimBtn">${t('dsFormBtn')}</button>
      <p class="ds-claim-msg" id="dsClaimMsg" aria-live="polite"></p>
      <button type="button" class="ds-cancel-link" id="dsCancelBtn">${t('dsCancelar')}</button>
    </form>`;
}

function paymentHtml() {
  const addr = SUPPORT.ADDRESS;
  if (!shownClaim()) {
    return `<div class="card-block ds-pay"><h3>${t('dsComoH3')}</h3>${claimHtml()}${helpHtml()}</div>`;
  }
  return `
    <div class="card-block ds-pay">
      <h3>${t('dsComoH3')}</h3>
      <div class="ds-network-warning" role="note">
        <div class="ds-network-big">${fmt(t('dsSoloRed'), { cur: SUPPORT.CURRENCY, net: SUPPORT.NETWORK })}</div>
        <div class="ds-network-small">${t('dsSoloRedDetalle')}</div>
      </div>
      <div class="ds-pay-grid">
        <div class="ds-qr" id="dsQr" role="img" aria-label="${fmt(t('dsQrAlt'), { net: SUPPORT.NETWORK })}"></div>
        <div class="ds-addr-col">
          <div class="ds-label">${fmt(t('dsDireccionLabel'), { cur: SUPPORT.CURRENCY, net: SUPPORT.NETWORK })}</div>
          <code class="ds-addr" id="dsAddr">${addr}</code>
          <button type="button" class="btn btn-ghost ds-copy" id="dsCopyBtn">${t('dsCopiar')}</button>
          <span class="ds-copied" id="dsCopied" aria-live="polite"></span>
        </div>
      </div>
      <ol class="ds-steps">
        <li>${fmt(t('dsPaso1'), { cur: SUPPORT.CURRENCY, net: SUPPORT.NETWORK })}
          <p class="ds-why">${t('dsPorQueDecimales')}</p></li>
        <li>${t('dsPaso2')}</li>
        <li>${t('dsPaso3')}</li>
        <li>${fmt(t('dsPaso4'), { h: SUPPORT.NORMAL_REVIEW_HOURS })}</li>
      </ol>
      ${claimHtml()}
      ${helpHtml()}
    </div>`;
}

// "¿Tienes problemas?" — manual help by e-mail only (no other payment method).
function helpHtml() {
  const mail = '<a href="mailto:hello@motherverdeny.com?subject=Mother%20Verde">hello@motherverdeny.com</a>';
  return `<div class="ds-help"><h4>${t('dsProblemasH')}</h4><p>${t('dsCriptoAyuda').replace('{mail}', mail)}</p></div>`;
}

function visitorHtml() {
  return `
    <div class="card-block ds-pay">
      <h3>${t('dsComoH3')}</h3>
      <p>${t('dsVisitorNote')}</p>
      <button type="button" class="btn btn-primary" id="dsCrearCuenta">${t('accCrearCuenta')}</button>
    </div>`;
}

export function renderDesbloquear() {
  const root = document.getElementById('desbloquearContent');
  if (!root) return;
  const c0 = claimNow();
  if (awaiting(c0) && syncedFromClaim !== c0.id) { syncedFromClaim = c0.id; flowers = c0.flowers; }
  const ready = supportAddressIsValid();
  // Visitors without a session never see the address or the QR: a contribution
  // can only be verified against an account.
  const signedIn = !!window.mvCurrentUser || !!(window.mvIsPreviewSignedIn && window.mvIsPreviewSignedIn());

  root.innerHTML = `
    <p class="subhead ds-intro">${t('dsIntro')}</p>

    <div class="ds-scale" aria-hidden="true">
      ${bud(26, 'ds-bud-on')}${bud(34, 'ds-bud-on')}${bud(42, 'ds-bud-on')}${bud(52, 'ds-bud-on')}${bud(64, 'ds-bud-on')}
    </div>
    <p class="ds-scale-msg">${t('dsImportante')}</p>

    <div class="card-block ds-flowers">
      <h3>${t('dsFloresH3')}</h3>
      <p>${fmt(t('dsFloresP'), { usdc: SUPPORT.FLOWER_USDC, cur: SUPPORT.CURRENCY })}</p>
      <div class="ds-picker">
        <button type="button" class="ds-step" id="dsMenos" aria-label="${t('dsMenos')}" ${flowers <= 1 ? 'disabled' : ''}>−</button>
        <div class="ds-garden" id="dsGarden">${gardenHtml()}</div>
        <button type="button" class="ds-step" id="dsMas" aria-label="${t('dsMas')}" ${flowers >= SUPPORT.MAX_FLOWERS ? 'disabled' : ''}>+</button>
      </div>
      <div class="ds-total" id="dsTotal" aria-live="polite">${totalLine()}</div>
      <p class="ds-extra-note" id="dsPorFlor">${fmt(t('dsPorFlorNota'), { usdc: SUPPORT.FLOWER_USDC, cur: SUPPORT.CURRENCY })}</p>
      <p class="ds-extra-note">${t('dsExtraNota')}</p>
    </div>

    <div class="card-block ds-cannawasi">
      <h3>${t('dsCannaWasiH3')}</h3>
      <p>${SUPPORT_RECIPIENT_TEXT[lang()] || SUPPORT_RECIPIENT_TEXT.es}</p>
    </div>

    ${!ready ? `<div class="note-box">${t('dsProximamente')}</div>`
      : !signedIn ? visitorHtml()
      : paymentHtml()}
  `;

  root.querySelector('#dsMenos').onclick = () => { if (flowers > 1) { flowers--; renderDesbloquear(); } };
  root.querySelector('#dsMas').onclick = () => { if (flowers < SUPPORT.MAX_FLOWERS) { flowers++; renderDesbloquear(); } };
  root.querySelectorAll('.ds-slot').forEach((b) => { b.onclick = () => { flowers = Number(b.dataset.n); renderDesbloquear(); }; });

  if (!ready || !signedIn) {
    root.querySelector('#dsCrearCuenta')?.addEventListener('click', () => {
      window.showScreen?.('cuenta');
      window.mvSetAuthMode?.('signup');
    });
    return;
  }

  QRCode.toString(SUPPORT.ADDRESS, {
    type: 'svg', errorCorrectionLevel: 'M', margin: 2,
    color: { dark: '#04140F', light: '#FFFFFF' },
  }).then((svg) => {
    const box = document.getElementById('dsQr');
    if (box) box.innerHTML = svg;
  }).catch(() => {});

  root.querySelector('#dsReservarBtn')?.addEventListener('click', reserve);
  root.querySelector('#dsCancelBtn')?.addEventListener('click', cancelReservation);
  root.querySelector('#dsClaimForm')?.addEventListener('submit', submitTx);
  root.querySelector('#dsLateForm')?.addEventListener('submit', submitLate);
  root.querySelector('#dsCopyAmount')?.addEventListener('click', async () => {
    const m = document.getElementById('dsAmountCopied');
    try { await navigator.clipboard.writeText(document.getElementById('dsCopyAmount').dataset.amount); m.textContent = t('dsMontoCopiado'); }
    catch (e) { m.textContent = ''; }
  });
  if (!shownClaim()) return;

  root.querySelector('#dsCopyBtn').onclick = async () => {
    const msg = document.getElementById('dsCopied');
    try {
      await navigator.clipboard.writeText(SUPPORT.ADDRESS);
      msg.textContent = t('dsCopiada');
    } catch (e) {
      // Clipboard blocked: select the address so it can be copied by hand.
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(document.getElementById('dsAddr'));
      sel.removeAllRanges(); sel.addRange(range);
      msg.textContent = t('dsCopiaManual');
    }
  };
}

window.mvRenderDesbloquear = renderDesbloquear;
if (document.getElementById('desbloquear')?.classList.contains('active')) renderDesbloquear();
