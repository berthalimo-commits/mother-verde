// Browser test (Bertha, 2026-11-06): ENGLISH is the default language.
//  - first visit, nothing saved: age gate in English from the FIRST PAINT (before
//    main.js), <html lang="en">, English description, story / contribution
//    screen / Terms / Privacy in English;
//  - a language already chosen is kept (saved in the browser), also across reloads;
//  - the profile's language is used on a browser with none saved, but never
//    overrides one chosen in the browser;
//  - a missing translation falls back to English;
//  - no browser-language detection (navigator.language is ignored).
// Needs Vite on 5174 + fakeserver.
import { check, sleep, sql, browser, summary } from './browser.mjs';
import fs from 'fs';
const APP = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const NEWBIE = 'b0000003-0000-4000-8000-000000000000';
const hide = `document.getElementById('mvDevPreview')?.remove(); 1`;

// 1) first visit, no language saved — and the browser says it prefers German: ignored
let b = await browser(null, null, 420, { lang: null });
await b.send('Emulation.setLocaleOverride', { locale: 'de-DE' }).catch(() => {});
await b.send('Network.enable');
await b.send('Network.setBlockedURLs', { urls: ['*main.js*'] }); // what the visitor sees before the big script arrives
await b.send('Page.navigate', { url: 'http://localhost:5174/' }); await sleep(1500); for (let i = 0; i < 40 && !(await b.ev(`!!document.querySelector('[data-i18n="agYes"]')`)); i++) await sleep(250);
const early = await b.ev(`({ lang: document.documentElement.lang, title: document.querySelector('[data-i18n="agTitle"]')?.textContent.trim(), yes: document.querySelector('[data-i18n="agYes"]')?.textContent.trim() })`);
check('primera visita, ANTES de cargar main.js: puerta de edad en inglés y <html lang="en"> (aunque el navegador prefiera alemán)', early.lang === 'en' && /Age/i.test(early.title) && /18/.test(early.yes) && !/años|Verificación/.test(early.title + early.yes), JSON.stringify(early));
await b.send('Network.setBlockedURLs', { urls: [] });
const evStart = b.events.length; // the blocked main.js above raises its own load error: not counted
await b.send('Page.navigate', { url: 'http://localhost:5174/' }); await sleep(5500);
const first = await b.ev(`({ lang: document.documentElement.lang, current: window.getCurrentLang(), saved: localStorage.getItem('mv-lang'), gate: document.querySelector('[data-i18n="agTitle"]').textContent.trim(), desc: document.querySelector('meta[name="description"]')?.content, nav: navigator.language })`);
check('primera visita: la web en inglés y no guarda ningún idioma por su cuenta', first.lang === 'en' && first.current === 'en' && first.saved === null && /Age/i.test(first.gate), JSON.stringify(first));
check('descripción de la página en inglés', /^An evidence-based encyclopedia of medical and recreational cannabis/.test(first.desc || ''), first.desc);
check('no hay detección del idioma del navegador (el navegador dice alemán y la web sigue en inglés; navigator.language no aparece en el código)', first.current === 'en' && !/navigator\.languages?\b/.test(fs.readFileSync(APP + '/public/main.js', 'utf8') + fs.readdirSync(APP + '/src').filter((f) => f.endsWith('.js')).map((f) => fs.readFileSync(APP + '/src/' + f, 'utf8')).join('') + fs.readFileSync(APP + '/index.html', 'utf8')), first.nav);
await b.ev(`document.querySelector('#ageGateModal button[onclick="ageGateConfirm(true)"]').click(); 1`); await sleep(1200);
const story = await b.ev(`document.querySelector('#storySlide1')?.innerText || ''`);
check('historia de bienvenida en inglés', /Welcome/.test(story) && !/Bienvenida/.test(story), story.slice(0, 80));
await b.ev(`document.getElementById('storySkip')?.click(); ${hide}`); await sleep(300);
await b.ev(`showScreen('desbloquear'); 1`); await sleep(700);
const ds = await b.ev(`document.getElementById('dsPurpose')?.innerText || ''`);
check('pantalla de aporte en inglés', /Before you contribute/.test(ds) && /I am Bertha Limo/.test(ds), ds.slice(0, 80));
await b.ev(`mvOpenLegal('terminos', 'cuenta'); 1`); await sleep(300);
const tc = await b.ev(`document.querySelector('#terminos h2').textContent.trim()`);
await b.ev(`mvOpenLegal('privacidad', 'cuenta'); 1`); await sleep(300);
const pv = await b.ev(`document.querySelector('#privacidad [data-i18n="pv1P"]').innerText`);
check('Términos y Privacidad en inglés', tc === 'Terms and Conditions' && /^Mother Verde LLC, Hamilton, NY\. Contact for anything/.test(pv), tc + ' | ' + pv);
// 2) a missing translation falls back to English
const fb = await b.ev(`(() => { window.__k = 'zzTestKey'; translations.es.zzTestKey = 'ES'; translations.en.zzTestKey = 'EN'; document.querySelector('#langSwitch button[data-lang=fr]').click(); return t('zzTestKey'); })()`);
check('si falta una traducción, se usa el inglés (no el español)', fb === 'EN', fb);
// 3) choosing a language is remembered
await b.ev(`document.querySelector('#langSwitch button[data-lang=es]').click(); 1`); await sleep(300);
await b.send('Page.navigate', { url: 'http://localhost:5174/' }); await sleep(5500);
const kept = await b.ev(`({ lang: document.documentElement.lang, current: window.getCurrentLang(), saved: localStorage.getItem('mv-lang') })`);
check('quien eligió español lo conserva al volver (y <html lang="es">)', kept.current === 'es' && kept.lang === 'es' && kept.saved === 'es', JSON.stringify(kept));
check('sin errores de JavaScript (con main.js ya cargado)', b.events.slice(evStart).filter((e) => e.method === 'Runtime.exceptionThrown').length === 0, JSON.stringify(b.events.slice(evStart).filter((e) => e.method === 'Runtime.exceptionThrown').map((e) => e.params.exceptionDetails.exception?.description?.slice(0, 120))));
await b.close();

// 4) the language saved in the browser wins; early age gate in that language too
b = await browser(null, null, 420, { lang: 'fr' });
await b.send('Network.enable');
await b.send('Network.setBlockedURLs', { urls: ['*main.js*'] });
await b.send('Page.navigate', { url: 'http://localhost:5174/' }); await sleep(1500); for (let i = 0; i < 40 && !(await b.ev(`!!document.querySelector('[data-i18n="agYes"]')`)); i++) await sleep(250);
const frEarly = await b.ev(`({ lang: document.documentElement.lang, title: document.querySelector('[data-i18n="agTitle"]').textContent.trim() })`);
check('idioma guardado (francés): la puerta de edad sale en francés desde la primera pintura', frEarly.lang === 'fr' && !/Age verification|Verificación/.test(frEarly.title) && frEarly.title.length > 3, JSON.stringify(frEarly));
await b.close();

// 5) the profile's language: used on a new browser, never over a choice made in the browser
await sql(`update profiles set preferred_lang = 'de', subscription_status = 'supporter' where id = '${NEWBIE}'`);
b = await browser(NEWBIE, 'aal1', 420, { lang: null });
await b.send('Page.navigate', { url: 'http://localhost:5174/' }); await sleep(6500);
const prof = await b.ev(`({ current: window.getCurrentLang(), saved: localStorage.getItem('mv-lang') })`);
check('con sesión en un navegador sin idioma guardado: se usa el idioma del perfil (alemán)', prof.current === 'de' && prof.saved === 'de', JSON.stringify(prof));
await b.close();
b = await browser(NEWBIE, 'aal1', 420, { lang: 'es' });
await b.send('Page.navigate', { url: 'http://localhost:5174/' }); await sleep(6500);
const prof2 = await b.ev(`window.getCurrentLang()`);
check('con sesión pero con español elegido en este navegador: se respeta el español (el perfil no lo cambia)', prof2 === 'es', prof2);
await b.close();
await sql(`update profiles set preferred_lang = 'es' where id = '${NEWBIE}'`);
summary();
