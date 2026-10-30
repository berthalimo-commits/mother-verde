// Full run 4/5 — every post-harvest route by touch: each option of each
// drying, curing, preparation (8b) and press decision is chosen at least once
// (rotating through the options run after run), the three ways of preparing
// the material (none, dry sifting, ice water with every way of drying the
// hash, freeze-drying included; every starting material), and «Terminar sin
// hacer rosin» from the preparation and from the press. Every screen is audited.
import { summary, check } from './browser.mjs';
import { RULES, session, audit, gs, harvestedGame, postShown, options, click, report } from './game-full-lib.mjs';

const used = {}; // stage_decision -> Set of options chosen
const next = {}; // rotation counter per decision
const pick = (st, d, opts) => { const k = st + '_' + d; const i = next[k] = (next[k] ?? -1) + 1; const o = opts[i % opts.length]; (used[k] ||= new Set()).add(o); return o; };
// choose on screen, one decision at a time (the form may redraw after a choice)
async function screen(b, st, forced = {}) {
  const done = new Set();
  for (let guard = 0; guard < 20; guard++) {
    const ds = (await postShown(b)).filter((d) => !done.has(d));
    if (!ds.length) break;
    const d = ds[0];
    const o = forced[d] ?? pick(st, d, await options(b, d));
    if (forced[d]) (used[st + '_' + d] ||= new Set()).add(o);
    await b.ev(`document.querySelector('label[for="jgp-${st}-${d}-${o}"]').click(); 1`);
    done.add(d);
  }
  await audit(b, `ruta ${run}: ${st}`, { why: run < 2 });
  return click(b, '#jgPostNext');
}

const SEPARATIONS = ['ninguna', 'tamiz_seco', 'agua_hielo', 'agua_hielo', 'tamiz_seco', 'agua_hielo', 'agua_hielo', 'tamiz_seco', 'ninguna'];
let run = 0;
for (const sep of SEPARATIONS) {
  run++;
  const b = await session(run % 2 ? 390 : 1280, harvestedGame());
  await screen(b, 'secado');
  await screen(b, 'curado');
  await screen(b, 'material', { separacion: sep });
  let s = await gs(b);
  check(`ruta ${run} (${sep}): de la preparación pasa a la prensa con su material`, s.stage === 'rosin' && !!s.post.material, s.stage);
  if (run === 4) {
    await click(b, '#jgSkipRosin');
    s = await gs(b);
    check(`ruta ${run}: «Terminar sin hacer rosin» desde la prensa -> final sin veredicto de rosin`, s.stage === 'fin' && s.result.rosin === null);
  } else {
    await screen(b, 'rosin');
    s = await gs(b);
    check(`ruta ${run}: final con veredicto de rosin`, s.stage === 'fin' && !!s.result.rosin);
  }
  await audit(b, `ruta ${run}: final`, { why: run < 3 });
  await b.close();
}
{
  run++;
  const b = await session(390, harvestedGame());
  await screen(b, 'secado'); await screen(b, 'curado');
  await click(b, '#jgSkipRosin');
  const s = await gs(b);
  check('«Terminar sin hacer rosin» desde la preparación -> final', s.stage === 'fin' && s.result.rosin === null && !s.post.material);
  await audit(b, 'sin rosin desde la preparación: final');
  await b.close();
}

// every option of every decision was chosen at least once (the press's own
// «material» only appears in games saved before 8b: game-full-5)
const missing = [];
for (const st of ['secado', 'curado', 'material', 'rosin']) for (const [d, v] of Object.entries(RULES.post[st].decisiones)) {
  if (st === 'rosin' && d === 'material') continue;
  // the moisture of frozen fresh flower only appears with that material: game-full-3 plays its three options
  if (st === 'rosin' && d === 'humedad_fresca') continue;
  for (const o of v.opciones) if (!used[st + '_' + d]?.has(o)) missing.push(`${st}.${d}=${o}`);
}
check(`todas las opciones del secado, curado, preparación y prensa se eligieron al menos una vez`, missing.length === 0, missing.join(', '));
report('game-full-4-post');
summary();
