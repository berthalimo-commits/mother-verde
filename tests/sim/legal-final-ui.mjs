// Browser test (Bertha, 2026-11-05: Terms and Privacy texts approved by her
// lawyer, published as final). In the 4 languages:
//  - Terms: clause 5 shows the approved text, the date is 5 November 2026, the
//    «draft» note is gone and NO «PENDIENTE / PENDING / AUSSTEHEND / EN ATTENTE»
//    is visible;
//  - Privacy: the e-mail fingerprint sentence (section 7) is there;
//  - the whole site: a pending marker may appear ONLY in the Privacy notes that
//    still wait for the lawyer's text (STILL_PENDING below). When those texts
//    arrive, empty STILL_PENDING: the test then fails on any marker left.
// Needs Vite on 5174 + fakeserver.
import { check, sleep, browser, summary } from './browser.mjs';
const L = ['es', 'en', 'de', 'fr'];
const MARK = /PENDIENTE|PENDING|AUSSTEHEND|EN ATTENTE/;
// Privacy notes without an approved text yet (Bertha chose to wait for the lawyer's wording)
const STILL_PENDING = ['pvIntro', 'pv1P', 'pv4P', 'pv5P', 'pv7P'];
const TC5 = {
  es: /^El aporte único de apoyo ayuda a Bertha Limo, fundadora de Mother Verde, a continuar su educación en SUNY Morrisville.*La prueba gratuita de 24 horas se ofrece una sola vez por persona\. Mother Verde es un proyecto independiente, no afiliado ni respaldado por SUNY Morrisville\.$/,
  en: /^The one-time support contribution helps Bertha Limo.*not affiliated with or endorsed by SUNY Morrisville\.$/,
  de: /^Der einmalige Unterstützungsbeitrag hilft Bertha Limo.*nicht von ihr unterstützt\.$/,
  fr: /^La contribution unique de soutien aide Bertha Limo.*non affilié ni approuvé par SUNY Morrisville\.$/,
};
const UPD = { es: 'Última actualización: 5 de noviembre de 2026', en: 'Last updated: 5 November 2026', de: 'Zuletzt aktualisiert: 5. November 2026', fr: 'Dernière mise à jour : 5 novembre 2026' };
const FP = { es: 'guardamos solo una huella cifrada e irreversible de tu correo', en: 'we keep only an encrypted, irreversible fingerprint of your e-mail', de: 'speichern wir nur einen verschlüsselten, nicht umkehrbaren Fingerabdruck', fr: 'nous gardons seulement une empreinte chiffrée et irréversible' };

const b = await browser(null, null, 1100);
await b.send('Page.navigate', { url: 'http://localhost:5174/' }); await sleep(5500);
await b.ev(`document.getElementById('ageGateModal').style.display='none'; document.getElementById('mvDevPreview')?.remove(); document.getElementById('storySkip')?.click(); 1`);
const res = {};
for (const l of L) {
  await b.ev(`document.querySelector('#langSwitch button[data-lang=${l}]').click(); 1`); await sleep(400);
  await b.ev(`mvOpenLegal('terminos', 'cuenta'); 1`); await sleep(400);
  const tc = await b.ev(`(() => { const s = document.getElementById('terminos'); return { text: s.innerText, tc5: s.querySelector('[data-i18n="tc5P"]').innerText.trim(), upd: s.querySelector('[data-i18n="tcUpdated"]').innerText.trim(), draft: !!s.querySelector('[data-i18n="tcDraftNote"]') }; })()`);
  await b.ev(`mvOpenLegal('privacidad', 'cuenta'); 1`); await sleep(400);
  const pv = await b.ev(`(() => { const s = document.getElementById('privacidad'); return { pv7: s.querySelector('[data-i18n="pv7P"]').innerText, marked: [...s.querySelectorAll('[data-i18n]')].filter((e) => ${MARK}.test(e.innerText)).map((e) => e.dataset.i18n) }; })()`);
  // every screen of the site (also the hidden ones), by its translated text
  const site = await b.ev(`[...document.querySelectorAll('[data-i18n]')].filter((e) => ${MARK}.test(e.textContent)).map((e) => e.dataset.i18n)`);
  res[l] = { tc, pv, site };
}
check('Términos: la cláusula 5 muestra el texto aprobado, en los 4 idiomas', L.every((l) => TC5[l].test(res[l].tc.tc5)), JSON.stringify(L.map((l) => res[l].tc.tc5.slice(0, 80))));
check('Términos: fecha «5 de noviembre de 2026» y sin la nota de borrador, 4 idiomas', L.every((l) => res[l].tc.upd === UPD[l] && !res[l].tc.draft));
check('Términos: ningún «PENDIENTE / PENDING / AUSSTEHEND / EN ATTENTE» visible, 4 idiomas', L.every((l) => !MARK.test(res[l].tc.text)), JSON.stringify(L.filter((l) => MARK.test(res[l].tc.text))));
check('Privacidad: frase de la huella cifrada del correo (sección 7), 4 idiomas', L.every((l) => res[l].pv.pv7.includes(FP[l])));
check(`Privacidad: solo quedan marcas en las ${STILL_PENDING.length} notas que esperan el texto de la abogada (${STILL_PENDING.join(', ')})`, L.every((l) => res[l].pv.marked.every((k) => STILL_PENDING.includes(k))), JSON.stringify(L.map((l) => [l, res[l].pv.marked])));
check('toda la web: ninguna otra marca de pendiente en ningún texto, 4 idiomas', L.every((l) => res[l].site.every((k) => STILL_PENDING.includes(k))), JSON.stringify(L.map((l) => [l, res[l].site.filter((k) => !STILL_PENDING.includes(k))])));
console.log(`  (informativo) marcas visibles en Privacidad: ${L.map((l) => l + ' ' + res[l].pv.marked.length).join(', ')}`);
check('sin errores de JavaScript', b.events.filter((e) => e.method === 'Runtime.exceptionThrown').length === 0);
await b.close();
summary();
