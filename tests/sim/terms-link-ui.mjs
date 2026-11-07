// Browser test (Bertha, 2026-11-04): the «Términos y Condiciones» link in the
// «Antes de aportar» box of Desbloquear really opens the platform's Terms, in
// the 4 languages: real address (#terminos, not «#»), a REAL mouse click (not
// a script click) opens the Terms with the title at the top, the keyboard
// (Enter) too, «← Volver» comes back to Desbloquear, and opening /#terminos in
// a new tab (no session) shows the Terms. Also #privacidad and the Cuenta
// links (their «Volver» still says «Volver a Cuenta»).
// Needs Vite on 5174 + fakeserver.
import { check, sleep, sql, browser, summary } from './browser.mjs';
import path from 'path';
const APP = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const { PURPOSE_TEXTS: T } = await import('file:///' + path.join(APP, 'src/purposeTexts.js'));
const NEWBIE = 'b0000003-0000-4000-8000-000000000000';
const L = ['es', 'en', 'de', 'fr'];
const TITLE = { es: 'Términos y Condiciones', en: 'Terms and Conditions', de: 'Nutzungsbedingungen', fr: 'Conditions générales' };
const BACK_DS = { es: '← Volver a Desbloquear', en: '← Back to Unlock', de: '← Zurück zu Freischalten', fr: '← Retour à Débloquer' };

const open = async (b, url = 'http://localhost:5174/') => {
  await b.send('Page.navigate', { url }); await sleep(5500);
  await b.ev(`document.getElementById('ageGateModal').style.display='none'; document.getElementById('mvDevPreview')?.remove(); document.getElementById('storySkip')?.click(); 1`); await sleep(300);
};
const lang = async (b, l) => { await b.ev(`document.querySelector('#langSwitch button[data-lang=${l}]').click(); 1`); await sleep(300); };
const realClick = async (b, sel) => {
  const r = await b.ev(`(() => { const a = document.querySelector(${JSON.stringify(sel)}); if (!a) return null; a.scrollIntoView({ block: 'center' }); const q = a.getClientRects()[0]; const x = q.x + Math.min(q.width / 2, 12), y = q.y + q.height / 2; return { x, y, hit: document.elementFromPoint(x, y) === a || a.contains(document.elementFromPoint(x, y)) }; })()`);
  if (!r) return false;
  await sleep(150);
  for (const type of ['mousePressed', 'mouseReleased']) await b.send('Input.dispatchMouseEvent', { type, x: r.x, y: r.y, button: 'left', clickCount: 1 });
  await sleep(700);
  return r.hit;
};
const termsShown = (b, l) => b.ev(`(() => { const s = document.getElementById('terminos'); const h = s.querySelector('h2'); const r = h.getBoundingClientRect(); return s.classList.contains('active') && h.textContent.trim() === ${JSON.stringify(TITLE[l])} && r.top >= 0 && r.bottom <= innerHeight && !location.hash; })()`);

for (const [who, uid] of [['sin sesión', null], ['con sesión', NEWBIE]]) {
  if (uid) await sql(`update profiles set subscription_status = 'none', trial_ends_at = now() - interval '1 hour', trial_started_at = now() - interval '25 hours' where id = '${uid}'`);
  const b = await browser(uid, uid ? 'aal1' : null, 390);
  await open(b);
  const res = {};
  for (const l of L) {
    await lang(b, l);
    await b.ev(`showScreen('desbloquear'); 1`); await sleep(600);
    const a = await b.ev(`(() => { const a = document.getElementById('dsTermsLink'); return a && { href: a.getAttribute('href'), text: a.textContent.trim(), inBox: !!a.closest('#dsPurpose') }; })()`);
    const hit = await realClick(b, '#dsTermsLink');
    const shown = await termsShown(b, l);
    const back = await b.ev(`document.querySelector('#terminos .legal-back').textContent.trim()`);
    await realClick(b, '#terminos .legal-back');
    const returned = await b.ev(`document.getElementById('desbloquear').classList.contains('active')`);
    res[l] = { ok: a?.href === '#terminos' && a.text === T.dsPropTerms[l] && a.text === TITLE[l] && a.inBox && hit && shown && back === BACK_DS[l] && returned, a, hit, shown, back, returned };
  }
  check(`${who}: el enlace del recuadro va a #terminos (no «#»), con el mismo nombre que la página de Términos en los 4 idiomas`, L.every((l) => res[l].a?.href === '#terminos' && res[l].a.text === T.dsPropTerms[l] && T.dsPropTerms[l] === TITLE[l]), JSON.stringify(L.map((l) => res[l].a)));
  check(`${who}: un clic REAL de ratón abre los Términos (título arriba, a la vista) y «← Volver a Desbloquear» regresa, en los 4 idiomas`, L.every((l) => res[l].ok), JSON.stringify(L.filter((l) => !res[l].ok).map((l) => [l, res[l]])));
  // keyboard: Tab to the link + Enter
  await lang(b, 'es'); await b.ev(`showScreen('desbloquear'); document.getElementById('dsTermsLink').focus(); 1`); await sleep(300);
  await b.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 }); await sleep(700);
  check(`${who}: con el teclado (Enter sobre el enlace) también abre los Términos`, await termsShown(b, 'es'));
  await b.close();
}

// a new tab / long press: the address alone opens the page
const b = await browser(null, null, 390);
await open(b, 'http://localhost:5174/#terminos');
check('abrir /#terminos en una pestaña nueva (sin sesión) muestra los Términos arriba', await termsShown(b, 'es'));
check('…y su «Volver» dice «Volver a Cuenta» y lleva a Cuenta', (await b.ev(`document.querySelector('#terminos .legal-back').textContent.trim()`)) === '← Volver a Cuenta' && await realClick(b, '#terminos .legal-back') && await b.ev(`document.getElementById('cuenta').classList.contains('active')`));
await open(b, 'http://localhost:5174/#privacidad');
check('abrir /#privacidad muestra la Política de Privacidad', await b.ev(`document.getElementById('privacidad').classList.contains('active') && !location.hash`));
await b.ev(`showScreen('cuenta'); 1`); await sleep(400);
await b.ev(`(() => { const r = [...document.querySelectorAll('#cuenta .spec-row')].find((x) => x.querySelector('[data-i18n="cuentaTerminosLabel"]')); r.click(); return 1; })()`); await sleep(500);
check('desde Cuenta: abre los Términos y «Volver a Cuenta» (como antes)', await termsShown(b, 'es') && (await b.ev(`document.querySelector('#terminos .legal-back').textContent.trim()`)) === '← Volver a Cuenta');
check('sin errores de JavaScript', b.events.filter((e) => e.method === 'Runtime.exceptionThrown').length === 0);
await b.close();
summary();
