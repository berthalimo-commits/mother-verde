// Zona del juego — phase 3 drawings: flat SVG in the same style as the
// scientist (simple shapes, the app's CSS colours, light and dark). Rule: no
// inside detail of any equipment — closed boxes and silhouettes only — and no
// text in the drawing (the buttons on top carry the names, in 4 languages).
// Spots: where each tappable thing sits, in the 360 x 240 drawing.

const box = (x, y, w, h, fill, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${extra}/>`;
const line = (d, c = 'var(--ink-soft)', w = 2) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;

export const KITCHEN = {
  spots: { ventana: [56, 61], detector: [175, 40], frasco: [250, 64], llama: [180, 126], tubo: [245, 124], enchufe: [322, 128], fumar: [45, 150], planta: [111, 176] },
  svg: '<svg viewBox="0 0 360 240" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid meet">'
    // wall and floor
    + box(0, 0, 360, 200, 'var(--paper-raised)') + box(0, 200, 360, 40, 'var(--paper)', ' stroke="var(--line-strong)"')
    // closed window, small room
    + box(20, 28, 72, 66, 'var(--teal)', ' fill-opacity="0.16" stroke="var(--ink-soft)" stroke-width="2" rx="3"')
    + line('M56 28 L56 94') + line('M20 61 L92 61') + box(50, 88, 12, 5, 'var(--ink-soft)', ' rx="1.5"')
    // empty place on the wall where a gas detector would be
    + '<circle cx="175" cy="40" r="11" fill="none" stroke="var(--ink-soft)" stroke-width="1.6" stroke-dasharray="3 3"/>'
    // shelf with a curing jar
    + line('M215 80 L290 80', 'var(--ink-soft)', 3)
    + box(240, 54, 20, 26, 'var(--teal)', ' fill-opacity="0.22" stroke="var(--ink-soft)" stroke-width="1.4" rx="4"') + box(238, 49, 24, 6, 'var(--ink-soft)', ' rx="2"')
    // counter and stove with a lit burner
    + box(135, 144, 160, 8, 'var(--ink-soft)', ' rx="2"') + box(140, 152, 150, 48, 'var(--paper)', ' stroke="var(--line-strong)"')
    + line('M215 152 L215 200', 'var(--line-strong)', 1.5) + box(150, 138, 60, 6, 'var(--ink-soft)', ' rx="2"')
    + '<path d="M180 112 Q188 124 184 132 Q180 136 176 132 Q172 124 180 112 Z" fill="var(--resin)"/>'
    + '<path d="M180 121 Q183 127 181 131 Q179 132 178 130 Q177 126 180 121 Z" fill="var(--paper-raised)" opacity="0.6"/>'
    // homemade device: a closed box held together with tape (nothing inside is shown)
    + box(228, 106, 34, 38, 'var(--ink-soft)', ' fill-opacity="0.45" stroke="var(--ink-soft)" stroke-width="1.4" rx="4"')
    + box(226, 116, 38, 5, 'var(--resin)', ' opacity="0.85"') + box(226, 130, 38, 5, 'var(--resin)', ' opacity="0.85"')
    // fridge and a wall socket
    + box(300, 62, 48, 138, 'var(--paper)', ' stroke="var(--line-strong)" stroke-width="2" rx="6"') + line('M300 110 L348 110', 'var(--line-strong)', 2)
    + line('M308 76 L308 98', 'var(--ink-soft)', 3) + line('M308 120 L308 146', 'var(--ink-soft)', 3)
    + box(278, 112, 12, 16, 'var(--paper)', ' stroke="var(--ink-soft)" stroke-width="1.2" rx="2"')
    + '<circle cx="284" cy="117" r="1.2" fill="var(--ink-soft)"/><circle cx="284" cy="123" r="1.2" fill="var(--ink-soft)"/>'
    // someone smoking
    + '<circle cx="45" cy="118" r="10" fill="var(--ink-soft)"/>'
    + box(33, 130, 24, 50, 'var(--ink-soft)', ' fill-opacity="0.65" rx="10"') + line('M40 180 L38 200', 'var(--ink-soft)', 5) + line('M50 180 L52 200', 'var(--ink-soft)', 5)
    + line('M54 122 L66 120', 'var(--paper-raised)', 2.4) + '<circle cx="67" cy="119.8" r="1.6" fill="var(--resin)"/>'
    + line('M68 116 Q72 110 68 104 Q65 98 70 92', 'var(--ink-soft)', 1.2)
    // a plant in a pot (not a hazard)
    + '<path d="M101 186 L121 186 L118 200 L104 200 Z" fill="var(--resin)" opacity="0.75"/>'
    + '<path d="M111 186 Q104 172 96 168 Q106 166 111 180 Q114 164 124 160 Q118 172 111 186 Z" fill="var(--moss)"/>'
    + '</svg>',
};

export const LAB = {
  spots: { licencia: [58, 52], ventilacion: [200, 42], explosion: [302, 44], proteccion: [56, 148], cerrado: [190, 150], inspeccion: [306, 150] },
  svg: '<svg viewBox="0 0 360 240" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid meet">'
    // clean wall and floor
    + box(0, 0, 360, 200, 'var(--paper-raised)') + box(0, 200, 360, 40, 'var(--paper)', ' stroke="var(--line-strong)"')
    // licence on the wall: a frame with a seal (no text)
    + box(34, 28, 48, 46, 'var(--paper)', ' stroke="var(--ink-soft)" stroke-width="2" rx="3"')
    + line('M42 40 L74 40', 'var(--line-strong)', 2) + line('M42 48 L70 48', 'var(--line-strong)', 2) + line('M42 56 L64 56', 'var(--line-strong)', 2)
    + '<circle cx="70" cy="64" r="6" fill="var(--resin)"/>' + '<path d="M66 69 L64 76 L70 73 L76 76 L74 69 Z" fill="var(--resin)" opacity="0.8"/>'
    // ventilation duct along the ceiling and a gas detector with its light
    + box(126, 16, 130, 16, 'var(--ink-soft)', ' fill-opacity="0.35" stroke="var(--ink-soft)" stroke-width="1.4" rx="3"')
    + line('M150 20 L150 28', 'var(--ink-soft)', 1.4) + line('M170 20 L170 28', 'var(--ink-soft)', 1.4) + line('M190 20 L190 28', 'var(--ink-soft)', 1.4) + line('M210 20 L210 28', 'var(--ink-soft)', 1.4)
    + box(214, 46, 18, 18, 'var(--paper)', ' stroke="var(--ink-soft)" stroke-width="1.4" rx="4"') + '<circle cx="223" cy="55" r="3.2" fill="var(--moss)"/>'
    // explosion-proof light: a closed, caged lamp
    + line('M302 0 L302 26', 'var(--ink-soft)', 2)
    + '<path d="M288 30 Q302 22 316 30 L316 50 Q302 60 288 50 Z" fill="var(--teal)" fill-opacity="0.28" stroke="var(--ink-soft)" stroke-width="2"/>'
    + line('M288 40 L316 40', 'var(--ink-soft)', 1.6) + line('M302 26 L302 56', 'var(--ink-soft)', 1.6)
    // protective equipment on a hook: goggles and gloves
    + line('M30 116 L82 116', 'var(--ink-soft)', 3)
    + '<path d="M36 128 Q46 122 56 128 Q66 122 76 128 L74 138 Q66 142 58 136 L54 136 Q46 142 38 138 Z" fill="var(--teal)" fill-opacity="0.5" stroke="var(--ink-soft)" stroke-width="1.4"/>'
    + '<path d="M40 150 L40 172 Q40 180 48 180 L52 180 Q58 180 58 172 L58 156 L54 156 L54 150 Z" fill="var(--moss)" opacity="0.8"/>'
    + '<path d="M62 150 L62 172 Q62 180 70 180 L74 180 Q80 180 80 172 L80 156 L76 156 L76 150 Z" fill="var(--moss)" opacity="0.8"/>'
    // the closed, certified system: a sealed cabinet with a lock and a check seal (no inside)
    + box(146, 104, 88, 96, 'var(--ink-soft)', ' fill-opacity="0.3" stroke="var(--ink-soft)" stroke-width="2" rx="8"')
    + box(154, 112, 72, 80, 'none', ' stroke="var(--line-strong)" stroke-width="1.6" rx="5"')
    + box(184, 144, 12, 12, 'var(--ink-soft)', ' rx="2"') + '<path d="M186 144 L186 139 Q190 134 194 139 L194 144" fill="none" stroke="var(--ink-soft)" stroke-width="2"/>'
    + '<circle cx="222" cy="120" r="8" fill="var(--moss)"/>' + line('M218 120 L221 123 L226 116', 'var(--paper-raised)', 2)
    // inspections: a clipboard with ticks on a stand
    + line('M306 178 L306 200', 'var(--ink-soft)', 3) + line('M294 200 L318 200', 'var(--ink-soft)', 3)
    + box(290, 126, 32, 52, 'var(--paper)', ' stroke="var(--ink-soft)" stroke-width="2" rx="3"') + box(299, 122, 14, 7, 'var(--ink-soft)', ' rx="2"')
    + line('M296 140 L299 143 L304 137', 'var(--moss)', 2) + line('M308 140 L316 140', 'var(--line-strong)', 2)
    + line('M296 154 L299 157 L304 151', 'var(--moss)', 2) + line('M308 154 L316 154', 'var(--line-strong)', 2)
    + line('M296 168 L299 171 L304 165', 'var(--moss)', 2) + line('M308 168 L316 168', 'var(--line-strong)', 2)
    + '</svg>',
};
