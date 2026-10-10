// Desbloquear screen (#desbloquear): the one-time support contribution page.
// Payment data comes ONLY from src/supportConfig.js. If the address is missing
// or malformed, the page says "Próximamente" and shows no address, QR or form.
// The QR is generated here (qrcode, MIT) — no external service is contacted.
import QRCode from 'qrcode';
import { SUPPORT, SUPPORT_RECIPIENT_TEXT, supportAddressIsValid } from './supportConfig.js';

let flowers = 1;

const t = (k) => (window.t ? window.t(k) : k);
const lang = () => (window.getCurrentLang ? window.getCurrentLang() : 'es');

function bud(size, extraClass = '') {
  return `<svg class="ds-bud ${extraClass}" width="${size}" height="${Math.round(size * 1.6)}" viewBox="0 0 60 96" aria-hidden="true"><use href="#mvBud"/></svg>`;
}

function fmt(template, vars) {
  return Object.entries(vars).reduce((s, [k, v]) => s.split('{' + k + '}').join(String(v)), template);
}

function gardenHtml() {
  const shown = Math.min(flowers, SUPPORT.MAX_FLOWERS);
  let html = '';
  for (let i = 0; i < shown; i++) html += bud(34, 'ds-bud-pop');
  return html;
}

function totalLine() {
  const key = flowers === 1 ? 'dsRamoUna' : 'dsRamoVarias';
  return fmt(t(key), { n: flowers, usdc: flowers * SUPPORT.FLOWER_USDC, cur: SUPPORT.CURRENCY });
}

function paymentHtml() {
  const addr = SUPPORT.ADDRESS;
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
        <li>${fmt(t('dsPaso2'), { usdc: SUPPORT.FLOWER_USDC, cur: SUPPORT.CURRENCY })}</li>
        <li>${t('dsPaso3')}</li>
        <li>${fmt(t('dsPaso4'), { h: SUPPORT.VERIFY_MAX_HOURS })}</li>
      </ol>
      <div class="note-box ds-form-soon">${t('dsFormProximamente')}</div>
    </div>`;
}

export function renderDesbloquear() {
  const root = document.getElementById('desbloquearContent');
  if (!root) return;
  const ready = supportAddressIsValid();

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

    ${ready ? paymentHtml() : `<div class="note-box">${t('dsProximamente')}</div>`}
  `;

  root.querySelector('#dsMenos').onclick = () => { if (flowers > 1) { flowers--; renderDesbloquear(); } };
  root.querySelector('#dsMas').onclick = () => { if (flowers < SUPPORT.MAX_FLOWERS) { flowers++; renderDesbloquear(); } };

  if (!ready) return;

  QRCode.toString(SUPPORT.ADDRESS, {
    type: 'svg', errorCorrectionLevel: 'M', margin: 2,
    color: { dark: '#04140F', light: '#FFFFFF' },
  }).then((svg) => {
    const box = document.getElementById('dsQr');
    if (box) box.innerHTML = svg;
  }).catch(() => {});

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
