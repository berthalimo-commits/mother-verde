// Zona del juego v2, phases 6-7 — the rules engine with equipment and
// germination (rules.json → setup, germinacion; docs/juego-decisiones.md).
// Every effect of the equipment, one by one, deterministic; every state the
// game produces is accepted by the server (migration 20261029100000).
import fs from 'fs';
import { makeDb } from './fakerest.mjs';
import * as E from '../../src/game/engine.js';

const RULES = JSON.parse(fs.readFileSync(new URL('../../src/game/rules.json', import.meta.url), 'utf8'));
let pass = 0, fail = 0; const failures = [];
const check = (n, c, d = '') => { if (c) { pass++; console.log('  ok   ', n); } else { fail++; failures.push(n); console.log('  FALLA', n, d); } };
const db = await makeDb();
const serverOk = async (s) => (await db.query('select public.game_state_valid($1::jsonb) v', [JSON.stringify(s)])).rows[0].v === true;
const states = [];
const keep = (x) => { states.push(x); return x; };
const IDEAL = Object.fromEntries(['plantula', 'vegetativo', 'floracion'].map((st) => [st, Object.fromEntries(E.DECISIONS.map((d) => [d, [].concat(RULES.etapas[st].ideal[d]?.valor ?? RULES.opciones[d][1])[0]]))]));
const SOIL = { carpa: 'mediana', luz: 'led', sistema: 'maceta', sustrato: 'tierra', maceta: 'plastico', maceta_tam: 'grande', riego_tipo: 'mano', medir: 'si' };
const GERM = { metodo: 'taco', temperatura: 'templada', humedad: 'humedo' };
const run = (setup) => { const s = keep(E.setSetup(E.newGame(), setup, RULES)); return keep(E.applyGerm(keep(E.start(s)), GERM, RULES)); };
const weeks = (s, n, ch) => { for (let i = 0; i < n; i++) s = keep(E.applyWeek(s, { ...IDEAL[s.stage], ...ch }, RULES)); return s; };
const toVeg = (s) => weeks(s, 2, {});

console.log('1. Preparar la carpa');
check('maceta: 8 decisiones; hidroponía (DWC): 4 (sin sustrato, maceta, tamaño ni riego)', E.setupDecisions(RULES, { sistema: 'maceta' }).length === 8 && E.setupDecisions(RULES, { sistema: 'dwc' }).join() === 'carpa,luz,sistema,medir');
let s = E.setSetup(E.newGame(), { ...SOIL, maceta_tam: 'pequena' }, RULES);
check('se guarda solo lo que aplica; maceta pequeña -> trasplante pendiente', s.setup.trasplante === 'no' && Object.keys(E.setSetup(E.newGame(), { carpa: 'grande', luz: 'led', sistema: 'nft', medir: 'no', sustrato: 'coco' }, RULES).setup).join() === 'carpa,luz,sistema,medir');
let threw = 0;
for (const f of [() => E.setSetup(E.newGame(), { ...SOIL, luz: 'laser' }, RULES), () => E.setSetup(E.newGame(), { carpa: 'mediana' }, RULES), () => E.setSetup(E.start(E.newGame()), SOIL, RULES)]) { try { f(); } catch { threw++; } }
check('opciones inventadas, preparación incompleta o fuera de la portada -> rechazado', threw === 3);
check('una partida de antes (sin equipo) sigue empezando en la plántula', E.start(E.newGame()).stage === 'plantula');

console.log('2. Germinación (fase 7)');
s = keep(E.start(keep(E.setSetup(E.newGame(), SOIL, RULES))));
check('con equipo, la partida empieza germinando', s.stage === 'germinacion' && s.week === 0);
let g = keep(E.applyGerm(s, GERM, RULES));
check('taco, templada (19–30 °C, F11) y húmedo -> plántula con salud 100', g.stage === 'plantula' && g.health === 100 && g.setup.germinacion === 'taco' && g.notes[0] === 'germBien');
g = E.applyGerm(s, { metodo: 'papel', temperatura: 'fria', humedad: 'empapado' }, RULES);
check('fría y empapado -> resta 4 + 4 y lo apunta en el registro', g.health === 92 && g.log.at(-1).s === 'germinacion' && g.log.at(-1).l.temperatura === 4 && g.log.at(-1).l.humedad === 4 && g.notes[0] === 'germMal');
check('vaso de agua: pregunta cuánto tiempo; varios días -> la semilla se ahoga (−4)', E.germDecisions(RULES, { metodo: 'vaso' }).includes('tiempo') && !E.germDecisions(RULES, { metodo: 'papel' }).includes('tiempo')
  && E.applyGerm(s, { metodo: 'vaso', temperatura: 'templada', humedad: 'humedo', tiempo: 'varios_dias' }, RULES).health === 96);
threw = 0;
for (const f of [() => E.applyGerm(s, { ...GERM, metodo: 'microondas' }, RULES), () => E.applyGerm(s, { metodo: 'vaso', temperatura: 'templada', humedad: 'humedo' }, RULES), () => E.applyGerm(g, GERM, RULES)]) { try { f(); } catch { threw++; } }
check('método inventado, vaso sin el tiempo o germinar dos veces -> rechazado', threw === 3);

console.log('3. Lo que cambia cada equipo');
let h = weeks(toVeg(run({ carpa: 'mediana', luz: 'led', sistema: 'dwc', medir: 'si' })), 2, { riego: 'mucho' });
check('hidroponía: no hay decisión de riego (aunque llegue «mucho» no resta ni trae exceso de riego)', !h.event && !h.log.some((l) => l.l.riego) && h.last.riego === 'moderado');
h = weeks(toVeg(run({ carpa: 'mediana', luz: 'led', sistema: 'dwc', medir: 'si' })), 2, { temperatura: 'calida' });
check('hidroponía con temperatura cálida 2 semanas -> pudrición de raíz (F9)', h.event?.id === 'pudricion_raiz', JSON.stringify(h.event));
const soil = weeks(toVeg(run(SOIL)), 2, { temperatura: 'calida' });
check('…en maceta, el mismo calor no pudre la raíz', soil.event?.id !== 'pudricion_raiz');
const aq = weeks(toVeg(run({ carpa: 'mediana', luz: 'led', sistema: 'acuaponia', medir: 'si' })), 2, { nutrientes: 'bajo' });
check('acuaponía: los nutrientes los dan los peces (no hay decisión ni carencia)', !aq.event && aq.last.nutrientes === 'medio');
let hps = weeks(toVeg(run({ ...SOIL, luz: 'hps' })), 1, {});
check('HPS: «templada» cuenta como cálida -> resta en vegetativo y el guía lo explica', hps.log.at(-1).l.temperatura === 4 && hps.notes.includes('efecto:hps'));
hps = weeks(toVeg(run({ ...SOIL, luz: 'hps' })), 2, { humedad: 'baja' });
check('HPS + aire seco 2 semanas -> ácaros (el calor de la lámpara cuenta, F6)', hps.event?.id === 'acaros');
const qs = (vegN, carpa) => { let x = run({ ...SOIL, carpa }); x = weeks(x, 2, {}); x = weeks(x, vegN - 1, {}); x = weeks(x, 1, { fotoperiodo: '12/12' }); return weeks(x, 2, { intensidad: 'alta' }); };
check('carpa pequeña + planta alta (≥ 5 semanas de vegetativo) + luz fuerte 2 semanas -> quemadura de luz', qs(5, 'pequena').event?.id === 'quemadura_luz', JSON.stringify(qs(5, 'pequena').event));
check('…con planta baja (3 semanas) o carpa mediana, no', qs(3, 'pequena').event?.id !== 'quemadura_luz' && qs(5, 'mediana').event?.id !== 'quemadura_luz');
const wet = (maceta) => weeks(toVeg(run({ ...SOIL, maceta })), 2, { riego: 'mucho' }).event?.id;
check('maceta de tela, de aire o de barro: el exceso de riego tarda una semana más (F10 + F3)', wet('plastico') === 'exceso_riego' && ['tela', 'aire', 'barro'].every((m) => wet(m) !== 'exceso_riego')
  && weeks(toVeg(run({ ...SOIL, maceta: 'tela' })), 3, { riego: 'mucho' }).event?.id === 'exceso_riego');
const dry = (maceta) => weeks(toVeg(run({ ...SOIL, maceta })), 1, { riego: 'poco' }).log.at(-1).l.riego;
check('…y «poco» riego resta el doble en tela (8) que en plástico (4) (F10)', dry('plastico') === 4 && dry('tela') === 8);
const mildew = (riego_tipo) => weeks(toVeg(run({ ...SOIL, riego_tipo })), 2, { humedad: 'alta' }).event?.id;
check('riego por goteo: el oídio tarda una semana más (F5)', mildew('mano') === 'oidio' && mildew('goteo') !== 'oidio');
const seedN = (sustrato) => weeks(run({ ...SOIL, sustrato }), 1, { nutrientes: 'bajo' }).log.at(-1).l.nutrientes;
check('coco y lana de roca: hay que nutrir desde la plántula (bajos restan); en tierra no puntúa', seedN('coco') === 4 && seedN('lana_roca') === 4 && seedN('tierra') === undefined);
check('tierra viva: nutrientes bajos en vegetativo no restan', weeks(toVeg(run({ ...SOIL, sustrato: 'tierra_viva' })), 1, { nutrientes: 'bajo' }).log.at(-1).l.nutrientes === undefined);
const lowN = (sustrato, n) => weeks(toVeg(run({ ...SOIL, sustrato })), n, { nutrientes: 'bajo' }).event?.id;
check('…y en tierra la carencia de nitrógeno tarda una semana más que en coco', lowN('coco', 2) === 'carencia_n' && lowN('tierra', 2) !== 'carencia_n' && lowN('tierra', 3) === 'carencia_n');
const big = weeks(toVeg(run({ ...SOIL, carpa: 'grande' })), 1, { temperatura: 'calida' });
check('carpa grande: cada error de temperatura o humedad resta 1 más (5 en vez de 4)', big.log.at(-1).l.temperatura === 5);
let hv = run({ ...SOIL, carpa: 'grande' }); hv = weeks(hv, 2, {}); hv = weeks(hv, 3, {}); hv = weeks(hv, 1, { fotoperiodo: '12/12' }); hv = weeks(hv, 8, {}); hv = keep(E.harvest(hv, RULES));
check('…y la cosecha suma +5 (con tope en 100)', hv.result.score === Math.min(100, hv.result.health + hv.result.pts + 5), JSON.stringify(hv.result));
let small = toVeg(run({ ...SOIL, maceta_tam: 'pequena' }));
small = weeks(small, 3, {});
check('maceta pequeña sin trasplantar: desde la 3.ª semana de vegetativo resta 4 por semana', small.log.at(-1).l.maceta === 4 && small.notes.includes('sinTrasplante') && !small.log.at(-2).l.maceta);
let moved = keep(E.transplant(toVeg(run({ ...SOIL, maceta_tam: 'pequena' }))));
moved = weeks(moved, 3, {});
check('trasplantar a tiempo -> no resta', moved.setup.trasplante === 'si' && !moved.log.some((l) => l.l.maceta));
threw = 0; for (const f of [() => E.transplant(toVeg(run(SOIL))), () => E.transplant(moved)]) { try { f(); } catch { threw++; } }
check('no se puede trasplantar una maceta grande ni dos veces', threw === 2);
check('mismas decisiones -> mismo resultado (sin azar)', JSON.stringify(qs(5, 'pequena')) === JSON.stringify(qs(5, 'pequena')));

console.log('4. El servidor acepta todos los estados');
let bad = null;
for (const x of states) if (!(await serverOk(x))) { bad = x; break; }
check(`${states.length} estados con equipo, germinación y problemas nuevos pasan game_state_valid y miden menos de 16 KB`, !bad && states.every((x) => JSON.stringify(x).length < 16384), JSON.stringify(bad)?.slice(0, 300));
check('cada efecto del equipo y cada problema nuevo dice su fuente y su nivel', Object.values(RULES.setup.decisiones).every((d) => d.fuente && d.respaldo)
  && ['pudricion_raiz', 'quemadura_luz'].every((id) => RULES.eventos.lista[id].fuente && RULES.eventos.lista[id].respaldo)
  && Object.values(RULES.germinacion.decisiones).every((d) => d.ideal.fuente && d.ideal.respaldo));

console.log(`\nRESULTADO: ${pass} ok, ${fail} fallas${fail ? ' -> ' + failures.join(' | ') : ''}`);
process.exit(0);
