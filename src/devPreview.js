// DEV PREVIEW — state selector with example data. Only in builds made with the
// preview flag (local dev server, Vercel build of branch "dev"); the production
// build doesn't contain this file (see vite.config.js).
// It never writes to the database: it only switches the app's preview state
// (mvAccessPreview / mvClaimPreview in main.js), and Desbloquear / the gift
// code simulate their answers while a preview state is on.

const STATES = [
  ['', 'Real (sin vista previa)'],
  ['visitor', 'Visitante (sin sesión)'],
  ['unconfirmed', 'Registrada, correo sin confirmar'],
  ['trial', 'Prueba de 24 h activa'],
  ['expired', 'Prueba terminada, sin aporte'],
  ['no_trial', 'Cuenta antigua sin prueba'],
  ['granted', 'Acceso por código de regalo (7 días)'],
  ['supporter', 'Acceso completo (aporte verificado)'],
  ['revoked', 'Acceso retirado'],
];
const CLAIMS = [
  ['', 'Sin aviso de aporte'],
  ['awaiting_payment', 'Monto reservado, sin pagar'],
  ['submitted', 'TXID enviado (pendiente)'],
  ['manual_review', 'En revisión manual'],
  ['rejected', 'Rechazado'],
  ['expired', 'Monto reservado vencido'],
];
const opts = (list, cur) => list.map(([v, l]) => `<option value="${v}"${v === cur ? ' selected' : ''}>${l}</option>`).join('');

function mount() {
  if (!window.mvAccessPreview || document.getElementById('mvDevPreview')) return;
  const box = document.createElement('div');
  box.id = 'mvDevPreview';
  box.setAttribute('role', 'region');
  box.setAttribute('aria-label', 'Vista previa de dev');
  box.style.cssText = 'position:fixed;left:10px;bottom:10px;z-index:99999;background:#0b1f17;color:#e8efe9;border:2px dashed #E8A33D;border-radius:10px;padding:10px 12px;font:13px/1.4 system-ui,sans-serif;max-width:min(330px,calc(100vw - 20px));box-shadow:0 4px 18px rgba(0,0,0,.4)';
  box.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
      <b style="color:#E8A33D">VISTA PREVIA · solo dev</b>
      <button type="button" id="mvDpMin" style="background:none;border:0;color:#e8efe9;cursor:pointer;font-size:16px" aria-label="Minimizar">–</button>
    </div>
    <div id="mvDpBody">
      <div style="opacity:.8;margin:2px 0 8px">Datos de ejemplo. No se guarda nada.</div>
      <label style="display:block;margin-bottom:6px">Estado de acceso<br>
        <select id="mvDpState" style="width:100%;margin-top:2px">${opts(STATES, '')}</select></label>
      <label style="display:block;margin-bottom:8px">Aviso de aporte<br>
        <select id="mvDpClaim" style="width:100%;margin-top:2px">${opts(CLAIMS, '')}</select></label>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        <button type="button" data-go="desbloquear">Desbloquear</button>
        <button type="button" data-go="cuenta">Cuenta</button>
        <button type="button" data-go="acceso">Pantalla de acceso</button>
        <a href="/panel-mv.html?demo=1" style="color:#8fd3a6">Panel de ejemplo</a>
      </div>
    </div>`;
  document.body.appendChild(box);
  const apply = () => {
    const st = box.querySelector('#mvDpState').value;
    const cl = box.querySelector('#mvDpClaim').value;
    window.mvAccessPreview(st || null, st === 'trial' ? 90 : undefined);
    window.mvClaimPreview(cl || null);
  };
  box.querySelector('#mvDpState').onchange = apply;
  box.querySelector('#mvDpClaim').onchange = apply;
  box.querySelectorAll('[data-go]').forEach((b) => { b.onclick = () => window.showScreen?.(b.dataset.go); });
  box.querySelector('#mvDpMin').onclick = () => {
    const body = box.querySelector('#mvDpBody');
    body.hidden = !body.hidden;
  };
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
else mount();
