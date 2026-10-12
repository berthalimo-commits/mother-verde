// Desbloquear screen (#desbloquear): the one-time support contribution page.
// Payment data comes ONLY from src/supportConfig.js. If the address is missing
// or malformed, the page says "Próximamente" and shows no address, QR or form.
// The QR is generated here (qrcode, MIT) — no external service is contacted.
import QRCode from 'qrcode';
import { SUPPORT, SUPPORT_RECIPIENT_TEXT, supportAddressIsValid } from './supportConfig.js';

let flowers = 1;
// main.js (classic script) can't import the config; it reads this.
window.MV_VERIFY_MAX_HOURS = SUPPORT.VERIFY_MAX_HOURS;

const t = (k) => (window.t ? window.t(k) : k);
const lang = () => (window.getCurrentLang ? window.getCurrentLang() : 'es');

function bud(size, extraClass = '') {
  return `<svg class="ds-bud ${extraClass}" width="${size}" height="${Math.round(size * 1.6)}" viewBox="0 0 60 96" aria-hidden="true"><use href="#mvBud"/></svg>`;
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
    const label = fmt(t(i === 1 ? 'dsRamoUna' : 'dsRamoVarias'), { n: i, usdc: i * SUPPORT.FLOWER_USDC, cur: SUPPORT.CURRENCY });
    html += `<button type="button" class="ds-slot${on ? ' on' : ''}" data-n="${i}" aria-pressed="${on}" aria-label="${label}">${bud(30, on ? '' : 'ds-bud-off')}</button>`;
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
const OPEN = ['submitted', 'manual_review'];
let syncedFromClaim = null; // claim id whose flower count the picker already took

const claimNow = () => window.mvLatestClaim || null;
// Preview mode (localhost / dev build): simulated, never calls the database.
const isLocalPreview = () => !!(window.mvPreviewOn && window.mvPreviewOn())
  && ((claimNow() && claimNow().id === 0) || !!(window.mvIsPreviewSignedIn && window.mvIsPreviewSignedIn()));
const amountText = (units) => (Number(units) / 1e6).toFixed(4);
const fmtWhen = (iso) => (window.mvFmtDateTime ? window.mvFmtDateTime(iso) : new Date(iso).toLocaleString());
function awaiting(c) { return c && c.status === 'awaiting_payment' && new Date(c.expires_at).getTime() > Date.now(); }

const RPC_ERR = {
  email_not_confirmed: 'dsErrConfirm', no_free_amount: 'dsErrBusy', expired: 'dsErrExpired',
  bad_tx_format: 'dsFormErrTx', tx_already_used: 'dsFormErrDup', already_supporter: 'dsYaTienes',
};
const errKey = (error) => { const m = (error && error.message) || ''; const k = Object.keys(RPC_ERR).find((x) => m.includes(x)); return k ? RPC_ERR[k] : 'dsFormErrGeneric'; };

async function reserve() {
  const msg = document.getElementById('dsClaimMsg');
  if (isLocalPreview()) {
    window.mvLatestClaim = { id: 0, status: 'awaiting_payment', flowers, amount_units: flowers * 10000000 + 4700, expires_at: new Date(Date.now() + 72 * 3600000).toISOString() };
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
  if (!TX_RE.test(tx)) { msg.textContent = t('dsFormErrTx'); return; }
  const c = claimNow();
  if (isLocalPreview()) { window.mvLatestClaim = { ...c, status: 'submitted', tx_hash: tx.toLowerCase() }; window.mvApplyAccessState?.(); renderDesbloquear(); return; }
  if (!window.mvSupabase || !window.mvCurrentUser || !c) { msg.textContent = t('dsFormErrGeneric'); return; }
  btn.disabled = true;
  msg.textContent = t('dsFormSending');
  const { data, error } = await window.mvSupabase.rpc('submit_support_claim_tx', { p_claim_id: c.id, p_tx_hash: tx });
  if (error) { msg.textContent = t(errKey(error)); btn.disabled = false; return; }
  window.mvLatestClaim = data;
  // Automatic verification (only does anything if it was switched on).
  try { await window.mvSupabase.functions.invoke('support-claims', { body: { action: 'verify', claim_id: data.id } }); } catch (e) {}
  await window.mvRefreshAuth?.();
  renderDesbloquear();
}

function claimHtml() {
  const c = claimNow();
  const access = window.mvAccessStateNow ? window.mvAccessStateNow() : '';
  if (access === 'supporter') return `<div class="note-box">${t('dsYaTienes')}</div>`;
  if (c && OPEN.includes(c.status)) {
    return `<div class="ds-claim-pending"><b>${t('dsPendingH')}</b><br>${fmt(t('dsPendingP'), { h: SUPPORT.VERIFY_MAX_HOURS })}</div>`;
  }
  const notes = (c && c.status === 'rejected' ? `<p class="ds-claim-rejected">${t('dsRejectedP')}</p>` : '')
    + (c && (c.status === 'expired' || (c.status === 'awaiting_payment' && !awaiting(c))) ? `<p class="ds-claim-rejected">${t('dsVencidoP')}</p>` : '');
  if (!awaiting(c)) {
    return `
      <div class="ds-claim">
        <h3>${t('dsReservarH')}</h3>
        ${notes}
        <p>${fmt(t('dsReservarP'), { usdc: flowers * SUPPORT.FLOWER_USDC, cur: SUPPORT.CURRENCY })}</p>
        <button type="button" class="btn btn-primary" id="dsReservarBtn">${t('dsReservarBtn')}</button>
        <p class="ds-claim-msg" id="dsClaimMsg" aria-live="polite"></p>
      </div>`;
  }
  const amount = amountText(c.amount_units);
  return `
    <div class="ds-amount" role="note">
      <div class="ds-amount-label">${t('dsEnviaExacto')}</div>
      <div class="ds-amount-big"><span id="dsAmount">${amount}</span> ${SUPPORT.CURRENCY}</div>
      <div class="ds-amount-net">${fmt(t('dsEnRed'), { net: SUPPORT.NETWORK })}</div>
      <p class="ds-amount-warn">${t('dsExactoAviso')}</p>
      <button type="button" class="btn btn-ghost ds-copy" id="dsCopyAmount">${t('dsCopiarMonto')}</button>
      <span class="ds-copied" id="dsAmountCopied" aria-live="polite"></span>
      <p class="ds-amount-note">${t('dsDecimalesP')}</p>
      <p class="ds-amount-note">${fmt(t('dsValidoHasta'), { d: fmtWhen(c.expires_at) })}</p>
      ${c.flowers !== flowers ? `<button type="button" class="btn btn-ghost" id="dsReservarBtn">${fmt(t('dsReservarOtro'), { n: flowers })}</button>` : ''}
    </div>
    <form class="ds-claim" id="dsClaimForm" novalidate>
      <h3>${t('dsFormH3')}</h3>
      <label for="dsClaimTx">${t('dsFormTx')}</label>
      <input type="text" id="dsClaimTx" maxlength="66" autocomplete="off" spellcheck="false" placeholder="0x…">
      <p class="ds-claim-help">${t('dsFormAyuda')}</p>
      <button type="submit" class="btn btn-primary" id="dsClaimBtn">${t('dsFormBtn')}</button>
      <p class="ds-claim-msg" id="dsClaimMsg" aria-live="polite"></p>
      <button type="button" class="ds-cancel-link" id="dsCancelBtn">${t('dsCancelar')}</button>
    </form>`;
}

function paymentHtml() {
  const addr = SUPPORT.ADDRESS;
  if (!awaiting(claimNow())) {
    return `<div class="card-block ds-pay"><h3>${t('dsComoH3')}</h3>${claimHtml()}</div>`;
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
        <li>${fmt(t('dsPaso1'), { cur: SUPPORT.CURRENCY, net: SUPPORT.NETWORK })}</li>
        <li>${t('dsPaso2')}</li>
        <li>${t('dsPaso3')}</li>
        <li>${fmt(t('dsPaso4'), { h: SUPPORT.VERIFY_MAX_HOURS })}</li>
      </ol>
      ${claimHtml()}
    </div>`;
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
      ${bud(26)}${bud(34)}${bud(42)}${bud(52)}${bud(64)}
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
  root.querySelector('#dsCopyAmount')?.addEventListener('click', async () => {
    const m = document.getElementById('dsAmountCopied');
    try { await navigator.clipboard.writeText(document.getElementById('dsAmount').textContent); m.textContent = t('dsMontoCopiado'); }
    catch (e) { m.textContent = ''; }
  });
  if (!awaiting(claimNow())) return;

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
