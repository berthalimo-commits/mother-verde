// Browser test (2026-11-04): welcome-story photos and layout, v2 (Bertha's
// APRUEBO). One photo per screen, taken from src/storyPhotos.js; each photo
// shown WHOLE in 4:5 (never cropped by CSS), inside its frame and the screen;
// phone = photo on top, at most 45 % of the screen height; >= 760 px = photo
// left, text right; no inner scrollbar; «Continuar» and «Saltar» fully
// visible. Checked at 320x568, 360x740, 768x1024, 1366x768 and 1920x1080, in
// the 4 languages, on the 6 screens (screenshots in out/story-v2-*). Also
// checks the published files: 4:5, max 1200 px (03 max 1000), no metadata.
// Needs Vite on 5174 + fakeserver.
import { check, sleep, browser, summary, OUT } from './browser.mjs';
import fs from 'fs';
import path from 'path';
const APP = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const { PURPOSE_TEXTS: T } = await import('file:///' + path.join(APP, 'src/purposeTexts.js'));
const { STORY_PHOTOS: P } = await import('file:///' + path.join(APP, 'src/storyPhotos.js'));
const L = ['es', 'en', 'de', 'fr'];
const SIZES = [[320, 568], [360, 740], [768, 1024], [1366, 768], [1920, 1080]];

// ------------------------------------------------------------ files
const head = (buf) => { let i = 2; const seg = []; while (i < buf.length - 4 && buf[i] === 0xff) { const m = buf[i + 1]; if (m === 0xda) break; seg.push(m); i += 2 + buf.readUInt16BE(i + 2); } return { seg, head: buf.subarray(0, i) }; };
const sizeOf = (buf) => { let i = 2; while (i < buf.length) { const m = buf[i + 1], len = buf.readUInt16BE(i + 2); if (m >= 0xc0 && m <= 0xc2) return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)]; i += 2 + len; } return [0, 0]; };
const files = Object.values(P).map((p) => ({ p, buf: fs.readFileSync(path.join(APP, 'public/historia', p.file)) }));
check('las 6 fotos del mapeo existen en public/historia', files.length === 6);
check('ninguna foto publicada tiene EXIF, XMP, IPTC, ICC, comentarios ni GPS', files.every(({ buf }) => { const { seg, head: h } = head(buf); return !seg.some((m) => m === 0xfe || (m >= 0xe1 && m <= 0xef)) && !h.includes('GPS') && !h.includes('Exif') && !h.includes('http://ns.adobe.com'); }));
check('todas en 4:5, máximo 1200 px de ancho (la 03, máximo 1000)', files.every(({ p, buf }) => { const [w, h] = sizeOf(buf); return Math.abs(w / h - 0.8) < 0.005 && w <= (p.maxWidth || 1200); }), JSON.stringify(files.map(({ buf }) => sizeOf(buf))));
check('no se usan 04-laboratorio ni 09-graduacion; la 4 es la foto de graduación de Bertha', Object.values(P).every((p) => !/^0[49]-/.test(p.source)) && P[4].source === 'IMG_6317.jpeg');
check('carpeta public/historia sin fotos sobrantes', fs.readdirSync(path.join(APP, 'public/historia')).sort().join() === Object.values(P).map((p) => p.file).sort().join());

// ------------------------------------------------------------ layout
const b = await browser(null, 'aal1', 420);
await b.send('Page.navigate', { url: 'http://localhost:5174/' }); await sleep(5000);
await b.ev(`(() => { const x = document.querySelector('#ageGateModal button[onclick="ageGateConfirm(true)"]'); if (x && x.offsetParent) x.click(); return 1; })()`); await sleep(800);
await b.ev(`document.getElementById('storySkip')?.click(); 1`);
// instant screen changes (no smooth scroll in the middle of a measurement)
await b.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
// viewport-only captures: a full-page capture enlarges the headless window and
// moves the horizontal track (test artifact)
const vshot = async (name) => { const r = await b.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(OUT + '/' + name + '.png', Buffer.from(r.result.data, 'base64')); };
const bad = [];
for (const [w, h] of SIZES) {
  await b.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 760 });
  for (const l of L) {
    await b.ev(`document.querySelector('#langSwitch button[data-lang=${l}]').click(); 1`); await sleep(300);
    await b.ev(`(() => { document.getElementById('mvDevPreview')?.remove(); window.mvOpenStory(); document.querySelectorAll('.story-photo img').forEach((i) => i.loading = 'eager'); return 1; })()`); await sleep(500);
    for (let n = 1; n <= 6; n++) {
      if (n > 1) await b.ev(`document.getElementById('storyNext').click(); 1`);
      await sleep(n === 1 ? 900 : 600);
      const m = await b.ev(`(() => {
        const s = document.getElementById('storySlide${n}'), imgs = s.querySelectorAll('.story-photo img'), i = imgs[0];
        const r = i.getBoundingClientRect(), f = s.querySelector('.story-photo').getBoundingClientRect(), t = s.querySelector('.story-text').getBoundingClientRect(), sr = s.getBoundingClientRect();
        const btn = [...document.querySelectorAll('#storySkip, #storyNext')].every((x) => { const q = x.getBoundingClientRect(); return x.offsetParent && q.top >= 0 && q.bottom <= innerHeight + 0.5 && q.left >= 0 && q.right <= innerWidth + 0.5; });
        return { count: imgs.length, src: i.src.split('/').pop(), alt: i.alt, loaded: i.complete && i.naturalWidth > 0 && !i.hidden, fit: getComputedStyle(i).objectFit,
          ratio: r.width / r.height, inFrame: r.left >= f.left - 0.5 && r.right <= f.right + 0.5 && r.top >= f.top - 0.5 && r.bottom <= f.bottom + 0.5,
          touches: Math.abs(r.width - f.width) < 1.5 || Math.abs(r.height - f.height) < 1.5, inView: r.top >= sr.top - 0.5 && r.bottom <= sr.bottom + 0.5 && r.left >= 0 && r.right <= innerWidth,
          overflow: s.scrollHeight - s.clientHeight, textClip: t.bottom - sr.bottom, h: r.height, vh: innerHeight, side: r.right <= t.left + 1, above: r.bottom <= t.top + 1, btn,
          pageX: document.documentElement.scrollWidth > innerWidth, radius: parseFloat(getComputedStyle(i).borderTopLeftRadius) };
      })()`);
      const p = P[n], wide = w >= 760;
      const ok = m.count === 1 && m.src === p.file && m.alt === T[p.alt][l] && m.loaded && m.fit !== 'cover' && Math.abs(m.ratio - 0.8) < 0.01 && m.inFrame && m.touches && m.inView
        && m.overflow <= 0 && m.textClip <= 0.5 && m.btn && !m.pageX && m.radius >= 8 && (wide ? m.side : m.above && m.h <= m.vh * 0.45 + 1);
      if (!ok) bad.push(`${w}x${h} ${l} P${n} ${JSON.stringify(m)}`);
      if (l === 'es' || w === 320) await vshot(`story-v2-${w}x${h}-${l}-P${n}`);
    }
    await b.ev(`document.getElementById('storySkip').click(); 1`); await sleep(200);
  }
}
check(`6 pantallas x 4 idiomas x ${SIZES.length} tamaños: una foto del mapeo, entera en 4:5 y redondeada, dentro de su marco y sin huecos, sin barra interna, texto completo, «Continuar» y «Saltar» a la vista; celular = foto arriba (máx. 45 % de la altura), ordenador = foto a la izquierda`, bad.length === 0, bad.length + ' casos:\n' + bad.slice(0, 4).join('\n'));
// rotating the phone / resizing the window keeps the same screen
await b.ev(`(() => { window.mvOpenStory(); for (let i = 0; i < 5; i++) document.getElementById('storyNext').click(); return 1; })()`); await sleep(400);
const keep = [];
for (const [w, h] of [[740, 360], [360, 740], [1366, 768], [320, 568]]) {
  await b.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 760 }); await sleep(600);
  keep.push(await b.ev(`(() => { const t = document.getElementById('storyTrack'), s = document.getElementById('storySlide6'); return /6/.test(document.getElementById('storyStep').textContent) && Math.abs(t.scrollLeft - 5 * t.clientWidth) < 2 && Math.abs(s.getBoundingClientRect().left - t.getBoundingClientRect().left) < 2 ? true : [document.getElementById('storyStep').textContent, t.scrollLeft, t.clientWidth]; })()`));
}
check('al girar el celular o cambiar el tamaño de la ventana sigue en la misma pantalla (6 de 6)', keep.every((x) => x === true), JSON.stringify(keep));
await b.close();
summary();
