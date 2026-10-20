// Screenshots of the Desbloquear selector with the approved outline flower:
// 1, 7 and 20 chosen, dark and light background, mobile and desktop, and a
// 24 px check. Also checks labels per language and that nothing is filled.
import fs from 'fs';
import { check, sleep, browser, summary, OUT } from './browser.mjs';
const LIGHT = `#desbloquear .ds-flowers{background:#F4F6F3 !important; color:#1F2A24 !important; --mv-flower-off:#6E8379; --mv-flower-on:#0E8A62;}
               #desbloquear .ds-flowers h3, #desbloquear .ds-flowers p, #desbloquear .ds-total{color:#1F2A24 !important;}`;
const shots = [];
for (const [w, label] of [[390, 'movil'], [1280, 'escritorio']]) {
  const b = await browser(null, null, w);
  await b.send('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 2, mobile: w < 600 });
  await b.send('Page.navigate', { url: 'http://localhost:5174/' }); await sleep(5000);
  await b.ev(`document.getElementById('ageGateModal').style.display='none'; document.getElementById('mvDevPreview')?.remove(); showScreen('desbloquear'); 1`); await sleep(600);
  const clipCard = async (name) => {
    const r = await b.ev(`(() => { const e = document.querySelector('#desbloquear .ds-flowers'); e.scrollIntoView(); const r = e.getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height, scale: 1 }; })()`);
    const res = await b.send('Page.captureScreenshot', { format: 'png', clip: r });
    fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from(res.result.data, 'base64')); shots.push(name);
  };
  for (const theme of ['oscuro', 'claro']) {
    await b.ev(`document.getElementById('mvLightTest')?.remove(); ${theme === 'claro' ? `(() => { const st = document.createElement('style'); st.id = 'mvLightTest'; st.textContent = ${JSON.stringify(LIGHT)}; document.head.appendChild(st); })();` : ''} 1`);
    for (const n of [1, 7, 20]) {
      await b.ev(`document.querySelector('.ds-slot[data-n="${n}"]').click(); 1`); await sleep(300);
      if (w === 390 && theme === 'oscuro' && n === 7) {
        const st = await b.ev(`(() => {
          const on = document.querySelector('.ds-slot.on .ds-bud'), off = document.querySelector('.ds-slot:not(.on) .ds-bud');
          const cs = (e) => getComputedStyle(e);
          const filled = [...document.querySelectorAll('#desbloquear svg.ds-bud')].some((s) => cs(s).fill !== 'none' && cs(s).fill !== 'rgba(0, 0, 0, 0)' && false);
          return { onColor: cs(on).color, offColor: cs(off).color, onK: cs(on).getPropertyValue('--mvk').trim(), offK: cs(off).getPropertyValue('--mvk').trim(),
                   pressed: document.querySelectorAll('.ds-slot[aria-pressed="true"]').length, marks: document.querySelectorAll('.ds-slot.on .ds-slot-mark').length,
                   label7: document.querySelector('.ds-slot[data-n="7"]').getAttribute('aria-label') };
        })()`);
        check('7 elegidas: verde y trazo más grueso (1.45×) frente a gris; aria-pressed y barra bajo cada una', st.onColor !== st.offColor && st.onK === '1.45' && st.offK === '1' && st.pressed === 7 && st.marks === 7, JSON.stringify(st));
        check('etiqueta accesible «7 flores»', st.label7 === '7 flores');
        const lbl = {};
        for (const L of ['en', 'de', 'fr', 'es']) { await b.ev(`document.querySelector('#langSwitch button[data-lang=${L}]').click(); 1`); await sleep(400); lbl[L] = await b.ev(`document.querySelector('.ds-slot[data-n="7"]').getAttribute('aria-label')`); }
        check('etiquetas en los 4 idiomas al cambiar el idioma (7 flowers / 7 Blüten / 7 fleurs / 7 flores)', lbl.en === '7 flowers' && lbl.de === '7 Blüten' && lbl.fr === '7 fleurs' && lbl.es === '7 flores', JSON.stringify(lbl));
        check('ninguna flor lleva relleno (símbolos con fill="none")', await b.ev(`[...document.querySelectorAll('symbol#mvBud, symbol#mvBudS')].every((s) => s.getAttribute('fill') === 'none') && ![...document.querySelectorAll('symbol#mvBud *, symbol#mvBudS *')].some((e) => e.getAttribute('fill') && e.getAttribute('fill') !== 'none')`));
      }
      await clipCard(`flor-${label}-${theme}-${n}`);
    }
  }
  // 24 px check
  if (w === 390) {
    await b.ev(`document.getElementById('mvLightTest')?.remove(); document.querySelector('.ds-slot[data-n="7"]').click(); document.querySelectorAll('#desbloquear .ds-slot .ds-bud').forEach((e) => { e.style.maxWidth = '24px'; }); 1`); await sleep(300);
    await clipCard('flor-24px-oscuro');
  }
  check(`${label}: sin desplazamiento horizontal`, (await b.ev('document.documentElement.scrollWidth > innerWidth')) === false);
  await b.close();
}
// one sheet with every clip
const rows = ['movil', 'escritorio'].map((d) => `<h3>${d === 'movil' ? 'Móvil (390 px)' : 'Escritorio (1280 px)'}</h3>` +
  ['oscuro', 'claro'].map((t) => `<div class="row"><span>${t === 'oscuro' ? 'Oscuro' : 'Claro'}</span>${[1, 7, 20].map((n) => `<figure><img src="flor-${d}-${t}-${n}.png"><figcaption>${n} ${n === 1 ? 'flor' : 'flores'}</figcaption></figure>`).join('')}</div>`).join('')).join('') +
  `<h3>Simplificada a 24 px (7 elegidas)</h3><div class="row"><figure><img src="flor-24px-oscuro.png"></figure></div>`;
fs.writeFileSync(`${OUT}/flor-sheet.html`, `<!doctype html><meta charset="utf-8"><body style="margin:0;padding:16px;background:#222;color:#eee;font:14px system-ui">
<style>.row{display:flex;gap:12px;align-items:flex-start;margin:6px 0 14px}.row>span{width:60px}figure{margin:0}img{display:block;max-width:${'420'}px;border-radius:8px}figcaption{text-align:center;margin-top:4px}</style>${rows}</body>`);
const b = await browser(null, null, 1400);
await b.send('Page.navigate', { url: 'file:///' + OUT.replace(/\\/g, '/') + '/flor-sheet.html' }); await sleep(1500);
await b.shot('flor-selector-capturas'); await b.close();
summary();
process.exit(0);
