// Zona del juego — the final review («repaso»): why the plant died or what
// lowered the score, told as a chain of the person's own decisions (week,
// choice, what it caused), what usually works better (never as the only
// answer), the «¿Por qué?» with its source (why.js) and the lessons.
// Pure data first (review), then the HTML (reviewHtml). Saves from before the
// review have no weekly choices in the log: the chain then says less, never
// something false.
import { DECISIONS, ideal, POST } from './engine.js';
import { WHY, whyGroupHtml, whyName } from './why.js';
import { postLooks } from './tent.js';

// Consecutive weeks with the same value become one step («semanas 2–3»).
function runs(weeks) {
  const out = [];
  for (const x of weeks) {
    const prev = out.at(-1);
    if (prev && prev.v === x.v && prev.s === x.s && x.w === prev.to + 1) prev.to = x.w;
    else out.push({ from: x.w, to: x.w, s: x.s, v: x.v });
  }
  return out;
}

export function review(state, rules) {
  const r = state.result || {};
  const log = state.log || [];
  const weeks = log.filter((x) => x.s !== 'germinacion');
  const setup = state.setup || {};
  const items = [];

  // decisions far from the ideal of their stage
  for (const d of DECISIONS) {
    const hit = weeks.filter((x) => x.l?.[d]);
    if (!hit.length) continue;
    const steps = hit[0].c ? runs(hit.map((x) => ({ w: x.w, s: x.s, v: x.c[d] }))) : [];
    const better = [...new Set(hit.map((x) => x.s))].map((st) => ({ s: st, v: [].concat(ideal(rules, st, d, setup) ?? []) }));
    items.push({ type: 'decision', key: d, lost: hit.reduce((a, x) => a + x.l[d], 0), steps, better });
  }

  // problems (events): what brought them, the answers given, the weeks they cost
  const evWeeks = weeks.filter((x) => x.l?.evento);
  for (const id of [...new Set(evWeeks.map((x) => x.e || 'evento'))]) {
    const cost = evWeeks.filter((x) => (x.e || 'evento') === id);
    const ev = rules.eventos.lista[id];
    const item = { type: 'evento', key: id, lost: cost.reduce((a, x) => a + x.l.evento, 0), weeksCost: cost.length,
      appeared: cost[0].w - 1, answers: [...new Set(cost.flatMap((x) => x.a || []))], better: ev?.respuesta_correcta || null, trigger: null };
    // the weeks in a row, up to the one it appeared, with the conditions that bring it
    if (ev && weeks.some((x) => x.c)) {
      const conds = Object.entries(ev.si);
      const run = [];
      for (const x of [...weeks].reverse()) {
        if (x.w > item.appeared) continue;
        if (!x.c || !conds.every(([k, v]) => x.c[k] === v)) { if (run.length) break; continue; }
        run.unshift(x.w);
      }
      if (run.length) item.trigger = { from: run[0], to: run.at(-1), conds };
    }
    items.push(item);
  }

  // switching to flowering too early / small pot never moved
  const flip = weeks.find((x) => x.l?.flip);
  if (flip) items.push({ type: 'flip', key: 'flip', lost: flip.l.flip, week: flip.w, min: rules.etapas.vegetativo.semanas.min });
  const pot = weeks.filter((x) => x.l?.maceta);
  if (pot.length) items.push({ type: 'maceta', key: 'maceta', lost: pot.reduce((a, x) => a + x.l.maceta, 0), week: pot[0].w });

  // germination
  const germ = log.find((x) => x.s === 'germinacion');
  for (const [d, n] of Object.entries(germ?.l || {})) {
    items.push({ type: 'germ', key: 'germ_' + d, d, lost: n, value: germ.c?.[d], better: [].concat(rules.germinacion.decisiones[d]?.ideal.valor ?? []) });
  }

  // after the harvest: drying and curing lower the score; the preparation and
  // the press only count in the rosin's own verdict (no number)
  for (const st of POST) {
    const p = state.post?.[st];
    for (const [d, n] of Object.entries(p?.l || {})) {
      const value = p.c?.[d];
      const look = Object.entries(postLooks(st, { [d]: value })).find(([, on]) => on)?.[0] || null;
      items.push({ type: 'post', key: WHY[st + '_' + d] ? st + '_' + d : st, stage: st, d, lost: n, scored: st === 'secado' || st === 'curado',
        value, look, better: [].concat(rules.post[st].decisiones[d]?.ideal.valor ?? []) });
    }
  }

  // growing mistakes first (what cost the most), then the post-harvest ones in their order
  const grow = items.filter((x) => x.type !== 'post').sort((a, b) => b.lost - a.lost);
  const post = items.filter((x) => x.type === 'post');
  const lessons = [...new Set([...grow, ...post].map((x) => WHY[x.key]?.lesson).filter(Boolean))];
  return { dead: !!r.dead, main: grow[0] || null, lastWeek: weeks.at(-1)?.w ?? null, grow, post, lessons };
}

// ---------------------------------------------------------------- view
const weeksText = (t, fmt, from, to) => from === to ? fmt(t('jgRv_semana'), { w: from }) : fmt(t('jgRv_semanas'), { a: from, b: to });
const q = (x) => `«${x}»`;

function optName(t, it, v, stage) {
  if (it.type === 'decision') return t(`jgO_${it.key}_${v}`);
  if (it.type === 'germ') return t(`jgGermO_${it.d}_${v}`);
  if (it.type === 'post') return t(`jgPO_${stage}_${it.d}_${v}`);
  return v;
}
const orList = (t, xs) => xs.map(q).join(` ${t('jgRv_o')} `);

function itemName(t, it) {
  if (it.type === 'post') return `${t('jgEtapa_' + it.stage).replace(/\s*\(.*\)$/, '')}: ${t('jgPD_' + it.stage + '_' + it.d).replace(/\s*\(.*\)$/, '')}`;
  if (it.type === 'evento' && it.key === 'evento') return t('jgWhyN_evento');
  return whyName(it.key, t);
}

function chain(it, ctx) {
  const { t, esc, fmt } = ctx;
  const steps = [];
  if (it.type === 'decision') {
    for (const st of it.steps) steps.push(`${weeksText(t, fmt, st.from, st.to)} (${t('jgEtapa_' + st.s)}): ${t('jgD_' + it.key)} ${q(t(`jgO_${it.key}_${st.v}`))}`);
    steps.push(fmt(t('jgRv_lejosIdeal'), { n: it.lost }));
  } else if (it.type === 'evento') {
    if (it.trigger) {
      steps.push(`${weeksText(t, fmt, it.trigger.from, it.trigger.to)}: ${it.trigger.conds.map(([k, v]) => `${t('jgD_' + k)} ${q(t(`jgO_${k}_${v}`))}`).join(' + ')}`);
    }
    if (it.key !== 'evento') steps.push(`${fmt(t('jgRv_aparecio'), { w: it.appeared, x: t('jgEvN_' + it.key) })} ${t('jgEvS_' + it.key)}`);
    for (const a of it.answers) steps.push(fmt(t('jgRv_respuestaMal'), { r: t('jgR_' + a) }));
    steps.push(fmt(t('jgRv_sinResolver'), { k: it.weeksCost, n: it.lost }));
  } else if (it.type === 'flip') {
    steps.push(fmt(t('jgRv_flip'), { w: it.week, min: it.min, n: it.lost }));
  } else if (it.type === 'maceta') {
    steps.push(fmt(t('jgRv_maceta'), { w: it.week, n: it.lost }));
  } else if (it.type === 'germ') {
    steps.push(`${t('jgEtapa_germinacion')}: ${t('jgGermD_' + it.d)} ${q(optName(t, it, it.value))}`);
    steps.push(fmt(t('jgRv_menosSalud'), { n: it.lost }));
  } else if (it.type === 'post') {
    if (it.value) steps.push(`${t('jgPD_' + it.stage + '_' + it.d).replace(/\s*\(.*\)$/, '')} ${q(optName(t, it, it.value, it.stage))}`);
    if (it.look) steps.push(t('jgTentX_' + it.look + (it.stage === 'material' ? '_material' : '')));
    steps.push(it.scored ? fmt(t('jgRv_menosNota'), { n: it.lost }) : t('jgRv_veredicto'));
  }
  return `<ol class="jg-rv-chain">${steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>`;
}

function betterText(it, ctx) {
  const { t, fmt } = ctx;
  if (it.type === 'decision') {
    const parts = it.better.filter((b) => b.v.length).map((b) => fmt(t('jgRv_mejorEtapa'), { etapa: t('jgEtapa_' + b.s), o: orList(t, b.v.map((v) => t(`jgO_${it.key}_${v}`))) }));
    return parts.length ? `${fmt(t('jgRv_mejorDecision'), { d: t('jgD_' + it.key), lista: parts.join('; ') })} ${t('jgRv_noUnica')}` : '';
  }
  if (it.type === 'evento') {
    if (!it.better) return t('jgRv_mejorEventoGen');
    const prev = it.trigger ? ` ${fmt(t('jgRv_prevenir'), { x: it.trigger.conds.map(([k, v]) => `${t('jgD_' + k)} ${q(t(`jgO_${k}_${v}`))}`).join(' + ') })}` : '';
    return `${fmt(t('jgRv_mejorEvento'), { r: t('jgR_' + it.better) })} ${t('jgEvX_' + it.key)}${prev} ${t('jgRv_noUnicaEvento')}`;
  }
  if (it.type === 'flip') return `${fmt(t('jgRv_mejorFlip'), { min: it.min })} ${t('jgRv_noUnica')}`;
  if (it.type === 'maceta') return `${t('jgRv_mejorMaceta')} ${t('jgRv_noUnica')}`;
  if (!it.better.length) return '';
  const opts = orList(t, it.better.map((v) => optName(t, it, v, it.stage)));
  return `${fmt(t('jgRv_mejorOpcion'), { o: opts })} ${t(it.type === 'post' ? 'jgRv_noUnicaPost' : 'jgRv_noUnica')}`;
}

function itemHtml(it, i, ctx) {
  const { t, esc } = ctx;
  const better = betterText(it, ctx);
  return `<li class="jg-rv-item" data-rv="${esc(it.key)}">
    <p class="jg-rv-name"><b>${esc(itemName(t, it))}</b></p>
    ${chain(it, ctx)}
    ${better ? `<p class="jg-rv-better"><b>${esc(t('jgRv_mejorTitulo'))}</b> ${esc(better)}</p>` : ''}
    ${WHY[it.key] ? whyGroupHtml([it.key], ctx, 'rv' + i) : ''}
  </li>`;
}

export function reviewHtml(rv, ctx) {
  const { t, esc, fmt, lessonBtn } = ctx;
  const all = [...rv.grow, ...rv.post];
  let head = '';
  if (rv.dead) {
    head = `<p class="jg-rv-main"><b>${esc(t('jgRv_principal'))}</b> ${esc(rv.main ? itemName(t, rv.main) : t('jgRv_sinDatos'))}.
      ${rv.lastWeek !== null ? esc(fmt(t('jgRv_murio'), { w: rv.lastWeek })) : ''}</p>`;
  }
  return `<section class="jg-review" aria-labelledby="jgRvH">
    <h4 id="jgRvH">${esc(t(rv.dead ? 'jgRv_tituloMuerta' : 'jgRv_tituloCosecha'))}</h4>
    ${head}
    ${all.length ? `<ol class="jg-rv-list">${all.map((it, i) => itemHtml(it, i, ctx)).join('')}</ol>` : `<p>${esc(t('jgFinNada'))}</p>`}
    ${rv.lessons.length ? `<p><b>${esc(t('jgRv_lecciones'))}</b></p><div class="jg-actions">${rv.lessons.map(lessonBtn).join('')}</div>` : ''}
  </section>`;
}

export const CSS = `
#juego .jg-review h4{font-family:'Manrope',sans-serif;font-size:16px;margin:16px 0 10px;color:var(--ink)}
#juego .jg-rv-main{font-size:15px;line-height:1.6;color:var(--ink);background:var(--paper-raised);border:1px solid var(--resin);border-left:4px solid var(--resin);border-radius:8px;padding:10px 12px}
#juego .jg-rv-list{list-style:none;padding:0;margin:0;display:grid;gap:12px}
#juego .jg-rv-item{border:1px solid var(--line);border-radius:8px;padding:10px 12px}
#juego .jg-rv-name{margin:0 0 6px;color:var(--ink)}
#juego .jg-rv-chain{list-style:none;margin:0 0 8px;padding:0;font-size:14px;line-height:1.6;color:var(--ink)}
#juego .jg-rv-chain li+li::before{content:'→ ';color:var(--ink-soft)}
#juego .jg-rv-better{font-size:13.5px;line-height:1.55;color:var(--ink);background:var(--paper-raised);border-left:4px solid var(--moss);border-radius:6px;padding:8px 10px;margin:0 0 10px}
`;
