// Full run 5/5 — saving. One game played by touch from «Prepara tu carpa» to
// the lab; at every stage the page is closed and opened again (same device:
// same stage, same step), and at some stages the game is opened on another
// device (a fresh browser: only the account). Then games saved before phases
// 6 (no equipment), 7 (no germination) and 8b (curing -> press) are loaded
// and played to the end. First, a control: the audit must catch planted faults.
import { summary, check, sleep, browser } from './browser.mjs';
import { RULES, E, IDEAL, POST_IDEAL, NEUTRAL, GERM_OK, USER, session, enter, reload, synced, audit, setup, germ, week, answer, click, gs, post, growToHarvest, harvestedGame, report, issues } from './game-full-lib.mjs';

console.log('0. Control: la revisión detecta fallos sembrados a propósito');
{
  const b = await session(390, E.applyGerm(E.start(E.setSetup(E.newGame(), NEUTRAL, RULES)), GERM_OK, RULES));
  await b.ev(`(() => { const r = document.querySelector('#juego .jg'); r.insertAdjacentHTML('beforeend', '<p>jgTextoFalso</p>'); document.getElementById('jgNext').disabled = true; console.error('fallo sembrado'); return 1; })()`);
  const n = issues.length;
  const probs = await audit(b, 'control (debe fallar)');
  const caught = ['sin traducir', 'bloqueados sin explicación', 'consola'].every((k) => probs.some((p) => p.includes(k)));
  issues.splice(n); // planted on purpose: not part of the report
  check('control: la revisión detecta texto sin traducir, botón bloqueado sin explicación y error de consola', caught, probs.join(' · '));
  await b.close();
}

console.log('1. Guardar, cerrar y volver a abrir en cada etapa');
const b = await session(390);
async function again(label, { otherDevice = false } = {}) {
  const before = await gs(b);
  await reload(b);
  const after = await gs(b);
  check(`${label}: cerrar y abrir en este dispositivo -> misma etapa y mismo paso`, after?.stage === before.stage && after.seq === before.seq && (after.lab?.at ?? null) === (before.lab?.at ?? null), `${before.stage}/${before.seq} -> ${after?.stage}/${after?.seq}`);
  await audit(b, `${label}: después de volver a abrir`, { why: false });
  if (otherDevice) {
    check(`${label}: la cuenta tiene el último paso`, await synced(b));
    const b2 = await browser(USER, 'aal1', 1280); b2.w = 1280; b2.seen = 0;
    await b2.send('Page.navigate', { url: 'http://localhost:5174/' }); await enter(b2);
    const o = await gs(b2);
    check(`${label}: en otro dispositivo (solo la cuenta) -> misma etapa y mismo paso`, o?.stage === before.stage && o.seq === before.seq, `${o?.stage}/${o?.seq}`);
    await audit(b2, `${label}: otro dispositivo`, { why: false });
    await b2.close();
  }
}
await again('portada «Prepara tu carpa»');
await setup(b, NEUTRAL);
await again('germinación', { otherDevice: true });
await germ(b, GERM_OK);
await again('plántula');
for (let i = 0; i < 2; i++) await week(b, IDEAL('plantula'));
await again('vegetativo');
for (let i = 0; i < 2 && !(await gs(b)).event; i++) await week(b, { ...IDEAL('vegetativo'), nutrientes: 'bajo' });
check('se abrió un problema (carencia de nitrógeno)', (await gs(b)).event?.id === 'carencia_n');
await again('problema abierto, sin responder', { otherDevice: true });
check('problema abierto: al volver sigue bloqueado CON la explicación', await b.ev(`document.getElementById('jgNext').disabled && !!document.getElementById('jgBloqueo')`));
await answer(b, 'ajustar_nutricion');
let s = await growToHarvest(b, { harvestAt: 1 });
check('floración y cosecha', s.stage === 'secado');
await again('secado');
await post(b, 'secado', POST_IDEAL('secado'));
await again('curado', { otherDevice: true });
await post(b, 'curado', POST_IDEAL('curado'));
await again('preparar el material');
await post(b, 'material', { partida: 'flor_curada', separacion: 'tamiz_seco', tamiz_frio: 'congelado', tamiz_malla: 'fina', tamiz_frotar: 'suave', tamiz_tiempo: 'corto' });
await again('prensa');
await post(b, 'rosin', (({ material, ...r }) => r)(POST_IDEAL('rosin')));
await again('final', { otherDevice: true });
await click(b, '#jgLab'); await sleep(800);
await again('laboratorio de seguridad');
await b.close();

console.log('2. Partidas guardadas antes de las fases 6, 7 y 8b');
// before phase 6: no equipment, weeks without the review's data
let old6 = E.start(E.newGame());
for (let i = 0; i < 3; i++) old6 = E.applyWeek(old6, IDEAL(old6.stage), RULES);
old6 = { ...old6, log: old6.log.map(({ c, e, a, ...x }) => x) };
delete old6.setup;
// before phase 7: equipment but no germination step
let old7 = E.start(E.setSetup(E.newGame(), NEUTRAL, RULES));
old7 = { ...old7, stage: 'plantula', week: 1, stageWeek: 1 };
// before 8b: curing finished -> straight to the press, no «material» in post
const old8 = (() => { const h = E.applyPost(E.applyPost(harvestedGame(), POST_IDEAL('secado'), RULES), POST_IDEAL('curado'), RULES); const x = { ...h, stage: 'rosin' }; delete x.post.material; return x; })();
for (const [name, st] of [['antes de la fase 6 (sin equipo)', old6], ['antes de la fase 7 (sin germinación)', old7], ['antes de 8b (curado -> prensa)', old8]]) {
  const bo = await session(390, st);
  let x = await gs(bo);
  check(`${name}: carga en su etapa (${st.stage})`, x?.stage === st.stage);
  await audit(bo, `${name}: al cargar`);
  if (['plantula', 'vegetativo'].includes(x.stage)) {
    x = await growToHarvest(bo);
    check(`${name}: se juega hasta la cosecha`, x.stage === 'secado', x.stage);
    for (const stg of ['secado', 'curado']) await post(bo, stg, POST_IDEAL(stg));
    await click(bo, '#jgSkipRosin');
  } else {
    await post(bo, 'rosin', POST_IDEAL('rosin'));
  }
  x = await gs(bo);
  check(`${name}: termina con su repaso final`, x.stage === 'fin' && await bo.ev(`!!document.querySelector('#juego .jg-review')`));
  await audit(bo, `${name}: final`);
  check(`${name}: guardado en la cuenta`, await synced(bo));
  await click(bo, '#jgAgain');
  x = await gs(bo);
  check(`${name}: «Empezar de nuevo» funciona (${x.stage})`, x.stage === (st.setup ? 'germinacion' : 'intro'));
  await bo.close();
}
report('game-full-5-guardar');
summary();
