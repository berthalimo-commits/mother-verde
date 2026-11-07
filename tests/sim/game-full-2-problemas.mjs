// Full run 2/5 — every plant problem, brought on by touch with the choices
// that cause it, then answered well (it goes away, health comes back) and
// answered badly (it stays, the week can go on, it asks again and keeps
// costing health). While a problem is open the decisions are locked: the
// screen must say why and offer «Ir a la pregunta». Every screen is audited.
import { summary, check } from './browser.mjs';
import { RULES, E, NEUTRAL, IDEAL, session, audit, week, answer, click, gs, gameAt, report, shots } from './game-full-lib.mjs';

// how to bring each problem on (rules.json → eventos: condition two weeks in a row)
const CASES = {
  oidio: { stage: 'vegetativo', c: { humedad: 'alta' } },
  botrytis: { stage: 'floracion', c: { humedad: 'alta' } },
  acaros: { stage: 'vegetativo', c: { temperatura: 'calida', humedad: 'baja' } },
  carencia_n: { stage: 'vegetativo', c: { nutrientes: 'bajo' } },
  exceso_riego: { stage: 'vegetativo', c: { riego: 'mucho' } },
  pudricion_raiz: { stage: 'vegetativo', c: { temperatura: 'calida' }, setup: { carpa: 'mediana', luz: 'led', sistema: 'dwc', medir: 'si' } },
  // only a tall plant (at least 5 weeks of vegetative growth) reaches the lamp
  quemadura_luz: { stage: 'floracion', c: { intensidad: 'alta' }, setup: { ...NEUTRAL, carpa: 'pequena' }, flipAt: 5 },
};
check('el test cubre todos los problemas del juego', Object.keys(RULES.eventos.lista).every((id) => id in CASES));

for (const [id, cs] of Object.entries(CASES)) {
  for (const good of [true, false]) {
    const tag = `${id} (${good ? 'bien' : 'mal'})`;
    const start = gameAt(cs.stage, cs.stage === 'floracion' ? 2 : 1, cs.setup || NEUTRAL, cs.flipAt);
    const b = await session(good ? 390 : 1280, start);
    let s = await gs(b);
    for (let i = 0; i < 5 && !s.event && ['plantula', 'vegetativo', 'floracion'].includes(s.stage); i++) {
      const c = { ...IDEAL(s.stage), ...cs.c };
      if (s.stage === 'vegetativo') c.fotoperiodo = '18/6';
      await week(b, c); s = await gs(b);
    }
    check(`${tag}: aparece jugando con ${JSON.stringify(cs.c)}`, s.event?.id === id, JSON.stringify(s.event) + ' ' + s.stage);
    if (s.event?.id !== id) { await b.close(); continue; }
    const locked = await b.ev(`({ next: document.getElementById('jgNext')?.disabled, note: !!document.getElementById('jgBloqueo'), go: !!document.getElementById('jgIrPregunta'), card: !!document.querySelector('.jg-event'), sym: !!document.querySelector('#jgTent [data-sym]') })`);
    check(`${tag}: la semana queda bloqueada, con la explicación, «Ir a la pregunta» y la tarjeta del problema`, locked.next && locked.note && locked.go && locked.card, JSON.stringify(locked));
    await audit(b, `${tag}: problema abierto`, { langs: good && id === 'oidio' });
    if (good) await shots(b, `jgfull-problema-${id}`);
    const h0 = s.health;
    const right = RULES.eventos.lista[id].respuesta_correcta;
    const shown = await b.ev(`[...document.querySelectorAll('.jg-answer')].map((x) => x.dataset.answer)`);
    check(`${tag}: entre las respuestas está la buena (${right})`, shown.includes(right), shown.join());
    if (good) {
      await answer(b, right); s = await gs(b);
      check(`${tag}: respuesta buena -> el problema se va y la salud sube (tope 100)`, !s.event && (s.health > h0 || s.health === 100), `${h0} -> ${s.health}`);
      check(`${tag}: se desbloquea la semana`, !(await b.ev(`document.getElementById('jgNext').disabled`)) && !(await b.ev(`!!document.getElementById('jgBloqueo')`)));
      await audit(b, `${tag}: después de responder bien`);
    } else {
      const wrong = shown.find((x) => x !== right);
      await answer(b, wrong); s = await gs(b);
      check(`${tag}: respuesta mala -> el problema sigue, pero la semana se puede pasar`, s.event?.id === id && s.event.answered && !(await b.ev(`document.getElementById('jgNext').disabled`)));
      await audit(b, `${tag}: después de responder mal`);
      const before = s.health;
      await week(b, { ...IDEAL(s.stage), fotoperiodo: s.stage === 'floracion' ? '12/12' : '18/6' }); s = await gs(b);
      check(`${tag}: la semana siguiente vuelve a preguntar y sigue restando salud`, s.event?.id === id && !s.event.answered && s.health < before, `${before} -> ${s.health}`);
      await audit(b, `${tag}: vuelve a preguntar`);
      await answer(b, right); s = await gs(b);
      check(`${tag}: a la segunda, con la respuesta buena, se resuelve`, !s.event);
    }
    await b.close();
  }
}
report('game-full-2-problemas');
summary();
