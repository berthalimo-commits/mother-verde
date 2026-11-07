// «Nuestra historia» — which photo goes on which screen. THE ONLY PLACE to
// change a photo: edit one line, run `node tools/historia-fotos.mjs` (it
// crops/compresses from fotos-historia/ into public/historia/), done.
//   source: file in fotos-historia/ (Bertha's originals, never modified)
//   alt:    key in src/purposeTexts.js (4 languages)
//   crop:   4:5 crop in fractions of the original: x, y = top-left corner;
//           w = width (the height follows from 4:5). Omit x/y to centre.
//   tune:   optional light fix (only the graduation photo needs it)
//   maxWidth: optional, smaller than the default 1200 px (lighter file)
// Never use 04-laboratorio or 09-graduacion (other people appear).
// Spare: 06-campo-sombrero, 08-campo-rociando.
export const STORY_PHOTOS = {
  1: { source: '05-planta-lentes-azules.jpg', file: 'p-05-planta.jpg', alt: 'storyAlt1', crop: { x: 0, y: 0, w: 1 } },
  2: { source: '07-flores-capucha.jpg', file: 'p-07-flores.jpg', alt: 'storyAlt2', crop: { x: 0, y: 0, w: 1 } },
  3: { source: '02-campo-camiseta-peru.jpg', file: 'p-02-campo.jpg', alt: 'storyAlt3', crop: { w: 1 } },
  4: { source: 'IMG_6317.jpeg', file: 'p-graduacion.jpg', alt: 'storyAlt4', crop: { x: 0.085, y: 0.012, w: 0.81 }, tune: { gamma: 0.72, sharpen: true } },
  5: { source: '01-carpa-sudadera-roja.jpg', file: 'p-01-plantas.jpg', alt: 'storyAlt5', crop: { x: 0.35, y: 0.22, w: 0.65 } },
  6: { source: '03-campo-abrazo-planta.jpg', file: 'p-03-abrazo.jpg', alt: 'storyAlt6', crop: { w: 1 }, maxWidth: 1000 },
};
