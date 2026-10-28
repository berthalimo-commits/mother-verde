// Mock-up only (nothing in the app changes): the 7-leaflet leaf in the real
// header logo and in the Cultivo zone icon, before/after, at 2x zoom.
import fs from 'fs';
import { sleep, browser, OUT } from './browser.mjs';
const leaf7 = fs.readFileSync(new URL('../../design/icons/leaf-7.svg', import.meta.url), 'utf8');
const inner = leaf7.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

const b = await browser(null, null, 1100);
await b.send('Emulation.setDeviceMetricsOverride', { width: 1100, height: 800, deviceScaleFactor: 3, mobile: false });
await b.send('Page.navigate', { url: 'http://localhost:5174/' }); await sleep(5000);
await b.ev(`document.getElementById('ageGateModal').style.display='none'; document.getElementById('mvDevPreview')?.remove(); mvAccessPreview('supporter'); showScreen('cultivo'); window.scrollTo(0,0); 1`);
await sleep(600);
const rect = (sel) => b.ev(`(() => { const r = document.querySelector('${sel}').getBoundingClientRect(); return { x: Math.max(0, r.x - 8), y: Math.max(0, r.y - 8), width: Math.min(r.width + 16, 330), height: r.height + 16, scale: 1 }; })()`);
async function clip(sel, name) {
  const r = await b.send('Page.captureScreenshot', { format: 'png', clip: await rect(sel) });
  fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.result.data, 'base64'));
}
await clip('.brand', 'leaf-logo-antes'); await clip('.brand-mark', 'leaf-logo-zoom-antes');
await clip('#cultivo .eyebrow-row', 'leaf-zona-antes'); await clip('#cultivo .zone-icon', 'leaf-zona-zoom-antes');
await b.ev(`(() => {
  const swap = (svg, color) => { svg.innerHTML = ${JSON.stringify(inner)}.replace(/currentColor/g, color); };
  swap(document.querySelector('.brand-mark svg'), 'var(--paper)');
  swap(document.querySelector('#cultivo .zone-icon'), 'var(--moss-deep)');
  return 1; })()`);
await sleep(300);
await clip('.brand', 'leaf-logo-despues'); await clip('.brand-mark', 'leaf-logo-zoom-despues');
await clip('#cultivo .eyebrow-row', 'leaf-zona-despues'); await clip('#cultivo .zone-icon', 'leaf-zona-zoom-despues');
await b.close();
process.exit(0);
