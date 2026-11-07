// Browser test (Bertha, 2026-11-05: Terms and Privacy texts approved by her
// lawyer, published as final). In the 4 languages:
//  - Terms: clause 5 shows the approved text, the date is 5 November 2026, the
//    «draft» note is gone and NO «PENDIENTE / PENDING / AUSSTEHEND / EN ATTENTE»
//    is visible;
//  - Privacy: the e-mail fingerprint sentence (section 7) is there;
//  - Privacy (final since 2026-11-05, Bertha's APRUEBO): legal basis, the
//    controller, payment records, transfers outside the EU and rights;
//    date without «borrador»;
//  - Terms clause 5 also explains gift codes, withdrawal of access and manual
//    contributions;
//  - the whole site: NO pending marker anywhere, in any language.
// Needs Vite on 5174 + fakeserver.
import { check, sleep, browser, summary } from './browser.mjs';
import fs from 'fs';
const L = ['es', 'en', 'de', 'fr'];
const MARK = /PENDIENTE|PENDING|AUSSTEHEND|EN ATTENTE/;
const STILL_PENDING = []; // none left (2026-11-05)
const TC5 = {
  es: /^El aporte único de apoyo ayuda a Bertha Limo, fundadora de Mother Verde, a seguir aprendiendo y creciendo en su vida profesional en SUNY Morrisville, que le abrió otra vez sus puertas.*La prueba gratuita de 24 horas se ofrece una sola vez por persona\. Mother Verde es un proyecto independiente, no afiliado ni respaldado por SUNY Morrisville\./,
  en: /^The one-time support contribution helps Bertha Limo, founder of Mother Verde, keep learning and growing in her professional life at SUNY Morrisville, which opened its doors to her once again.*not affiliated with or endorsed by SUNY Morrisville\./,
  de: /^Der einmalige Unterstützungsbeitrag hilft Bertha Limo, Gründerin von Mother Verde, an der SUNY Morrisville, die ihr noch einmal ihre Türen geöffnet hat, weiter zu lernen.*nicht von ihr unterstützt\./,
  fr: /^La contribution unique de soutien aide Bertha Limo, fondatrice de Mother Verde, à continuer d’apprendre et de grandir dans sa vie professionnelle à SUNY Morrisville, qui lui a de nouveau ouvert ses portes.*non affilié ni approuvé par SUNY Morrisville\./,
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
  const pv = await b.ev(`(() => { const s = document.getElementById('privacidad'); const g = (k) => s.querySelector('[data-i18n="' + k + '"]').innerText; return { text: s.innerText, pv7: g('pv7P'), intro: g('pvIntro'), pv1: g('pv1P'), pv4: g('pv4P'), pv5: g('pv5P'), upd: g('pvUpdated').trim(), marked: [...s.querySelectorAll('[data-i18n]')].filter((e) => ${MARK}.test(e.innerText)).map((e) => e.dataset.i18n) }; })()`);
  // every screen of the site (also the hidden ones), by its translated text
  const site = await b.ev(`[...document.querySelectorAll('[data-i18n]')].filter((e) => ${MARK}.test(e.textContent)).map((e) => e.dataset.i18n)`);
  res[l] = { tc, pv, site };
}
check('Términos: la cláusula 5 muestra el texto aprobado, en los 4 idiomas', L.every((l) => TC5[l].test(res[l].tc.tc5)), JSON.stringify(L.map((l) => res[l].tc.tc5.slice(0, 80))));
check('Términos: fecha «5 de noviembre de 2026» y sin la nota de borrador, 4 idiomas', L.every((l) => res[l].tc.upd === UPD[l] && !res[l].tc.draft));
check('Términos: ningún «PENDIENTE / PENDING / AUSSTEHEND / EN ATTENTE» visible, 4 idiomas', L.every((l) => !MARK.test(res[l].tc.text)), JSON.stringify(L.filter((l) => MARK.test(res[l].tc.text))));
check('Privacidad: frase de la huella cifrada del correo (sección 7), 4 idiomas', L.every((l) => res[l].pv.pv7.includes(FP[l])));
check('Privacidad: ningún «PENDIENTE / PENDING / AUSSTEHEND / EN ATTENTE» visible, 4 idiomas', L.every((l) => !MARK.test(res[l].pv.text) && res[l].pv.marked.length === 0), JSON.stringify(L.map((l) => [l, res[l].pv.marked])));
const PV = {
  basis: { es: /Por qué usamos tus datos:.*interés legítimo.*consentimiento/, en: /Why we use your data:.*legitimate interest.*consent/, de: /Warum wir deine Daten verwenden:.*berechtigten Interesses.*Einwilligung/, fr: /Pourquoi nous utilisons tes données :.*intérêt légitime.*consentement/ },
  pv4: { es: /interés legítimo en poder demostrar los pagos.*no las borra automáticamente/, en: /legitimate interest in being able to prove the payments.*does not delete them automatically/, de: /berechtigten Interesses auf, erhaltene Zahlungen.*löscht sie nicht automatisch/, fr: /intérêt légitime à pouvoir démontrer les paiements.*ne les supprime pas automatiquement/ },
  pv5: { es: /Mother Verde LLC está en Estados Unidos.*fuera de la Unión Europea/, en: /Mother Verde LLC is based in the United States.*outside the European Union/, de: /Mother Verde LLC hat ihren Sitz in den Vereinigten Staaten.*außerhalb der Europäischen Union/, fr: /Mother Verde LLC est établie aux États-Unis.*hors de l’Union européenne/ },
  pv7: { es: /en un máximo de 30 días\. Si crees que tratamos mal tus datos, también puedes presentar una reclamación ante la autoridad de protección de datos de tu país\.$/, en: /within 30 days at most\. If you believe we are mishandling your data, you can also file a complaint with the data protection authority in your country\.$/, de: /innerhalb von höchstens 30 Tagen\. .*bei der Datenschutzbehörde deines Landes beschweren\.$/, fr: /dans un délai maximal de 30 jours\. .*auprès de l’autorité de protection des données de ton pays\.$/ },
  upd: { es: 'Última actualización: 5 de noviembre de 2026', en: 'Last updated: 5 November 2026', de: 'Letzte Aktualisierung: 5. November 2026', fr: 'Dernière mise à jour : 5 novembre 2026' },
};
check('Privacidad: base legal, constancias de pago, transferencias fuera de la UE, derechos con respuesta «en un máximo de 30 días» y reclamación ante la autoridad de protección de datos y responsable «Mother Verde LLC, Hamilton, NY» con hello@, 4 idiomas', L.every((l) => PV.basis[l].test(res[l].pv.intro) && PV.pv4[l].test(res[l].pv.pv4) && PV.pv5[l].test(res[l].pv.pv5) && PV.pv7[l].test(res[l].pv.pv7) && res[l].pv.pv1.startsWith('Mother Verde LLC, Hamilton, NY.') && /hello@motherverdeny\.com/.test(res[l].pv.pv1)), JSON.stringify(L.map((l) => [l, PV.basis[l].test(res[l].pv.intro), PV.pv4[l].test(res[l].pv.pv4), PV.pv5[l].test(res[l].pv.pv5), PV.pv7[l].test(res[l].pv.pv7)])));
check('Términos, cláusula 5: no nombra apps de pago (regla del 3-11), «otro medio acordado», 4 idiomas', L.every((l) => !/paypal|cash\s?app|venmo|zelle/i.test(res[l].tc.tc5)) && /otro medio acordado|another agreed means|anderen vereinbarten Weg|autre moyen convenu/.test(L.map((l) => res[l].tc.tc5).join(' ')));
{
  const main = fs.readFileSync(new URL('../../public/main.js', import.meta.url), 'utf8');
  const tpl = fs.readFileSync(new URL('../../supabase/email-templates/confirm-signup.html', import.meta.url), 'utf8');
  const first = { es: /primera vez/, en: /first time/, de: /zum ersten Mal|Beim ersten Mal/, fr: /première fois/ };
  const val = (l, k) => JSON.parse(main.match(new RegExp('^translations\\.' + l + '\\.' + k + ' = (".*");$', 'm'))[1]);
  check('la prueba de 24 h se promete solo «la primera vez» (entrada, confirmación, historia 4 y plantilla de confirmación), 4 idiomas', L.every((l) => first[l].test(val(l, 'accEntradaP')) && first[l].test(val(l, 'accConfirmaP')) && first[l].test(val(l, 'story4P')) && first[l].test(tpl)) && !L.some((l) => /24/.test(val(l, 'accConfirmaH'))));
}
check('Privacidad: fecha «5 de noviembre de 2026», sin «borrador», 4 idiomas', L.every((l) => res[l].pv.upd === PV.upd[l]), JSON.stringify(L.map((l) => res[l].pv.upd)));
const TC5B = { es: /Códigos de regalo:.*7 días de acceso completo.*7 días.*Retiro del acceso:.*Aportes manuales:/, en: /Gift codes:.*7 days of full access.*7 days.*Withdrawal of access:.*Manual contributions:/, de: /Geschenkcodes:.*7 Tage Vollzugriff.*7 Tagen.*Entzug des Zugangs:.*Manuelle Beiträge:/, fr: /Codes cadeaux :.*7 jours d’accès complet.*7 jours.*Retrait de l’accès :.*Contributions manuelles :/ };
check('Términos, cláusula 5: párrafo de códigos de regalo (7 días), retiro de acceso y aportes manuales, 4 idiomas', L.every((l) => TC5B[l].test(res[l].tc.tc5)));
check('toda la web: ninguna otra marca de pendiente en ningún texto, 4 idiomas', L.every((l) => res[l].site.every((k) => STILL_PENDING.includes(k))), JSON.stringify(L.map((l) => [l, res[l].site.filter((k) => !STILL_PENDING.includes(k))])));
check('sin errores de JavaScript', b.events.filter((e) => e.method === 'Runtime.exceptionThrown').length === 0);
await b.close();
summary();
