// Zona del juego — several plants, regular seeds (males) and autoflowers
// (rules.json → setup.decisiones.semilla/plantas, semillas). Deterministic;
// every state the game produces is accepted by the server (migration
// 20261031100000_game_plants).
import fs from 'fs';
import { makeDb } from './fakerest.mjs';
import * as E from '../../src/game/engine.js';
import { review } from '../../src/game/review.js';

const RULES = JSON.parse(fs.readFileSync(new URL('../../src/game/rules.json', import.meta.url), 'utf8'));
const POL = RULES.semillas.regular.resta_polinizacion; // validated by Bertha: 25
let pass = 0, fail = 0; const failures = [];
const check = (n, c, d = '') => { if (c) { pass++; console.log('  ok   ', n); } else { fail++; failures.push(n); console.log('  FALLA', n, d); } };
const db = await makeDb();
const serverOk = async (s) => (await db.query('select public.game_state_valid($1::jsonb) v', [JSON.stringify(s)])).rows[0].v === true;
const states = [];
const keep = (x) => { states.push(x); return x; };
const IDEAL = Object.fromEntries(['plantula', 'vegetativo', 'floracion'].map((st) => [st, Object.fromEntries(E.DECISIONS.map((d) => [d, [].concat(RULES.etapas[st].ideal[d]?.valor ?? RULES.opciones[d][1])[0]]))]));
const SOIL = { carpa: 'mediana', luz: 'led', sistema: 'maceta', sustrato: 'tierra', maceta: 'plastico', maceta_tam: 'grande', riego_tipo: 'mano', medir: 'si' };
const GERM = { metodo: 'taco', temperatura: 'templada', humedad: 'humedo' };
const run = (extra, prev = null) => { const s = keep(E.setSetup(E.newGame(prev), { ...SOIL, ...extra }, RULES)); return keep(E.applyGerm(keep(E.start(s)), GERM, RULES)); };
const week = (s, ch = {}) => keep(E.applyWeek(s, { ...IDEAL[s.stage], ...ch }, RULES));
const weeks = (s, n, ch) => { for (let i = 0; i < n; i++) s = week(s, ch); return s; };
// photoperiod plant: 2 seedling weeks, 3 vegetative, then 12/12
const toFlower = (s) => weeks(weeks(s, 4, {}), 1, { fotoperiodo: '12/12' });
const throws = (f) => { try { f(); return false; } catch { return true; } };

console.log('1. Preparar la carpa: semilla y número de plantas');
check('dos decisiones nuevas para todos los sistemas: semilla y plantas', ['maceta', 'dwc'].every((sis) => ['semilla', 'plantas'].every((d) => E.setupDecisions(RULES, { sistema: sis }).includes(d))));
check('caben 2 plantas en la carpa pequeña, 4 en la mediana y 6 en la grande', E.setupOptions(RULES, 'plantas', { carpa: 'pequena' }).join() === '1,2'
  && E.setupOptions(RULES, 'plantas', { carpa: 'mediana' }).length === 4 && E.setupOptions(RULES, 'plantas', { carpa: 'grande' }).length === 6);
check('3 plantas en una carpa pequeña o una semilla inventada -> rechazado', throws(() => E.setSetup(E.newGame(), { ...SOIL, carpa: 'pequena', plantas: '3' }, RULES))
  && throws(() => E.setSetup(E.newGame(), { ...SOIL, semilla: 'clon' }, RULES)) && throws(() => E.setSetup(E.newGame(), { ...SOIL, plantas: '7', carpa: 'grande' }, RULES)));
let s = E.setSetup(E.newGame(), { ...SOIL, semilla: 'regular', plantas: '4' }, RULES);
check('el número de plantas se guarda como número', s.setup.plantas === 4 && s.setup.semilla === 'regular');
s = E.setSetup(E.newGame(), SOIL, RULES);
check('sin semilla ni plantas (pantallas de antes): feminizada y 1 planta', s.setup.semilla === 'feminizada' && s.setup.plantas === 1);

console.log('2. Semillas regulares: machos');
const males = (n, r) => E.maleCount({ run: r, setup: { semilla: 'regular', plantas: n } });
check('la mitad salen machos (impar: arriba o abajo según la partida), siempre queda una hembra', males(4, 1) === 2 && males(6, 2) === 3 && males(3, 1) === 1 && males(3, 2) === 2 && males(1, 1) === 0 && males(1, 2) === 0 && males(2, 1) === 1);
check('feminizada y autofloreciente: ningún macho', E.maleCount({ run: 1, setup: { semilla: 'feminizada', plantas: 6 } }) === 0 && E.maleCount({ run: 1, setup: { semilla: 'autofloreciente', plantas: 6 } }) === 0);
let r = run({ semilla: 'regular', plantas: '4', carpa: 'grande' });
let v = weeks(r, 4, {});
check('en vegetativo no se ven todavía', !E.malesVisible(v, RULES) && throws(() => E.removeMales(v, RULES)));
let f = toFlower(r);
check('1.ª semana de floración: se ven los machos (sacos de polen)', f.stage === 'floracion' && f.stageWeek === 1 && E.malesVisible(f, RULES));
let rm = keep(E.removeMales(f, RULES));
check('retirarlos a tiempo: «retirados», ya no se ven, no se puede repetir', rm.setup.machos === 'retirados' && !E.malesVisible(rm, RULES) && rm.notes.includes('machosRetirados') && throws(() => E.removeMales(rm, RULES)));
let one = week(f);
check('pasar la 1.ª semana sin retirarlos: todavía no hay polen', !one.setup.machos && E.malesVisible(one, RULES) && !one.notes.includes('polinizado'));
let late = week(one);
check('pasar la 2.ª semana con machos en la carpa: sueltan polen (se apunta la semana)', late.setup.machos === 'tarde' && late.notes.includes('polinizado') && late.log.at(-1).m === 'polen' && !E.malesVisible(late, RULES));
// health 60 so the score is not capped at 100
const hv = (x) => keep(E.harvest({ ...weeks(x, 8 - x.stageWeek, {}), health: 60 }, RULES));
const good = hv(keep(E.removeMales(f, RULES)));
const bad = hv(late);
check(`cosecha polinizada: −${POL} frente a la misma sin polen; se guarda la resta y las hembras`, good.result.score - bad.result.score === RULES.semillas.regular.resta_polinizacion
  && bad.result.polen === POL && POL === 25 && !good.result.polen && bad.result.hembras === 2 && good.result.hembras === 2, `${good.result.score} ${bad.result.score}`);
const rvBad = review(bad, RULES), rvGood = review(good, RULES);
const it = rvBad.grow.find((x) => x.key === 'polen');
check(`repaso final: la polinización es un punto con su semana, −${POL} y su lección (Genética); sin polen no aparece`, it && it.lost === POL && it.week === late.log.at(-1).w
  && rvBad.lessons.includes('genetica') && !rvGood.grow.some((x) => x.key === 'polen'), JSON.stringify(it));
const capped = (x) => keep(E.harvest(weeks(x, 8 - x.stageWeek, {}), RULES));
check('con salud 100 la resta también se ve (se quita después del tope de 100)', capped(late).result.score === capped(keep(E.removeMales(f, RULES))).result.score - POL);
let blocked = { ...f, event: { id: 'oidio', since: 1 } };
check('con un problema sin responder, no se pueden retirar (como el trasplante)', throws(() => E.removeMales(blocked, RULES)));

console.log('3. Autofloreciente: calendario propio');
let a = run({ semilla: 'autofloreciente' });
a = weeks(a, 2, {});
check('2 semanas de plántula -> vegetativo', a.stage === 'vegetativo');
let a1 = week(a, { fotoperiodo: '12/12' });
check('12/12 en vegetativo no la hace florecer y cuenta como menos luz', a1.stage === 'vegetativo' && a1.notes.includes('autoNo1212') && a1.log.at(-1).l.fotoperiodo === RULES.puntuacion.resta_fotoperiodo);
a = week(a);
let a2 = week(a);
check('florece sola por edad tras 2 semanas de vegetativo (aunque siga en 18/6)', a2.stage === 'floracion' && a2.notes.includes('flipEdad'), a2.stage);
let a3 = week(a2, { fotoperiodo: '18/6' });
let a4 = week(a2, { fotoperiodo: '12/12' });
check('en floración, 18/6 y 12/12 valen igual', !a3.log.at(-1).l.fotoperiodo && !a4.log.at(-1).l.fotoperiodo);
check('tricomas más rápidos: lechosos en la 3.ª semana, punto (mezcla) en la 5.ª, ámbar en la 7.ª', E.trichomes(3, RULES, a.setup) === 'lechosas' && E.trichomes(5, RULES, a.setup) === 'mezcla' && E.trichomes(7, RULES, a.setup) === 'ambar'
  && E.trichomes(5, RULES, { semilla: 'feminizada' }) === 'transparentes');
let a5 = weeks(a2, 4, {});
check('punto de cosecha a las 9 semanas desde la semilla (2 + 2 + 5, dentro de las 8–10 de Genética)', a5.stageWeek === 5 && a5.trich === 'mezcla' && a5.week === 9, `${a5.week} ${a5.trich}`);
let ah = keep(E.harvest(a5, RULES));
check('cosecha en su punto: +20 de los tricomas', ah.result.trich === 'mezcla' && ah.result.pts === 20 && ah.stage === 'secado');
let auto = weeks(a2, 8, {});
check('si nadie cosecha, se cosecha sola al pasar la 8.ª semana de floración (no la 12.ª)', auto.stage === 'secado' && auto.result.trich === 'ambar' && auto.notes.includes('cosechaAuto'), auto.stage);
let small = run({ semilla: 'autofloreciente', carpa: 'pequena' });
small = weeks(small, 4, {});
small = weeks(small, 3, { intensidad: 'alta' });
check('planta pequeña: con la carpa pequeña y luz fuerte no llega a quemarse (no tiene 5 semanas de vegetativo)', small.event?.id !== 'quemadura_luz');

console.log('4. Varias plantas, empezar de nuevo y partidas de antes');
const big = run({ carpa: 'grande', plantas: '5', semilla: 'feminizada' });
const bh = keep(E.harvest(weeks(toFlower(big), 7, {}), RULES));
check('5 feminizadas: se cosechan las 5', bh.result.hembras === 5);
const again = E.restart(late, RULES);
check('«Empezar de nuevo» con regulares: misma semilla y plantas, machos sin decidir', again.stage === 'germinacion' && again.setup.semilla === 'regular' && again.setup.plantas === 4 && !again.setup.machos);
const old = { ...E.newGame(), stage: 'fin', setup: { ...SOIL, germinacion: 'taco' } };
const oldR = E.restart(old, RULES);
check('partida de antes (equipo sin semilla): «Empezar de nuevo» sigue funcionando, feminizada y 1', oldR.stage === 'germinacion' && oldR.setup.semilla === 'feminizada' && oldR.setup.plantas === 1);
check('partida de antes sin equipo: 1 planta, sin machos, calendario normal', E.plantCount(undefined) === 1 && E.maleCount(E.newGame()) === 0 && E.trichomes(8, RULES, undefined) === 'mezcla');

console.log('4b. Carpa llena (respuesta 6: sube un nivel; en floración «Baja» no sube)');
const full = run({ carpa: 'pequena', plantas: '2' });
check('2 plantas en la carpa pequeña = llena; 1 planta o 4 en la grande, no', E.tentFull(full, RULES) && !E.tentFull(run({ carpa: 'pequena', plantas: '1' }), RULES) && !E.tentFull(run({ carpa: 'grande', plantas: '4' }), RULES));
let fv = weeks(full, 2, { humedad: 'baja' });
let fm = week(fv, { humedad: 'media_alta' });
check('vegetativo con «Media-alta»: cuenta como «Alta» (−4) y el guía lo explica', fm.log.at(-1).c.humedad === 'alta' && fm.log.at(-1).l.humedad === 4 && fm.notes.includes('efecto:llena'), JSON.stringify(fm.log.at(-1)));
let fb = week(fv, { humedad: 'baja' });
check('vegetativo con «Baja»: cuenta como «Media-alta», lo ideal (sin pérdida)', fb.log.at(-1).c.humedad === 'media_alta' && !fb.log.at(-1).l.humedad && fb.notes.includes('efecto:llena'));
let ff = weeks(weeks(weeks(full, 2, { humedad: 'baja' }), 3, { humedad: 'baja' }), 1, { humedad: 'baja', fotoperiodo: '12/12' });
ff = weeks(ff, 3, { humedad: 'baja' });
check('floración con «Baja» (lo ideal): se queda en «Baja», sin pérdida; vegetativo con «Baja» tampoco pierde', ff.stage === 'floracion' && !ff.log.filter((l) => l.s !== 'plantula').some((l) => l.l.humedad) && ff.log.filter((l) => l.s === 'floracion').every((l) => l.c.humedad === 'baja'), JSON.stringify(ff.log.map((l) => [l.s, l.c?.humedad, l.l.humedad])));
let fo = weeks(full, 2, { humedad: 'baja' });
fo = weeks(fo, 2, { humedad: 'media_alta' });
check('«Media-alta» 2 semanas con la carpa llena -> oídio (como con «Alta»)', fo.event?.id === 'oidio', JSON.stringify(fo.event));
let reg = run({ carpa: 'pequena', plantas: '2', semilla: 'regular' });
reg = weeks(weeks(weeks(reg, 4, { humedad: 'baja' }), 1, { humedad: 'baja', fotoperiodo: '12/12' }), 0, {});
check('regulares: al retirar el macho la carpa deja de estar llena', E.tentFull(reg, RULES) && !E.tentFull(E.removeMales(reg, RULES), RULES));

console.log('5. El servidor acepta todo lo que el juego guarda');
let bad5 = 0;
for (const x of states) if (!(await serverOk(x))) { bad5++; if (bad5 < 4) console.log(JSON.stringify(x.setup), x.stage); }
check(`${states.length} estados aceptados por game_state_valid`, bad5 === 0, bad5 + ' rechazados');
check('el servidor rechaza 7 plantas, una semilla inventada y machos desconocidos', !(await serverOk({ ...good, setup: { ...good.setup, plantas: 7 } }))
  && !(await serverOk({ ...good, setup: { ...good.setup, semilla: 'clon' } })) && !(await serverOk({ ...good, setup: { ...good.setup, machos: 'nunca' } })));

console.log(`\nRESULTADO: ${pass} ok, ${fail} fallas`);
if (fail) { console.log('Fallas:', failures.join(' | ')); process.exitCode = 1; }
process.exit();
