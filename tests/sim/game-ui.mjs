// Browser test — Zona del juego (fakeserver.mjs, all migrations incl. 20261015100000).
// Access (trial / expired / contribution / gift), lazy loading, progress
// (save, reload, another device, offline, lock + unlock), 4 languages live,
// phase 2 (drying, curing, qualitative rosin: choose, save, reload, no figures),
// mobile + desktop, light + dark (the platform is dark-only: same colours),
// 44 px targets, contrast, dev preview.
import { check, sleep, sql, browser, summary, ADMIN, PAYER } from './browser.mjs';

const NEWBIE = 'b0000003-0000-4000-8000-000000000000';
const open = async (b) => { await b.send('Page.navigate', { url: 'http://localhost:5174/' }); await sleep(5500); await b.ev(`document.getElementById('ageGateModal').style.display='none'; document.getElementById('mvDevPreview')?.remove(); 1`); };
const screen = (b) => b.ev(`document.querySelector('.screen.active')?.id`);
const gameLoaded = (b) => b.ev(`performance.getEntriesByType('resource').some((r) => /\\/src\\/game\\/game\\.js/.test(r.name))`);
const gs = (b) => b.ev(`window.mvGameDebug ? JSON.parse(JSON.stringify(window.mvGameDebug.state)) : null`);
const goGame = async (b) => { await b.ev(`goMore('juego'); 1`); for (let i = 0; i < 30; i++) { if (await b.ev(`!!document.getElementById('jgBubble') || document.querySelector('.screen.active')?.id !== 'juego'`)) break; await sleep(200); } await sleep(300); };
const click = (b, id) => b.ev(`document.getElementById('${id}').click(); 1`);
const serverRow = async (uid) => (await sql(`select seq, state->>'week' as week, state->>'stage' as stage from game_progress where user_id = '${uid}'`))[0] || null;

// ------------------------------------------------------------ access
await sql(`update profiles set subscription_status = 'trialing', trial_ends_at = now() + interval '20 hours', trial_started_at = now() where id = '${NEWBIE}'`);
let b = await browser(PAYER, 'aal1', 390);
await open(b);
check('el juego NO se descarga si no se entra (solo existe la entrada del menú)', await gameLoaded(b) === false && await b.ev(`!!document.getElementById('tabsMoreJuego')`));
await goGame(b);
const lockTxt = await b.ev(`document.getElementById('acceso').innerText`);
check('prueba vencida sin aporte -> la misma pantalla de bloqueo que las demás zonas', await screen(b) === 'acceso' && /Tu prueba gratis terminó/.test(lockTxt), await screen(b));
check('…y el juego ni siquiera se descargó', await gameLoaded(b) === false);
await b.close();

b = await browser(NEWBIE, 'aal1', 390);
await open(b);
await goGame(b);
check('prueba de 24 h activa -> entra al juego', await screen(b) === 'juego' && await gameLoaded(b) === true);
const intro = await b.ev(`document.getElementById('juegoRoot').innerText`);
check('avisos visibles: simulación educativa, solo mayores de 18, sin dinero ni rankings', /Simulación educativa/.test(intro) && /mayores de 18/.test(intro) && /sin rankings/.test(intro));
check('el científico de la plataforma es el guía (mismo dibujo)', await b.ev(`document.querySelector('#juego .jg-sci svg path[d="M26 24 Q34 20 40 30 Q42 40 34 48 Q26 52 20 46 Q16 36 26 24 Z"]') !== null`));

check('portada: el científico explica (pose «explicando»)', await b.ev(`document.querySelector('#juego .jg-sci svg')?.dataset.pose`) === 'explicando');

// ------------------------------------------------------------ playing + saving
await click(b, 'jgStart'); await sleep(800);
for (let i = 0; i < 3; i++) { await click(b, 'jgNext'); await sleep(900); }
check('tras jugar semanas la pose cambia según lo que pasa', ['contento', 'pensando', 'preocupado', 'lupa'].includes(await b.ev(`document.querySelector('#juego .jg-sci svg')?.dataset.pose`)));
let st = await gs(b);
const row = await serverRow(NEWBIE);
check('jugar 3 semanas -> se guarda en la cuenta (semana y seq iguales en el servidor)', st.week === 4 && row && Number(row.week) === 4 && row.seq === st.seq, JSON.stringify({ st: st.week, row }));
check('mensaje «Guardado en tu cuenta.»', /Guardado en tu cuenta/.test(await b.ev(`document.getElementById('jgSync').innerText`)));
await b.send('Page.reload'); await sleep(5500);
await b.ev(`document.getElementById('ageGateModal').style.display='none'; 1`);
await goGame(b);
st = await gs(b);
check('recargar -> continúa exactamente en la misma semana, sin repetir', st.week === 4 && st.stage === 'vegetativo' && await b.ev(`!document.getElementById('jgStart')`), JSON.stringify({ week: st.week, stage: st.stage }));

// ------------------------------------------------------------ offline
await b.send('Network.enable');
await b.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
await b.ev(`window.dispatchEvent(new Event('offline')); 1`);
await click(b, 'jgNext'); await sleep(1200);
const offMsg = await b.ev(`document.getElementById('jgSync').innerText`);
check('sin internet -> la semana se juega igual y queda guardada en el dispositivo', (await gs(b)).week === 5 && /este dispositivo/.test(offMsg) && Number((await serverRow(NEWBIE)).week) === 4, offMsg);
await b.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
await b.ev(`window.dispatchEvent(new Event('online')); 1`); await sleep(1500);
check('vuelve la conexión -> se envía sola a la cuenta', Number((await serverRow(NEWBIE)).week) === 5);
await b.close();

// ------------------------------------------------------------ another device
let b2 = await browser(NEWBIE, 'aal1', 1280);
await open(b2);
await goGame(b2);
check('otro dispositivo (navegador nuevo, sin copia local) -> sigue en la semana 5', (await gs(b2)).week === 5);
await click(b2, 'jgNext'); await sleep(1000);
await b2.close();
b = await browser(NEWBIE, 'aal1', 390); // this "first device" has an older local copy (week 5)? new profile: fresh -> server
await open(b);
await b.ev(`localStorage.setItem('mv-game:${NEWBIE}', JSON.stringify({ state: Object.assign(${JSON.stringify(st)}, { seq: 1, week: 2 }), pending: false })); 1`);
await goGame(b);
check('un dispositivo con una copia vieja -> toma la más nueva de la cuenta (semana 6)', (await gs(b)).week === 6);

// ------------------------------------------------------------ lock + unlock
await sql(`update profiles set trial_ends_at = now() - interval '1 minute' where id = '${NEWBIE}'`);
await b.ev(`window.mvRefreshAuth(); 1`); await sleep(1500);
check('vence la prueba con el juego abierto -> pantalla de bloqueo', await screen(b) === 'acceso');
check('…el progreso sigue en la cuenta', Number((await serverRow(NEWBIE)).week) === 6);
await sql(`update profiles set subscription_status = 'supporter' where id = '${NEWBIE}'`);
await b.ev(`window.mvRefreshAuth(); 1`); await sleep(1500);
await goGame(b);
check('tras el aporte -> vuelve a entrar y sigue en la semana 6', await screen(b) === 'juego' && (await gs(b)).week === 6);

// ------------------------------------------------------------ 4 languages live
const titles = {};
for (const L of ['en', 'de', 'fr', 'es']) {
  await b.ev(`document.querySelector('#langSwitch button[data-lang=${L}]').click(); 1`); await sleep(500);
  titles[L] = await b.ev(`document.getElementById('jgH1').textContent + ' | ' + document.querySelector('#juego legend').textContent + ' | ' + document.getElementById('jgNext').textContent`);
}
check('cambio de idioma en vivo (EN, DE, FR, ES) redibuja el juego', /Grow your plant/.test(titles.en) && /Zieh deine Pflanze/.test(titles.de) && /Cultive ta plante/.test(titles.fr) && /Cultiva tu planta/.test(titles.es), JSON.stringify(titles));
const raw = await b.ev(`(() => { const out = []; for (const L of ['es','en','de','fr']) { /* no visible text may be a raw key */ } return document.getElementById('juego').innerText.match(/\\bjg[A-Z][A-Za-z_]+/g) || []; })()`);
check('ningún texto sin traducir (claves «jg…» a la vista)', raw.length === 0, raw.join(','));
await b.close();

// ------------------------------------------------------------ gift + contribution
await sql(`update profiles set subscription_status = 'trialing', trial_ends_at = now() - interval '3 days', access_until = now() + interval '7 days' where id = '${PAYER}'`);
b = await browser(PAYER, 'aal1', 390);
await open(b);
await goGame(b);
check('acceso por código de regalo (días vigentes) -> entra al juego', await screen(b) === 'juego');
await b.close();

// ------------------------------------------------------------ phase 2: drying, curing, rosin
b = await browser(PAYER, 'aal1', 390);
await open(b);
await goGame(b);
await click(b, 'jgStart'); await sleep(700);
for (let i = 0; i < 14 && (await gs(b)).stage !== 'floracion'; i++) { await click(b, 'jgNext'); await sleep(700); }
await click(b, 'jgHarvest'); await sleep(1200);
st = await gs(b);
check('cosechar -> pasa al secado (no al resultado) y el guía da la nota de la cosecha', st.stage === 'secado' && !!(await b.ev(`document.getElementById('jgPostForm')`))
  && /Nota de la cosecha/.test(await b.ev(`document.getElementById('jgBubble').innerText`)), st.stage);
check('en el secado no hay nada elegido de antemano', await b.ev(`document.querySelectorAll('#jgPostForm input:checked').length`) === 0);
await click(b, 'jgPostNext'); await sleep(400);
check('seguir sin elegir -> aviso «Elige una opción en cada grupo» y no avanza', /Elige una opción/.test(await b.ev(`document.getElementById('jgMissing').innerText`)) && (await gs(b)).stage === 'secado');
const pick = (st2, ch) => b.ev(`(() => { for (const [d, o] of Object.entries(${JSON.stringify(ch)})) document.querySelector('label[for="jgp-${st2}-' + d + '-' + o + '"]').click(); return 1; })()`);
const a11y = () => b.ev(`(() => {
  const small = [...document.querySelectorAll('#juego button, #juego .jg-opts label')].filter((e) => e.offsetParent && e.getBoundingClientRect().height < 44).length;
  const unlabelled = [...document.querySelectorAll('#juego input')].filter((i) => !document.querySelector('label[for="' + i.id + '"]')).length;
  return small === 0 && unlabelled === 0 && [...document.querySelectorAll('#juego fieldset')].every((f) => f.querySelector('legend')?.textContent.trim()) && document.documentElement.scrollWidth <= innerWidth;
})()`);
check('secado en el móvil: opciones ≥ 44 px, etiquetadas, grupos con nombre, sin desborde', await a11y());
await pick('secado', { temperatura: 'calida', humedad: 'media', aire: 'pared', luz: 'oscuro', duracion: 'chasquido' });
await click(b, 'jgPostNext'); await sleep(1200);
st = await gs(b);
check('secado con calor -> pasa al curado, el guía dice qué restó y se preocupa', st.stage === 'curado' && /temperatura del secado/.test(await b.ev(`document.getElementById('jgBubble').innerText`))
  && await b.ev(`document.querySelector('#juego .jg-sci svg').dataset.pose`) === 'preocupado');
check('el curado queda guardado en la cuenta', (await serverRow(PAYER))?.stage === 'curado');
await b.send('Page.reload'); await sleep(5500);
await b.ev(`document.getElementById('ageGateModal').style.display='none'; 1`);
await goGame(b);
check('recargar -> sigue en el curado', (await gs(b)).stage === 'curado' && !!(await b.ev(`document.getElementById('jgPostForm')`)));
await pick('curado', { envase: 'vidrio', humedad: 'media', abrir: 'diario', tiempo: 'semanas' });
await click(b, 'jgPostNext'); await sleep(1200);
const rosinTxt = await b.ev(`document.getElementById('jgPostForm').innerText`);
check('prensa de rosin: aviso de seguridad visible, guía con casco y gafas, botón para no hacerla', (await gs(b)).stage === 'rosin' && /quemaduras/.test(rosinTxt)
  && await b.ev(`document.querySelector('#juego .jg-sci svg').dataset.pose`) === 'casco' && !!(await b.ev(`document.getElementById('jgSkipRosin')`)));
check('rosin sin ninguna cifra en pantalla (ni temperaturas, ni tiempos, ni presiones)', !/\d/.test(rosinTxt + await b.ev(`document.getElementById('jgBubble').innerText`)), rosinTxt);
const rosinTitles = {};
for (const L of ['en', 'de', 'fr', 'es']) {
  await b.ev(`document.querySelector('#langSwitch button[data-lang=${L}]').click(); 1`); await sleep(500);
  rosinTitles[L] = await b.ev(`document.querySelector('#jgPostForm h3').textContent + ' | ' + (document.getElementById('juego').innerText.match(/\\bjg[A-Z][A-Za-z_]+/g) || []).join(',')`);
}
check('rosin en 4 idiomas, sin claves a la vista', /simulated\) \| $/.test(rosinTitles.en) && /simuliert\) \| $/.test(rosinTitles.de) && /simulé\) \| $/.test(rosinTitles.fr) && /simulado\) \| $/.test(rosinTitles.es), JSON.stringify(rosinTitles));
await pick('rosin', { material: 'curado', calor: 'medio', presion: 'media', papel: 'pergamino', proteccion: 'sin_proteccion' });
await click(b, 'jgPostNext'); await sleep(1200);
const fin = await b.ev(`document.getElementById('juegoRoot').innerText`);
st = await gs(b);
check('resultado final: nota al cosechar y después del secado y el curado, qué restó y veredicto del rosin', st.stage === 'fin' && st.result.final === st.result.score - 8
  && /después del secado y el curado/.test(fin) && /temperatura del secado/.test(fin) && /Rosin \(simulado\): para mejorar: la protección/.test(fin), JSON.stringify(st.result));
check('sin protección -> el guía avisa de las quemaduras', /guantes resistentes al calor/.test(await b.ev(`document.getElementById('jgBubble').innerText`)));
check('«Repasar» lleva a Elaboración → Procesos & SOP', await b.ev(`(() => { const x = [...document.querySelectorAll('#juego .jg-lesson')].find((e) => e.dataset.lesson === 'procesos'); if (!x) return false; x.click(); return true; })()`)
  && (await sleep(600), await screen(b)) === 'elaboracion' && await b.ev(`document.getElementById('elaboracion-procesos').classList.contains('active')`));
check('el final queda guardado en la cuenta', (await serverRow(PAYER))?.stage === 'fin');

// ------------------------------------------------------------ phase 3: the safety lab
await b.ev(`window.showScreen('juego'); window.mvRenderJuego?.(); 1`); await sleep(1200);
const labLoaded = () => b.ev(`performance.getEntriesByType('resource').some((r) => /\\/src\\/game\\/lab\\.js/.test(r.name))`);
check('el laboratorio NO se descarga hasta pulsar «Visitar el laboratorio de seguridad»', await labLoaded() === false && !!(await b.ev(`document.getElementById('jgLab')`)));
await click(b, 'jgLab'); await sleep(1500);
const labTxt = () => b.ev(`document.getElementById('juegoRoot').innerText`);
check('al pulsarlo se descarga y abre la entrada con la frase aprobada y el guía con casco', await labLoaded() === true
  && /Hasta ahora practicaste cultivo y procesos sin solventes/.test(await labTxt()) && await b.ev(`document.querySelector('#juego .jg-sci svg').dataset.pose`) === 'casco');
const seen = [];
const shownDigits = [];
const tries = {};
for (let i = 0; i < 60; i++) {
  const sc = await b.ev(`document.querySelector('#juego .jl')?.dataset.scene`);
  if (!seen.includes(sc)) { seen.push(sc); if (['s2', 's3'].includes(sc)) { await b.ev(`document.getElementById('mvDevPreview')?.remove(); document.querySelector('#juego .jl-art')?.scrollIntoView(); 1`); await sleep(300); await b.shot('juego-lab-' + sc); check(`escena ${sc} en el móvil: botones del dibujo ≥ 44 px, sin desborde`, await a11y()); } }
  const txt = await b.ev(`document.querySelector('#juego .jl').innerText + ' ' + document.getElementById('jgBubble').innerText`);
  if (/[0-9]/.test(txt)) shownDigits.push(sc + ': ' + (txt.match(/.{0,30}[0-9].{0,30}/) || [''])[0]);
  if (sc === 'fin') break;
  // tap every spot not found yet (one per loop, like a person)
  if (await b.ev(`(() => { const x = document.querySelector('#juego .jl-spot:not(.jl-found)'); if (!x) return false; x.click(); return true; })()`)) { await sleep(350); continue; }
  // a question not answered yet: try the options in order until the right one is marked
  if (await b.ev(`!!document.querySelector('#juego .jl-answer:not([disabled])')`)) { const n = tries[sc] = (tries[sc] ?? -1) + 1; await b.ev(`document.querySelectorAll('#juego .jl-answer')[${n}].click(); 1`); await sleep(450); continue; }
  await click(b, 'jlNext'); await sleep(900);
}
check('se recorre el laboratorio entero: entrada, conceptos, cocina, laboratorio, CO₂ y «Laboratorio visitado»', seen.join(' > ') === 'intro > s1 > s2 > s3 > s4 > fin' && /Laboratorio visitado/.test(await labTxt()), seen.join(' > '));
check('ninguna cifra en ninguna pantalla del laboratorio', shownDigits.length === 0, shownDigits.join(' | '));
check('el final se guarda en la cuenta (visita contada; si hubo muchos guardados seguidos, en el minuto siguiente)', await (async () => { for (let i = 0; i < 72; i++) { const r0 = await sql(`select state->'lab'->>'at' as at from game_progress where user_id = '${PAYER}'`); if (r0[0]?.at === 'fin') break; await sleep(1000); } const r = await sql(`select state->'lab'->>'at' as at, state->'lab'->>'v' as v from game_progress where user_id = '${PAYER}'`); return r[0]?.at === 'fin' && Number(r[0]?.v) === 1; })());
const labLangs = {};
for (const L of ['en', 'de', 'fr', 'es']) {
  await b.ev(`document.querySelector('#langSwitch button[data-lang=${L}]').click(); 1`); await sleep(500);
  labLangs[L] = await b.ev(`document.querySelector('#juego .jg-result h3').textContent + ' | ' + ((document.getElementById('juego').innerText.match(/\\bj[gl][A-Z][A-Za-z_]+/g) || []).join(','))`);
}
check('laboratorio en 4 idiomas en vivo, sin claves a la vista', /^Lab visited \| $/.test(labLangs.en) && /^Labor besucht \| $/.test(labLangs.de) && /^Laboratoire visité \| $/.test(labLangs.fr) && /^Laboratorio visitado \| $/.test(labLangs.es), JSON.stringify(labLangs));
check('laboratorio en el móvil: botones ≥ 44 px, sin desborde', await a11y());
await click(b, 'jlClose'); await sleep(900);
check('«Volver a la partida» -> el resultado de la cosecha otra vez', !!(await b.ev(`document.getElementById('jgAgain')`)) && !(await b.ev(`document.querySelector('#juego .jl')`)));
await b.close();
b = await browser(ADMIN, 'aal1', 390);
await open(b);
await goGame(b);
check('acceso completo (aporte) -> entra al juego', await screen(b) === 'juego');
await b.close();

// ------------------------------------------------------------ mobile / desktop, light / dark, a11y
for (const [w, label] of [[390, 'movil'], [1280, 'escritorio']]) {
  for (const scheme of ['dark', 'light']) {
    b = await browser(ADMIN, 'aal1', w);
    await b.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] });
    await open(b);
    await goGame(b);
    if (await b.ev(`!!document.getElementById('jgStart')`)) { await click(b, 'jgStart'); await sleep(700); }
    const a = await b.ev(`(() => {
      const lum = (c) => { const m = c.match(/\\d+(\\.\\d+)?/g).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
      const bg = (el) => { while (el) { const c = getComputedStyle(el).backgroundColor; if (c && !/rgba\\(\\d+, \\d+, \\d+, 0\\)|transparent/.test(c)) return c; el = el.parentElement; } return getComputedStyle(document.body).backgroundColor; };
      const ratio = (el) => { const l1 = lum(getComputedStyle(el).color), l2 = lum(bg(el)); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
      const texts = [...document.querySelectorAll('#juego .jg-bubble, #juego legend, #juego .jg-opts label span, #juego .jg-opts label small, #juego .jg-badges li, #juego .jg-title, #juego .jg-sync')].filter((e) => e.offsetParent && e.textContent.trim());
      const minRatio = Math.min(...texts.map(ratio));
      const targets = [...document.querySelectorAll('#juego button, #juego .jg-opts label')].filter((e) => e.offsetParent);
      const small = targets.filter((e) => e.getBoundingClientRect().height < 44).map((e) => e.textContent.trim().slice(0, 20));
      const unlabelled = [...document.querySelectorAll('#juego input')].filter((i) => !document.querySelector('label[for="' + i.id + '"]')).length;
      const fieldsets = [...document.querySelectorAll('#juego fieldset')].every((f) => f.querySelector('legend')?.textContent.trim());
      return { minRatio: Math.round(minRatio * 100) / 100, small, unlabelled, fieldsets, overflow: document.documentElement.scrollWidth > innerWidth, meter: !!document.querySelector('#juego meter[aria-labelledby]') };
    })()`);
    check(`${label} ${scheme === 'dark' ? 'oscuro' : 'claro'}: contraste ≥ 4,5 (${a.minRatio}), botones y opciones ≥ 44 px, etiquetas y grupos con nombre, sin desborde`,
      a.minRatio >= 4.5 && a.small.length === 0 && a.unlabelled === 0 && a.fieldsets && !a.overflow && a.meter, JSON.stringify(a));
    // real keyboard: from the guide's bubble, Tab passes the tent's objects
    // (v2 phase 3) and reaches the first option of the list
    await b.ev(`document.getElementById('jgBubble').focus(); 1`);
    for (let i = 0; i < 20 && !(await b.ev(`document.activeElement?.type === 'radio'`)); i++) {
      await b.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
      await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
      await sleep(150);
    }
    const focusOutline = await b.ev(`(() => { const l = document.querySelector('#juego input[type=radio]:focus-visible + label'); return l ? getComputedStyle(l).outlineStyle : 'sin foco: ' + document.activeElement?.id; })()`);
    if (w === 390 && scheme === 'dark') check('el foco del teclado se ve en las opciones', focusOutline === 'solid', focusOutline);
    await b.shot(`juego-${label}-${scheme === 'dark' ? 'oscuro' : 'claro'}`);
    await b.close();
  }
}

// ------------------------------------------------------------ dev preview
b = await browser(ADMIN, 'aal1', 390);
await b.send('Page.navigate', { url: 'http://localhost:5174/' }); await sleep(5500);
await b.ev(`document.getElementById('ageGateModal').style.display='none'; 1`);
check('vista previa de dev: botón «Juego»', await b.ev(`!!document.querySelector('#mvDevPreview [data-go="juego"]')`));
await b.ev(`document.getElementById('mvDpExpired').click(); 1`); await sleep(400);
await b.ev(`document.querySelector('#mvDevPreview [data-go="juego"]').click(); 1`); await sleep(600);
check('vista previa «prueba vencida» + Juego -> pantalla de bloqueo', await screen(b) === 'acceso');
await b.ev(`document.getElementById('mvDpReal').click(); 1`); await sleep(400);
await b.ev(`document.querySelector('#mvDevPreview [data-go="juego"]').click(); 1`); await sleep(1500);
check('vista previa «cuenta real» + Juego -> juego', await screen(b) === 'juego');
await b.close();
summary();
