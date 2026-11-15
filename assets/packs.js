/* ==========================================================================
   Skelvo Stream — packs assortis.
   Un pack = un fond (assets/bg/<id>.webp) + les couleurs du contour caméra
   (c1, c2, c3) + un thème complet pour tous les overlays. Choisir un pack
   règle tout d'un coup, sous le même nom, pour que tout aille ensemble.
   Chargé AVANT app.js dans les pages éditeur.
   ========================================================================== */
window.SK_PACKS = [
  { id: 'lavande', label: 'Lavande', light: false,
    c: ['a78bfa', '67e8f9', 'c4b5fd'],
    t: { font: 'sora', fw: '700', tx: 'ffffff', ac: 'c4b5fd', ac2: '67e8f9', sk: 'glass', sf: '1b1530', so: '55', rad: '50', bw: '1', bc: 'c4b5fd', bo: '25', sh: '30', shs: 'soft', gl: '10', up: '0' } },
  { id: 'glace', label: 'Glace', light: true,
    c: ['e0f2fe', '7dd3fc', 'a5b4fc'],
    t: { font: 'manrope', fw: '700', tx: '12324a', ac: '0ea5e9', ac2: '818cf8', sk: 'glass', sf: 'f2f9ff', so: '82', rad: '45', bw: '1', bc: 'ffffff', bo: '70', sh: '22', shs: 'soft', gl: '0', up: '0' } },
  { id: 'peche', label: 'Pêche', light: true,
    c: ['fdba74', 'fda4af', 'fde68a'],
    t: { font: 'outfit', fw: '700', tx: '4a2618', ac: 'f97352', ac2: 'fb923c', sk: 'solid', sf: 'fff4ec', so: '92', rad: '60', bw: '0', bc: 'ffffff', bo: '0', sh: '22', shs: 'soft', gl: '0', up: '0' } },
  { id: 'menthe', label: 'Menthe', light: true,
    c: ['6ee7b7', '5eead4', 'a7f3d0'],
    t: { font: 'outfit', fw: '700', tx: '05302a', ac: '10b981', ac2: '14b8a6', sk: 'solid', sf: 'effcf7', so: '92', rad: '55', bw: '0', bc: 'ffffff', bo: '0', sh: '20', shs: 'soft', gl: '0', up: '0' } },
  { id: 'or', label: 'Or', light: false,
    c: ['e8c77d', 'fff1c1', 'b08d4a'],
    t: { font: 'cormorant', fw: '700', tx: 'f5ecd7', ac: 'd8b46a', ac2: 'a07c3a', sk: 'solid', sf: '0a0907', so: '90', rad: '6', bw: '1', bc: 'd8b46a', bo: '45', sh: '40', shs: 'soft', gl: '0', up: '1' } },
  { id: 'argent', label: 'Argent', light: false,
    c: ['f4f4f5', 'a1a1aa', 'e4e4e7'],
    t: { font: 'archivo', fw: '700', tx: 'ffffff', ac: 'e4e4e7', ac2: 'a1a1aa', sk: 'gradient', sf: '18181b', so: '86', rad: '12', bw: '1', bc: 'ffffff', bo: '25', sh: '35', shs: 'soft', gl: '0', up: '1' } },
  { id: 'nuit', label: 'Nuit', light: false,
    c: ['818cf8', 'c084fc', '38bdf8'],
    t: { font: 'sora', fw: '700', tx: 'eef0ff', ac: '8b9bff', ac2: 'c3a6ff', sk: 'gradient', sf: '0d1020', so: '88', rad: '35', bw: '1', bc: '8b9bff', bo: '25', sh: '40', shs: 'soft', gl: '12', up: '0' } },
  { id: 'sakura', label: 'Sakura', light: true,
    c: ['fbcfe8', 'f9a8d4', 'e9d5ff'],
    t: { font: 'nunito', fw: '800', tx: '5b2140', ac: 'ec4899', ac2: 'f9a8d4', sk: 'solid', sf: 'fff5f9', so: '94', rad: '90', bw: '0', bc: 'ffffff', bo: '0', sh: '18', shs: 'soft', gl: '0', up: '0' } },
  { id: 'braise', label: 'Braise', light: false,
    c: ['f97316', 'ef4444', 'fbbf24'],
    t: { font: 'archivo', fw: '800', tx: 'fff7ed', ac: 'fb923c', ac2: 'ef4444', sk: 'solid', sf: '140804', so: '88', rad: '14', bw: '1', bc: 'fb923c', bo: '35', sh: '40', shs: 'soft', gl: '20', up: '1' } },
  { id: 'cyber', label: 'Cyber', light: false,
    c: ['22d3ee', 'e879f9', '818cf8'],
    t: { font: 'outfit', fw: '700', tx: 'ffffff', ac: '22d3ee', ac2: 'e879f9', sk: 'outline', sf: '05060a', so: '72', rad: '30', bw: '2', bc: '22d3ee', bo: '100', sh: '0', shs: 'soft', gl: '45', up: '0' } },
  { id: 'toxique', label: 'Toxique', light: false,
    c: ['a3e635', '4ade80', 'facc15'],
    t: { font: 'unbounded', fw: '700', tx: 'ffffff', ac: 'b6ff3b', ac2: 'facc15', sk: 'solid', sf: '0a0d06', so: '90', rad: '18', bw: '0', bc: 'ffffff', bo: '0', sh: '40', shs: 'soft', gl: '15', up: '1' } },
  { id: 'retro', label: 'Rétro', light: false,
    c: ['f472b6', 'a855f7', 'fbbf24'],
    t: { font: 'syne', fw: '800', tx: 'ffffff', ac: 'f472b6', ac2: 'fbbf24', sk: 'solid', sf: '1e0b33', so: '90', rad: '8', bw: '2', bc: 'f472b6', bo: '60', sh: '80', shs: 'hard', gl: '10', up: '1' } }
];
