// Full run 3/5 — every ending, played by touch: a successful harvest with a
// good rosin, the dead plant, and each post-harvest failure (mould while
// drying, over-dried buds, failed curing, burnt / dark rosin, watery rosin,
// mouldy material in the 8b preparation). For each one: the tent shows it
// while choosing, the final review explains it (cause, «Qué habría funcionado
// mejor», «¿Por qué?»), both restart buttons work, screenshots on phone and
// computer in tests/sim/out/jgfull-final-*.png.
import { summary, check } from './browser.mjs';
import { RULES, E, TEXTS, IDEAL, POST_IDEAL, session, audit, week, answer, click, gs, gameAt, harvestedGame, post, shots, report } from './game-full-lib.mjs';

const tes = TEXTS.es;
const caption = (b) => b.ev(`document.getElementById('jgTentDesc')?.textContent || ''`);
const review = (b) => b.ev(`document.querySelector('#juego .jg-review')?.innerText || ''`);
const MATERIAL_NONE = { partida: 'flor_curada', separacion: 'ninguna' };

// play the post-harvest by touch: changes per stage (others ideal); null material = skip the press
async function postRun(b, ch, { material = MATERIAL_NONE, rosin = true } = {}) {
  const seen = {};
  for (const st of ['secado', 'curado']) {
    const vals = { ...POST_IDEAL(st), ...(ch[st] || {}) };
    for (const [d, o] of Object.entries(ch[st] || {})) await b.ev(`document.querySelector('label[for="jgp-${st}-${d}-${o}"]')?.click(); 1`);
    seen[st] = await caption(b);
    await post(b, st, vals);
  }
  if (!material) { await click(b, '#jgSkipRosin'); return seen; }
  await post(b, 'material', { ...material, ...(ch.material || {}) });
  seen.material = (await gs(b)).notes.find((n) => n.startsWith('pureza:'));
  if (!rosin) { await click(b, '#jgSkipRosin'); return seen; }
  const vals = { ...POST_IDEAL('rosin'), ...(ch.rosin || {}) };
  delete vals.material;
  for (const [d, o] of Object.entries(ch.rosin || {})) await b.ev(`document.querySelector('label[for="jgp-rosin-${d}-${o}"]')?.click(); 1`);
  seen.rosin = await caption(b);
  await post(b, 'rosin', vals);
  return seen;
}
async function endChecks(b, name, { expect = [], langs = false } = {}) {
  const s = await gs(b);
  check(`${name}: termina en la pantalla final`, s.stage === 'fin', s.stage);
  const rv = await review(b);
  check(`${name}: el repaso lo explica (${expect.length} frases esperadas) con «Qué habría funcionado mejor»`, expect.every((x) => rv.includes(x)) && (expect.length === 0 || rv.includes(tes.jgRv_mejorTitulo)),
    expect.filter((x) => !rv.includes(x)).join(' | ') + ' || ' + rv.slice(0, 400));
  check(`${name}: botones «Empezar de nuevo» y «Probar otro sistema de cultivo»`, await b.ev(`!!document.getElementById('jgAgain') && !!document.getElementById('jgOtroSistema')`));
  await audit(b, `${name}: pantalla final`, { langs });
  await shots(b, `jgfull-final-${name}`);
  return s;
}

console.log('1. Cosecha exitosa con un buen rosin');
let b = await session(390, harvestedGame());
await postRun(b, {}, { material: { partida: 'flor_congelada', separacion: 'agua_hielo', agua_temp: 'helada', agua_agitar: 'suave', agua_lavados: 'varios', agua_bolsa: 'fina', agua_secado: 'liofilizado' } });
let s = await endChecks(b, 'exito', { langs: true });
check('exito: nota 100 y rosin «bien hecho»', s.result.final === 100 && s.result.rosin?.causes.length === 0 && (await b.ev(`document.querySelector('.jg-result').innerText`)).includes(tes.jgFinRosinBien));
await click(b, '#jgLab');
await audit(b, 'exito: laboratorio de seguridad (entrada)');
await b.close();

console.log('2. La planta muere (riego «Mucho» y respuestas equivocadas)');
b = await session(390, gameAt('vegetativo', 1));
for (let i = 0; i < 30 && (await gs(b)).stage !== 'fin'; i++) {
  s = await gs(b);
  if (s.event && !s.event.answered) { const wrong = await b.ev(`[...document.querySelectorAll('.jg-answer')].map((x) => x.dataset.answer).find((a) => a !== '${RULES.eventos.lista[s.event.id].respuesta_correcta}')`); if (!(await answer(b, wrong))) break; continue; }
  await week(b, { ...IDEAL(s.stage), riego: 'mucho', fotoperiodo: s.stage === 'floracion' ? '12/12' : '18/6' });
}
s = await gs(b);
check('muerta: la salud llega a 0', s.result?.dead === true && s.health === 0);
check('muerta: la carpa muestra la planta marchita y la lámpara apagada', (await caption(b)).includes(tes.jgTentD_muerta));
await endChecks(b, 'muerta', { expect: [tes.jgRv_tituloMuerta, 'Causa principal: Exceso de riego', 'Respondiste «'], langs: true });
await click(b, '#jgAgain');
check('muerta: «Empezar de nuevo» -> germinación con el mismo equipo', (await gs(b)).stage === 'germinacion');
await audit(b, 'muerta: después de «Empezar de nuevo»');
await b.close();

const ENDS = [
  ['moho-secado', { secado: { humedad: 'alta' } }, 'secado', tes.jgTentX_moho],
  ['resecos', { secado: { duracion: 'muchas_semanas', temperatura: 'calida' } }, 'secado', tes.jgTentX_reseco],
  ['curado-fallido', { curado: { envase: 'plastico', abrir: 'nunca', g_luz: 'sol' } }, 'curado', tes.jgTentX_moho],
  ['rosin-quemado', { rosin: { calor: 'alto', proteccion: 'sin_proteccion' } }, 'rosin', tes.jgTentX_oscuro],
  ['material-enmohecido', { material: { agua_secado: 'bola_humeda' } }, 'material', tes.jgTentX_moho_material],
];
for (const [i, [name, ch, where, look]] of ENDS.entries()) {
  console.log(`${3 + i}. ${name}`);
  b = await session(i % 2 ? 1280 : 390, harvestedGame());
  const material = name === 'material-enmohecido' ? { partida: 'flor_congelada', separacion: 'agua_hielo', agua_temp: 'helada', agua_agitar: 'suave', agua_lavados: 'varios', agua_bolsa: 'fina' } : MATERIAL_NONE;
  let seen;
  if (name === 'material-enmohecido') {
    for (const st of ['secado', 'curado']) await post(b, st, POST_IDEAL(st));
    for (const [d, o] of Object.entries({ ...material, ...ch.material })) await b.ev(`document.querySelector('label[for="jgp-material-${d}-${o}"]')?.click(); 1`);
    seen = { material: await caption(b) };
    await post(b, 'material', { ...material, ...ch.material });
    await post(b, 'rosin', (({ material: _, ...r }) => r)(POST_IDEAL('rosin')));
  } else seen = await postRun(b, ch);
  check(`${name}: la carpa lo muestra mientras se elige (${where})`, (seen[where] || '').includes(look), seen[where]);
  const expect = [look];
  if (name === 'rosin-quemado') expect.push(tes.jgRv_veredicto, tes.jgFb_quemadura);
  s = await endChecks(b, name, { expect });
  if (where === 'secado' || where === 'curado') check(`${name}: baja la nota final`, s.result.final < s.result.score, `${s.result.score} -> ${s.result.final}`);
  else check(`${name}: cuenta en el veredicto del rosin, no en la nota del cogollo`, s.result.rosin.causes.length > 0 && s.result.final === s.result.score);
  if (name === 'rosin-quemado') check('rosin-quemado: sin protección -> aviso de quemadura en la guía', (await gs(b)).notes.includes('quemadura'));
  await click(b, '#jgOtroSistema');
  check(`${name}: «Probar otro sistema» -> «Prepara tu carpa»`, (await gs(b)).stage === 'intro' && await b.ev(`!!document.getElementById('jgSetupForm')`));
  await b.close();
}

console.log('8. Rosin aguado (flor fresca): solo posible en partidas guardadas antes de 8b');
const old = { ...E.applyPost(E.applyPost(harvestedGame(), POST_IDEAL('secado'), RULES), POST_IDEAL('curado'), RULES), stage: 'rosin' };
delete old.post.material;
b = await session(390, old);
check('aguado: la prensa pregunta el material (partida vieja)', await b.ev(`!!document.querySelector('input[name="jgp-material"]')`));
await b.ev(`document.querySelector('label[for="jgp-rosin-material-fresco"]').click(); 1`);
check('aguado: la carpa muestra el agua', (await caption(b)).includes(tes.jgTentX_agua));
await post(b, 'rosin', { ...POST_IDEAL('rosin'), material: 'fresco' });
await endChecks(b, 'rosin-aguado', { expect: [tes.jgTentX_agua] });
await b.close();
// in a new game the press gets its material from 8b (flower, frozen, kief,
// hash): fresh flower is never an option, so «aguado» cannot happen there
check('en una partida nueva ninguna preparación da «flor fresca» a la prensa (dato para el informe)',
  Object.values(RULES.post.material.da_material).every((m) => m !== 'fresco'));

report('game-full-3-finales');
summary();
