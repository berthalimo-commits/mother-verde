// Browser test (Bertha, 2026-11-06): in English, German and French no Spanish
// text is left outside the translation system. Scans EVERY text node of the
// page (also hidden screens and inputs' placeholders / aria-labels / titles)
// after switching language and after rendering the dynamic parts (search,
// calculators, travel checklist, Médico, education), looking for words that
// only Spanish uses. Allowed on purpose, marked in the HTML with
// translate="no": proper names (universities, institutions, published titles)
// and quotes in the original language.
// Needs Vite on 5174 + fakeserver.
import { check, sleep, browser, summary } from './browser.mjs';
// words that are Spanish and not English/German/French (whole words, case-insensitive).
// Left out on purpose because they also exist in French, German or English: que, los,
// con, sin, alto, mayo, par, une, firma (German «Firma» = company).
const ES = /(?<![\p{L}])(las|del|para|una|unos|unas|por|está|están|más|también|según|días|semanas|meses|horas|porción|porciones|resultados|verificados|listo|viajar|objetivo|rango|bajo|dentro|ambiente|seco|húmedo|cerrar|correo|tipo|siglo|archivado|nueva|nuevo|lote|sello|contacto|universidad|estudio|países|país|europeos|diciembre|enero|febrero|marzo|abril|junio|julio|agosto|septiembre|octubre|noviembre|médico|salud|pública|cultivo|horticultura|medicina|perú|alemania|reino unido|países bajos|ee\. ?uu\.)(?![\p{L}])/iu;
// Proper names that stay in Spanish in every language (people, institutions, a journal, places)
const PROPER = /Di Marzo|Fundación Ciencias para la Cannabis|Centro Médico Cannabimed|Viña del Mar|Concepción|Cannabis y Salud|Instituto de Regulación y Control del Cannabis|Instituto Argentino del Cannabis|Universidad de Caldas|Universidad [A-ZÁÉÍÓÚ][\p{L} .]*/gu;
const LANGS = (process.env.MV_LANGS || 'en,de,fr').split(',');

const b = await browser(null, null, 1200, { lang: 'en' });
await b.send('Page.navigate', { url: 'http://localhost:5174/' }); await sleep(6000);
await b.ev(`document.getElementById('ageGateModal').style.display='none'; document.getElementById('mvDevPreview')?.remove(); document.getElementById('storySkip')?.click(); 1`);

const scan = () => b.ev(`(() => {
  const RE = ${ES};
  const PROPER = ${PROPER};
  const out = [];
  const skip = (el) => el.closest('script,style,noscript,[translate="no"],#mvDevPreview,svg title');
  const where = (el) => { const s = el.closest('[id]'); const k = el.closest('[data-i18n]'); return (s ? '#' + s.id : '') + (k ? ' [' + k.getAttribute('data-i18n') + ']' : ''); };
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) {
    const txt = n.nodeValue.trim(); if (!txt || !n.parentElement || skip(n.parentElement)) continue;
    const m = txt.replace(PROPER, '').match(RE); if (m) out.push(where(n.parentElement) + ' «' + txt.slice(0, 70) + '»');
  }
  for (const el of document.querySelectorAll('[placeholder],[aria-label],[title],[alt]')) {
    if (skip(el)) continue;
    for (const a of ['placeholder', 'aria-label', 'title', 'alt']) { const v = el.getAttribute(a); if (v && RE.test(v)) out.push(where(el) + ' @' + a + ' «' + v.slice(0, 60) + '»'); }
  }
  return [...new Set(out)];
})()`);

const all = {};
for (const l of LANGS) {
  await b.ev(`document.querySelector('#langSwitch button[data-lang=${l}]').click(); 1`); await sleep(600);
  // dynamic parts: search results, calculators, checklist, Médico by country, education filter
  await b.ev(`(() => {
    try { openSearch?.(); const i = document.getElementById('searchInput'); if (i) { i.value = 'zzzz'; i.dispatchEvent(new Event('input', { bubbles: true })); } } catch (e) {}
    for (const f of ['updateVPD','updateDLI','updateDose','updateDoseComestibles','updateDecarbCalc','renderTravelChecklist','renderHarvestChecklist']) { try { window[f]?.(); } catch (e) {} }
    return 1; })()`);
  await sleep(300);
  all[l] = await scan();
  await b.ev(`try { closeSearch?.(); } catch (e) {} 1`);
}
for (const l of LANGS) check(`${l}: ningún texto en español fuera de las traducciones (${all[l].length} encontrados)`, all[l].length === 0, '\n      ' + all[l].slice(0, 40).join('\n      '));
if (process.env.MV_DUMP) fs.writeFileSync(process.env.MV_DUMP, JSON.stringify(all, null, 1));

// search in any language: «Germany», «Deutschland» and «Alemania» find the same country,
// shown with its name in the current language
const search = async (l, q) => {
  await b.ev(`document.querySelector('#langSwitch button[data-lang=${l}]').click(); 1`); await sleep(300);
  return b.ev(`(() => { openSearch(); const i = document.getElementById('searchInput'); i.value = ${JSON.stringify(q)}; i.dispatchEvent(new Event('input', { bubbles: true })); runSearch(); return [...document.querySelectorAll('#searchResults .search-result-title')].map((x) => x.textContent.trim()); })()`);
};
const s1 = await search('en', 'Germany'), s2 = await search('en', 'Deutschland'), s3 = await search('en', 'Alemania'), s4 = await search('de', 'Germany');
check('buscador: «Germany», «Deutschland» y «Alemania» encuentran Alemania (en inglés se muestra «Germany»; en alemán, «Deutschland»)', s1.includes('Germany') && s2.includes('Germany') && s3.includes('Germany') && s4.includes('Deutschland'), JSON.stringify([s1, s2, s3, s4]));
const s5 = await search('fr', 'mildew'), s6 = await search('es', 'Oídio');
check('buscador: los temas también se encuentran en otro idioma y se muestran en el actual («mildew» en francés -> «Oïdium (blanc)»)', s5.includes('Oïdium (blanc)') && s6.includes('Oídio (mildiu polvoso)'), JSON.stringify([s5, s6]));
const none = await b.ev(`(() => { const i = document.getElementById('searchInput'); i.value = '<b>zz</b>'; runSearch(); return document.querySelector('#searchResults .search-empty')?.innerHTML; })()`);
check('buscador: «sin resultados» traducido y lo escrito no se interpreta como HTML', /&lt;b&gt;zz&lt;\/b&gt;/.test(none || '') && /Sin resultados/.test(none || ''), none);
await b.ev(`closeSearch(); 1`);
// travel checklist keeps the ticks when the language changes
const tc = await b.ev(`(() => { renderTravelChecklist(); const c = document.querySelector('.tc-item[data-idx="2"]'); c.checked = true; c.dispatchEvent(new Event('change')); document.querySelector('#langSwitch button[data-lang=de]').click(); return { ticked: document.querySelector('.tc-item[data-idx="2"]').checked, text: document.querySelector('#travelChecklist span').textContent, prog: document.getElementById('travelChecklistProgress').textContent }; })()`);
check('checklist de viaje: en alemán, conserva lo marcado y el contador está traducido', tc.ticked && /Reiseziel/.test(tc.text) && /^1 von 6 geprüft/.test(tc.prog), JSON.stringify(tc));
const med = await b.ev(`[...document.querySelectorAll('#ciencia-medico [data-cc]')].map((x) => x.textContent).slice(0, 5)`);
check('Médico: los nombres de país siguen el idioma (alemán: Peru, Chile, Spanien, Deutschland…)', med.includes('Deutschland') && med.includes('Spanien'), JSON.stringify(med));
check('sin errores de JavaScript', b.events.filter((e) => e.method === 'Runtime.exceptionThrown').length === 0);
await b.close();
summary();
import fs from 'fs';
