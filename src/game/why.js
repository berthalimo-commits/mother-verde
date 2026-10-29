// Zona del juego — «¿Por qué?»: the reason behind each consequence, its lesson
// in the platform and, when there is one, the outside source that was opened
// and checked (docs/juego-fuentes.md, codes F1–F6). A rule that only exists
// for the game says so. No source is cited here that is not in that file.

export const SOURCES = {
  F1: { label: 'Rodriguez-Morrison, Llewellyn & Zheng — Frontiers in Plant Science, 2021', url: 'https://www.frontiersin.org/articles/10.3389/fpls.2021.646020/full' },
  F2: { label: 'Utah State University Extension — Hemp nutrient deficiencies', url: 'https://extension.usu.edu/planthealth/ipm/notes_ag/hemp-nutrient-deficiencies' },
  F3: { label: 'UC IPM, University of California — Pythium root rot', url: 'https://ipm.ucanr.edu/agriculture/floriculture-and-ornamental-nurseries/pythium-root-rot/' },
  F4: { label: 'Utah State University Extension — Hemp bud rot', url: 'https://extension.usu.edu/planthealth/ipm/notes_ag/hemp-bud-rot' },
  F5: { label: 'Utah State University Extension — Hemp powdery mildew', url: 'https://extension.usu.edu/planthealth/ipm/notes_ag/hemp-powdery-mildew' },
  F6: { label: 'NC State Extension — Twospotted spider mite in industrial hemp', url: 'https://content.ces.ncsu.edu/twospotted-spider-mite-in-industrial-hemp' },
  F8: { label: 'Milay et al. — Frontiers in Plant Science, 2020 (storage)', url: 'https://www.frontiersin.org/articles/10.3389/fpls.2020.583605/full' },
  P1: { label: 'US 11001025 B2 (patent, 2021)', url: 'https://patents.google.com/patent/US11001025B2/en' },
  P2: { label: 'US 11511465 B2 (patent, 2022)', url: 'https://patents.google.com/patent/US11511465B2/en' },
  F9: { label: 'Alhussaen — PhD thesis, University of Technology Sydney, 2006 (hydroponic lettuce)', url: 'https://opus.lib.uts.edu.au/handle/10453/36864' },
  F10: { label: 'Simshaw et al. — Acta Horticulturae 1140, 2016 (nursery containers)', url: 'https://www.ishs.org/ishs-article/1140_41' },
  F11: { label: 'Geneve et al. — Crops, 2022 (hemp germination temperature)', url: 'https://scholars.uky.edu/en/publications/temperature-limits-for-seed-germination-in-industrial-hemp-cannab/' },
};

// key -> lesson of the platform, source code (or null) and backing level.
// Texts: jgWhy_<key> (reason) and jgWhyN_<key> (short name, when it isn't a
// decision / event / stage name the game already has).
export const WHY = {
  fotoperiodo: { lesson: 'ciclo', src: 'F1', level: 'estudio' },
  intensidad: { lesson: 'iluminacion', src: 'F1', level: 'estudio' },
  riego: { lesson: 'diagnostico', src: 'F3', level: 'guia' },
  nutrientes: { lesson: 'sustrato', src: 'F2', level: 'guia' },
  temperatura: { lesson: 'sistemas', src: 'F6', level: 'guia' },
  humedad: { lesson: 'sistemas', src: 'F4', level: 'guia' },
  flip: { lesson: 'ciclo', src: null, level: 'simple' },
  evento: { lesson: 'diagnostico', src: null, level: 'simple' },
  oidio: { lesson: 'diagnostico', src: 'F5', level: 'guia' },
  botrytis: { lesson: 'diagnostico', src: 'F4', level: 'guia' },
  acaros: { lesson: 'diagnostico', src: 'F6', level: 'guia' },
  carencia_n: { lesson: 'diagnostico', src: 'F2', level: 'guia' },
  exceso_riego: { lesson: 'diagnostico', src: 'F3', level: 'guia' },
  muerta: { lesson: 'diagnostico', src: 'F3', level: 'simple' },
  tricomas: { lesson: 'cosecha', src: null, level: 'practica' },
  secado: { lesson: 'procesos', src: null, level: 'practica' },
  curado: { lesson: 'procesos', src: null, level: 'practica' },
  rosin: { lesson: 'concentrados', src: null, level: 'practica' },
  sinDato: { lesson: null, src: null, level: 'simple' },
  // Phase 8: one reason per post-harvest decision that can cost points
  // (rules.json → post; levels as in docs/juego-decisiones.md).
  secado_metodo: { lesson: 'procesos', src: null, level: 'autora' },
  secado_temperatura: { lesson: 'procesos', src: null, level: 'practica' },
  secado_humedad: { lesson: 'procesos', src: null, level: 'practica' },
  secado_aire: { lesson: 'procesos', src: null, level: 'practica' },
  secado_luz: { lesson: 'procesos', src: 'F8', level: 'estudio' },
  secado_duracion: { lesson: 'procesos', src: null, level: 'practica' },
  curado_envase: { lesson: 'procesos', src: null, level: 'practica' },
  curado_control: { lesson: 'procesos', src: null, level: 'autora' },
  curado_abrir: { lesson: 'procesos', src: null, level: 'practica' },
  curado_tiempo: { lesson: 'procesos', src: null, level: 'practica' },
  curado_g_luz: { lesson: 'procesos', src: 'F8', level: 'estudio' },
  curado_g_temp: { lesson: 'procesos', src: 'F8', level: 'estudio' },
  curado_g_aire: { lesson: 'procesos', src: 'F8', level: 'estudio' },
  curado_g_forma: { lesson: 'procesos', src: 'F8', level: 'estudio' },
  curado_g_tiempo: { lesson: 'procesos', src: 'F8', level: 'estudio' },
  rosin_material: { lesson: 'concentrados', src: null, level: 'practica' },
  rosin_malla: { lesson: 'concentrados', src: ['P1', 'P2'], level: 'patente' },
  rosin_calor: { lesson: 'concentrados', src: 'P2', level: 'practica' },
  rosin_papel: { lesson: 'concentrados', src: null, level: 'practica' },
  rosin_enfriado: { lesson: 'concentrados', src: null, level: 'autora' },
  rosin_guardar: { lesson: 'concentrados', src: 'F8', level: 'estudio' },
  rosin_proteccion: { lesson: 'concentrados', src: null, level: 'simple' },
  // Phases 6-7: equipment, germination and the two new problems
  pudricion_raiz: { lesson: 'diagnostico', src: ['F9', 'F3'], level: 'estudio' },
  quemadura_luz: { lesson: 'iluminacion', src: null, level: 'autora' },
  maceta: { lesson: 'sustrato', src: null, level: 'autora' },
  hps: { lesson: 'iluminacion', src: null, level: 'practica' },
  maceta_porosa: { lesson: 'sustrato', src: 'F10', level: 'estudio' },
  germ_temperatura: { lesson: 'propagacion', src: 'F11', level: 'estudio' },
  germ_humedad: { lesson: 'propagacion', src: null, level: 'autora' },
  germ_tiempo: { lesson: 'propagacion', src: null, level: 'autora' },
};
const srcList = (w) => [].concat(w.src ?? []);

// The keys a list of game notes / causes points to (in order, no repeats).
export function whyKeysFromNotes(notes, state) {
  const out = [];
  const add = (k) => { if (WHY[k] && !out.includes(k)) out.push(k); };
  for (const n of notes || []) {
    const [kind, arg] = n.split(':');
    if (kind === 'semanaMal') Object.keys(state.log.at(-1)?.l || {}).forEach(add);
    else if (kind === 'evento' || kind === 'eventoBien' || kind === 'eventoMal') add(arg);
    else if (kind === 'flipTemprano') add('flip');
    else if (kind === 'sinDato' || kind === 'postSinDato') add('sinDato');
    else if (kind === 'cosechado' || kind === 'cosechaAuto') add('tricomas');
    else if (kind === 'postMal') { Object.keys(state.post?.[arg]?.l || {}).forEach((d) => add(arg + '_' + d)); add(arg); }
    else if (kind === 'quemadura') add('rosin');
    else if (kind === 'germMal') Object.keys(state.log.at(-1)?.l || {}).forEach((d) => add('germ_' + d));
    else if (kind === 'sinTrasplante') add('maceta');
    else if (n === 'efecto:hps') add('hps');
    else if (n === 'efecto:poco_doble') add('maceta_porosa');
  }
  return out;
}

// Keys of the final result: what cost health, the harvest point, drying /
// curing / rosin mistakes, and the dead plant.
export function whyKeysFromResult(r) {
  const out = [];
  const add = (k) => { if (WHY[k] && !out.includes(k)) out.push(k); };
  if (r.dead) add('muerta');
  (r.causes || []).forEach(add);
  if (!r.dead) add('tricomas');
  (r.postCauses || []).forEach((c) => add(WHY[c] ? c : c.split('_')[0]));
  (r.rosin?.causes || []).forEach((c) => add(WHY[c] ? c : 'rosin'));
  return out;
}

// A group of «¿Por qué?» buttons + one panel that shows the chosen reason.
// name(key) gives the short name shown on each button.
export function whyGroupHtml(keys, ctx, gid) {
  if (!keys.length) return '';
  const { t, esc } = ctx;
  return `<div class="jg-whys" data-gid="${gid}">
    <div class="jg-why-btns">${keys.map((k) => `<button type="button" class="btn btn-ghost jg-why" data-why="${k}" aria-expanded="false" aria-controls="jgWhyP-${gid}">${esc(t('jgWhyBtn'))} · ${esc(whyName(k, t))}</button>`).join('')}</div>
    <div class="jg-why-panel" id="jgWhyP-${gid}" role="region" aria-live="polite" hidden></div>
  </div>`;
}

export function whyName(k, t) {
  if (['fotoperiodo', 'intensidad', 'riego', 'nutrientes', 'temperatura', 'humedad'].includes(k)) return t('jgD_' + k);
  if (['oidio', 'botrytis', 'acaros', 'carencia_n', 'exceso_riego', 'pudricion_raiz', 'quemadura_luz'].includes(k)) return t('jgEvN_' + k);
  if (k.startsWith('germ_')) return t('jgGermD_' + k.slice(5));
  if (['secado', 'curado', 'rosin'].includes(k)) return t('jgEtapa_' + k).replace(/\s*\(.*\)$/, '');
  if (k === 'tricomas') return t('jgTricomas').replace(/\s*\(.*\)$/, '');
  if (/^(secado|curado|rosin)_/.test(k)) return t('jgPD_' + k).replace(/\s*\(.*\)$/, '');
  return t('jgWhyN_' + k);
}

export function whyPanelHtml(k, ctx) {
  const { t, esc, lessonBtn } = ctx;
  const w = WHY[k];
  const srcs = srcList(w).map((c) => SOURCES[c]);
  return `<p class="jg-why-text">${esc(t('jgWhy_' + k))}</p>
    <p class="jg-why-level"><b>${esc(t('jgWhyRespaldo'))}</b> ${esc(t('jgWhyNivel_' + w.level))}</p>
    ${srcs.length ? `<p class="jg-why-src"><b>${esc(t('jgWhyFuente'))}</b> ${srcs.map((s) => `<a href="${s.url}" target="_blank" rel="noopener noreferrer">${esc(s.label)}</a>`).join(' · ')}</p>` : ''}
    ${w.lesson ? lessonBtn(w.lesson) : ''}`;
}

// One listener per game screen: open / close the reason under each group.
export function bindWhy(box, ctx) {
  box.addEventListener('click', (ev) => {
    const b = ev.target.closest('.jg-why');
    if (!b) return;
    const group = b.closest('.jg-whys');
    const panel = group.querySelector('.jg-why-panel');
    const open = b.getAttribute('aria-expanded') === 'true';
    group.querySelectorAll('.jg-why').forEach((x) => x.setAttribute('aria-expanded', 'false'));
    if (open) { panel.hidden = true; panel.innerHTML = ''; return; }
    b.setAttribute('aria-expanded', 'true');
    panel.innerHTML = whyPanelHtml(b.dataset.why, ctx);
    panel.hidden = false;
    ctx.bindLessons?.(panel);
  });
}

export const CSS = `
#juego .jg-whys{margin:0 0 14px}
#juego .jg-why-btns{display:flex;flex-wrap:wrap;gap:8px}
#juego .jg-why{min-height:44px;font-size:13.5px}
#juego .jg-why[aria-expanded="true"]{border-color:var(--moss);color:var(--moss)}
#juego .jg-why-panel{margin-top:10px;background:var(--paper-raised);border:1px solid var(--glow-border);border-left:4px solid var(--moss);border-radius:8px;padding:10px 14px}
#juego .jg-why-panel p{margin:0 0 8px;font-size:13.5px;line-height:1.55;color:var(--ink)}
#juego .jg-why-panel .jg-why-level,#juego .jg-why-panel .jg-why-src{color:var(--ink-soft)}
#juego .jg-why-panel a{color:var(--teal);overflow-wrap:anywhere}
`;
