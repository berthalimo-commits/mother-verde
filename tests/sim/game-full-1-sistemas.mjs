// Full run 1/5 — every growing system played by touch from «Prepara tu carpa»
// to the end (harvest, drying, curing, «Terminar sin hacer rosin»), every
// germination method, the other equipment (substrates, pots, lights, tents,
// drip, playing blind) and «reducir movimiento». Every screen is audited
// (game-full-lib.mjs). The successful ending is captured per system.
import { summary, sleep } from './browser.mjs';
import { RULES, E, NEUTRAL, GERM_OK, IDEAL, POST_IDEAL, session, audit, setup, germ, week, click, gs, growToHarvest, post, shots, report, width } from './game-full-lib.mjs';
import { check } from './browser.mjs';

const SYSTEMS = RULES.setup.decisiones.sistema.opciones;
console.log('1. Cada sistema de cultivo, de principio a fin');
for (const [i, sistema] of SYSTEMS.entries()) {
  const b = await session(i % 2 ? 1280 : 390);
  await audit(b, `${sistema}: pantalla «Prepara tu carpa»`, { langs: i === 0 });
  const vals = sistema === 'maceta' ? NEUTRAL : { carpa: 'mediana', luz: 'led', sistema, medir: 'si' };
  await setup(b, vals);
  let s = await gs(b);
  check(`${sistema}: el equipo se guarda y empieza la germinación`, s.stage === 'germinacion' && s.setup.sistema === sistema, JSON.stringify(s?.setup));
  await audit(b, `${sistema}: germinación`, { langs: i === 0 });
  await germ(b, GERM_OK);
  s = await gs(b);
  await audit(b, `${sistema}: plántula semana 1`, { langs: i === 0 });
  const fixed = E.fixedDecisions(s, RULES);
  if (Object.keys(fixed).length) {
    const shown = await b.ev(`[...document.querySelectorAll('#jgForm fieldset legend')].length`);
    check(`${sistema}: lo que fija el sistema no se pregunta y la pantalla lo explica`, shown === 6 - Object.keys(fixed).length && !!(await b.ev(`document.getElementById('jgFixed')?.textContent`)));
  }
  s = await growToHarvest(b);
  check(`${sistema}: se llega a la cosecha jugando`, s.stage === 'secado', s.stage);
  await audit(b, `${sistema}: secado`, { langs: i === 0 });
  await post(b, 'secado', POST_IDEAL('secado'));
  await audit(b, `${sistema}: curado`, { langs: i === 0 });
  await post(b, 'curado', POST_IDEAL('curado'));
  await audit(b, `${sistema}: preparar el material`, { langs: i === 0 });
  await click(b, '#jgSkipRosin');
  s = await gs(b);
  check(`${sistema}: «Terminar sin hacer rosin» lleva al final con nota`, s.stage === 'fin' && typeof s.result.final === 'number', JSON.stringify(s.result));
  await audit(b, `${sistema}: final (cosecha)`, { langs: i === 0 });
  await shots(b, `jgfull-final-exito-${sistema}`);
  await b.close();
}

console.log('2. Cada método de germinación (y una germinación mal hecha)');
const METHODS = RULES.germinacion.decisiones.metodo.opciones;
for (const [i, metodo] of METHODS.entries()) {
  const b = await session(390, E.start(E.setSetup(E.newGame(), NEUTRAL, RULES)));
  check(`${metodo}: la partida guardada abre en germinación`, (await gs(b)).stage === 'germinacion');
  const bad = i === METHODS.length - 1;
  await germ(b, { ...GERM_OK, metodo, ...(metodo === 'vaso' ? { tiempo: 'menos_dia' } : {}), ...(bad ? { temperatura: 'fria', humedad: 'empapado' } : {}) });
  const s = await gs(b);
  check(`${metodo}: pasa a plántula (salud ${s.health})`, s.stage === 'plantula' && s.setup.germinacion === metodo && (bad ? s.health < 100 : s.health === 100));
  await audit(b, `germinación «${metodo}»${bad ? ' fría y empapada' : ''} -> plántula`);
  await b.close();
}

console.log('3. Otro equipo: sustratos, macetas, luces, carpas, riego por goteo, sin medidor');
const VARIANTS = [
  { ...NEUTRAL, sustrato: 'coco', maceta: 'tela', luz: 'hps', carpa: 'pequena' },
  { ...NEUTRAL, sustrato: 'lana_roca', maceta: 'aire', luz: 'cmh', carpa: 'grande', riego_tipo: 'goteo' },
  { ...NEUTRAL, sustrato: 'tierra_viva', maceta: 'barro', maceta_tam: 'pequena', medir: 'no' },
];
for (const [i, v] of VARIANTS.entries()) {
  const b = await session(i % 2 ? 1280 : 390);
  await setup(b, v);
  await germ(b, GERM_OK);
  let s = await gs(b);
  check(`equipo ${i + 1} (${v.sustrato}, ${v.maceta}, ${v.luz}, carpa ${v.carpa}${v.medir === 'no' ? ', sin medidor' : ''}): se guarda tal cual`, Object.entries(v).every(([k, x]) => s.setup[k] === x), JSON.stringify(s.setup));
  await audit(b, `equipo ${i + 1}: plántula`);
  if (v.maceta_tam === 'pequena') {
    for (let k = 0; k < 3; k++) await week(b, IDEAL((await gs(b)).stage));
    check('maceta pequeña: el botón «Trasplantar» está en vegetativo', await b.ev(`!!document.getElementById('jgTrasplante')`));
    await audit(b, `equipo ${i + 1}: vegetativo con «Trasplantar»`);
  }
  if (v.medir === 'no') check('sin medidor: los nutrientes no muestran su cifra', await b.ev(`![...document.querySelectorAll('input[name="jg-nutrientes"] + label small')].length`));
  s = await growToHarvest(b);
  check(`equipo ${i + 1}: se llega a la cosecha`, s.stage === 'secado', s.stage);
  await b.close();
}

console.log('4. «Reducir movimiento» detiene las animaciones');
{
  const b = await session(390, E.applyGerm(E.start(E.setSetup(E.newGame(), NEUTRAL, RULES)), GERM_OK, RULES));
  await week(b, IDEAL('plantula'));
  const normal = await b.ev(`document.getAnimations().filter((a) => a.effect?.target?.closest?.('#juego')).length`);
  await b.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await week(b, IDEAL('plantula'));
  const reduced = await b.ev(`document.getAnimations().filter((a) => a.effect?.target?.closest?.('#juego')).length`);
  const hidden = await b.ev(`[...document.querySelectorAll('#juego .jgt-drops, #juego .jgt-night')].every((e) => getComputedStyle(e).display === 'none')`);
  check(`sin la preferencia la semana se anima (${normal} animaciones); con «reducir movimiento», ninguna (${reduced}) y las gotas y la noche no se muestran`, normal > 0 && reduced === 0 && hidden);
  await b.close();
}
report('game-full-1-sistemas');
summary();
