// Browser test (2nd independent review, 2026-11-06): the two dose-per-serving
// calculators (Herramientas and Comestibles) refuse 0 and negative numbers
// with a message in the 4 languages, instead of treating 0 servings as 1 or
// showing a negative dose; normal values still give the dose.
// Needs Vite on 5174 + fakeserver.
import { check, sleep, browser, summary } from './browser.mjs';
const MSG = { es: 'Escribe números mayores que 0.', en: 'Enter numbers greater than 0.', de: 'Gib Zahlen größer als 0 ein.', fr: 'Saisis des nombres supérieurs à 0.' };
const b = await browser(null, null, 1100);
await b.send('Page.navigate', { url: 'http://localhost:5174/' }); await sleep(5500);
await b.ev(`document.getElementById('ageGateModal').style.display='none'; document.getElementById('mvDevPreview')?.remove(); document.getElementById('storySkip')?.click(); 1`);
const put = (id, v) => b.ev(`(() => { const e = document.getElementById('${id}'); e.value = '${v}'; e.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
const out = (id) => b.ev(`document.getElementById('${id}').textContent.trim()`);
const res = {};
for (const [mgId, sId, rId] of [['doseMg', 'doseServings', 'doseResult'], ['cmDoseMg', 'cmDoseServings', 'cmDoseResult']]) {
  const r = {};
  await put(mgId, '600'); await put(sId, '10'); await sleep(150); r.normal = await out(rId);
  await put(sId, '0'); await sleep(150); r.zero = await out(rId);
  await put(sId, '-5'); await sleep(150); r.negServ = await out(rId);
  await put(sId, '10'); await put(mgId, '-100'); await sleep(150); r.negMg = await out(rId);
  await put(mgId, '0'); await sleep(150); r.zeroMg = await out(rId);
  r.lang = {};
  for (const l of ['en', 'de', 'fr', 'es']) { await b.ev(`document.querySelector('#langSwitch button[data-lang=${l}]').click(); 1`); await sleep(400); r.lang[l] = await out(rId); }
  await put(mgId, '600'); await sleep(150); r.back = await out(rId);
  res[rId] = r;
}
for (const [rId, name] of [['doseResult', 'Herramientas'], ['cmDoseResult', 'Comestibles']]) {
  const r = res[rId];
  check(`${name}: 600 mg en 10 porciones -> 60.0 mg por porción`, /^60\.0 mg/.test(r.normal), r.normal);
  check(`${name}: 0 porciones, porciones negativas, mg negativos o 0 mg -> mensaje, no un número`, [r.zero, r.negServ, r.negMg, r.zeroMg].every((x) => x === MSG.es), JSON.stringify(r));
  check(`${name}: el mensaje está en los 4 idiomas`, Object.entries(r.lang).every(([l, x]) => x === MSG[l]), JSON.stringify(r.lang));
  check(`${name}: al volver a un valor válido, vuelve el resultado`, /^60\.0 mg/.test(r.back), r.back);
}
check('sin errores de JavaScript', b.events.filter((e) => e.method === 'Runtime.exceptionThrown').length === 0);
await b.close();
summary();
