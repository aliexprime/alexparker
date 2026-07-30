/* =============================================================================
   world.js — a set of small floating islands, rendered small and scaled up.

   The scene is real geometry with real lights and real shadows. It only looks
   like pixel art because it is rendered into a buffer a few hundred pixels wide
   and then blown up with nearest-neighbour scaling. Nothing here is a sprite.

   Layout: one island per section, arranged in a ring around a jar of sand that
   gains a grain for every visit. Each island is authored in its own local space
   where +z points OUT of the ring, then rotated into place — so whichever side
   you orbit to, you are looking at the front of something.

   Nothing is labelled until you select it. Selecting an island also wakes it
   up: screens start reading, platters spin, the heavy bag swings.
============================================================================= */

import * as THREE from "./vendor/three.module.min.js";
import { ZONES, JAR_ZONE, BOARD, CHEST, CLIPBOARD, CONTACT, SCREEN, MUSIC_LINK }
  from "./content.js";

/* ---- Palette ---------------------------------------------------------------
   Muted and warm, so a room full of colour still sits quietly on paper. */

const C = {
  baseDark:  0xb2aa9a,
  baseMid:   0xc7bfae,
  baseTop:   0xdfd8c8,
  edge:      0xa39a88,

  wood:      0xa87c4e,
  woodDark:  0x815c34,
  woodLight: 0xc2996a,
  metal:     0x9aa1a6,
  metalDark: 0x6b7276,
  brass:     0xc9a44c,
  white:     0xf2f1ec,
  paper:     0xfbfaf7,
  plant:     0x5f8a52,
  plantDark: 0x466b3d,
  plantStem: 0x4d7342,
  pot:       0xb9714f,
  potRim:    0xc98262,      // the rim standing proud of the pot
  potDark:   0x8f523a,      // and the saucer under it
  soil:      0x4a3a2c,
  fabric:    0xc3b096,

  rld:       0x2f9e7a,
  rldDark:   0x24785d,
  rldLight:  0x6fcaa6,
  clinFloor: 0xdde5e4,
  clinPanel: 0xbcd0d1,
  bedFrame:  0x99a2a7,
  mattress:  0xf0efea,
  blanket:   0x3a9e7f,
  blanket2:  0x2b7c62,
  screenTeal:0x6fd6ab,

  invFloor:  0xded7c7,
  vault:     0x878f94,
  vaultDark: 0x606870,
  safe:      0x495257,
  board:     0xf4f3ee,
  boardInk:  0x3f7f5f,
  boardInk2: 0x4a6f9e,
  money:     0x8fae7d,
  screenGrn: 0x8ed49a,

  matA:      0x9db2bd,
  matB:      0x8aa1ae,
  matTrim:   0x6f8592,
  bagLeather:0x8a5a45,
  bagDark:   0x6f4636,
  bagSeam:   0x5a3729,      // straps and stitching on the bag and the dummy
  beltWhite: 0xe8e5dc,
  beltBlack: 0x2f2c2a,
  gi:        0xe4e2da,

  deckBody:  0x4a4f55,
  platter:   0x9aa1a6,
  vinyl:     0x2b2926,
  /* Three greys a step apart, so the mixer reads as a made thing rather than a
     black hole between two decks: the case a shade lighter than a deck, the
     faceplate set into it darker, and the brow at the back darker again. */
  mixer:     0x525860,
  mixerFace: 0x3a4046,      // the faceplate the controls are set into
  mixerDark: 0x272b30,      // the brow at the back, standing the meters up
  knob:      0x9aa2a8,
  slot:      0x1c1f23,      // a fader's sunk channel
  speaker:   0x3f4348,
  speakerFace: 0x33373b,    // the baffle the drivers are set into
  cone:      0x8d7f6d,
  canShell:  0x33373b,      // headphone cup
  canPad:    0x55595e,      // and the pad inside it
  canTrim:   0x1d2023,
  ledCyan:   0x7fd6d0,
  ledAmber:  0xe8b95c,
  ledRed:    0xd8694e,      // the top of a meter, where you do not want to be

  // The two streaming icons on the mixer. Everything else in this palette is
  // muted to sit inside the world's own light, and these two are the one
  // deliberate exception — a badge is only worth building if it is recognised
  // at a glance, and that means the real brand colours, not a version of them
  // softened to match the room.
  soundcloud:     0xff5500,
  spotifyGreen:   0x1db954,
  spotifyMark:    0x0d1f14,  // the bars, near-black the way the real mark sits on the green

  leather:   0xa8402c,
  leatherDark: 0x7d2c1e,
  perfume:   0xd7b0c0,
  rug:       0xd0b995,
  chest:     0x9c6a3f,
  chestLid:  0x7f5330,
  toyRed:    0xd0685a,
  toyBlue:   0x5f8fc9,
  toyYellow: 0xe0b552,
  toyGreen:  0x7aa87a,
  toyPurple: 0x9078ae,

  aboutFloor:0xe2dbcb,
  rug2:      0xc0ac90,

  // The dog: a sandy ridgeback crossed with a kelpie, in a white bed. `dogPale`
  // is the lighter sand on his chin and the inside of his ears; `dogSock` is
  // the actual white, and only four paws and the tip of his tail get it.
  dog:       0xd0a468,
  dogMuzzle: 0xb98a4e,
  dogRidge:  0xba8b50,
  dogPale:   0xe3c99b,
  dogSock:   0xf4f0e6,
  dogNose:   0x332c27,
  bedRim:    0xfbfaf6,
  bedPad:    0xd9d5ca,

  lampGlow:  0xffe9b0,
  steam:     0xdfe4e6,

  glass:     0xcadde4,
  sand:      0xd7ae66,
  sandDark:  0xb9884a
};

const BOOKS = [0xb5553f, 0x4a7a8c, 0xc9a44c, 0x6b8f5e, 0x8a6b9e, 0xc2725e,
               0x5f7f9e, 0xa8894a, 0x7d9e6b, 0x9e5f5f];

/* ---- Geometry builder ------------------------------------------------------
   Static props are accumulated here and merged into one mesh per island, so the
   whole scene costs a couple of dozen draw calls. Anything that moves is built
   as its own small mesh instead. */

const _m = new THREE.Matrix4();
const _e = new THREE.Euler();
const _c = new THREE.Color();

/* Contact shade. Light never reaches the crease where an object meets the thing
   under it, and a renderer that only knows about a sun and a sky will happily
   light that crease as brightly as the rest. So the bottom of everything gets
   darkened into its own vertex colours as it is built — free at run time,
   because it is just the colour the vertex was always going to have.

   The falloff is a fixed distance rather than a fraction of the object, since
   this is a local effect: a wardrobe and a footstool have the same dark skirt
   at the floor, not skirts in proportion to themselves.

   Which is exactly why short things have to be left out of it. On something
   only a little taller than the falloff the skirt is not a skirt any more, it
   is a wash over the whole object — and a shelf of books, each one graded dark
   at the bottom and light at the top, reads as a second row of books standing
   behind the first. So an object has to be a good deal taller than the falloff
   before it gets one, which leaves books, papers, rugs and lettering flat. */
const AO_DROP = 0.2;             // how dark the very bottom goes
const AO_RISE = 0.22;            // and over what height it comes back up
const AO_MIN = AO_RISE * 2.6;    // shorter than this and it is a wash, not a skirt

class Builder {
  constructor() { this.p = []; this.n = []; this.c = []; }

  _add(geo, color, x, y, z, rx, ry, rz) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    _e.set(rx || 0, ry || 0, rz || 0);
    _m.makeRotationFromEuler(_e);
    _m.setPosition(x, y, z);
    g.applyMatrix4(_m);

    const pos = g.attributes.position.array;
    const nor = g.attributes.normal.array;
    _c.set(color);
    const r = _c.r, gr = _c.g, b = _c.b;

    let lo = Infinity, hi = -Infinity;
    for (let i = 1; i < pos.length; i += 3) {
      if (pos[i] < lo) lo = pos[i];
      if (pos[i] > hi) hi = pos[i];
    }
    const shade = hi - lo >= AO_MIN;

    for (let i = 0; i < pos.length; i += 3) {
      this.p.push(pos[i], pos[i + 1], pos[i + 2]);
      this.n.push(nor[i], nor[i + 1], nor[i + 2]);
      if (shade) {
        const up = Math.min(1, (pos[i + 1] - lo) / AO_RISE);
        const k = 1 - AO_DROP * (1 - up) * (1 - up);
        this.c.push(r * k, gr * k, b * k);
      } else {
        this.c.push(r, gr, b);
      }
    }
    g.dispose();
    return this;
  }

  /** Box where `y` is the BOTTOM face, optionally spun about Y. */
  box(x, y, z, w, h, d, color, ry) {
    return this._add(new THREE.BoxGeometry(w, h, d), color, x, y + h / 2, z, 0, ry, 0);
  }

  /** Box where `y` is the CENTRE, with a full rotation. */
  boxC(x, y, z, w, h, d, color, rx, ry, rz) {
    return this._add(new THREE.BoxGeometry(w, h, d), color, x, y, z, rx, ry, rz);
  }

  /** Upright cylinder, `y` is the bottom. Low segment counts read better. */
  cyl(x, y, z, rTop, rBot, h, seg, color) {
    return this._add(new THREE.CylinderGeometry(rTop, rBot, h, seg), color, x, y + h / 2, z, 0, 0, 0);
  }

  /** Cylinder with a free axis, `y` is the centre. */
  cylC(x, y, z, rTop, rBot, h, seg, color, rx, ry, rz) {
    return this._add(new THREE.CylinderGeometry(rTop, rBot, h, seg), color, x, y, z, rx, ry, rz);
  }

  cone(x, y, z, r, h, seg, color, rx, ry, rz) {
    return this._add(new THREE.ConeGeometry(r, h, seg), color, x, y, z, rx, ry, rz);
  }

  /** Faceted blob — plants, balls, anything that should not look smooth. */
  rock(x, y, z, r, color, detail) {
    return this._add(new THREE.IcosahedronGeometry(r, detail || 0), color, x, y, z, 0, 0, 0);
  }

  /** The same, stretched — for things that are oval rather than round. */
  rockS(x, y, z, r, color, detail, sx, sy, sz, rx, ry, rz) {
    const g = new THREE.IcosahedronGeometry(r, detail || 0);
    g.scale(sx, sy, sz);
    return this._add(g, color, x, y, z, rx, ry, rz);
  }

  get empty() { return this.p.length === 0; }

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.c, 3));
    g.computeBoundingSphere();
    return g;
  }
}

function solidMesh(builder) {
  const mesh = new THREE.Mesh(builder.geometry(), new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function glowMesh(builder) {
  return new THREE.Mesh(builder.geometry(), new THREE.MeshBasicMaterial({ vertexColors: true }));
}

/** A small standalone mesh for something that has to move. */
function part(fn, glow) {
  const b = new Builder();
  fn(b);
  return glow ? glowMesh(b) : solidMesh(b);
}

function rng(seed) {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

/** Local offset within a prop that has been spun by `ry`. */
function loc(x, z, ry, lx, lz) {
  return [x + Math.cos(ry) * lx + Math.sin(ry) * lz,
          z - Math.sin(ry) * lx + Math.cos(ry) * lz];
}

/* A 5x7 pixel font — fine enough that a whiteboard can hold a sentence and
   still be read once you zoom in on it. Rows run top to bottom. */
const FONT = {
  "0"  : "01110100011001110101110011000101110",
  "1"  : "00100011000010000100001000010001110",
  "2"  : "01110100010000100010001000100011111",
  "3"  : "11111000100010000010000011000101110",
  "4"  : "00010001100101010010111110001000010",
  "5"  : "11111100001111000001000011000101110",
  "6"  : "00110010001000011110100011000101110",
  "7"  : "11111000010001000100010000100001000",
  "8"  : "01110100011000101110100011000101110",
  "9"  : "01110100011000101111000010001001100",
  "A"  : "01110100011000111111100011000110001",
  "B"  : "11110100011000111110100011000111110",
  "C"  : "01110100011000010000100001000101110",
  "D"  : "11110100011000110001100011000111110",
  "E"  : "11111100001000011110100001000011111",
  "F"  : "11111100001000011110100001000010000",
  "G"  : "01110100011000010111100011000101111",
  "H"  : "10001100011000111111100011000110001",
  "I"  : "11111001000010000100001000010011111",
  "J"  : "00111000100001000010000101001001100",
  "K"  : "10001100101010011000101001001010001",
  "L"  : "10000100001000010000100001000011111",
  "M"  : "10001110111010110101100011000110001",
  "N"  : "10001110011010110011100011000110001",
  "O"  : "01110100011000110001100011000101110",
  "P"  : "11110100011000111110100001000010000",
  "Q"  : "01110100011000110001101011001001101",
  "R"  : "11110100011000111110101001001010001",
  "S"  : "01111100001000001110000010000111110",
  "T"  : "11111001000010000100001000010000100",
  "U"  : "10001100011000110001100011000101110",
  "V"  : "10001100011000110001100010101000100",
  "W"  : "10001100011000110101101011101110001",
  "X"  : "10001100010101000100010101000110001",
  "Y"  : "10001100010101000100001000010000100",
  "Z"  : "11111000010001000100010001000011111",
  " "  : "00000000000000000000000000000000000",
  "!"  : "00100001000010000100001000000000100",
  ","  : "00000000000000000000011000010001000",
  "-"  : "00000000000000011111000000000000000",
  "."  : "00000000000000000000000000110001100",
  "="  : "00000000001111100000111110000000000",
  "?"  : "01110100010000100010001000000000100",
  "&"  : "01100100101001001100101011001001101",
  "/"  : "00001000100010001000100001000010000",
  ":"  : "00000011000110000000011000110000000",
  "'"  : "00100001000100000000000000000000000",
  "+"  : "00000001000010011111001000010000000",
  "%"  : "11001110100001000100010000101110011",
  "$"  : "00100011111010001110001011111000100",
  "@"  : "01110100011011110101101111000001110",
  "("  : "00010001000100001000010000100000010",
  ")"  : "01000001000001000010000100010001000",
};
const GLYPH_W = 5, GLYPH_H = 7;

/** Width of a string once drawn, without the trailing gap after the last
    character. Everything that centres or fits text measures with this. */
function textWidth(str, px) {
  return str.length ? str.length * px * (GLYPH_W + 1) - px : 0;
}

/** Write `str` on a surface facing +z: characters advance along +x, rows down.
    Every scene faces +z out of the ring, so this is the readable direction. */
function textXY(b, str, x0, yTop, z, px, color) {
  let x = x0;
  for (const ch of str.toUpperCase()) {
    const glyph = FONT[ch];
    if (glyph) {
      for (let r = 0; r < GLYPH_H; r++) {
        for (let c = 0; c < GLYPH_W; c++) {
          if (glyph[r * GLYPH_W + c] === "1") {
            b.box(x + c * px, yTop - (r + 1) * px, z, px, px, 0.022, color);
          }
        }
      }
    }
    x += px * (GLYPH_W + 1);
  }
  return x;
}

/** Break a line so it fits a given number of characters. */
function wrapText(str, max) {
  const out = [];
  let cur = "";
  for (const w of str.split(" ")) {
    if (!cur) cur = w;
    else if ((cur + " " + w).length <= max) cur += " " + w;
    else { out.push(cur); cur = w; }
  }
  if (cur) out.push(cur);
  return out;
}

/** The same as textXY, centred on `cx` rather than run from a left margin. */
function textMid(b, str, cx, yTop, z, px, color) {
  return textXY(b, str, cx - textWidth(str, px) / 2, yTop, z, px, color);
}

/** Stand a pixel sprite up in the XY plane, centred on the origin and facing
    +z like everything else here. `rows` is the picture written out top down,
    one character per pixel, and `key` says what colour each character means —
    anything not in `key` is a hole.

    One box per horizontal RUN rather than one per pixel. What makes a sprite
    read as pixel art is its stepped outline, and inside a run of the same
    colour the cube faces are coplanar and identically lit, so a row of little
    cubes and one long box are the same picture — the run costs a fortieth of
    the geometry for it. Each box is a single pixel tall, well under AO_MIN, so
    none of them pick up a contact skirt and the colours stay flat. */
function sprite(b, rows, key, px, depth) {
  const w = rows.reduce(function (m, r) { return Math.max(m, r.length); }, 0);
  const x0 = -w * px / 2, yTop = rows.length * px / 2;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    let c = 0;
    while (c < row.length) {
      const ch = row[c];
      if (!(ch in key)) { c++; continue; }
      let end = c;
      while (end + 1 < row.length && row[end + 1] === ch) end++;
      const n = end - c + 1;
      b.boxC(x0 + (c + n / 2) * px, yTop - (r + 0.5) * px, 0,
             n * px, px, depth, key[ch]);
      c = end + 1;
    }
  }
  return b;
}

/* ---- Cards ------------------------------------------------------------------

   A small printed plate with a heading, a rule and a few short lines, drawn
   into whatever mesh you hand it. Nothing in the world is labelled from the
   outside — the scenes say what they are by what is in them — so the only
   thing that uses this is the card that comes up beside an object in the toy
   chest, where a project's name genuinely has nowhere else to live.

   Sized from its own text, so nothing ever overflows the plate. */

const SIGN_PLATE = 0xf1ede3, SIGN_FRAME = 0x3c443f;
const SIGN_TITLE = 0x2b322e, SIGN_LINE = 0x6d766f;

function signBoard(b, x, yBottom, z, title, lines, o) {
  o = o || {};
  const tp = o.titlePx || 0.05;             // title pixel
  const lp = o.linePx || 0.028;             // body pixel
  const pad = o.pad === undefined ? 0.17 : o.pad;
  const titleH = GLYPH_H * tp, bodyH = GLYPH_H * lp;
  const lineH = bodyH * 1.75;
  const gap = lineH * 0.62;

  let inner = textWidth(title, tp);
  for (const l of lines) inner = Math.max(inner, textWidth(l, lp));
  const w = inner + pad * 2;
  const h = pad * 2 + titleH +
            (lines.length ? gap + (lines.length - 1) * lineH + bodyH : 0);

  b.box(x, yBottom, z, w + 0.09, h + 0.09, 0.06, o.frame || SIGN_FRAME);
  b.box(x, yBottom + 0.045, z + 0.03, w, h, 0.04, o.plate || SIGN_PLATE);

  const fz = z + 0.058;
  let row = yBottom + 0.045 + h - pad;
  textMid(b, title, x, row, fz, tp, o.title || SIGN_TITLE);
  row -= titleH;
  if (lines.length) {
    b.box(x, row - gap / 2, fz, inner, tp * 0.5, 0.02, o.title || SIGN_TITLE);
    row -= gap;
    for (const l of lines) {
      textMid(b, l, x, row, fz, lp, o.line || SIGN_LINE);
      row -= lineH;
    }
  }
  return { w: w, h: h + 0.09 };
}

/* A frequency that changes over time has to be integrated, never multiplied
   into t. `Math.sin(t * f)` jumps by `t * delta-f` the instant f changes: barely
   visible in the first few seconds and violent a few minutes in, which is what
   made the dog judder and the vitals trace tear. Accumulate instead. */
function phaser(start) {
  let p = start || 0;
  return function (dt, freq) { p += dt * freq; return p; };
}

function hash1(n) {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

/** Smooth pseudo-random walk, for charts and meters that should look alive. */
function walk(k) {
  const i = Math.floor(k), f = k - i;
  const a = hash1(i), b = hash1(i + 1);
  return a + (b - a) * (f * f * (3 - 2 * f));
}

/* =============================================================================
   Islands
============================================================================= */

const F = 0.35;           // the top surface of an island: props sit on this
// How far a selected island floats above the ring. Focus targets are measured
// off the geometry, which is authored before the float, so both need this.
const FOCUS_LIFT = 0.2;
const ISLAND = 7.2;

/** A floating slab, stepped underneath so it reads as an object not a plane. */
function island(b, size, topColor) {
  b.box(0, F - 0.07, 0, size, 0.07, size, topColor);
  b.box(0, F - 0.58, 0, size, 0.51, size, C.baseTop);
  b.box(0, F - 0.96, 0, size - 0.9, 0.38, size - 0.9, C.baseMid);
  b.box(0, F - 1.28, 0, size - 2.5, 0.32, size - 2.5, C.baseDark);
  b.box(0, F - 1.52, 0, size - 4.4, 0.24, size - 4.4, C.edge);
}

/* ---- Shared props ---------------------------------------------------------- */

/** A bookcase with an actual cavity, so the books are visible inside it. */
function shelf(b, x, z, w, h, ry, seed) {
  const d = 0.42, t = 0.06;
  const [bxp, bzp] = loc(x, z, ry, 0, -d / 2 + t / 2);
  b.box(bxp, F, bzp, w, h, t, C.woodDark, ry);
  for (const side of [-1, 1]) {
    const [sx, sz] = loc(x, z, ry, side * (w / 2 - t / 2), 0);
    b.box(sx, F, sz, t, h, d, C.wood, ry);
  }
  b.box(x, F + h - t, z, w, t, d, C.wood, ry);
  b.box(x, F, z, w, t, d, C.woodDark, ry);

  const r = rng(seed);
  const rows = Math.max(2, Math.round(h / 0.52));
  const gap = (h - 0.14) / rows;
  for (let i = 1; i <= rows; i++) {
    if (i < rows) b.box(x, F + 0.06 + i * gap, z, w - 2 * t, t, d - 0.06, C.wood, ry);
    const shelfY = F + 0.06 + (i - 1) * gap + t;
    const cap = shelfY + gap - t - 0.04;
    /* Books deep enough to reach the back panel. Standing 0.05 clear of it,
       each one threw a shadow of its own size and shape onto the panel behind,
       and a row of book-then-dark-book-shaped-hole reads as two rows of books.
       Evening out the heights does the rest: the less panel showing over the
       top of a short book, the less there is for a tall one to cast onto. */
    let bx = -w / 2 + t + 0.05;
    while (bx < w / 2 - t - 0.12) {
      const bw = 0.055 + r() * 0.055;
      const bh = Math.min(0.34, gap - 0.12) * (0.82 + r() * 0.18);
      if (r() > 0.09 && shelfY + bh < cap + 0.12) {
        const [px, pz] = loc(x, z, ry, bx + bw / 2, 0.0);
        b.box(px, shelfY, pz, bw, bh, 0.28, BOOKS[(r() * BOOKS.length) | 0], ry);
      }
      bx += bw + 0.012;
    }
  }
}

/* ---- Books off a shelf ------------------------------------------------------

   A bookcase is the one thing in a room that has an obvious thing to do: knock
   it and books come out. Each one gets a small pool of loose books that start
   tucked inside the case and are thrown out on the shelf's own facing when it
   is touched. They fall under gravity, tumble, and lie where they land. Touch
   it again and the same books go again — the pool never grows.

   `ry` is the shelf's rotation, so local +z is the way it faces. */
function bookSpill(group, x, z, ry, w, h, seed) {
  const r = rng(seed);
  const books = [];
  const fwd = [Math.sin(ry), 0, Math.cos(ry)];       // local +z, in world terms
  const side = [Math.cos(ry), 0, -Math.sin(ry)];     // local +x

  for (let i = 0; i < 5; i++) {
    const bw = 0.07 + r() * 0.05, bh = 0.2 + r() * 0.1;
    const m = part(function (b) {
      b.box(-bw / 2, -bh / 2, -0.12, bw, bh, 0.24, BOOKS[(r() * BOOKS.length) | 0]);
      b.box(-bw / 2 + 0.012, -bh / 2 + 0.01, -0.115, bw - 0.024, bh - 0.02, 0.235, C.paper);
    });
    m.visible = false;
    group.add(m);
    books.push({
      m: m,
      half: bh / 2,
      lx: (r() - 0.4) * (w - 0.3),                   // which slot it comes from
      ly: 0.35 + r() * (h - 0.7),
      out: 0.55 + r() * 0.85,                        // how hard it is thrown
      drift: (r() - 0.5) * 0.7,
      up: 1.1 + r() * 1.1,
      spin: (r() - 0.5) * 9,
      tumble: 3 + r() * 5,
      delay: i * 0.07 + r() * 0.06,
      t: 0, live: false
    });
  }

  function throwOut() {
    for (const b of books) { b.t = -b.delay; b.live = true; b.m.visible = false; }
    touched();
  }

  function update(dt) {
    for (const b of books) {
      if (!b.live) continue;
      b.t += dt;
      if (b.t < 0) continue;
      b.m.visible = true;
      // Straight out of the case, falling, until it reaches the floor.
      const y = F + b.ly + b.up * b.t - 4.6 * b.t * b.t;
      const rest = F + 0.02 + b.half * 0.55;
      const d = b.out * b.t;
      const s = b.drift * b.t;
      b.m.position.set(
        x + fwd[0] * (0.24 + d) + side[0] * (b.lx + s),
        Math.max(rest, y),
        z + fwd[2] * (0.24 + d) + side[2] * (b.lx + s)
      );
      if (y <= rest) {
        // Landed: lie flat, and stop.
        b.m.rotation.set(Math.PI / 2, b.spin, 0);
        b.live = false;
      } else {
        b.m.rotation.set(b.tumble * b.t, b.spin * b.t * 0.4, b.tumble * 0.6 * b.t);
      }
    }
  }

  return { throwOut: throwOut, update: update };
}

/* There is one of these in nearly every room, which is why it is worth more
   than the three blobs on a spike it used to be. A blob is what an
   icosahedron looks like when nothing tells you it is a plant.

   What makes it read now is that the parts are the parts a plant has: a pot
   that tapers with a rim standing off it and a saucer under it, soil you can
   see, a stem going up out of the soil, and leaves arranged in tiers around
   that stem, each tier wider and lower than the one above. `seed` turns the
   tiers so that no two plants in the world are the same plant. */
function pottedPlant(b, x, z, scale, seed) {
  const s = scale || 1;
  const r = rng(seed === undefined ? 7 : seed);

  // Saucer, pot, rim. The rim is a separate ring standing proud of the pot,
  // which is the single detail that stops it reading as a paper cup.
  b.cyl(x, F, z, 0.21 * s, 0.19 * s, 0.025 * s, 10, C.potDark);
  b.cyl(x, F + 0.025 * s, z, 0.185 * s, 0.135 * s, 0.235 * s, 10, C.pot);
  b.cyl(x, F + 0.235 * s, z, 0.2 * s, 0.195 * s, 0.045 * s, 10, C.potRim);
  b.cyl(x, F + 0.24 * s, z, 0.17 * s, 0.17 * s, 0.02 * s, 10, C.soil);

  // Stem, slightly off vertical, because nothing grows plumb.
  const lean = (r() - 0.5) * 0.16;
  b.boxC(x + lean * 0.2 * s, F + 0.42 * s, z, 0.045 * s, 0.34 * s, 0.045 * s,
         C.plantStem, 0, 0, lean);

  /* Leaves in three tiers. Each leaf is a flattened blob tipped away from the
     stem, so a tier reads as a spray rather than a ball, and the tiers step
     outward going down the way foliage does. */
  const tiers = [
    { y: 0.78, out: 0.10, n: 3, size: 0.115, col: C.plant },
    { y: 0.63, out: 0.19, n: 4, size: 0.145, col: C.plantDark },
    { y: 0.50, out: 0.26, n: 5, size: 0.13,  col: C.plant }
  ];
  let turn = r() * Math.PI * 2;
  for (const t of tiers) {
    for (let i = 0; i < t.n; i++) {
      const a = turn + (i / t.n) * Math.PI * 2;
      const lx = Math.cos(a) * t.out * s, lz = Math.sin(a) * t.out * s;
      const jy = (r() - 0.5) * 0.04 * s;
      b.rockS(x + lx, F + t.y * s + jy, z + lz, t.size * s, t.col, 0,
              1.25, 0.5, 1.25, 0, -a, 0.34);
    }
    turn += 0.7;                      // offset each tier off the one above it
  }
  // A bud at the very top, so the stem has somewhere to end.
  b.rockS(x + lean * 0.35 * s, F + 0.86 * s, z, 0.085 * s, C.plant, 0,
          1, 1.15, 1, 0, 0, 0);
}

function crate(b, x, y, z, s, ry) {
  b.box(x, y, z, s, s, s, C.wood, ry);
  b.box(x, y + s * 0.46, z, s * 1.02, s * 0.07, s * 1.02, C.woodDark, ry);
  b.box(x, y + s * 0.02, z, s * 1.02, s * 0.07, s * 1.02, C.woodDark, ry);
}

function chair(b, x, z, ry, color) {
  const seat = 0.44;
  b.box(x, F + seat, z, 0.48, 0.08, 0.48, color, ry);
  for (const [lx, lz] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) {
    const [px, pz] = loc(x, z, ry, lx, lz);
    b.box(px, F, pz, 0.06, seat, 0.06, C.woodDark);
  }
  const [bx, bz] = loc(x, z, ry, 0, -0.21);
  b.box(bx, F + seat + 0.08, bz, 0.48, 0.5, 0.06, color, ry);
}

function desk(b, x, z, w, d, ry, color) {
  const h = 0.72;
  b.box(x, F + h, z, w, 0.08, d, color, ry);
  for (const [lx, lz] of [[-w / 2 + 0.1, -d / 2 + 0.1], [w / 2 - 0.1, -d / 2 + 0.1],
                          [-w / 2 + 0.1, d / 2 - 0.1], [w / 2 - 0.1, d / 2 - 0.1]]) {
    const [px, pz] = loc(x, z, ry, lx, lz);
    b.box(px, F, pz, 0.08, h, 0.08, C.woodDark);
  }
  return F + h + 0.08;
}

/** A screen on a stand. Returns the y of the bottom of the lit panel. */
function monitor(b, g, x, y, z, w, h, ry, screenColor) {
  b.box(x, y, z, 0.26, 0.05, 0.18, C.metalDark, ry);
  b.box(x, y + 0.05, z, 0.06, 0.2, 0.06, C.metalDark, ry);
  b.box(x, y + 0.25, z, w, h, 0.05, C.metal, ry);
  const [fx, fz] = loc(x, z, ry, 0, 0.031);
  g.box(fx, y + 0.28, fz, w - 0.07, h - 0.06, 0.012, screenColor, ry);
  return y + 0.28;
}

/* =============================================================================
   Section: RLDatix
============================================================================= */

const BED_X = -0.35, BED_Z = 0.15;
// Centre of the chart hanging off the footboard — also where the camera aims
// when you tap it, so the geometry and the focus target can never drift apart.
// The four rows on it are tap targets too, hence their own two constants.
const CHART_Y = F + 0.42;
const CHART_ROW_Y = F + 0.43;
const CHART_ROW_STEP = 0.085;
// Where the head end of the bed hinges, and how far it sits up.
const BED_HINGE_Z = BED_Z - 0.32, BED_HINGE_Y = F + 0.54;

function buildRLDatix(b, g) {
  island(b, ISLAND, C.clinFloor);

  const bx = BED_X, bz = BED_Z;
  const frameY = F + 0.44;

  // Low headwall: reads as a bay without walling the scene off.
  b.box(bx, F, bz - 1.62, 2.7, 0.86, 0.14, C.clinPanel);
  b.box(bx, F + 0.86, bz - 1.62, 2.8, 0.19, 0.2, C.rld);
  b.box(bx, F + 0.84, bz - 1.62, 2.8, 0.03, 0.21, C.rldDark);
  textXY(b, "RLDATIX", bx - 0.46, F + 1.02, bz - 1.36, 0.022, C.paper);
  b.box(bx + 0.95, F + 0.5, bz - 1.5, 0.56, 0.4, 0.1, C.white);
  g.box(bx + 0.95, F + 0.56, bz - 1.44, 0.46, 0.28, 0.02, 0x123c31);
  b.box(bx - 0.9, F + 0.52, bz - 1.5, 0.4, 0.28, 0.1, 0xdfe9e0);
  b.box(bx - 0.9, F + 0.6, bz - 1.44, 0.09, 0.09, 0.04, C.metal);
  b.box(bx - 0.74, F + 0.6, bz - 1.44, 0.09, 0.09, 0.04, C.metal);

  for (const [lx, lz] of [[-0.45, -1.0], [0.45, -1.0], [-0.45, 1.0], [0.45, 1.0]]) {
    b.box(bx + lx, F, bz + lz, 0.08, 0.44, 0.08, C.metalDark);
  }
  b.box(bx, frameY, bz, 1.06, 0.1, 2.24, C.bedFrame);
  b.box(bx, frameY + 0.1, bz + 0.35, 1.0, 0.17, 1.5, C.mattress);
  // The head end articulates — see animRLDatix — so it is not drawn here.
  b.box(bx, frameY + 0.27, bz + 0.62, 1.02, 0.07, 1.0, C.blanket);
  b.box(bx, frameY + 0.27, bz + 1.06, 1.02, 0.09, 0.16, C.blanket2);
  b.box(bx, frameY, bz - 1.2, 1.06, 0.5, 0.07, C.metal);
  b.box(bx, frameY, bz + 1.2, 1.06, 0.36, 0.07, C.metal);
  b.box(bx - 0.55, frameY + 0.16, bz + 0.2, 0.05, 0.26, 1.3, C.metal);
  b.box(bx + 0.55, frameY + 0.16, bz + 0.2, 0.05, 0.26, 1.3, C.metal);
  // The chart hanging off the end of the bed. Everything it says is written on
  // the paper — there is no panel to put it in — and each of the four rows is
  // its own tap target once the chart fills the screen.
  const cbY = CHART_Y - 0.41, cz = bz + 1.42;
  b.box(bx, cbY, bz + 1.4, 0.78, 0.82, 0.03, C.woodDark);
  b.box(bx, cbY + 0.04, cz, 0.7, 0.7, 0.02, C.paper);
  b.box(bx, cbY + 0.65, cz, 0.7, 0.09, 0.025, C.rld);
  b.box(bx, cbY + 0.76, bz + 1.4, 0.26, 0.09, 0.07, C.metal);
  textMid(b, CLIPBOARD.brand, bx, cbY + 0.72, cz + 0.023, 0.009, C.paper);
  textMid(b, CLIPBOARD.title, bx, cbY + 0.615, cz + 0.018, 0.0075, 0x2c3532);
  textMid(b, CLIPBOARD.title2, bx, cbY + 0.545, cz + 0.018, 0.0075, 0x2c3532);
  b.box(bx, cbY + 0.475, cz + 0.018, 0.62, 0.011, 0.012, C.rld);

  CLIPBOARD.lines.forEach(function (line, i) {
    const ry = cbY + 0.44 - i * CHART_ROW_STEP;
    b.box(bx - 0.24, ry - 0.036, cz + 0.015, 0.034, 0.034, 0.012, 0xb4bcb9);
    b.box(bx - 0.24, ry - 0.031, cz + 0.02, 0.022, 0.022, 0.012, C.rld);
    textXY(b, line, bx - 0.2, ry, cz + 0.018, 0.0058, 0x4a5250);
  });
  textMid(b, CLIPBOARD.foot, bx, cbY + 0.115, cz + 0.018, 0.0062, 0x8d9793);

  // IV pole.
  b.box(bx - 1.35, F, bz - 0.5, 0.3, 0.05, 0.3, C.metalDark);
  b.cyl(bx - 1.35, F + 0.05, bz - 0.5, 0.035, 0.035, 1.55, 6, C.metal);
  b.box(bx - 1.35, F + 1.3, bz - 0.5, 0.24, 0.3, 0.08, 0xdfe9e0);
  b.box(bx - 1.35, F + 1.57, bz - 0.5, 0.3, 0.04, 0.1, C.metal);

  // Workstation on wheels.
  b.box(2.15, F + 0.02, 1.35, 0.62, 0.7, 0.5, C.white, -0.4);
  b.box(2.15, F, 1.35, 0.5, 0.06, 0.4, C.metalDark, -0.4);
  monitor(b, g, 2.15, F + 0.72, 1.35, 0.62, 0.44, -0.4, 0x15453a);
  b.box(2.15, F + 0.72, 1.58, 0.44, 0.03, 0.16, 0xd6d6d0, -0.4);

  // Tall things live on the side edges only.
  b.box(-2.95, F, -0.7, 0.85, 1.7, 0.55, C.white);
  b.box(-2.95, F + 0.05, -0.42, 0.72, 0.5, 0.04, 0xdde6e7);
  b.box(-2.95, F + 1.15, -0.42, 0.72, 0.44, 0.04, 0xdde6e7);
  b.box(-2.68, F + 0.28, -0.4, 0.1, 0.05, 0.05, C.metal);
  // The middle drawer slides out — see animRLDatix.

  b.box(2.95, F, -0.9, 0.62, 0.86, 1.9, C.white);
  b.box(2.95, F + 0.86, -0.9, 0.7, 0.08, 2.0, 0xe4ebec);
  b.box(2.95, F + 0.94, -1.5, 0.34, 0.08, 0.42, 0xc8d6d7);
  b.box(2.8, F + 0.94, -1.72, 0.05, 0.24, 0.05, C.metal);

  b.cyl(-2.2, F, 1.5, 0.24, 0.2, 0.42, 8, C.metal);
  b.cyl(-2.2, F + 0.42, 1.5, 0.26, 0.26, 0.07, 8, C.blanket);
  b.cyl(2.5, F, -2.6, 0.2, 0.17, 0.42, 8, 0xd5dcdc);
  pottedPlant(b, -2.9, 2.3, 1.0, 3);
}

/** A trace that is mostly flat, with the one spike that matters. */
function ecgWave(p) {
  p -= Math.floor(p);
  if (p < 0.40) return 0;
  if (p < 0.46) return -0.22;
  if (p < 0.53) return 1.0;
  if (p < 0.58) return -0.45;
  if (p < 0.68) return 0.18;
  return 0;
}

let raiseBed = null, spikeVitals = null;
let openDrawer = null, runDrip = null, reshuffleDash = null;

function animRLDatix(group) {
  const ups = [];

  // The head end of the bed, on its hinge. Touch the bed and it sits up.
  const back = new THREE.Group();
  back.position.set(BED_X, BED_HINGE_Y, BED_HINGE_Z);
  group.add(back);
  // Measured off the hinge, which sits at the base of the mattress, so these
  // land exactly where the flat bed used to be drawn.
  back.add(part(function (b) {
    b.box(0, 0, -0.3, 1.0, 0.2, 0.62, C.mattress);
    b.box(0, 0.2, -0.6, 1.0, 0.18, 0.42, C.mattress);
    b.box(0, 0.38, -0.68, 0.66, 0.1, 0.3, C.paper);
  }));

  let bedUp = 0, bedTo = 0;
  raiseBed = function () { bedTo = bedTo > 0.5 ? 0 : 1; touched(); };
  ups.push(function (t, dt) {
    bedUp += (bedTo - bedUp) * (1 - Math.pow(0.02, dt));
    back.rotation.x = bedUp * 0.62;
  });

  // Vitals trace on the headwall, travelling right to left.
  const trace = new THREE.Group();
  trace.position.set(BED_X + 0.95, F + 0.70, BED_Z - 1.428);
  group.add(trace);
  const bars = [];
  for (let i = 0; i < 8; i++) {
    const m = part(b => b.box(0, -0.018, 0, 0.05, 0.036, 0.012, C.screenTeal), true);
    m.position.x = -0.19 + i * 0.054;
    trace.add(m);
    bars.push(m);
  }
  // The middle drawer of the supply cabinet eases out when the ward is awake.
  const drawer = part(function (b) {
    b.box(-2.95, F + 0.6, -0.42, 0.72, 0.5, 0.04, 0xdde6e7);
    b.box(-2.68, F + 0.83, -0.4, 0.1, 0.05, 0.05, C.metal);
    b.box(-2.95, F + 0.62, -0.58, 0.66, 0.42, 0.3, 0xeef3f2);   // the tray behind it
    b.box(-2.95, F + 0.66, -0.6, 0.5, 0.1, 0.2, 0xc9d6d8);      // and what is in it
  });
  group.add(drawer);
  let drawerOut = 0, drawerTo = -1;      // -1 = follow the room, 0/1 = held
  openDrawer = function () { drawerTo = drawerTo > 0.5 ? 0 : 1; touched(); };
  ups.push(function (t, dt, amt, idle) {
    const a = Math.max(amt, idle);
    const want2 = drawerTo < 0 ? a * (0.6 + Math.sin(t * 0.9) * 0.2) : drawerTo;
    drawerOut += (want2 - drawerOut) * (1 - Math.pow(0.01, dt));
    drawer.position.z = drawerOut * 0.34;
  });

  // Touching the monitor runs the trace hot for a few seconds. A resting
  // 66 bpm, up to about 110 when it is pushed.
  let spike = 0;
  spikeVitals = function () { spike = 1; touched(); };
  const pBeat = phaser();
  ups.push(function (t, dt, amt, idle) {
    spike = Math.max(0, spike - dt * 0.22);
    const a = Math.min(1, Math.max(amt, idle) + spike);
    const beat = pBeat(dt, 1.1 + spike * 0.75);
    for (let i = 0; i < bars.length; i++) {
      bars[i].position.y = ecgWave(beat - i * 0.055) * (0.10 + spike * 0.05) * a;
    }
  });

  // A drip working its way down the line. Touch the pole and it runs faster
  // for a while.
  const drop = part(b => b.box(0, -0.025, 0, 0.045, 0.05, 0.045, 0xbcd6e0));
  drop.castShadow = false;
  group.add(drop);
  let fast = 0;
  runDrip = function () { fast = 1; touched(); };
  const pDrip = phaser();
  ups.push(function (t, dt, amt, idle) {
    fast = Math.max(0, fast - dt * 0.14);
    drop.visible = Math.min(1, Math.max(amt, idle) + fast) > 0.4;
    const p = pDrip(dt, 0.75 + fast * 2.6) % 1;
    if (!drop.visible) return;
    drop.position.set(BED_X - 1.35, F + 1.28 - p * 0.52, BED_Z - 0.5);
  });

  // Dashboard on the workstation.
  const dash = new THREE.Group();
  dash.position.set(2.15, F + 1.03, 1.35);
  dash.rotation.y = -0.4;
  group.add(dash);
  const dashBars = [];
  for (let i = 0; i < 5; i++) {
    const m = part(b => b.box(0, 0, 0, 0.06, 1, 0.012, C.screenTeal), true);
    m.position.set(-0.2 + i * 0.1, 0, 0.033);
    dash.add(m);
    dashBars.push(m);
  }
  // Touching the workstation redraws the dashboard on a fresh set of numbers.
  let seed = 0, shuffle = 0;
  reshuffleDash = function () { seed += 37.4; shuffle = 1; touched(); };
  ups.push(function (t, dt, amt, idle) {
    shuffle = Math.max(0, shuffle - dt * 0.8);
    const a = Math.max(amt, idle);
    for (let i = 0; i < dashBars.length; i++) {
      const h = 0.05 + walk(t * 0.5 + seed + i * 3.7) * 0.26;
      // A quick flicker as the new figures come in.
      dashBars[i].scale.y = 0.04 + h * a * (1 - shuffle * 0.8 * ((i + Math.floor(shuffle * 9)) % 2));
    }
  });

  return ups;
}

/* =============================================================================
   Section: Investing
============================================================================= */

// The board is big enough, and specific enough, to be worth looking at on its
// own — so its geometry is described here and picked up as a focus target.
const BOARD_X = 1.65, BOARD_Z = -2.95, BOARD_W = 3.5, BOARD_H = 2.15;
const BOARD_Y = F + 1.55;

/* Both doors swing, so both boxes are shells with something inside, and the
   doors themselves are separate meshes built in animInvesting. Hinged on their
   right-hand edge, which is the side with room to swing into. */
const VAULT_X = -2.55, VAULT_Z = -0.9;
/* The safe used to stand at (-2.5, 1.15), directly in front of the vault and
   hiding most of it. It moves to the right of the desk, where it has the corner
   to itself. Its door swings out on +z through about 83 degrees, so it also has
   to sit far enough back that the open door clears the coin table at z = 1.22. */
const SAFE_X = 2.4, SAFE_Z = -0.25;

/* The screen on the desk, the other thing here worth looking at on its own.
   These follow from what monitor() draws, so they and the geometry can never
   drift: the lit panel starts 0.28 above the desk and is inset from the bezel. */
const SCR_X = 0.15, SCR_W = 0.95, SCR_H = 0.64;
const SCR_Y = F + 0.8 + 0.28 + SCR_H / 2;
const SCR_Z = 0.593;
const CHART_Y0 = SCR_Y - SCR_H / 2 + 0.09;   // where the curve stands
const CHART_H = 0.42;                         // and how tall it gets

/* One equity curve, written down rather than rolled: a grind up, a drawdown
   that takes back most of it, then a recovery to a new high. The same shape
   every time, because the point of it is the shape. */
function equity(u) {
  const trend = Math.pow(u, 1.25);
  const dip = -0.5 * Math.exp(-Math.pow((u - 0.6) / 0.1, 2));
  const wob = Math.sin(u * 23) * 0.03 + Math.sin(u * 51 + 1.1) * 0.016;
  return Math.max(0.03, trend + dip + wob + 0.06);
}

function buildInvesting(b, g) {
  island(b, ISLAND, C.invFloor);

  // The vault: a shell with something inside it, because the door opens.
  const vx = VAULT_X, vz = VAULT_Z;
  b.box(vx, F, vz - 0.42, 1.9, 2.0, 0.11, C.vaultDark);          // back
  b.box(vx - 0.9, F, vz, 0.1, 2.0, 0.95, C.vaultDark);           // sides
  b.box(vx + 0.9, F, vz, 0.1, 2.0, 0.95, C.vaultDark);
  b.box(vx, F + 1.9, vz, 1.9, 0.1, 0.95, C.vaultDark);           // lid
  b.box(vx, F, vz, 1.9, 0.1, 0.95, C.vaultDark);                 // floor
  b.box(vx, F + 2.0, vz, 2.0, 0.1, 1.05, C.vault);               // cornice
  for (const sy of [F + 0.68, F + 1.28]) {
    b.box(vx, sy, vz + 0.02, 1.66, 0.05, 0.78, 0x3d444a);        // shelves
  }
  // What is on the shelves. Gold on the bottom two, paper on the top.
  for (let i = 0; i < 3; i++) {
    b.box(vx - 0.5 + i * 0.5, F + 0.1, vz, 0.34, 0.12, 0.5, C.brass, 0.1 * i);
    b.box(vx - 0.5 + i * 0.5, F + 0.22, vz - 0.02, 0.3, 0.1, 0.44, C.brass, -0.08 * i);
  }
  for (let i = 0; i < 3; i++) {
    b.box(vx - 0.48 + i * 0.48, F + 0.73, vz, 0.36, 0.13, 0.46, C.brass, -0.06 * i);
  }
  for (let i = 0; i < 4; i++) {
    b.box(vx - 0.6 + i * 0.4, F + 1.33, vz, 0.3, 0.16, 0.4, C.money, 0.12 * i);
    b.box(vx - 0.6 + i * 0.4, F + 1.4, vz, 0.32, 0.05, 0.2, 0xd8cfae, 0.12 * i);
  }

  // The safe, same idea at a smaller size.
  const sx = SAFE_X, sz = SAFE_Z;
  b.box(sx, F, sz - 0.32, 0.95, 1.0, 0.16, C.safe);              // back
  b.box(sx - 0.44, F, sz, 0.07, 1.0, 0.8, C.safe);               // sides
  b.box(sx + 0.44, F, sz, 0.07, 1.0, 0.8, C.safe);
  b.box(sx, F + 0.93, sz, 0.95, 0.07, 0.8, C.safe);              // lid
  b.box(sx, F, sz, 0.95, 0.07, 0.8, C.safe);                     // floor
  b.box(sx, F + 0.46, sz + 0.02, 0.78, 0.04, 0.62, 0x4d565d);    // shelf
  for (let i = 0; i < 5; i++) {
    b.cyl(sx - 0.22, F + 0.07 + i * 0.045, sz, 0.1, 0.1, 0.045, 8, C.brass);
    b.cyl(sx + 0.02, F + 0.07 + i * 0.045, sz - 0.06, 0.1, 0.1, 0.045, 8, C.brass);
  }
  b.box(sx + 0.16, F + 0.5, sz, 0.28, 0.12, 0.36, C.paper, 0.2);
  b.box(sx - 0.14, F + 0.5, sz + 0.04, 0.3, 0.09, 0.38, C.money, -0.14);
  crate(b, SAFE_X, F + 1.0, SAFE_Z, 0.34, 0.3);

  const topY = desk(b, 0.35, 0.75, 2.0, 1.0, 0, C.wood);
  monitor(b, g, SCR_X, topY, 0.55, 1.02, 0.7, 0, 0x14332a);
  // Everything printed on the screen. The curve itself is animated below.
  const sx0 = SCR_X - SCR_W / 2, sy1 = SCR_Y + SCR_H / 2;
  textMid(b, SCREEN.title, SCR_X, sy1 - 0.04, SCR_Z, 0.0115, C.screenGrn);
  b.box(SCR_X, sy1 - 0.14, SCR_Z, SCR_W - 0.1, 0.012, 0.014, 0x2c5c4a);
  // A baseline, and two guides the curve crosses on its way up.
  b.box(SCR_X, CHART_Y0, SCR_Z, SCR_W - 0.1, 0.012, 0.014, 0x2c5c4a);
  for (let i = 1; i <= 2; i++) {
    for (let k = 0; k < 15; k++) {                         // dashed, so it reads
      b.box(sx0 + 0.055 + k * 0.062, CHART_Y0 + (CHART_H * i) / 3, SCR_Z,
            0.03, 0.01, 0.012, 0x24503f);
    }
  }
  let fy = CHART_Y0 - 0.055;
  for (const line of SCREEN.lines || []) {
    textMid(b, line, SCR_X, fy, SCR_Z, 0.008, 0x4e9c7d);
    fy -= 0.075;
  }
  b.box(0.95, topY, 0.95, 0.38, 0.03, 0.22, 0xd6d6d0);
  b.box(1.25, topY, 0.6, 0.2, 0.24, 0.14, C.paper);
  chair(b, 0.35, 2.05, Math.PI, C.woodDark);

  // The stand only. The panel itself is a separate mesh so it can turn over,
  // built in animInvesting below.
  const wx = BOARD_X, wz = BOARD_Z;
  const postX = BOARD_W / 2 + 0.16, postTop = BOARD_Y + BOARD_H / 2 + 0.16;
  for (const sgn of [-1, 1]) {
    b.box(wx + sgn * postX, F, wz, 0.13, postTop - F, 0.13, C.woodDark);
    b.box(wx + sgn * postX, F, wz, 0.2, 0.09, 0.9, C.woodDark);            // foot
    b.box(wx + sgn * postX, BOARD_Y - 0.02, wz, 0.19, 0.12, 0.19, C.brass); // pivot
  }
  b.box(wx, postTop - 0.11, wz, BOARD_W + 0.46, 0.11, 0.13, C.woodDark);
  b.box(wx, F + 0.42, wz + 0.24, BOARD_W - 0.5, 0.06, 0.14, C.wood);       // pen tray

  b.box(2.3, F, 1.7, 1.25, 0.42, 0.85, C.woodDark);
  b.box(2.3, F + 0.42, 1.7, 1.35, 0.07, 0.95, C.wood);
  const coinY = F + 0.49;
  for (const [cx, cz, cn] of [[2.0, 1.5, 7], [2.3, 1.45, 5], [2.05, 1.9, 4], [2.55, 1.8, 6]]) {
    for (let i = 0; i < cn; i++) b.cyl(cx, coinY + i * 0.045, cz, 0.11, 0.11, 0.045, 8, C.brass);
  }
  for (let i = 0; i < 3; i++) {
    b.box(2.68, coinY + i * 0.1, 1.5, 0.4, 0.095, 0.23, C.money, 0.2);
    b.box(2.68, coinY + i * 0.1 + 0.02, 1.5, 0.42, 0.05, 0.1, 0xd8cfae, 0.2);
  }

  pottedPlant(b, -1.0, 2.5, 1.1, 11);
}

/** One side of the board, drawn around the panel's own centre so the same code
    does the front and the back — the back group is simply turned 180 degrees,
    which keeps its text the right way round. */
function buildBoardFace(b, face) {
  const fpx = 0.02;
  const lineH = fpx * (GLYPH_H + 2.0);
  const cols = Math.floor((BOARD_W - 0.42) / (fpx * (GLYPH_W + 1)));
  const left = -BOARD_W / 2 + 0.2;
  const fz = 0.045;
  let row = BOARD_H / 2 - 0.16;

  textXY(b, face.heading, left, row, fz, fpx, C.boardInk2);
  b.box(0, row - fpx * (GLYPH_H + 1.1), fz, BOARD_W - 0.42, 0.022, 0.02, C.boardInk2);
  row -= lineH * 1.6;

  for (const q of face.lines) {
    const wrapped = wrapText(q, cols - 2);
    for (let i = 0; i < wrapped.length; i++) {
      if (i === 0) b.box(left, row - fpx * 4, fz, fpx * 2, fpx, 0.02, C.boardInk);
      textXY(b, wrapped[i], left + fpx * 3, row, fz, fpx, C.boardInk);
      row -= lineH;
    }
    row -= lineH * 0.3;
  }
}

let boardPivot = null;
let boardTurned = 0;        // 0 front, 1 back
let vaultOpen = 0, safeOpen = 0;   // 0 shut, 1 swung wide
let flickCoin = null, redrawCurve = null;

function animInvesting(group) {
  const ups = [];

  // A coin left spinning on the table with the takings on it.
  const spinner = part(function (b) {
    b.cylC(0, 0, 0, 0.11, 0.11, 0.045, 10, C.brass, Math.PI / 2, 0, 0);
    b.cylC(0, 0, 0.024, 0.07, 0.07, 0.01, 10, 0xe2c274, Math.PI / 2, 0, 0);
  });
  spinner.position.set(2.0, F + 0.49 + 7 * 0.045 + 0.06, 1.5);
  group.add(spinner);
  const COIN_Y = F + 0.49 + 7 * 0.045 + 0.06;
  let flick = 0;
  flickCoin = function () { flick = 1; touched(); };
  ups.push(function (t, dt, amt, idle) {
    flick = Math.max(0, flick - dt * 0.45);
    const a = Math.max(amt, idle);
    spinner.rotation.y += dt * (0.6 + 7 * a + flick * 34);
    // Leaning over as it loses momentum, the way a coin does before it drops.
    spinner.rotation.z = (0.12 + Math.sin(t * 2.3) * 0.06) * a * (1 - flick);
    spinner.position.y = COIN_Y + Math.sin(t * 4.6) * 0.008 * a
                       + Math.sin(Math.min(1, flick) * Math.PI) * 0.3;
  });

  // The vault door. Hinged on its right edge and swung toward the middle of
  // the room, which is the only direction with nothing in the way.
  const vaultDoor = new THREE.Group();
  vaultDoor.position.set(VAULT_X + 0.85, F + 0.06, VAULT_Z + 0.44);
  group.add(vaultDoor);
  const vd = new Builder();
  vd.box(-0.85, 0, 0, 1.7, 1.84, 0.13, C.vault);
  vd.cylC(-0.85, 0.92, 0.09, 0.62, 0.62, 0.14, 10, C.vault, Math.PI / 2, 0, 0);
  vd.cylC(-0.85, 0.92, 0.17, 0.5, 0.5, 0.05, 10, C.vaultDark, Math.PI / 2, 0, 0);
  vd.cylC(-0.85, 0.92, 0.22, 0.12, 0.12, 0.08, 8, C.brass, Math.PI / 2, 0, 0);
  for (let i = 0; i < 4; i++) {
    vd.boxC(-0.85, 0.92, 0.22, 0.72, 0.055, 0.055, C.brass, 0, 0, (i * Math.PI) / 4);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.4;
    vd.boxC(-0.85 + Math.cos(a) * 0.74, 0.92 + Math.sin(a) * 0.74, 0.06,
            0.08, 0.08, 0.06, C.brass);
  }
  // Bolts along the hinge edge, which only show once it is open.
  for (let i = 0; i < 5; i++) {
    vd.cylC(-1.66, 0.24 + i * 0.35, 0, 0.055, 0.055, 0.26, 6, C.metal, 0, Math.PI / 2, 0);
  }
  vaultDoor.add(solidMesh(vd));

  // And the safe door, the same trick a size down.
  const safeDoor = new THREE.Group();
  safeDoor.position.set(SAFE_X + 0.4, F + 0.06, SAFE_Z + 0.38);
  group.add(safeDoor);
  const sd = new Builder();
  sd.box(-0.4, 0, 0, 0.8, 0.86, 0.08, 0x5a636a);
  sd.cylC(-0.26, 0.44, 0.07, 0.12, 0.12, 0.06, 8, C.brass, Math.PI / 2, 0, 0);
  sd.cylC(-0.26, 0.44, 0.1, 0.05, 0.05, 0.03, 6, C.vaultDark, Math.PI / 2, 0, 0);
  sd.box(-0.66, 0.3, 0.05, 0.05, 0.28, 0.05, C.brass);
  for (let i = 0; i < 3; i++) {
    sd.cylC(-0.78, 0.18 + i * 0.26, 0, 0.04, 0.04, 0.18, 6, C.metal, 0, Math.PI / 2, 0);
  }
  safeDoor.add(solidMesh(sd));

  ups.push(function (t, dt) {
    const k = 1 - Math.pow(0.004, dt);
    vaultDoor.rotation.y += (vaultOpen * 1.5 - vaultDoor.rotation.y) * k;
    safeDoor.rotation.y += (safeOpen * 1.45 - safeDoor.rotation.y) * k;
  });

  // The panel, hung between the two posts so it can be turned over.
  boardPivot = new THREE.Group();
  boardPivot.position.set(BOARD_X, BOARD_Y, BOARD_Z);
  group.add(boardPivot);

  const panel = new Builder();
  panel.boxC(0, 0, 0, BOARD_W, BOARD_H, 0.07, C.board);
  panel.boxC(0, BOARD_H / 2 + 0.04, 0, BOARD_W + 0.14, 0.08, 0.1, 0xb8b2a2);
  panel.boxC(0, -BOARD_H / 2 - 0.04, 0, BOARD_W + 0.14, 0.08, 0.1, 0xb8b2a2);
  panel.boxC(-BOARD_W / 2 - 0.07, 0, 0, 0.08, BOARD_H + 0.16, 0.1, 0xb8b2a2);
  panel.boxC(BOARD_W / 2 + 0.07, 0, 0, 0.08, BOARD_H + 0.16, 0.1, 0xb8b2a2);
  buildBoardFace(panel, BOARD.front);
  boardPivot.add(solidMesh(panel));

  const back = new Builder();
  buildBoardFace(back, BOARD.back);
  const backGroup = new THREE.Group();
  backGroup.rotation.y = Math.PI;
  backGroup.add(solidMesh(back));
  boardPivot.add(backGroup);

  ups.push(function (t, dt) {
    const to = boardTurned * Math.PI;
    boardPivot.rotation.y += (to - boardPivot.rotation.y) * (1 - Math.pow(0.004, dt));
  });

  // The portfolio curve on the screen, drawn as columns so it fills in under
  // itself the way an equity chart does. It draws left to right, holds at the
  // end, and starts over.
  const N = 34, colStep = (SCR_W - 0.1) / (N - 1), colX0 = SCR_X - (SCR_W - 0.1) / 2;
  const eq = [];
  for (let i = 0; i < N; i++) eq.push(equity(i / (N - 1)));
  const eqMax = Math.max(...eq);
  for (let i = 0; i < N; i++) eq[i] /= eqMax;

  const cols = [];
  for (let i = 0; i < N; i++) {
    const m = part(b => b.box(0, 0, 0, colStep * 0.82, 1, 0.012, C.screenGrn), true);
    m.position.set(colX0 + i * colStep, CHART_Y0, SCR_Z + 0.002);
    group.add(m);
    cols.push(m);
  }
  // The point the line has reached, so the eye has something to follow.
  const head = part(b => b.box(-0.014, -0.014, 0, 0.028, 0.028, 0.012, 0xcdf3de), true);
  group.add(head);

  // Its own clock rather than the world's, so touching the screen can send it
  // back to the start of the run.
  let cyc = 0;
  redrawCurve = function () { cyc = 0; touched(); };
  ups.push(function (t, dt, amt, idle) {
    const a = Math.max(amt, idle);
    cyc = (cyc + dt * 0.115) % 1;
    // Asleep it just shows the finished curve; awake it redraws itself.
    const p = a > 0.05 ? (cyc < 0.72 ? cyc / 0.72 : 1) : 1;
    for (let i = 0; i < N; i++) {
      const grow = clamp((p - i / (N - 1)) * (N - 1) + 1, 0, 1);
      cols[i].visible = grow > 0.002;
      cols[i].scale.y = Math.max(0.006, eq[i] * CHART_H * grow);
    }
    const lead = clamp(Math.round(p * (N - 1)), 0, N - 1);
    head.visible = p < 0.999 && a > 0.05;
    if (head.visible) {
      head.position.set(colX0 + lead * colStep, CHART_Y0 + eq[lead] * CHART_H, SCR_Z + 0.006);
    }
  });

  return ups;
}

/* =============================================================================
   Section: Jiu-jitsu — mats, a heavy bag, and the belts that came before
============================================================================= */

const BAG_X = -2.85, BAG_Z = -1.5;
// The dummy on the mat. Rolls about its own long axis when thrown, so it is
// built around a pivot at its middle rather than on the floor.
const DUM_X = 0.9, DUM_Z = 0.4, DUM_RY = -0.5, DUM_Y = F + 0.27;

function buildBJJ(b, g) {
  island(b, ISLAND, 0xdcd6c8);

  // Tatami, laid in the middle in a checkerboard the way a mat always is.
  const n = 3, s = 1.72, span = n * s;
  b.box(0, F, 0, span + 0.16, 0.05, span + 0.16, C.matTrim);
  const off = -(n - 1) * s / 2;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      b.box(off + i * s, F + 0.05, off + j * s, s - 0.06, 0.05, s - 0.06,
            ((i + j) & 1) ? C.matA : C.matB);
    }
  }

  // Heavy bag stand, just off the mat. The bag itself is animated.
  b.box(BAG_X, F, BAG_Z, 1.0, 0.12, 1.0, C.metalDark);
  b.cyl(BAG_X, F + 0.12, BAG_Z, 0.09, 0.11, 2.4, 8, C.metal);
  b.box(BAG_X + 0.38, F + 2.4, BAG_Z, 0.86, 0.12, 0.14, C.metal);
  b.box(BAG_X + 0.78, F + 2.34, BAG_Z, 0.08, 0.08, 0.08, C.metalDark);

  // Belt rack along the back, so the belts face out. Two belts on it, both
  // real: the white belt being worn now, and the taekwondo belt from before.
  const rx = 1.35, rz = -3.05;
  b.box(rx - 1.15, F, rz, 0.14, 1.9, 0.14, C.woodDark);
  b.box(rx + 1.15, F, rz, 0.14, 1.9, 0.14, C.woodDark);
  b.box(rx, F + 1.78, rz, 2.4, 0.1, 0.1, C.wood);

  // Both belts hang off the bar and sway, so they are meshes — see animBJJ.

  // A gi folded on a bench, off the mat.
  b.box(0.3, F, 3.0, 2.0, 0.42, 0.55, C.woodDark);
  b.box(0.3, F + 0.42, 3.0, 2.1, 0.08, 0.62, C.wood);
  b.box(-0.2, F + 0.5, 3.0, 0.6, 0.16, 0.42, C.gi);
  b.box(-0.2, F + 0.66, 3.0, 0.56, 0.1, 0.38, 0xd6d4cb);
  b.box(0.26, F + 0.5, 3.0, 0.2, 0.08, 0.32, C.beltWhite);
  b.box(0.26, F + 0.5, 3.0, 0.09, 0.09, 0.34, 0x2f2c2a);
  // The drink bottle rocks — see animBJJ.

  // The dummy is left out on the mat, and gets thrown when you touch it, so
  // it is built in animBJJ rather than here.

  // Spare mats stacked in the corner. The top one slides — see animBJJ.
  for (let i = 0; i < 2; i++) {
    b.box(-2.7, F + i * 0.11, 2.6, 1.15, 0.11, 0.8, i % 2 ? C.matA : C.matB, 0.2);
  }
  pottedPlant(b, 2.8, 2.6, 1.0, 19);
  void g;
}

let hitBag = null, throwDummy = null;
let swingBelts = null, knockBottle = null, pullMat = null;

function animBJJ(group) {
  // The bag hangs off the arm and swings, on two frequencies so it never looks
  // like a metronome.
  const pivot = new THREE.Group();
  pivot.position.set(BAG_X + 0.78, F + 2.3, BAG_Z);
  group.add(pivot);
  /* Heavy bag. The chain and swivel it hangs on, a collar top and bottom, a
     body that tapers slightly toward the floor the way a filled bag does, and
     two straps down the sides with the seam between them. A plain cylinder
     with a band at each end could have been a water heater. */
  pivot.add(part(b => {
    b.cyl(0, -0.06, 0, 0.045, 0.045, 0.06, 6, C.metalDark);        // swivel
    for (let i = 0; i < 3; i++) {                                  // chain
      b.cylC(0, -0.11 - i * 0.055, 0, 0.032, 0.032, 0.05, 6, C.metal,
             i % 2 ? Math.PI / 2 : 0, 0, 0);
    }
    b.cyl(0, -0.34, 0, 0.26, 0.29, 0.1, 10, C.bagDark);            // top collar
    b.cyl(0, -1.5, 0, 0.265, 0.235, 1.18, 10, C.bagLeather);       // body
    b.cyl(0, -1.56, 0, 0.245, 0.245, 0.1, 10, C.bagDark);          // base collar
    /* Bands round it rather than straps down it. The body tapers from 0.265 at
       the top to 0.235 at the floor, and a straight box cannot follow that: set
       at one radius it stood out as a fin near the top and vanished inside the
       leather near the bottom. A ring only needs the radius at its own height,
       which is r = 0.235 + 0.0254 * (y + 1.5) along this cone. */
    for (const y of [-1.12, -0.72]) {
      const r = 0.235 + 0.0254 * (y + 1.5) + 0.006;
      b.cyl(0, y - 0.03, 0, r, r, 0.06, 10, C.bagSeam);
    }
  }));

  // A struck bag swings hard and then settles, so the hit decays rather than
  // being another steady sine on top of the idle one.
  let hit = 0, hitAt = 0;
  hitBag = function () { hit = 1; hitAt = 0; touched(); };

  // The two belts, each hanging off the bar on its own pivot. Both are real:
  // the white one being worn now, and the taekwondo belt from before.
  const RX = 1.35, RZ = -3.05, BAR = F + 1.78;
  const belts = [];
  for (const spec of [
    { x: RX - 0.46, body: C.beltWhite, bar: C.beltBlack, tape: C.beltWhite, two: true },
    { x: RX + 0.56, body: C.beltBlack, bar: 0x201e1c, tape: C.brass, two: false }
  ]) {
    const pivot = new THREE.Group();
    pivot.position.set(spec.x, BAR, RZ);
    group.add(pivot);
    pivot.add(part(function (b) {
      const y0 = -(BAR);
      b.box(0, y0 + F + 0.96, 0, 0.28, 0.82, 0.08, spec.body);
      b.box(0, y0 + F + 1.02, 0, 0.3, 0.36, 0.1, spec.bar);
      if (spec.two) {
        b.box(0, y0 + F + 1.10, 0, 0.32, 0.055, 0.12, spec.tape);
        b.box(0, y0 + F + 1.21, 0, 0.32, 0.055, 0.12, spec.tape);
      } else {
        b.box(0, y0 + F + 1.15, 0, 0.32, 0.065, 0.12, spec.tape);
      }
    }));
    belts.push(pivot);
  }

  // The drink bottle left on the bench, rocking on its base.
  const bottle = new THREE.Group();
  bottle.position.set(1.0, F + 0.5, 3.0);
  group.add(bottle);
  bottle.add(part(function (b) {
    b.cyl(0, 0, 0, 0.09, 0.09, 0.28, 8, 0x7fb0c4);
    b.cyl(0, 0.28, 0, 0.05, 0.05, 0.06, 8, C.metalDark);
  }));

  // The top spare mat, half pulled off the stack.
  const topMat = part(function (b) {
    b.box(0, 0, 0, 1.15, 0.11, 0.8, C.matA, 0.2);
  });
  topMat.position.set(-2.7, F + 0.22, 2.6);
  group.add(topMat);

  let swung = 0, knocked = 0, matPulled = false, matOff = 0;
  swingBelts = function () { swung = 1; touched(); };
  knockBottle = function () { knocked = 1; touched(); };
  pullMat = function () { matPulled = !matPulled; touched(); };

  // The dummy, on a pivot through its middle so a throw rolls it rather than
  // pushing it through the mat.
  const dummy = new THREE.Group();
  dummy.position.set(DUM_X, DUM_Y, DUM_Z);
  dummy.rotation.y = DUM_RY;
  group.add(dummy);
  const roll = new THREE.Group();
  dummy.add(roll);
  /* A grappling dummy, laid out the way one is actually built: a torso that
     tapers to the waist, shoulders wider than the chest, a neck, a head, arms
     bent at the elbow rather than run straight out as sticks, and the seam and
     stitching down the front. It used to be four slabs in a cross, which from
     above read as a brown plus sign on the mat and nothing more.

     -z is its head end. */
  roll.add(part(function (b) {
    b.box(0, -0.19, -0.34, 0.56, 0.38, 0.5, C.bagLeather);        // chest
    b.box(0, -0.17, 0.14, 0.46, 0.34, 0.42, C.bagLeather);        // waist
    b.box(0, -0.16, 0.5, 0.5, 0.32, 0.34, C.bagLeather);          // hips
    b.box(0, -0.02, -0.62, 0.22, 0.16, 0.16, C.bagDark);          // neck
    b.rockS(0, 0.02, -0.8, 0.21, C.bagDark, 0, 0.95, 1, 1.1, 0, 0, 0);
    /* The seam down the middle, and a row of stitches either side of it. On the
       torso's top face at 0.19, not at 0 — at 0 they were inside the torso,
       which is a lot of geometry to draw where nobody can see it. */
    b.box(0, 0.188, -0.2, 0.05, 0.02, 1.24, C.bagSeam);
    for (let i = 0; i < 7; i++) {
      for (const sx of [-0.1, 0.1]) {
        b.box(sx, 0.186, -0.68 + i * 0.17, 0.035, 0.018, 0.06, C.bagSeam);
      }
    }
    for (const side of [-1, 1]) {
      // Upper arm out to the side, forearm turned forward at the elbow.
      b.boxC(side * 0.4, -0.04, -0.42, 0.28, 0.2, 0.2, C.bagLeather);
      b.boxC(side * 0.52, -0.05, -0.16, 0.19, 0.19, 0.44, C.bagLeather, 0, side * 0.18, 0);
      b.rockS(side * 0.57, -0.06, 0.08, 0.11, C.bagDark, 0, 1, 0.9, 1, 0, 0, 0);
      // And a leg stub each, rather than one slab across the bottom.
      b.boxC(side * 0.14, -0.06, 0.78, 0.21, 0.24, 0.32, C.bagDark);
    }
  }));

  let rollFrom = 0, rollTo = 0, rollT = 1;
  throwDummy = function () {
    rollFrom = rollTo;
    rollTo += Math.PI;              // over onto its other side, every time
    rollT = 0;
    touched();
  };

  return [function (t, dt, amt, idle) {
    const a = Math.max(amt, idle);
    if (hit > 0.001) {
      hitAt += dt;
      hit = Math.max(0, 1 - hitAt / 3.4);
    }
    const swing = a * (Math.sin(t * 2.1) * 0.16 + Math.sin(t * 1.31 + 1.2) * 0.06);
    pivot.rotation.x = swing - hit * hit * Math.sin(hitAt * 7.4) * 0.62;
    pivot.rotation.z = a * Math.sin(t * 1.7 + 0.6) * 0.05
                     - hit * hit * Math.sin(hitAt * 5.1 + 0.7) * 0.16;

    if (rollT < 1) {
      rollT = Math.min(1, rollT + dt * 0.95);
      // Slow at both ends, quick through the middle — a body being turned over.
      const e = rollT < 0.5 ? 2 * rollT * rollT : 1 - Math.pow(-2 * rollT + 2, 2) / 2;
      roll.rotation.z = rollFrom + (rollTo - rollFrom) * e;
      roll.position.y = Math.sin(rollT * Math.PI) * 0.24;
    } else {
      roll.rotation.z = rollTo;
      roll.position.y = 0;
    }
    // Settling breath, so it is never completely dead on the mat.
    roll.rotation.x = a * Math.sin(t * 0.8) * 0.02;

    // Belts turning on their hangers, each on its own slow beat, plus whatever
    // is left of a shove.
    /* The rack's bar runs along x, so a belt folded over it swings about that
       same axis — out toward you and back again, like anything hanging off a
       rail. It used to turn on Y and tip on Z, which read as a sideways wobble
       and never as a swing. A trace of Y is left so the two are not identical. */
    swung = Math.max(0, swung - dt * 0.5);
    for (let i = 0; i < belts.length; i++) {
      belts[i].rotation.x = Math.sin(t * (0.42 + i * 0.13) + i * 2.1) * 0.24 * a
                          + Math.sin(t * 6.2 + i * 1.3) * swung * swung * 0.85;
      belts[i].rotation.y = Math.sin(t * (0.61 + i * 0.09)) * 0.05 * a;
    }

    // The bottle: rocking, or knocked over and slowly righting itself.
    knocked = Math.max(0, knocked - dt * 0.42);
    const tip = Math.sin(Math.min(1, knocked * 1.6) * Math.PI * 0.5) * 1.45;
    bottle.rotation.z = Math.sin(t * 1.9) * 0.07 * a + tip;
    bottle.rotation.x = Math.sin(t * 1.4 + 0.8) * 0.05 * a;
    bottle.position.x = 1.0 + Math.sin(tip) * 0.14;
    bottle.position.y = F + 0.5 - (1 - Math.cos(tip)) * 0.09;

    // The top mat creeps off the stack, or is pulled right off onto the floor.
    matOff += ((matPulled ? 1 : 0) - matOff) * (1 - Math.pow(0.02, dt));
    const creep = (0.5 + 0.5 * Math.sin(t * 0.7)) * 0.22 * a * (1 - matOff);
    topMat.position.x = -2.7 + creep + matOff * 1.25;
    topMat.position.y = F + 0.22 + Math.abs(Math.sin(t * 0.7)) * 0.01 * a
                      - matOff * 0.2;
    topMat.rotation.z = matOff * 0.06;
  }];
}

/* =============================================================================
   Section: Music — decks in the corner
============================================================================= */

const DECK_Y = F + 0.92;

/* The panel on the front of the booth: a focus target, and the way out to
   SoundCloud. Flat against the front face, so unlike the laptop it replaced it
   needs no group of its own to lean the lettering with a lid — it is simply
   part of the island. PANEL_Y is the middle of it, and the booth front is at
   z = 0.125, so the plate sits a hair proud of that. */
const PANEL_Y = F + 0.55, PANEL_Z = 0.14, PANEL_W = 1.32, PANEL_H = 0.46;

/* Local +z is out of the ring, so it is the front of the scene. The speakers
   are the tallest things here and were standing at +0.5, right in front of the
   crate and the synth — from most angles you got a wall of black box. They go
   to the back, where their height frames the booth instead of hiding it, and
   the two things worth looking at come forward.

   Held here rather than written into each place that needs them, because the
   crate and the synth are each built in one function, animated in another and
   given a hit box in a third, and all three have to agree. */
/* The mixer's control surface, and the brow at the back of it that carries the
   two channel meters. MIX_BROW_Z is the face they sit on, pointing at you. */
const MIX_TOP    = DECK_Y + 0.235;
const MIX_BROW_H = 0.18;
const MIX_BROW_Z = -0.585;
/* Where the LISTEN / icon panel sits, and both the mesh (in animMusic) and the
   hit boxes over it (registered separately, where all this section's targets
   are) need the same number — raised clear of the mixer's own hit box, which
   tops out at MIX_TOP + 0.3 (addDetail below: height 0.4, centred 0.1 above
   MIX_TOP), so a tap meant for an icon can never land in the mixer's box
   instead once both exist over the same spot. */
const MIX_CUE_Y = MIX_TOP + 0.36;
/* The panel is built with its BOTTOM on the cue origin, so that scaling it in y
   makes it grow up out of the mixer rather than open from the middle — which is
   why its own middle needs a name of its own for everything that has to sit
   centred in it. Wide and tall enough for the two badges side by side with a
   margin either side; see MIX_ICON_X for where that leaves them. */
const MIX_CUE_W = 0.56, MIX_CUE_H = 0.155;
const MIX_CUE_MID = MIX_CUE_H / 2;
/* The two badges are different widths — the cloud is nearly twice as wide as it
   is tall, the disc is square — so centring the PAIR is not the same as putting
   one either side of the middle. These are the two centres that leave an equal
   margin at each end of the panel and an even gap between them, and the hit
   boxes below are placed off the same numbers. */
const MIX_ICON_X = [-0.083, 0.127];

const SPK_X = 2.6, SPK_Z = -2.25;
const SYN_X = -2.4, SYN_Z = 1.9, SYN_R = 0.55;
const CRATE_X = 2.5, CRATE_Z = 1.75, CRATE_R = -0.35;
const CRATE_H = 0.46;                    // wall height; the sleeves stand proud
const SLEEVE_Y = F + 0.08;               // resting on the crate floor
/* Sized to the inside of the crate: 0.81 across and 0.66 front to back once the
   walls are taken off, and 0.38 from the floor to the top of them. A record
   stands a little proud of a crate, not most of the way out of it. */
const SLEEVE_H = 0.52, SLEEVE_D = 0.52;

/* ---- The two streaming badges -------------------------------------------------

   Standing emblems rather than flat decals, in keeping with everything else
   here being an actual shape rather than a picture of one — a badge with real
   depth to it catches the same light as the mixer it sits on instead of looking
   pasted over the top of it.

   Both are pixel sprites, extruded. Curves were the first thing tried — lobes
   of icosahedron for the cloud, thin partial tori for Spotify's bars — and at
   the size these are actually seen they came out as an orange smear and an
   unreadable dark smudge. A stepped outline holds its shape however small it
   gets, which is the whole reason pixel art exists, and it is what the rest of
   the world is built out of anyway.

   Both return a mesh around their own origin, uncoloured by anything outside
   them — makeToy does the same for the same reason: something this small is
   assembled once and then just placed, not rebuilt every time it moves. */

/* A pixel each, and how far both stand off their backing. The two differ
   because the sprites are different shapes — the cloud is a wide, short 28x11,
   the disc a square 19x19 — and a badge is judged by how much of the panel it
   fills, not by how many pixels went into it. These are the sizes that leave
   the pair looking like a matched set. */
const SC_PX  = 0.0073;       // -> 0.204 wide, 0.080 tall
const SP_PX  = 0.0061;       // -> 0.116 square
const ICON_D = 0.024;

/** SoundCloud: the waveform stepping up on the left into the cloud on the
    right. The bars matter as much as the cloud — a plain cloud reads as
    weather, and it is the bars ramping into it that say SoundCloud. So they
    run tall, most of the way up to the cloud's own height, which is how the
    real mark is drawn. No wordmark: nothing that small survives being read
    across a room. */
const SC_ROWS = [
  "..............########......",
  ".............###########....",
  ".........##.#############...",
  ".........##.##############..",
  "...##....##.##############..",
  "...##....##.###############.",
  "...##.##.##.###############.",
  "##.##.##.##.###############.",
  "##.##.##.##.################",
  "##.##.##.##.################",
  "##.##.##.##.################"
];

function makeSoundcloudIcon() {
  const b = new Builder();
  sprite(b, SC_ROWS, { "#": C.soundcloud }, SC_PX, ICON_D);
  return solidMesh(b);
}

/** Spotify: the disc, and the three arcs across it. They are concentric about
    a point below the disc — the smallest at the bottom, each one wider than
    the last, like a signal fanning upward — so their radii and spans are not
    independent numbers to be nudged one at a time. Drawn straight into the
    grid rather than cut out of it, so the green either side of a bar is the
    same disc and the bars are holes in nothing. */
const SP_ROWS = [
  "......#######......",
  "....###########....",
  "...#############...",
  "..###############..",
  ".#####ooooooo#####.",
  ".###ooooooooooo###.",
  "###ooo#######ooo###",
  "###o###########o###",
  "#######ooooo#######",
  "#####ooooooooo#####",
  "#####oo#####oo#####",
  "###################",
  "#######ooooo#######",
  ".#####ooooooo#####.",
  ".#####o#####o#####.",
  "..###############..",
  "...#############...",
  "....###########....",
  "......#######......"
];

function makeSpotifyIcon() {
  const b = new Builder();
  sprite(b, SP_ROWS, { "#": C.spotifyGreen, "o": C.spotifyMark }, SP_PX, ICON_D);
  return solidMesh(b);
}

function buildMusic(b, g) {
  island(b, ISLAND, 0xcfc7b6);
  b.cyl(0, F + 0.05, 0.6, 2.7, 2.7, 0.03, 12, 0xbeb5a2);

  // Booth.
  b.box(0, F, -0.35, 2.6, 0.92, 0.95, C.woodDark);
  b.box(0, DECK_Y, -0.35, 2.75, 0.1, 1.05, C.wood);
  g.box(0, F + 0.14, 0.15, 2.3, 0.05, 0.02, C.ledCyan);      // strip under the lip

  // Two decks with a mixer between them. Platters are animated separately.
  for (const side of [-1, 1]) {
    const x = side * 0.85;
    b.box(x, DECK_Y + 0.1, -0.35, 0.78, 0.11, 0.66, C.deckBody);
    b.box(x + side * 0.3, DECK_Y + 0.21, -0.6, 0.1, 0.03, 0.28, C.metal);   // tonearm
    b.box(x + side * 0.3, DECK_Y + 0.21, -0.74, 0.08, 0.05, 0.08, C.metalDark);
    b.box(x - side * 0.31, DECK_Y + 0.21, -0.08, 0.05, 0.02, 0.22, 0xd6d6d0); // pitch
  }
  /* The mixer, laid out the way a club mixer actually is: two channel strips
     side by side, each with its EQ above its own fader, a crossfader across
     the front, and the meters standing up on a brow at the back rather than
     lying flat on the deck where nothing can read them. Everything is built
     around MIX_TOP so the whole surface can be moved in one number. */
  b.box(0, DECK_Y + 0.1, -0.35, 0.72, 0.13, 0.66, C.mixer);
  b.box(0, MIX_TOP - 0.01, -0.35, 0.68, 0.012, 0.62, C.mixerFace);   // faceplate

  for (const side of [-1, 1]) {
    const cx = side * 0.17;
    /* EQ in a block of four rather than a line of four. Strung out front to
       back they came at this camera as one long diagonal smear down the face;
       clustered, each channel reads as a cluster. */
    for (let i = 0; i < 4; i++) {
      const kx = cx + ((i % 2) - 0.5) * 0.105;
      const kz = -0.545 + Math.floor(i / 2) * 0.095;
      b.cyl(kx, MIX_TOP, kz, 0.03, 0.032, 0.028, 8, i === 0 ? C.brass : C.knob);
      b.cyl(kx, MIX_TOP + 0.028, kz, 0.011, 0.011, 0.008, 6, C.mixerFace);
    }
    // Channel fader: a sunk slot with a cap in it. The cap rides the level.
    b.box(cx, MIX_TOP - 0.008, -0.185, 0.05, 0.012, 0.24, C.slot);
  }

  // Crossfader, across the front where a crossfader goes.
  b.box(0, MIX_TOP - 0.008, -0.065, 0.42, 0.01, 0.05, C.slot);

  /* The brow. A club mixer stands its meters up on the back panel so the DJ
     can see them from above the decks — which is also the only place they can
     be read from out here, since anything lying flat on the top face is edge
     on to the camera and reduces to a line. */
  b.box(0, MIX_TOP, MIX_BROW_Z - 0.04, 0.68, MIX_BROW_H, 0.08, C.mixerDark);
  b.box(0, MIX_TOP + MIX_BROW_H, MIX_BROW_Z - 0.04, 0.7, 0.02, 0.1, C.mixer);
  for (const side of [-1, 1]) {
    // Which channel each ladder belongs to, printed beside it.
    textMid(g, side < 0 ? "1" : "2", side * 0.29, MIX_TOP + 0.135,
            MIX_BROW_Z + 0.005, 0.014, 0x8fa3ae);
  }

  /* The handle, lit into the front of the booth.

     It used to be a laptop standing open on the deck table, and it stood in
     the mixer: the mixer runs from z -0.68 to -0.02 and the screen was at
     -0.06, inside it. There is no room to separate them up there either. The
     top is 1.05 deep, the decks and mixer take 0.66 of that, and a laptop's
     screen sits at the back of its own base — so pushing the screen forward
     pushes the base off the front edge, which it already overhung.

     On the front panel it cannot clash with anything on the table, and it
     reads the way the front of a booth usually does. */
  b.box(0, PANEL_Y - PANEL_H / 2, PANEL_Z, PANEL_W + 0.08, PANEL_H + 0.08, 0.03, C.metalDark);
  g.box(0, PANEL_Y - PANEL_H / 2, PANEL_Z + 0.012, PANEL_W, PANEL_H, 0.02, 0x25333d);
  /* One word, because that is what the front of a booth says. The y given to a
     line of text is the TOP of it, not the middle, and a glyph is seven pixels
     tall — so a line set at px hangs 7 x px below the number given here. */
  textMid(g, MUSIC_LINK.booth, 0, PANEL_Y + 0.115, PANEL_Z + 0.03, 0.033, C.ledCyan);

  /* Headphones hooked over the lip of the booth, headband on the deck and cups
     hanging down the front of it.

     Not standing on the deck, because there is nowhere for them to stand: the
     top is 1.05 front to back, the decks and mixer take 0.66 of it and the
     brow the rest, so a pair of cans laid anywhere on it either hangs off the
     front edge into thin air or sits inside a turntable. Over the lip they
     have the whole front panel to themselves, and it is where a pair actually
     ends up between records.

     Cups face out, flat to the panel — a cup is a disc, and a disc lying on
     the axis that points at you reads as a cup rather than as an edge. */
  const CAN_Z = 0.168, CAN_Y = DECK_Y - 0.06;
  for (const hx of [-1.16, -0.86]) {
    b.cylC(hx, CAN_Y, CAN_Z, 0.135, 0.135, 0.075, 10, C.canShell, Math.PI / 2, 0, 0);
    b.cylC(hx, CAN_Y, CAN_Z + 0.045, 0.1, 0.1, 0.02, 10, C.canPad, Math.PI / 2, 0, 0);
    b.cylC(hx, CAN_Y, CAN_Z - 0.03, 0.15, 0.15, 0.02, 10, C.canTrim, Math.PI / 2, 0, 0);
    // The arm from the lip down to the cup.
    b.box(hx, CAN_Y + 0.1, CAN_Z - 0.02, 0.035, 0.16, 0.045, C.canTrim);
  }
  // Headband over the lip: across the top, and lying back onto the deck.
  b.box(-1.01, DECK_Y + 0.09, CAN_Z - 0.03, 0.34, 0.05, 0.075, C.canShell);
  b.box(-1.01, DECK_Y + 0.1, 0.055, 0.3, 0.045, 0.14, C.canShell);
  b.box(-1.01, DECK_Y + 0.145, 0.055, 0.24, 0.03, 0.1, C.canPad);     // the padding
  /* Cable, off the left cup and down the panel. Two lengths with a kink in it,
     placed as midpoints between endpoints that meet — tilted about their own
     centres with the tilts guessed, they hung in the air as two separate
     sticks. A cylinder rotated by +z leans its TOP toward -x, hence the signs. */
  b.cylC(-1.22, CAN_Y - 0.218, CAN_Z, 0.013, 0.013, 0.176, 6, C.canTrim, 0, 0, -0.35);
  b.cylC(-1.23, CAN_Y - 0.38, CAN_Z, 0.013, 0.013, 0.165, 6, C.canTrim, 0, 0, 0.245);

  /* Speakers on stands at the back, turned in the way a pair gets aimed.

     A cabinet is a box with a baffle set into the front of it, a port under
     the drivers and a badge on it — without those it is just a black block
     with two holes, which is what these were. The drivers themselves are
     animated, so only what they sit in is here. */
  for (const side of [-1, 1]) {
    const x = side * SPK_X, ry = -side * 0.32;
    b.box(x, F, SPK_Z, 0.46, 0.05, 0.46, C.metalDark);              // plate
    b.box(x, F + 0.04, SPK_Z, 0.28, 0.03, 0.28, C.metal);
    b.cyl(x, F + 0.06, SPK_Z, 0.045, 0.055, 0.9, 8, C.metalDark);   // column
    b.cyl(x, F + 0.94, SPK_Z, 0.14, 0.14, 0.03, 8, C.metalDark);    // top plate

    b.box(x, F + 0.97, SPK_Z, 0.72, 1.05, 0.6, C.speaker, ry);
    // Baffle, inset, so the cabinet has a front rather than just a face.
    const [fx, fz] = loc(x, SPK_Z, ry, 0, 0.302);
    b.boxC(fx, F + 1.49, fz, 0.62, 0.95, 0.02, C.speakerFace, 0, ry, 0);
    /* A badge under the drivers, and no bass port. There was one, and it sat
       inside the bottom of the woofer — the cabinet only has 0.15 of baffle
       below the driver and a port wide enough to read needs all of it. A
       two-way with a badge is a speaker; a port poking out of a woofer is a
       mistake. */
    const [px2, pz2] = loc(x, SPK_Z, ry, 0, 0.313);
    b.boxC(px2, F + 1.04, pz2, 0.17, 0.038, 0.014, C.brass, 0, ry, 0);
  }

  /* Synth on an X-stand out front on the left. The stand has legs that cross
     and feet that spread, rather than two posts on two plates; the body has an
     end cheek at each side and a raised control panel behind the keys with the
     pitch and mod wheels let into the left of it, which is the arrangement that
     says keyboard rather than black plank. */
  for (const side of [-1, 1]) {
    const [px, pz] = loc(SYN_X, SYN_Z, SYN_R, side * 0.62, 0);
    b.box(px, F, pz, 0.1, 0.045, 0.68, C.metalDark, SYN_R);         // foot
    /* Two legs crossing, tilted enough to actually read as a cross. At the
       shallow angle they had, the pair sat almost on top of each other and
       came out as one thick post. The tilt is in the island's frame, so the
       boxes take the stand's own rotation on Y as well. */
    b.boxC(px, F + 0.37, pz, 0.045, 0.8, 0.045, C.metalDark, side * 0.3, SYN_R, 0);
    b.boxC(px, F + 0.37, pz, 0.042, 0.78, 0.042, C.metal, -side * 0.3, SYN_R, 0);
  }
  b.box(SYN_X, F + 0.72, SYN_Z, 1.72, 0.1, 0.54, 0x3f4348, SYN_R);   // body
  for (const side of [-1, 1]) {                                      // end cheeks
    const [cx, cz] = loc(SYN_X, SYN_Z, SYN_R, side * 0.8, 0);
    b.box(cx, F + 0.72, cz, 0.12, 0.17, 0.56, C.woodDark, SYN_R);
  }
  // Raised panel behind the keys, with the two wheels at its left-hand end.
  b.box(SYN_X, F + 0.82, SYN_Z, 1.6, 0.09, 0.2, 0x2f3338, SYN_R);
  {
    const [wx, wz] = loc(SYN_X, SYN_Z, SYN_R, -0.72, -0.03);
    b.box(wx, F + 0.82, wz, 0.2, 0.02, 0.24, 0x24272b, SYN_R);
    for (let k = 0; k < 2; k++) {
      const [px3, pz3] = loc(SYN_X, SYN_Z, SYN_R, -0.765 + k * 0.09, -0.03);
      b.cylC(px3, F + 0.855, pz3, 0.035, 0.035, 0.045, 8, C.knob, 0, SYN_R, Math.PI / 2);
    }
  }
  // Keys are meshes so they can be played — see animMusic.
  for (let i = 0; i < 4; i++) {
    const [nx, nz] = loc(SYN_X, SYN_Z, SYN_R, -0.42 + i * 0.24, -0.03);
    b.cyl(nx, F + 0.87, nz, 0.035, 0.035, 0.04, 8, C.brass);
  }

  /* Record crate, out front on the right. Built as a box with nothing in it —
     four walls and a floor — because the sleeves stand inside it. As one solid
     block the records were fins stuck in a lump of wood, which is what made
     lifting one out look wrong however it moved. */
  const cw = 0.95, cd = 0.8, ct = 0.07;
  b.box(CRATE_X, F, CRATE_Z, cw, 0.08, cd, C.woodDark, CRATE_R);
  for (const side of [-1, 1]) {
    const [wx2, wz2] = loc(CRATE_X, CRATE_Z, CRATE_R, side * (cw - ct) / 2, 0);
    b.box(wx2, F, wz2, ct, CRATE_H, cd, C.woodDark, CRATE_R);
    const [ex, ez] = loc(CRATE_X, CRATE_Z, CRATE_R, 0, side * (cd - ct) / 2);
    b.box(ex, F, ez, cw, CRATE_H, ct, C.wood, CRATE_R);
  }

  pottedPlant(b, -2.9, -1.4, 1.15, 27);
}

let spinDecks = null, burstMeters = null;
let thumpSpeakers = null, pullRecord = null, playKeys = null;
// The mixer's own focus target, so the scene can tell when it is being read
// and put its LISTEN cue up. Assigned where the targets are registered.
let mixerTarget = null;
// True once LISTEN has been tapped through to the two icons. Owned by
// animMusic's own updater; declared here only so the click handler that sets
// it (mixerTarget's act, registered further down) and the two icons' own hit
// boxes (also registered further down) can all reach the same flag.
let optionsOpen = false;
let scTarget = null, spTarget = null;

function animMusic(group) {
  const ups = [];
  const platters = [];

  // The panel is flat on the booth front and never moves, so it is built with
  // the rest of the island rather than needing a group here.

  for (const side of [-1, 1]) {
    const x = side * 0.85;
    const p = part(b => {
      b.cyl(0, -0.025, 0, 0.29, 0.29, 0.05, 12, C.platter);
      b.cyl(0, 0.025, 0, 0.26, 0.26, 0.012, 12, C.vinyl);
      b.cyl(0, 0.037, 0, 0.085, 0.085, 0.012, 10, 0xd9c98f);
      b.box(0.14, 0.03, 0, 0.16, 0.014, 0.02, 0x4a4643);   // so the spin reads
    });
    p.position.set(x, DECK_Y + 0.19, -0.35);
    group.add(p);
    platters.push(p);
  }
  // Touching a deck spins it up to playing speed for a while.
  let spun = 0;
  spinDecks = function () { spun = 1; touched(); };
  ups.push(function (t, dt, amt, idle) {
    spun = Math.max(0, spun - dt * 0.09);
    const a = Math.min(1, Math.max(amt, idle) + spun);
    for (const p of platters) p.rotation.y += dt * (0.35 + 3.1 * a + spun * 3.4);
  });

  /* Two channel meters, one ladder each, standing on the brow. Segments are
     separate meshes that switch on and off rather than a bar that stretches,
     because a ladder of discrete lamps is what a mixer actually shows and it
     survives the pixel grid better than a smoothly growing rectangle. */
  // Six lamps with a clear gap between them. At seven the gaps fell below a
  // pixel and the ladder rendered as one solid bar, which is a different
  // instrument entirely.
  const SEGS = 6, SEG_PITCH = 0.025;
  const ladders = [[], []];
  for (let ch = 0; ch < 2; ch++) {
    const cx = ch === 0 ? -0.19 : 0.19;
    for (let i = 0; i < SEGS; i++) {
      const col = i >= SEGS - 1 ? C.ledRed : (i >= SEGS - 3 ? C.ledAmber : C.ledCyan);
      const m = part(b => b.box(0, 0, 0, 0.075, 0.013, 0.012, col), true);
      m.position.set(cx, MIX_TOP + 0.032 + i * SEG_PITCH, MIX_BROW_Z + 0.004);
      m.visible = false;
      group.add(m);
      ladders[ch].push(m);
    }
    // The unlit ladder behind, so the meter reads as a meter when it is quiet.
    const back = part(b => b.box(0, 0, 0, 0.085, SEGS * SEG_PITCH, 0.008, 0x14171a));
    back.position.set(cx, MIX_TOP + 0.032 + (SEGS - 1) * SEG_PITCH / 2, MIX_BROW_Z - 0.002);
    group.add(back);
  }

  // The two channel fader caps, which ride their own channel's level.
  const caps = [];
  for (const side of [-1, 1]) {
    const cap = part(b => {
      b.box(0, 0, 0, 0.07, 0.028, 0.05, C.knob);
      b.box(0, 0.028, 0, 0.075, 0.008, 0.012, 0xd6d6d0);
    });
    cap.position.set(side * 0.17, MIX_TOP - 0.002, -0.185);
    group.add(cap);
    caps.push(cap);
  }

  /* Over the mixer: LISTEN first, then — once you tap again — the two ways to
     actually hear it. One panel, two things it can be showing, which is why
     the icons are children of the same group that carries LISTEN rather than
     a second pop-up of their own: they share its one rise. See MIX_CUE_Y for
     why the panel sits where it does. */
  const cue = part(function (b) {
    b.box(0, 0, 0, MIX_CUE_W, MIX_CUE_H, 0.02, C.mixerDark);
    b.box(0, 0.005, 0.011, MIX_CUE_W - 0.02, MIX_CUE_H - 0.01, 0.01, 0x1b3038);
  });
  cue.position.set(0, MIX_CUE_Y, MIX_BROW_Z - 0.04);
  group.add(cue);

  const cueText = part(function (b) {
    textMid(b, MUSIC_LINK.cue, 0, MIX_CUE_MID + 0.04, 0.02, 0.0115, C.ledCyan);
  }, true);
  cue.add(cueText);

  // The two badges, sitting in that same panel once it has been asked twice.
  const scIcon = makeSoundcloudIcon();
  scIcon.position.set(MIX_ICON_X[0], MIX_CUE_MID, 0.018);
  scIcon.visible = false;
  cue.add(scIcon);
  const spIcon = makeSpotifyIcon();
  spIcon.position.set(MIX_ICON_X[1], MIX_CUE_MID, 0.018);
  spIcon.visible = false;
  cue.add(spIcon);

  cue.scale.set(1, 0.0001, 1);
  cue.visible = false;
  /* The sleeves standing in the record crate. Square, filed front to back, all
     sitting flat on the crate floor — no stagger and no lean. A record does not
     tilt out of a crate, it comes straight up out of it, so that is the only
     thing any of them ever does. */
  const sleeves = [];
  const rr = rng(21);
  for (let i = 0; i < 9; i++) {
    /* Square, and centred on its own origin. It used to be drawn from z 0 back
       to -0.58 while its origin sat at the middle of the crate, so every record
       hung a quarter of a unit out the back of it with the front half empty —
       and at 0.58 tall on a 0.38 deep crate they stood more out than in. */
    const m = part(function (b) {
      b.box(0, 0, 0, 0.05, SLEEVE_H, SLEEVE_D, BOOKS[(rr() * BOOKS.length) | 0]);
    });
    const [px, pz] = loc(CRATE_X, CRATE_Z, CRATE_R, -0.28 + i * 0.07, 0);
    m.position.set(px, SLEEVE_Y, pz);
    m.rotation.y = CRATE_R;
    group.add(m);
    sleeves.push(m);
  }

  /* Synth keys, played in a slow rolling figure rather than at random.

     Set out in FRONT of the control panel, not under it. They used to run from
     local z -0.02 back to 0.24 while the panel occupies -0.1 to 0.1 and stands
     higher, so the panel covered the back half of every key and a keyboard came
     out as a row of little square buttons.

     Black keys are narrower, shorter and set higher and further back than the
     white ones, which is the only reason a row of blocks reads as a keyboard. */
  const keys = [];
  for (let i = 0; i < 13; i++) {
    const black = (i % 7 === 1 || i % 7 === 3 || i % 7 === 5);
    const m = part(function (b) {
      if (black) b.box(-0.032, 0, -0.055, 0.064, 0.038, 0.11, 0x24272b);
      // Near enough touching: a keyboard's white keys have a hairline between
      // them, not the gap a row of separate blocks would show.
      else       b.box(-0.053, 0, -0.088, 0.106, 0.028, 0.176, C.paper);
    });
    const [kx, kz] = loc(SYN_X, SYN_Z, SYN_R, -0.66 + i * 0.11, black ? 0.15 : 0.185);
    m.position.set(kx, F + (black ? 0.872 : 0.862), kz);
    m.rotation.y = SYN_R;
    group.add(m);
    keys.push(m);
  }
  // Touch the crate and one record lifts out of it; touch the synth and it
  // plays a run up the keys rather than idling.
  let lifted = -1, liftT = 0, run = 0;
  pullRecord = function () {
    lifted = (lifted + 1) % sleeves.length;
    liftT = 0;
    touched();
  };
  playKeys = function () { run = 0.0001; touched(); };

  ups.push(function (t, dt, amt, idle) {
    const a = Math.max(amt, idle);
    if (lifted >= 0) liftT = Math.min(1, liftT + dt * 0.5);
    for (let i = 0; i < sleeves.length; i++) {
      // Someone thumbing through: a small wave of lifts running back to front.
      const p = Math.sin(t * 1.1 - i * 0.55) * 0.5 + 0.5;
      // The one being pulled comes right up out of the crate and drops back.
      const up = i === lifted ? Math.sin(liftT * Math.PI) * 0.5 : 0;
      sleeves[i].position.y = SLEEVE_Y + p * 0.045 * a + up;
      if (i === lifted && liftT >= 1) lifted = -1;
    }
    if (run > 0) {
      run += dt * 1.5;
      if (run > 2.2) run = 0;
    }
    for (let i = 0; i < keys.length; i++) {
      const idleOn = Math.max(0, Math.sin(t * 2.4 - i * 0.62));
      // A run sweeps one key at a time from the bottom of the board up.
      const pos = run > 0 ? 1 - Math.min(1, Math.abs(run * keys.length - i) * 1.6) : 0;
      const on = Math.max(Math.pow(idleOn, 6) * a, pos);
      keys[i].position.y = F + 0.86 - on * 0.026;
    }
  });

  // Touching the mixer pushes everything into the red for a moment.
  let burst = 0;
  burstMeters = function () { burst = 1; touched(); };
  const pMeter = phaser();
  let cueUp = 0;

  /* Whether the panel is showing LISTEN or the two icons. Set true by the
     mixer's own act(), defined where the target is registered below — a tap
     that lands anywhere in the mixer's box while it is already the thing
     focused reaches that act(), which is the moment to move past LISTEN.

     Reset the instant the mixer stops being read, not left to whatever state
     it was last in — arriving mid-pick, with LISTEN already swapped out for
     icons you have not asked for yet, would be a strange way to meet it. */
  optionsOpen = false;

  ups.push(function (t, dt, amt, idle) {
    burst = Math.max(0, burst - dt * 0.35);
    const a = Math.min(1, Math.max(amt, idle) + burst);
    const k = pMeter(dt, 3.4 + burst * 5);

    // Two channels running their own levels, so the pair never move as one.
    for (let ch = 0; ch < 2; ch++) {
      const lvl = (walk(k + ch * 17.3) * 0.62 + 0.34 + burst * 0.3) * a;
      const lit = Math.round(clamp(lvl, 0, 1) * SEGS);
      for (let i = 0; i < SEGS; i++) ladders[ch][i].visible = i < lit;
      // The fader sits where its channel is running.
      caps[ch].position.z = -0.185 + (0.5 - clamp(lvl, 0, 1)) * 0.17;
    }

    // The cue only exists while the mixer is the thing being read.
    const want = (mixerTarget && activeDetail === mixerTarget) ? 1 : 0;
    if (!want) optionsOpen = false;
    cueUp += (want - cueUp) * (1 - Math.pow(0.004, dt));
    cue.visible = cueUp > 0.01;
    cue.scale.y = Math.max(0.0001, cueUp);

    cueText.visible = !optionsOpen;
    scIcon.visible = optionsOpen;
    spIcon.visible = optionsOpen;
    // Each icon's own hit box exists only in the same moment it is drawn —
    // see where they are registered below.
    if (scTarget) scTarget.enabled = optionsOpen;
    if (spTarget) spTarget.enabled = optionsOpen;
  });

  // Speaker cones, pushing air.
  const cones = [];
  for (const side of [-1, 1]) {
    const g2 = new THREE.Group();
    g2.position.set(side * SPK_X, F + 1.0, SPK_Z);
    g2.rotation.y = -side * 0.32;
    group.add(g2);
    const woof = part(b => b.cylC(0, 0, 0, 0.2, 0.2, 0.07, 10, C.cone, Math.PI / 2, 0, 0));
    woof.position.set(0, 0.32, 0.31);
    const tweet = part(b => b.cylC(0, 0, 0, 0.09, 0.09, 0.06, 8, C.cone, Math.PI / 2, 0, 0));
    tweet.position.set(0, 0.78, 0.31);
    g2.add(woof); g2.add(tweet);
    cones.push(woof, tweet);
  }
  let thump = 0;
  thumpSpeakers = function () { thump = 1; touched(); };
  ups.push(function (t, dt, amt, idle) {
    thump = Math.max(0, thump - dt * 1.9);
    const a = Math.max(amt, idle);
    // The thump is one hard shove that rings out, not a faster wobble.
    const kick = Math.sin(thump * Math.PI * 3) * thump * thump * 0.4;
    const pulse = 1 + Math.sin(t * 8.4) * 0.09 * a + Math.sin(t * 3.1) * 0.05 * a + kick;
    for (const c of cones) c.scale.set(pulse, 1, pulse);
  });

  return ups;
}

/* =============================================================================
   Section: Projects
============================================================================= */

function buildProjects(b, g) {
  island(b, ISLAND, C.baseTop);
  b.cyl(0, F + 0.05, 0.2, 3.0, 3.0, 0.04, 12, C.rug);
  b.cyl(0, F + 0.09, 0.2, 2.3, 2.3, 0.012, 12, 0xdcc6a6);

  b.box(0, F + 0.09, -0.2, 2.3, 0.95, 1.45, C.chest);
  b.box(0, F + 0.09, -0.2, 2.36, 0.12, 1.51, C.chestLid);
  b.box(0, F + 0.92, -0.2, 2.36, 0.12, 1.51, C.chestLid);
  b.box(0, F + 0.14, 0.56, 0.28, 0.7, 0.06, C.brass);
  b.box(0, F + 0.46, 0.56, 0.22, 0.22, 0.08, C.brass);
  for (const sx of [-0.95, 0.95]) {
    b.box(sx, F + 0.14, 0.56, 0.14, 0.78, 0.05, C.brass);
    b.box(sx, F + 0.14, -0.96, 0.14, 0.78, 0.05, C.brass);
  }

  shelf(b, -2.95, -0.6, 2.4, 1.55, Math.PI / 2, 55);

  /* Alphabet blocks instead of the two packing crates that used to stand here.
     A room built around a toy chest had a pair of anonymous brown boxes in the
     corner, which is warehouse, not playroom — and being plain cubes they gave
     the eye nothing, where a block has a letter on it and a colour of its own.
     They spell the room, which is the other thing the boxes were not doing.

     Two on the floor and one on top; the fourth is a mesh so it can be knocked
     off the stack — see animProjects. */
  for (const s of BLOCKS) {
    b.box(s.x, F + s.y, s.z, BLOCK_S, BLOCK_S, BLOCK_S, s.col, s.ry);
    blockLetter(b, s.x, F + s.y + BLOCK_S / 2, s.z, s.ry, s.ch);
  }
  pottedPlant(b, -2.6, 2.4, 1.15, 35);
  void g;
}

/* ---- Alphabet blocks --------------------------------------------------------

   A stack in the corner of the playroom, spelling the room. Each block carries
   its letter sunk into the face that points out of the ring, and a paler panel
   behind it so the letter has something to sit on rather than floating on bare
   wood. `ry` is small and different on each, because a child does not line
   blocks up square and a stack that is perfectly square reads as furniture. */
const BLOCK_S = 0.46;
/* Three along the floor and one on top of the middle, rather than two stacks
   of two — stacked in pairs, the back block of each pair is hidden behind the
   front one and half the word is a colour you cannot read. */
const BLOCKS = [
  { ch: "P", x: 2.24, y: 0, z: -1.06, ry:  0.11, col: C.toyRed },
  { ch: "L", x: 2.78, y: 0, z: -1.00, ry: -0.06, col: C.toyBlue },
  { ch: "A", x: 3.32, y: 0, z: -1.06, ry:  0.14, col: C.toyYellow }
];
const BLOCK_TOP = { ch: "Y", x: 2.78, y: BLOCK_S, z: -1.00, ry: -0.19, col: C.toyGreen };

/** The letter on the outward face of one block, plus the panel it sits on.
    Takes the CENTRE of the block, so it serves both the ones built into the
    island and the loose one, which is drawn around its own origin.

    Drawn a pixel at a time rather than with textMid, because the text helpers
    all draw square onto the x/y plane and a block is turned a little off it.
    Each pixel is placed with the block's own rotation, so the letter lies on
    the face instead of cutting across the corner of it. */
function blockLetter(b, cx, cy, cz, ry, ch) {
  const glyph = FONT[ch];
  if (!glyph) return;
  const half = BLOCK_S / 2;

  const [panelX, panelZ] = loc(cx, cz, ry, 0, half - 0.004);
  b.boxC(panelX, cy, panelZ, 0.3, 0.3, 0.02, C.paper, 0, ry, 0);

  const px = 0.03;
  const w = GLYPH_W * px, h = GLYPH_H * px;
  for (let r = 0; r < GLYPH_H; r++) {
    for (let c = 0; c < GLYPH_W; c++) {
      if (glyph[r * GLYPH_W + c] !== "1") continue;
      const lx = -w / 2 + (c + 0.5) * px;
      const ly = h / 2 - (r + 0.5) * px;
      const [gx, gz] = loc(cx, cz, ry, lx, half + 0.008);
      b.boxC(gx, cy + ly, gz, px, px, 0.02, 0x3b3129, 0, ry, 0);
    }
  }
}

/** The objects that live in the chest. Add a case to add a shape. */
function makeToy(kind, i) {
  const b = new Builder();
  const palette = [C.toyRed, C.toyBlue, C.toyYellow, C.toyGreen, C.toyPurple];
  const col = palette[i % palette.length];

  switch (kind) {
    case "coin":
      b.cylC(0, 0, 0, 0.32, 0.32, 0.09, 14, C.brass, Math.PI / 2, 0, 0);
      for (const f of [0.05, -0.05]) {
        b.cylC(0, 0, f, 0.25, 0.25, 0.02, 14, 0xe2c274, Math.PI / 2, 0, 0);
      }
      // A T on this face and an H on the other, because it is a coin from a
      // heads-or-tails game and half of that was missing.
      b.boxC(0, 0, 0.062, 0.07, 0.17, 0.02, 0xa8853c);
      b.boxC(0, 0.05, 0.062, 0.15, 0.06, 0.02, 0xa8853c);
      for (const s of [-1, 1]) {
        b.boxC(s * 0.05, 0, -0.062, 0.05, 0.17, 0.02, 0xa8853c);
      }
      b.boxC(0, 0, -0.062, 0.09, 0.05, 0.02, 0xa8853c);
      break;

    case "football": {
      // AFL ball: an oval leaning on its side, with the seam and the lacing.
      const tilt = 1.28;
      b.rockS(0, 0, 0, 0.25, C.leather, 1, 0.72, 1.32, 0.72, 0, 0, tilt);
      const seam = new THREE.TorusGeometry(0.248, 0.019, 4, 18);
      seam.scale(0.74, 1.34, 1);
      b._add(seam, C.leatherDark, 0, 0, 0, 0, 0, tilt);
      for (let k = 0; k < 4; k++) {
        const ly = 0.105 - k * 0.066;
        b.boxC(-Math.sin(tilt) * ly, Math.cos(tilt) * ly, 0.2,
               0.065, 0.022, 0.03, C.paper, 0, 0, tilt);
      }
      break;
    }

    case "perfume":
      b.box(0, -0.28, 0, 0.28, 0.32, 0.17, C.perfume);
      b.box(0, -0.3, 0.09, 0.17, 0.12, 0.02, 0xf2e2e8);      // label
      b.box(0, 0.04, 0, 0.11, 0.1, 0.09, C.perfume);          // neck
      b.box(0, 0.14, 0, 0.17, 0.11, 0.13, C.brass);           // collar
      b.box(0.1, 0.19, 0, 0.14, 0.035, 0.035, C.brass);       // tube
      b.rock(0.22, 0.2, 0, 0.075, 0x9b7684);                  // atomiser bulb
      break;

    case "rocket":
      b.cyl(0, -0.2, 0, 0.11, 0.13, 0.4, 8, col);
      b.cone(0, 0.3, 0, 0.13, 0.2, 8, C.paper);
      b.box(-0.14, -0.2, 0, 0.06, 0.16, 0.16, C.paper);
      b.box(0.14, -0.2, 0, 0.06, 0.16, 0.16, C.paper);
      break;

    case "ball":
      b.rock(0, 0, 0, 0.22, col, 1);
      break;

    case "controller":
      b.box(-0.26, -0.09, -0.15, 0.52, 0.18, 0.3, col);
      b.cyl(-0.13, 0.09, 0, 0.055, 0.055, 0.04, 6, C.paper);
      b.cyl(0.13, 0.09, 0, 0.055, 0.055, 0.04, 6, C.paper);
      break;

    case "brush":
      b.cyl(0, -0.24, 0, 0.035, 0.035, 0.42, 6, C.woodLight);
      b.cyl(0, 0.18, 0, 0.055, 0.05, 0.1, 6, C.brass);
      b.cyl(0, 0.28, 0, 0.04, 0.06, 0.12, 6, col);
      break;

    default:                                   // cube
      b.box(-0.17, -0.17, -0.17, 0.34, 0.34, 0.34, col);
      b.box(-0.18, -0.02, -0.18, 0.36, 0.06, 0.36, C.paper);
  }
  return solidMesh(b);
}

let openChest = null, spillProjects = null, toppleCrate = null;

function animProjects(group, def, zone) {
  const ups = [];

  const pivot = new THREE.Group();
  pivot.position.set(0, F + 0.99, -0.92);              // hinge along the back edge
  const lid = new Builder();
  lid.box(0, 0, 0.72, 2.36, 0.2, 1.55, C.chestLid);
  lid.box(0, 0.18, 0.72, 2.2, 0.1, 1.4, C.chest);
  lid.box(0, 0.12, 1.44, 0.22, 0.16, 0.1, C.brass);
  for (const sx of [-0.95, 0.95]) lid.box(sx, 0.18, 0.72, 0.12, 0.06, 1.5, C.brass);
  pivot.add(solidMesh(lid));
  group.add(pivot);

  // What is in the chest is listed in content.js.
  const toys = new THREE.Group();
  toys.position.set(0, F + 0.66, 0);
  group.add(toys);

  const kinds = (CHEST && CHEST.length) ? CHEST : ["cube"];
  const TOY_SCALE = 1.18;
  for (let i = 0; i < Math.min(7, kinds.length); i++) {
    const entry = kinds[i];
    const shape = (typeof entry === "string") ? entry : entry.shape;
    const mesh = makeToy(shape, i);
    mesh.scale.setScalar(TOY_SCALE);
    // Laid out across the chest rather than round it, so that nothing ends up
    // hiding behind anything else from the front.
    const n = Math.min(7, kinds.length);
    const t = n === 1 ? 0.5 : i / (n - 1);
    mesh.userData.home = {
      x: (t - 0.5) * 1.86,
      z: -0.2 + Math.sin(t * Math.PI) * 0.16,
      y: Math.sin(t * Math.PI) * 0.09
    };
    mesh.userData.phase = i * 0.8;
    mesh.userData.spin = 0.34 + (i % 3) * 0.13;
    mesh.position.set(0, -0.34, -0.4);
    toys.add(mesh);

    if (typeof entry === "string") continue;

    // Each object carries its own card, hung above it and hidden until the
    // object is tapped. This is where a project's name lives now.
    const lines = (entry.lines || []).slice();
    if (entry.href) lines.push("TAP AGAIN TO OPEN");
    const cb = new Builder();
    const size = signBoard(cb, 0, 0, 0, entry.title || shape, lines,
                           { titlePx: 0.018, linePx: 0.0135, pad: 0.09 });
    const card = solidMesh(cb);
    card.position.set(mesh.userData.home.x, F + 1.98, mesh.userData.home.z - 0.34);
    card.visible = false;
    group.add(card);

    const d = addMovingDetail(zone, mesh);
    d.card = card;
    d.yOff = size.h / 2 + 0.02;                 // aim between object and card
    cardDetails.push(d);
    if (entry.href) d.act = function () { window.open(entry.href, "_blank", "noopener"); };
  }

  // The chest stays shut until somebody opens it — selecting the island is not
  // the same as reaching for the lid.
  let open = 0, openTo = 0;
  openChest = function () { openTo = openTo > 0.5 ? 0 : 1; touched(); };

  // Books off the shelf on the back wall.
  const spill = bookSpill(group, -2.95, -0.6, Math.PI / 2, 2.4, 1.55, 91);
  spillProjects = spill.throwOut;

  // The top block of the stack, which is the one that gets knocked off it.
  const crateTop = part(function (b) {
    b.box(0, 0, 0, BLOCK_S, BLOCK_S, BLOCK_S, BLOCK_TOP.col);
    blockLetter(b, 0, BLOCK_S / 2, 0, 0, BLOCK_TOP.ch);
  });
  crateTop.position.set(BLOCK_TOP.x, F + BLOCK_TOP.y, BLOCK_TOP.z);
  crateTop.rotation.y = BLOCK_TOP.ry;
  group.add(crateTop);

  let toppled = false, fall = 0;
  toppleCrate = function () { toppled = !toppled; touched(); };

  ups.push(function (t, dt, amt, idle) {
    spill.update(dt);
    const a = Math.max(amt, idle);
    fall += ((toppled ? 1 : 0) - fall) * (1 - Math.pow(0.01, dt));
    // Rocking on the stack, or tipped off the side of it onto the rug.
    // Rocking on the stack, or knocked off the side of it onto the rug.
    crateTop.rotation.z = Math.sin(t * 1.7) * 0.04 * a * (1 - fall) - fall * 1.5;
    crateTop.rotation.y = BLOCK_TOP.ry + fall * 0.5;
    crateTop.position.x = BLOCK_TOP.x + fall * 0.5;
    crateTop.position.z = BLOCK_TOP.z + fall * 0.34;
    crateTop.position.y = F + BLOCK_TOP.y + Math.abs(Math.sin(t * 1.7)) * 0.012 * a
                        - fall * BLOCK_S;

    open += (openTo - open) * (1 - Math.pow(0.005, dt));
    // A touch past the stop, then back — a lid thrown open, not eased open.
    // Idle only creaks it: whatever is inside stays a surprise until it is
    // actually opened.
    pivot.rotation.x = -1.85 * open - Math.sin(open * Math.PI) * 0.16
                     - idle * 0.1 * (1 - open);
    for (const m of toys.children) {
      const home = m.userData.home;
      const wobble = Math.sin(t * 1.15 + m.userData.phase) * 0.09;
      m.position.x += (home.x * open - m.position.x) * Math.min(1, dt * 5);
      m.position.z += ((home.z * open) + (1 - open) * -0.4 - m.position.z) * Math.min(1, dt * 5);
      m.position.y += (((0.82 + home.y + wobble) * open - 0.34 * (1 - open)) - m.position.y) * Math.min(1, dt * 5);
      m.rotation.y += dt * (0.12 + m.userData.spin * open);
      if (m.userData.detail) m.userData.detail.enabled = open > 0.55;
      m.visible = m.position.y > -0.3;
    }
  });

  return ups;
}

/* =============================================================================
   Section: About
============================================================================= */

let ABOUT_TOP = F + 0.8;

function buildAbout(b, g) {
  island(b, ISLAND, C.aboutFloor);
  b.cyl(0, F + 0.05, 0.75, 2.5, 2.5, 0.03, 12, C.rug2);

  shelf(b, -2.95, -0.5, 3.0, 2.0, Math.PI / 2, 17);
  shelf(b, 2.95, -0.8, 2.2, 1.55, -Math.PI / 2, 41);

  const topY = desk(b, 0, 0.55, 2.3, 1.05, 0, C.wood);
  ABOUT_TOP = topY;
  b.box(-0.35, topY, 0.5, 0.72, 0.03, 0.5, C.metal);
  b.boxC(-0.35, topY + 0.24, 0.24, 0.72, 0.46, 0.03, C.metal, -0.22, 0, 0);
  g.boxC(-0.35, topY + 0.24, 0.27, 0.64, 0.38, 0.012, 0x2b3a44, -0.22, 0, 0);
  b.box(0.58, topY, 0.38, 0.16, 0.16, 0.16, C.paper);
  b.cylC(0.69, topY + 0.08, 0.38, 0.05, 0.05, 0.03, 8, C.paper, 0, 0, Math.PI / 2);
  b.box(0.8, topY, 0.78, 0.34, 0.05, 0.24, C.paper, 0.3);
  b.box(0.83, topY + 0.05, 0.8, 0.3, 0.02, 0.2, 0xe6e2d8, 0.3);

  /* Desk lamp. It was a cone on a stick on a puck; a lamp is a weighted base,
     an arm with a joint in it, a shade with a lip, and a bulb you can see up
     inside the shade — which is also what tells you it is switched on. */
  b.cyl(-1.02, topY, 0.22, 0.13, 0.155, 0.035, 10, C.metalDark);
  b.cyl(-1.02, topY + 0.035, 0.22, 0.105, 0.12, 0.03, 10, C.metal);
  b.boxC(-1.02, topY + 0.2, 0.22, 0.032, 0.31, 0.032, C.metalDark, 0.1, 0, 0);
  b.cyl(-0.99, topY + 0.34, 0.235, 0.045, 0.045, 0.05, 8, C.brass);   // the joint
  b.boxC(-0.955, topY + 0.45, 0.27, 0.028, 0.2, 0.028, C.metalDark, 0.5, 0, 0);
  b.cone(-0.93, topY + 0.55, 0.315, 0.175, 0.2, 10, C.brass, Math.PI, 0, 0);
  b.cyl(-0.93, topY + 0.452, 0.315, 0.178, 0.168, 0.028, 10, 0xb98a3e);  // the lip
  g.cyl(-0.93, topY + 0.462, 0.315, 0.075, 0.075, 0.05, 8, 0xffeec2);    // lit bulb

  chair(b, 0.1, 1.7, Math.PI, C.woodDark);
  pottedPlant(b, 2.7, -2.4, 1.3, 43);
  pottedPlant(b, -2.5, 2.3, 0.9, 51);
  crate(b, -1.9, F + 0.05, 2.6, 0.5, 0.3);
  for (let i = 0; i < 4; i++) {
    b.box(-0.9, F + 0.05 + i * 0.075, 2.5, 0.42, 0.075, 0.32, BOOKS[i + 2], i * 0.16);
  }

  // The dog bed: a white bolster with the cushion sunk down inside it. The dog
  // is animated, so he is built in animAbout below.
  const dx = DOG_X, dz = DOG_Z;
  b.cyl(dx, F, dz, DOG_BED_R, DOG_BED_R + 0.04, 0.08, 14, C.bedRim);
  b.cyl(dx, F + 0.08, dz, DOG_BED_R - 0.02, DOG_BED_R, 0.2, 14, C.bedRim);
  b.cyl(dx, F + 0.09, dz, DOG_BED_R - 0.22, DOG_BED_R - 0.22, 0.09, 14, C.bedPad);
  b.cyl(dx, F + 0.18, dz, DOG_BED_R - 0.26, DOG_BED_R - 0.24, 0.03, 14, C.bedPad);
}

/* ---- The dog ----------------------------------------------------------------
   Sandy ridgeback crossed with a kelpie: long back, deep chest, pricked ears
   and the ridge of hair that grows the wrong way down the spine. Lying in the
   sphinx pose with his front paws over the edge of the bed, so he has a head
   to lift when somebody arrives.

   Everything below is measured from the top of the cushion, which is where
   DOG_Y puts the group — so his belly is at y = 0 and nothing floats. */

const DOG_X = 1.9, DOG_Z = 1.6, DOG_BED_R = 0.95;
const DOG_Y = F + 0.21, DOG_RY = 0.34;

function dogBody(b) {
  b.box(0, 0.1, -0.08, 0.42, 0.3, 0.78, C.dog);                // barrel
  b.box(0, 0.08, 0.24, 0.45, 0.32, 0.28, C.dog);               // deeper at the chest
  b.box(0, 0.05, -0.42, 0.44, 0.26, 0.2, C.dog);               // rump
  b.box(0, 0.39, -0.02, 0.11, 0.035, 0.66, C.dogRidge);        // the ridge
  for (const s of [-1, 1]) {
    b.box(s * 0.21, 0.02, -0.3, 0.13, 0.28, 0.4, C.dog);       // hind legs, folded
    b.box(s * 0.19, 0.0, -0.44, 0.15, 0.14, 0.16, C.dogSock);  // hind paws, white
    b.box(s * 0.12, 0.0, 0.32, 0.14, 0.15, 0.38, C.dog);       // forelegs, stretched
    b.box(s * 0.12, 0.0, 0.6, 0.16, 0.12, 0.16, C.dogSock);    // front paws, white
  }
}

function dogHead(b) {
  b.box(0, -0.14, -0.15, 0.19, 0.26, 0.24, C.dog);             // neck
  b.box(0, 0, 0, 0.25, 0.23, 0.25, C.dog);                     // skull
  b.box(0, 0.0, 0.13, 0.16, 0.13, 0.2, C.dogMuzzle);           // muzzle
  b.box(0, -0.025, 0.14, 0.13, 0.035, 0.17, C.dogPale);        // chin
  b.box(0, 0.035, 0.31, 0.085, 0.065, 0.035, C.dogNose);       // nose
  for (const s of [-1, 1]) {
    b.box(s * 0.062, 0.115, 0.115, 0.04, 0.04, 0.025, C.dogNose);    // eyes, proud
    b.box(s * 0.105, 0.16, 0.05, 0.04, 0.045, 0.1, C.dogMuzzle);     // brow
    // Kelpie ears: pricked, and tipped out a little.
    b.boxC(s * 0.1, 0.29, -0.04, 0.085, 0.2, 0.05, C.dogMuzzle, -0.1, 0, s * 0.26);
    b.boxC(s * 0.1, 0.27, -0.015, 0.05, 0.14, 0.03, C.dogPale, -0.1, 0, s * 0.26);
  }
}

let petDog = null, toggleLamp = null;
let spillAboutL = null, spillAboutR = null;
let wakeLaptop = null, stirMug = null;

function animAbout(group, def, zone) {
  const ups = [];
  const topY = ABOUT_TOP;

  // Both bookcases in the study drop books when they are touched.
  const left = bookSpill(group, -2.95, -0.5, Math.PI / 2, 3.0, 2.0, 17);
  const right = bookSpill(group, 2.95, -0.8, -Math.PI / 2, 2.2, 1.55, 41);
  spillAboutL = left.throwOut;
  spillAboutR = right.throwOut;

  // The laptop is on: a cursor blinking away on an otherwise dead screen.
  const cursor = part(function (b) {
    b.boxC(0, 0, 0, 0.05, 0.022, 0.01, 0x9fd8ff);
  }, true);
  cursor.position.set(-0.58, topY + 0.36, 0.3);
  cursor.rotation.x = -0.22;
  group.add(cursor);
  const rows = part(function (b) {
    for (let i = 0; i < 4; i++) b.boxC(0, -i * 0.045, 0, 0.3 - i * 0.05, 0.014, 0.01, 0x4e6e86);
  }, true);
  rows.position.set(-0.46, topY + 0.3, 0.29);
  rows.rotation.x = -0.22;
  group.add(rows);

  let awake = 1, lit = 1;
  wakeLaptop = function () { awake = awake ? 0 : 1; touched(); };

  ups.push(function (t, dt, amt, idle) {
    left.update(dt);
    right.update(dt);
    lit += (awake - lit) * (1 - Math.pow(0.004, dt));
    const a = Math.max(amt, idle) * lit;
    cursor.visible = a > 0.15 && (t * 1.7) % 1 < 0.55;
    rows.visible = a > 0.15;
  });

  // The dog: breathing all the time, head up and tail going when you arrive.
  const dog = new THREE.Group();
  dog.position.set(DOG_X, DOG_Y, DOG_Z);
  dog.rotation.y = DOG_RY;
  group.add(dog);

  const body = part(dogBody);
  dog.add(body);

  const neck = new THREE.Group();
  neck.position.set(0, 0.3, 0.26);
  dog.add(neck);
  const head = part(dogHead);
  head.position.set(0, 0.13, 0.08);
  neck.add(head);

  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 0.14, -0.5);
  dog.add(tailPivot);
  /* Swept round beside his hip, in three lengths that each turn a little more
     than the last. It has to curl: the pivot already sits half a unit back from
     the middle of the bed, so a tail pointing straight out behind him is longer
     than the bed has room for and hangs out through the side of it. Curled, the
     whole thing including the white tip stays over the cushion. */
  const tail = part(function (b) {
    b.boxC(0.092, 0.00, -0.092, 0.10, 0.10, 0.26, C.dog, 0, -0.79, 0);
    b.boxC(0.283, -0.01, -0.220, 0.09, 0.09, 0.21, C.dog, 0, -1.22, 0);
    b.boxC(0.446, -0.02, -0.258, 0.08, 0.08, 0.13, C.dogSock, 0, -1.54, 0);  // white tip
  });
  tailPivot.add(tail);

  // Touching him is worth something on its own: he perks right up for a while
  // and the tail goes properly, then he settles back to whatever the scene is
  // doing.
  let pet = 0;
  petDog = function () { pet = 1; touched(); };

  // Everything of his that speeds up runs on its own accumulated phase.
  const pBreath = phaser(), pLook = phaser(1.2), pWag = phaser();

  ups.push(function (t, dt, amt, idle) {
    pet = Math.max(0, pet - dt * 0.16);
    const a = Math.min(1, Math.max(amt, idle) + pet);
    const breath = Math.sin(pBreath(dt, 1.5 + pet * 1.6)) * 0.5 + 0.5;
    body.scale.set(1 + breath * 0.02, 1 + breath * (0.025 + pet * 0.03), 1);
    // Asleep his chin is down on his paws; awake his head comes up and he
    // has a look around.
    neck.rotation.x = 0.72 - 0.8 * a + Math.sin(t * 0.9) * 0.03 - pet * 0.16;
    neck.rotation.y = Math.sin(pLook(dt, 0.55 + pet * 0.9)) * 0.26 * a;
    neck.rotation.z = Math.sin(t * 0.37) * 0.05 * a;
    // A slow sweep on the cushion most of the time, a proper wag when watched.
    // Wag round on Y, lift on Z — the tail lies out to his side, so what raises
    // it is a roll, not a pitch. Euler order puts the lift first, then the wag.
    tailPivot.rotation.y = Math.sin(pWag(dt, 2.0 + 4.5 * a + pet * 5)) * (0.1 + 0.5 * a);
    tailPivot.rotation.z = 0.05 + 0.17 * a;
  });
  void zone;

  // The lamp warms up.
  const bulb = part(b => b.rock(0, 0, 0, 0.09, C.lampGlow), true);
  bulb.position.set(-0.94, topY + 0.42, 0.3);
  group.add(bulb);
  let lampOn = 1, lampLit = 1;
  toggleLamp = function () { lampOn = lampOn ? 0 : 1; touched(); };
  ups.push(function (t, dt, amt, idle) {
    lampLit += (lampOn - lampLit) * (1 - Math.pow(0.004, dt));
    const a = Math.max(amt, idle);
    const s = 0.55 + a * (0.75 + Math.sin(t * 2.6) * 0.07 + Math.sin(t * 7.3) * 0.03);
    bulb.scale.setScalar(0.12 + s * lampLit);
  });

  // Steam off the mug.
  const puffs = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.07, 0.07),
      new THREE.MeshBasicMaterial({ color: C.steam, transparent: true, opacity: 0 })
    );
    m.position.set(0.58, topY + 0.18, 0.38);
    group.add(m);
    puffs.push(m);
  }
  let steam = 0;
  stirMug = function () { steam = 1; touched(); };
  const pSteam = phaser();
  ups.push(function (t, dt, amt, idle) {
    steam = Math.max(0, steam - dt * 0.3);
    const a = Math.min(1, Math.max(amt, idle) + steam);
    const k = pSteam(dt, 0.42 + steam * 0.75);
    for (let i = 0; i < puffs.length; i++) {
      const p = (k + i / puffs.length) % 1;
      const m = puffs[i];
      m.position.y = topY + 0.18 + p * (0.42 + steam * 0.2);
      m.position.x = 0.58 + Math.sin(p * 5.2 + i) * 0.05;
      m.scale.setScalar(0.5 + p * 1.1);
      m.material.opacity = a * (0.5 + steam * 0.35) * Math.sin(p * Math.PI);
    }
  });

  return ups;
}

/* =============================================================================
   Section: the hourglass
   ---------------------------------------------------------------------------
   Two bulbs in a frame. The level in the lower bulb is the visitor count; the
   stream running through the neck is decorative and always moving, so the
   middle of the ring is never a still object.
============================================================================= */

const HG_R      = 0.82;                    // widest radius of a bulb
const HG_WAIST  = 0.13;                    // radius at the neck
const HG_BULB   = 1.44;                    // height of one bulb
const HG_BASE   = F + 0.24;                // inside floor of the lower bulb
const HG_NECK   = HG_BASE + HG_BULB;
const HG_TOP    = HG_NECK + HG_BULB;

/* Only the island. The hourglass itself turns when you touch it, so all of it —
   woodwork, brass and glass — is built into a group of its own in
   animHourglass, and the ground stays put underneath it. */
function buildHourglass(b, g) {
  island(b, 5.2, C.baseTop);
  void g;
}

/** The frame the glass sits in, drawn around its own centre so it can spin. */
function hourglassFrame(b) {
  b.cyl(0, F, 0, 1.14, 1.28, 0.22, 12, C.wood);
  b.cyl(0, F, 0, 1.24, 1.32, 0.08, 12, C.woodDark);
  b.cyl(0, HG_TOP + 0.02, 0, 0.96, 0.9, 0.18, 12, C.wood);
  b.cyl(0, HG_TOP + 0.2, 0, 0.88, 0.92, 0.07, 12, C.woodDark);

  // Three posts holding it together.
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    const px = Math.cos(a) * 0.96, pz = Math.sin(a) * 0.96;
    b.box(px, F + 0.2, pz, 0.14, HG_TOP - F - 0.18, 0.14, C.woodDark, -a);
    b.box(px, F + 0.2, pz, 0.19, 0.1, 0.19, C.brass, -a);
    b.box(px, HG_TOP - 0.1, pz, 0.19, 0.1, 0.19, C.brass, -a);
  }

  // Brass collars where the glass meets wood, and at the neck.
  b.cyl(0, HG_BASE - 0.07, 0, HG_R + 0.05, HG_R + 0.05, 0.1, 14, C.brass);
  b.cyl(0, HG_TOP - 0.03, 0, HG_R + 0.05, HG_R + 0.05, 0.1, 14, C.brass);
  b.cyl(0, HG_NECK - 0.09, 0, HG_WAIST + 0.07, HG_WAIST + 0.07, 0.18, 10, C.brass);
}

/* Reachable by the visitor-count code as well as by the animation below. */
let sandCol = null, grain = null;

/** The lower bulb tapers, so the sand has to taper with it. */
function sandGeometry(fill) {
  const rTop = HG_R + (HG_WAIST - HG_R) * clamp(fill, 0, 1);
  return new THREE.CylinderGeometry(Math.max(0.09, rTop), HG_R - 0.04, 1, 14);
}

/** The inside of the UPPER bulb, h above the neck: narrow at the neck, wide at
    the top, straight between the two — which is how the glass is built. */
function bulbR(h) {
  return HG_WAIST + (HG_R - HG_WAIST) * clamp(h / HG_BULB, 0, 1);
}

/** And the sand sitting in it, held just inside the glass. `frac` is how much
    of a load is still up there; the geometry is a unit height, to be scaled. */
function topSandGeometry(frac) {
  const h = HG_BULB * HG_LOAD * clamp(frac, 0, 1);
  return new THREE.CylinderGeometry(Math.max(0.06, bulbR(h) - 0.025), HG_WAIST * 0.92, 1, 14);
}

let turnHourglass = null;
let turning = false;

/* How long one bulb takes to empty into the other, and how far through that it
   is. The lower level used to stand for the visitor count; the count is in the
   header where it can actually be read, and down here the sand does what sand
   does — runs out, gets turned over, runs out again. */
const HG_RUN = 60;
const HG_LOAD = 0.94;      // how much of a bulb one load of sand fills
let hgT = 0;
let sandStep = -1;         // which fortieth of the run the tapers were cut for

function animHourglass(group) {
  const ups = [];

  /* The vessel — woodwork, brass and glass — hangs off a pivot at the neck,
     which is what an hourglass actually turns about. Everything above the neck
     mirrors what is below it, so the glass looks identical after the turn and
     only the frame gives it away: the fat plinth ends up on top.

     The sand is deliberately NOT in here. It stays the right way up in the
     world and simply pours again, which is both what sand does and far less
     work than mirroring every level, stream and grain. */
  const vessel = new THREE.Group();
  vessel.position.set(0, HG_NECK, 0);
  group.add(vessel);
  const frame = part(hourglassFrame);
  frame.position.y = -HG_NECK;
  vessel.add(frame);

  /* Turning it over is lift, then spin, then set down — three moves, not one.

     It has to be. The vessel turns about its neck, and the far corner of the
     plinth is 2.14 out from there while the neck is only 1.68 above the
     ground, so halfway round that corner is a third of a unit UNDER the floor
     it is standing on. Spinning on the spot puts the base through the island.
     Lifting first is also simply what you do with an hourglass. */
  const HG_LIFT = 0.62;
  const RISE = 0.24, SPIN = 0.76;         // where in the run each move happens
  let turnFrom = 0, turnTo = 0, turnT = 1;

  turnHourglass = function () {
    if (turnT < 1) return;                 // one turn at a time
    turnFrom = vessel.rotation.z;
    turnTo = turnFrom + Math.PI;
    turnT = 0;
    turning = true;
    touched();
  };

  const ease = p => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
  ups.push(function (t, dt) {
    if (turnT >= 1) return;
    turnT = Math.min(1, turnT + dt * 0.5);

    // Up over the first quarter, hold while it turns, down over the last.
    const up = turnT < RISE ? ease(turnT / RISE)
             : turnT > SPIN ? 1 - ease((turnT - SPIN) / (1 - SPIN))
             : 1;
    vessel.position.y = HG_NECK + up * HG_LIFT;

    const s = clamp((turnT - RISE) / (SPIN - RISE), 0, 1);
    vessel.rotation.z = turnFrom + (turnTo - turnFrom) * ease(s);

    if (turnT >= 1) {
      turning = false;
      vessel.position.y = HG_NECK;
      hgT = 0;                             // the sand starts its run again
    }
  });

  const glassMat = new THREE.MeshLambertMaterial({
    color: C.glass, transparent: true, opacity: 0.55,
    depthWrite: false, side: THREE.DoubleSide
  });

  // Sand in the lower bulb — this is the one that means something.
  sandCol = new THREE.Mesh(sandGeometry(0.2), new THREE.MeshLambertMaterial({ color: C.sand }));
  sandCol.receiveShadow = true;
  sandCol.scale.y = 0.0001;
  sandCol.position.set(0, HG_BASE, 0);
  group.add(sandCol);

  /* Sand still up top. Built as a unit cone and scaled, so its level can drop
     over the run without rebuilding geometry every frame.

     The old one was a fixed 0.44 across where the glass around it is only
     0.379, so it stood out through the side of the bulb. Both radii now come
     off the glass itself: the upper bulb runs from HG_WAIST at the neck to
     HG_R at the top over HG_BULB, so the glass at height h is a straight
     interpolation between them, and the sand is held a hair inside that. */
  const topSand = new THREE.Mesh(
    topSandGeometry(1), new THREE.MeshLambertMaterial({ color: C.sand })
  );
  group.add(topSand);

  // The glass, last so it draws over what is inside it. It turns with the
  // vessel, and is its own mirror image, so it looks the same either way up.
  const lower = new THREE.Mesh(
    new THREE.CylinderGeometry(HG_WAIST, HG_R, HG_BULB, 14, 1, true), glassMat);
  lower.position.set(0, HG_BASE + HG_BULB / 2 - HG_NECK, 0);
  vessel.add(lower);
  const upper = new THREE.Mesh(
    new THREE.CylinderGeometry(HG_R, HG_WAIST, HG_BULB, 14, 1, true), glassMat);
  upper.position.set(0, HG_BULB / 2, 0);
  vessel.add(upper);

  // The stream, and grains falling down it so the motion reads at any size.
  const stream = new THREE.Mesh(
    new THREE.CylinderGeometry(0.065, 0.09, 1, 8),
    new THREE.MeshLambertMaterial({ color: C.sandDark })
  );
  group.add(stream);

  const grains = [];
  for (let i = 0; i < 11; i++) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.12, 0.12),
      new THREE.MeshLambertMaterial({ color: i % 3 ? C.sandDark : C.sand })
    );
    group.add(m);
    grains.push(m);
  }

  // The mound where the stream lands.
  const mound = new THREE.Mesh(
    new THREE.ConeGeometry(0.3, 0.19, 12),
    new THREE.MeshLambertMaterial({ color: C.sandDark })
  );
  group.add(mound);

  // This visit's own grain, dropped once the tally finishes climbing.
  grain = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.12, 0.12),
    new THREE.MeshLambertMaterial({ color: C.sandDark })
  );
  grain.castShadow = true;
  grain.visible = false;
  group.add(grain);

  ups.push(function (t, dt, amt) {
    /* The run. One bulb empties into the other over HG_RUN seconds and then it
       turns itself over and goes again, which is the only thing an hourglass
       has ever done. Tapping it turns it early; either way hgT starts over. */
    if (!turning) {
      hgT = Math.min(1, hgT + dt / HG_RUN);
      if (hgT >= 1) turnHourglass();
    }

    /* Both tapers follow the glass around them, and a cone's top radius cannot
       be scaled without dragging its bottom one along, so the shape has to be
       remade rather than stretched. Not sixty times a second though: once every
       fortieth of the run is far below what anyone can see moving. */
    const step = Math.round(hgT * 40);
    if (step !== sandStep) {
      sandStep = step;
      sandCol.geometry.dispose();
      sandCol.geometry = sandGeometry(hgT * HG_LOAD);
      topSand.geometry.dispose();
      topSand.geometry = topSandGeometry(1 - hgT);
    }

    // Top drains, bottom fills, and the two always add up to one load of sand.
    const topH = HG_BULB * HG_LOAD * (1 - hgT);
    topSand.visible = !turning && topH > 0.02;
    topSand.scale.y = Math.max(0.001, topH);
    topSand.position.set(0, HG_NECK + topH / 2, 0);

    const botH = HG_BULB * HG_LOAD * hgT;
    sandCol.scale.y = Math.max(0.0001, botH);
    sandCol.position.y = HG_BASE + botH / 2;

    const top = HG_BASE + botH;                    // surface of the lower sand
    const drop = Math.max(0.05, HG_NECK - 0.06 - top);

    // Nothing runs while it is up in the air, including the sand itself —
    // a flat disc hanging where the glass used to be gives the trick away.
    stream.visible = !turning;
    mound.visible = !turning;
    sandCol.visible = !turning;
    topSand.visible = !turning;
    for (const g2 of grains) g2.visible = !turning;
    if (turning) return;

    stream.scale.y = drop;
    stream.position.set(0, top + drop / 2, 0);

    mound.position.set(0, top + 0.06, 0);
    mound.scale.setScalar(0.9 + Math.sin(t * 6) * 0.06 * (0.4 + amt));

    // Runs at all times so the middle of the ring is never static, and picks
    // up when the section is the one being read.
    const rate = 0.55 + 0.75 * amt;
    for (let i = 0; i < grains.length; i++) {
      const p = ((t * rate) + i / grains.length) % 1;
      const g2 = grains[i];
      const jitter = 0.035 * p;
      g2.position.set(
        Math.sin(i * 5.1 + t * 2) * jitter,
        HG_NECK - 0.06 - p * drop,
        Math.cos(i * 3.7 + t * 2) * jitter
      );
      g2.rotation.set(t * 2 + i, t * 1.4 + i, 0);
    }
  });

  return ups;
}
/* =============================================================================
   Scene
============================================================================= */

const canvas = document.getElementById("stage");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.shadowMap.enabled = true;
// Soft edges now that a shadow is being looked at directly rather than through
// a pixel grid that was hiding the stepping anyway.
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const PAPER = 0xf7f6f3;

const scene = new THREE.Scene();
scene.background = new THREE.Color(PAPER);

/* Distance haze in the page's own colour, so the far side of the ring settles
   back into the paper instead of competing with the island in front of you.
   The camera sits a fixed 90 out, and the ring is about 15 across, so the
   range is set well wide of that — the effect wants to be felt, not seen. */
scene.fog = new THREE.Fog(PAPER, 86, 200);

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 240);

/* Three lights, and the point of each one:

   sky/ground   an unlit face is never simply dark. It picks up warm from
                above and a cool blue-grey from below, which is what stops
                flat-shaded blocks reading as grey cardboard.
   sun          the warm key. Set lower than it was, because a long shadow
                describes a shape and a short one only proves it is there.
   rim          cold, from behind and low, so silhouettes come off a cream
                background rather than dissolving into it. */
/* The ground half of this is warm, not the cool grey it was. What bounces up
   into the underside of a chair leg is whatever the chair is standing on, and
   everything here stands on a cream floor. The cool stays where it belongs, in
   the fill and the rim, which is what keeps the warm/cool split. */
scene.add(new THREE.HemisphereLight(0xfff4e4, 0xa8977f, 0.84));

const SUN_DIR = new THREE.Vector3(14, 15, 10).normalize();
const SUN_DIST = 34;

const sun = new THREE.DirectionalLight(0xfff0d6, 2.25);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = SUN_DIST * 2.4;
sun.shadow.normalBias = 0.045;  // stops the stepped cylinders self-shadowing
scene.add(sun);
scene.add(sun.target);

const fill = new THREE.DirectionalLight(0xdce6f4, 0.34);
fill.position.set(-11, 7, -6);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xb6ccE4, 0.55);
rim.position.set(-9, 4, -13);
scene.add(rim);

/* ---- Where the sun points, and how tightly ------------------------------------

   A directional light's shadow map is a fixed number of texels spread over
   whatever the shadow camera covers, so covering the whole ring at once means
   every shadow in it is coarse. Wrapped around all seven islands each texel is
   about 17mm across, while a focused view puts a screen pixel at about 9mm —
   so shadow edges were nearly twice as blocky as the pixels they sat in, which
   is the one place the picture stopped being crisp.

   Nothing needs the whole ring sharp at once. So the shadow camera follows
   whatever you are looking at and pulls in tight around it, which is a four to
   five times finer shadow exactly where you are looking, and finer than the
   pixel grid — so shadow edges land on pixel boundaries and stay there.

   The catch is that a shadow camera which moves smoothly makes its shadows
   crawl, because the texel grid slides underneath the geometry. The fix is to
   never place it between texels: work out where it wants to be, then round
   that to a whole number of texels in the light's own frame. The grid then
   moves in whole steps and the shadows sit still. */

const RING_HALF = 17;              // enough for every island at once

/** How wide the shadow camera has to be to cover what the eye camera frames,
    plus enough margin that something standing just out of shot still throws its
    shadow into it — the sun is about forty degrees up, so the tallest things
    here reach a couple of units past themselves.

    Rounded up to whole units so that it settles on a size and stays there: a
    frustum that resizes every frame resizes its texels too, and shadows that
    sit on a grid which is always changing shimmer. */
function sunHalfFor(fit) {
  return clamp(Math.ceil(fit * 1.12 + 1.6), 2, RING_HALF);
}

// An orthonormal frame for the light, so a position can be rounded to texels.
const _lz = SUN_DIR.clone();
const _lx = new THREE.Vector3(0, 1, 0).cross(_lz).normalize();
const _ly = new THREE.Vector3().crossVectors(_lz, _lx).normalize();
const _aim = new THREE.Vector3();
const _aimWide = new THREE.Vector3();
let shadowHalf = -1;

function aimSun(target, half) {
  const texel = (half * 2) / sun.shadow.mapSize.x;
  // Round the aim point to whole texels, along the light's own two axes.
  const u = Math.round(target.dot(_lx) / texel) * texel;
  const v = Math.round(target.dot(_ly) / texel) * texel;
  const w = target.dot(_lz);
  _aim.copy(_lx).multiplyScalar(u)
      .addScaledVector(_ly, v)
      .addScaledVector(_lz, w);

  sun.target.position.copy(_aim);
  sun.position.copy(_aim).addScaledVector(SUN_DIR, SUN_DIST);

  if (half !== shadowHalf) {
    shadowHalf = half;
    const c = sun.shadow.camera;
    c.left = -half; c.right = half; c.top = half; c.bottom = -half;
    // Depth precision is spread over the same near/far however wide the
    // frustum is, so the bias that a wide one needs makes a tight one leak
    // light under things. Scale it with the area it is covering.
    sun.shadow.bias = -0.0012 * (half / RING_HALF);
    c.updateProjectionMatrix();
  }
  sun.target.updateMatrixWorld();
}

const world = new THREE.Group();
scene.add(world);

/* ---- Sections ----------------------------------------------------------------
   Array order in content.js is the order round the ring. */

const RING_R = 11.2;

const ZONE_BUILD = {
  rldatix:   { build: buildRLDatix,   anim: animRLDatix },
  investing: { build: buildInvesting, anim: animInvesting, always: true },
  bjj:       { build: buildBJJ,       anim: animBJJ },
  music:     { build: buildMusic,     anim: animMusic },
  projects:  { build: buildProjects,  anim: animProjects },
  about:     { build: buildAbout,     anim: animAbout },
  hourglass: { build: buildHourglass, anim: animHourglass, always: true }
};

const zones = [];
const pickables = [];
const detailHits = [];

/** A hit box carried by a moving object, so it can be tapped where it is. */
function addMovingDetail(zone, mesh) {
  /* Wrapped round the object itself rather than a fixed cube.

     Every one of these used to get the same 0.66 box whatever it was, which
     for a coin — a disc a tenth of a unit thick — was seven times deeper than
     the thing it stood for, and for a ball lying on its side was half again
     too tall. A hit box is a solid: at this camera a ray comes down at about
     thirty degrees, so a box standing well proud of its object is entered
     long before the object is reached, and answers taps aimed past it.

     Measured off the geometry so it cannot drift when a shape is redrawn,
     with a little margin for comfort and a floor so nothing thin is
     impossible to hit. */
  mesh.geometry.computeBoundingBox();
  const bb = mesh.geometry.boundingBox;
  const size = new THREE.Vector3(), centre = new THREE.Vector3();
  bb.getSize(size);
  bb.getCenter(centre);

  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(
      Math.max(0.2, size.x + 0.07),
      Math.max(0.2, size.y + 0.07),
      Math.max(0.2, size.z + 0.07)
    ),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hit.position.copy(centre);
  mesh.add(hit);
  const detail = {
    zone: zone,
    obj: mesh,
    // Nearly face on, because there is a card to read next to it.
    az: zone.group.rotation.y + 0.12,
    el: 0.34,
    fitH: 1.7,
    fitV: 1.2,
    enabled: false
  };
  hit.userData.detail = detail;
  mesh.userData.detail = detail;
  detailHits.push(hit);
  return detail;
}

/* Details that only wake up while another detail is the one being looked at —
   the four lines on the clipboard, which would otherwise be a set of tiny
   tap targets floating over the end of a bed. */
const gatedDetails = [];

/* Details that bring a written card with them — the objects in the chest. The
   card hangs in the scene beside the object and is only shown while it is the
   thing being looked at. */
const cardDetails = [];

function gateDetail(d, parent) {
  d.gate = parent;
  d.enabled = false;
  gatedDetails.push(d);
  return d;
}

/** Mark a detail as one that does its thing on the first touch, not the
    second — doors, throws, anything mechanical. */
function swings(d) {
  d.actOnFocus = true;
  return d;
}

function refreshGates() {
  for (const d of gatedDetails) {
    d.enabled = d.gate ? (activeDetail === d.gate) : (activeZone === d.gateZone);
  }
}

/** A single object inside a scene worth looking at on its own. Local coords.

    `depth` matters more than it looks. The camera is always angled down, so a
    ray crossing a deep box drops a long way inside it — deep enough and a tap
    aimed at one line of a list enters the box of the line above. Anything
    stacked close together wants a shallow box. */
function addDetail(zone, lx, ly, lz, w, h, fitH, fitV, el, act, depth) {
  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, depth || 0.6),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hit.position.set(lx, ly, lz);
  zone.group.add(hit);

  const ry = zone.group.rotation.y;
  const detail = {
    zone: zone,
    // Face-on: no azimuth offset, because the whole point is to read it.
    az: ry,
    el: el,
    fitH: fitH,
    fitV: fitV,
    pos: new THREE.Vector3(
      zone.group.position.x + Math.cos(ry) * lx + Math.sin(ry) * lz,
      ly,
      zone.group.position.z - Math.sin(ry) * lx + Math.cos(ry) * lz
    )
  };
  detail.act = act || null;
  // Asleep until its island is the one selected. A sign or a whiteboard is a
  // big target, and from right out at the ring a tap should choose the island,
  // not jump straight past it into whatever happened to be behind the cursor.
  detail.gateZone = zone;
  detail.enabled = false;
  gatedDetails.push(detail);
  hit.userData.detail = detail;
  detailHits.push(hit);
  return detail;
}

function addZone(def, x, z, angle, hitW, hitH) {
  const spec = ZONE_BUILD[def.id];
  if (!spec) return null;

  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = angle;

  const b = new Builder(), g = new Builder();
  spec.build(b, g);
  group.add(solidMesh(b));
  if (!g.empty) group.add(glowMesh(g));

  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(hitW, hitH, hitW),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hit.position.y = F + hitH / 2 - 0.4;
  group.add(hit);

  world.add(group);

  const zone = {
    def: def,
    group: group,
    baseY: 0,
    amt: 0,          // 0 asleep, 1 selected — everything animated reads this
    lift: 0,
    focusAz: def.keepAz ? null : angle,
    always: !!spec.always,
    // Where this island sits in the idle cycle. Spaced by the golden ratio so
    // no two wake at the same moment and the order never looks like a queue.
    idlePhase: (zones.length * 0.6180339887) % 1,
    updaters: []
  };
  hit.userData.zone = zone;
  zones.push(zone);
  pickables.push(hit);

  // Built after the zone exists, so animations can register details on it.
  if (spec.anim) zone.updaters = spec.anim(group, def, zone);
  return zone;
}

ZONES.forEach(function (def, i) {
  const a = (i / ZONES.length) * Math.PI * 2;
  const zone = addZone(def, Math.sin(a) * RING_R, Math.cos(a) * RING_R, a, ISLAND, 3.6);
  if (!zone) return;

  if (def.id === "investing") {
    addDetail(zone, BOARD_X, BOARD_Y, BOARD_Z, BOARD_W, BOARD_H, 3.05, 1.75, 0.3,
               function () { boardTurned = boardTurned ? 0 : 1; touched(); });
    swings(addDetail(zone, SCR_X, SCR_Y, SCR_Z, SCR_W, SCR_H, 0.66, 0.44, 0.2,
                     function () { if (redrawCurve) redrawCurve(); }));
    swings(addDetail(zone, VAULT_X, F + 1.0, VAULT_Z + 0.45, 1.9, 2.0, 1.9, 1.5, 0.34,
                     function () { vaultOpen = vaultOpen ? 0 : 1; touched(); }, 0.3));
    swings(addDetail(zone, SAFE_X, F + 0.5, SAFE_Z + 0.36, 0.95, 1.0, 1.05, 0.8, 0.34,
                     function () { safeOpen = safeOpen ? 0 : 1; touched(); }, 0.3));
    swings(addDetail(zone, 2.3, F + 0.62, 1.7, 1.5, 0.7, 1.1, 0.8, 0.45,
                     function () { if (flickCoin) flickCoin(); }));       // the takings
  }

  if (def.id === "bjj") {
    // The two belts are the point of the rack, so this one just frames them.
    swings(addDetail(zone, 1.35, F + 1.2, -3.05, 2.5, 1.1, 1.5, 0.95, 0.16,
                     function () { if (swingBelts) swingBelts(); }));
    swings(addDetail(zone, DUM_X, DUM_Y, DUM_Z, 1.3, 0.8, 1.5, 1.0, 0.42,
                     function () { if (throwDummy) throwDummy(); }, 1.3));
    swings(addDetail(zone, BAG_X + 0.78, F + 1.0, BAG_Z, 0.7, 1.6, 1.3, 1.1, 0.36,
                     function () { if (hitBag) hitBag(); }, 0.7));
    swings(addDetail(zone, 0.1, F + 0.6, 3.0, 2.2, 0.9, 1.9, 1.3, 0.4,
                     function () { if (knockBottle) knockBottle(); }));   // gi and bottle
    swings(addDetail(zone, -2.7, F + 0.17, 2.6, 1.3, 0.5, 2.2, 1.6, 0.4,
                     function () { if (pullMat) pullMat(); }));           // spare mats
  }

  if (def.id === "music") {
    swings(addDetail(zone, -0.85, DECK_Y + 0.2, -0.35, 0.85, 0.4, 0.9, 0.6, 0.5,
                     function () { if (spinDecks) spinDecks(); }, 0.7));
    /* The mixer is the way out to SoundCloud and Spotify now, so it is
       deliberately NOT a swings() target: act must not fire on the first
       touch. One tap brings the camera onto it and puts LISTEN up over the
       brow; the second tap does not leave the site on its own any more, it
       swaps LISTEN for the two icons — nobody should be sent off the site by
       a tap that was aimed at looking at something, and now nobody is sent to
       one destination when they may have wanted the other.

       The box covers the brow and the top face together, which is all of the
       mixer you can see from out front. */
    mixerTarget = addDetail(zone, 0, MIX_TOP + 0.1, -0.44, 0.8, 0.4, 0.72, 0.52, 0.4,
                            function () { optionsOpen = true; touched(); },
                            0.34);
    mixerTarget.onFocus = function () { if (burstMeters) burstMeters(); };

    /* The two icons themselves. Instant, like the clipboard rows: by the time
       either exists to be tapped the camera is already sitting on the mixer,
       so tapping one should open its link on the spot, not spend a moment
       flying somewhere it already is.

       Built off the same MIX_ICON_X and MIX_CUE_MID the meshes are placed with
       in animMusic, plus the panel's own offset, so the two cannot drift apart
       — a hit box that does not agree with what is drawn under it is a tap that
       misses something you can plainly see. Each box is only as wide as its own
       badge, which is why they are not the same width. */
    const scHref = (MUSIC_LINK.links.find(function (l) { return l.id === "soundcloud"; }) || {}).href;
    const spHref = (MUSIC_LINK.links.find(function (l) { return l.id === "spotify"; }) || {}).href;
    const ICON_Y = MIX_CUE_Y + MIX_CUE_MID, ICON_Z = MIX_BROW_Z - 0.022;
    scTarget = addDetail(zone, MIX_ICON_X[0], ICON_Y, ICON_Z, 0.21, 0.13, 0.72, 0.52, 0.4,
                         function () { if (scHref) window.open(scHref, "_blank", "noopener"); },
                         0.12);
    scTarget.instant = true;
    scTarget.enabled = false;
    spTarget = addDetail(zone, MIX_ICON_X[1], ICON_Y, ICON_Z, 0.15, 0.13, 0.72, 0.52, 0.4,
                         function () { if (spHref) window.open(spHref, "_blank", "noopener"); },
                         0.12);
    spTarget.instant = true;
    spTarget.enabled = false;
    for (const side of [-1, 1]) {
      swings(addDetail(zone, side * SPK_X, F + 1.5, SPK_Z, 0.9, 1.15, 0.9, 0.8, 0.25,
                       function () { if (thumpSpeakers) thumpSpeakers(); }));
    }
    swings(addDetail(zone, CRATE_X, F + 0.35, CRATE_Z, 1.1, 0.85, 1.0, 0.85, 0.4,
                     function () { if (pullRecord) pullRecord(); }));     // record crate
    swings(addDetail(zone, SYN_X, F + 0.85, SYN_Z, 1.9, 0.55, 1.25, 0.85, 0.45,
                     function () { if (playKeys) playKeys(); }));         // the synth
  }

  if (def.id === "projects") {
    swings(addDetail(zone, 0, F + 0.95, 0.3, 2.4, 1.4, 2.3, 1.75, 0.42,
                     function () { if (openChest) openChest(); }, 1.3));
    // Framed wide, because the point is watching where the books land.
    swings(addDetail(zone, -2.6, F + 0.78, -0.6, 0.9, 1.6, 2.5, 2.0, 0.3,
                     function () { if (spillProjects) spillProjects(); }));
    // The block stack. Wrapped round all four of them, so a tap anywhere on
    // the pile knocks the top one off it.
    swings(addDetail(zone, 2.78, F + 0.5, -1.0, 2.0, 1.1, 1.9, 1.4, 0.3,
                     function () { if (toppleCrate) toppleCrate(); }, 0.9));
  }

  if (def.id === "about") {
    swings(addDetail(zone, DOG_X, DOG_Y + 0.35, DOG_Z + 0.2, 1.3, 1.0, 1.35, 0.95, 0.3,
                     function () { if (petDog) petDog(); }, 1.0));
    swings(addDetail(zone, -0.35, ABOUT_TOP + 0.22, 0.3, 0.85, 0.6, 0.65, 0.45, 0.3,
                     function () { if (wakeLaptop) wakeLaptop(); }, 0.4));
    swings(addDetail(zone, -0.96, ABOUT_TOP + 0.4, 0.28, 0.5, 0.72, 0.55, 0.5, 0.25,
                     function () { if (toggleLamp) toggleLamp(); }, 0.35));
    swings(addDetail(zone, 0.6, ABOUT_TOP + 0.1, 0.38, 0.36, 0.36, 0.34, 0.26, 0.35,
                     function () { if (stirMug) stirMug(); }, 0.3));
    swings(addDetail(zone, -2.6, F + 1.05, -0.5, 0.9, 2.0, 2.8, 2.2, 0.28,
                     function () { if (spillAboutL) spillAboutL(); }));
    swings(addDetail(zone, 2.6, F + 0.85, -0.8, 0.9, 1.6, 2.5, 2.0, 0.28,
                     function () { if (spillAboutR) spillAboutR(); }));
  }

  /* The booth front is a name and nothing else now — no target of its own. The
     way out to SoundCloud moved onto the mixer, which is the thing you would
     reach for anyway, and a panel that only says who it is has nothing to do
     when you tap it. */

  // The chart on the end of the bed. Tap it to read it; once it fills the
  // screen its four lines become tap targets of their own, and each one opens
  // the message form.
  if (def.id === "rldatix") {
    swings(addDetail(zone, BED_X, F + 0.75, BED_Z - 0.2, 1.1, 0.5, 1.6, 1.1, 0.42,
                     function () { if (raiseBed) raiseBed(); }, 1.2));
    swings(addDetail(zone, 2.15, F + 1.28, 1.35, 0.7, 0.5, 0.75, 0.5, 0.3,
                     function () { if (reshuffleDash) reshuffleDash(); })); // workstation
    swings(addDetail(zone, BED_X + 0.95, F + 0.7, BED_Z - 1.4, 0.62, 0.46, 0.62, 0.42, 0.2,
                     function () { if (spikeVitals) spikeVitals(); }, 0.25));
    swings(addDetail(zone, BED_X - 1.35, F + 1.3, BED_Z - 0.5, 0.5, 0.9, 0.7, 0.6, 0.3,
                     function () { if (runDrip) runDrip(); }));           // the IV pole
    swings(addDetail(zone, -2.95, F + 0.85, -0.42, 0.9, 1.7, 1.1, 0.95, 0.25,
                     function () { if (openDrawer) openDrawer(); }));     // supply cabinet
    const chart = addDetail(zone, BED_X, CHART_Y, BED_Z + 1.42, 0.82, 0.86,
                            0.55, 0.46, 0.24, null, 0.1);
    CLIPBOARD.lines.forEach(function (line, k) {
      // Thin, and a shade in front of the chart, so the row you tapped is the
      // row the ray reaches first.
      const row = addDetail(zone, BED_X - 0.02, CHART_ROW_Y - k * CHART_ROW_STEP,
                            BED_Z + 1.45, 0.44, 0.082, 1.0, 0.74, 0.24,
                            function () { openForm(CLIPBOARD.topics[k] || line); },
                            0.06);
      row.instant = true;                    // acts on the first tap, no zoom
      gateDetail(row, chart);
    });
  }
});

/* The hourglass is not in ZONES — it is the middle of the ring, not a part of
   it — so its own target has to be hung on it here, outside that loop. */
const jarZone = addZone(JAR_ZONE, 0, 0, 0, 4.8, 5.0);
if (jarZone) {
  // Framed wide enough that it stays in shot while it is on its side.
  swings(addDetail(jarZone, 0, HG_NECK, 0, 1.9, 3.0, 2.5, 2.2, 0.3,
                   function () { if (turnHourglass) turnHourglass(); }, 1.9));
}

// Placeholder copy has nowhere left to show itself, so it nags here instead of
// quietly shipping as though it were finished.
for (const def of ZONES) {
  if (def.todo) console.info("[alexparker.au] " + def.label + " — " + def.todo);
}

/* =============================================================================
   Camera, controls, picking
============================================================================= */

let cssW = 1, cssH = 1;
// The rendered buffer's aspect, which is the window's only by accident — see
// resize(). Everything that frames or picks has to use this one.
let renderAspect = 1;


function homeFor() {
  // Standing more overhead on a tall screen puts the height to work instead of
  // leaving it as empty paper. The ring is circular, so no azimuth is narrower.
  return (cssH > cssW * 1.15)
    ? { az: Math.PI * 0.1, el: 1.18, fitH: 15.5, fitV: 14.4 }
    : { az: Math.PI * 0.23, el: 0.62, fitH: 15.8, fitV: 10.9 };
}

let HOME = homeFor();
HOME.target = new THREE.Vector3(0, 1.1, 0);

const cam = {
  az: HOME.az, el: HOME.el, fitH: HOME.fitH, fitV: HOME.fitV,
  scale: 1.9, sx: 0, sy: 0, w: 1, h: 1, target: HOME.target.clone()
};
const want = {
  az: HOME.az, el: HOME.el, fitH: HOME.fitH, fitV: HOME.fitV,
  scale: 1, sx: 0, sy: 0, target: HOME.target.clone()
};

let userMoved = false;

/* ---- Travelling to a view -----------------------------------------------------
   Picking a scene is a journey, not a cut, so the camera works out the whole
   trip up front and then flies it: where it is now, where it is going, the
   short way round, and how long that ought to take.

   Two things this fixes. An azimuth is a bearing, and every bearing has
   infinitely many names — the island at 0.34 is also at 6.62 and at -5.94. The
   camera's own azimuth wanders wherever dragging leaves it, so subtracting one
   raw number from another sent it three-quarters of the way round the ring to
   reach a neighbour. And the old easing was an exponential chase, which is at
   its fastest the instant you tap and crawls at the end: it read as a snap
   followed by a settle rather than a move. A fixed duration eased at both ends
   leaves and arrives gently, and the duration grows with the distance, so
   stepping next door stays brisk while crossing the ring takes its time. */

const TAU = Math.PI * 2;
const MOVE_MIN = 0.55;   // seconds, for a move that barely turns
const MOVE_MAX = 1.3;    // and the cap, for the far side of the ring

/** The same bearing, renamed as whichever of its infinite names is nearest
    `from` — so the difference between them is never more than half a turn. */
function nearestAz(target, from) {
  let d = (target - from + Math.PI) % TAU;
  if (d < 0) d += TAU;
  return from + d - Math.PI;
}

const from = {
  az: HOME.az, el: HOME.el, fitH: HOME.fitH, fitV: HOME.fitV,
  scale: 1, sx: 0, sy: 0, target: HOME.target.clone()
};
let moveT = 1, moveDur = MOVE_MIN;

/** Begin the flight to whatever `want` now holds. */
function startMove() {
  want.az = nearestAz(want.az, cam.az);
  from.az = cam.az;
  from.el = cam.el;
  from.fitH = cam.fitH;
  from.fitV = cam.fitV;
  from.scale = cam.scale;
  from.sx = cam.sx;
  from.sy = cam.sy;
  from.target.copy(cam.target);
  moveDur = Math.min(MOVE_MAX, MOVE_MIN + Math.abs(want.az - cam.az) * 0.26);
  moveT = 0;
}

/** Drop out of a flight, for when the visitor takes the camera themselves. */
function stopMove() { moveT = 1; }

function applyCamera() {
  const R = 90;
  camera.position.set(
    cam.target.x + R * Math.cos(cam.el) * Math.sin(cam.az),
    cam.target.y + R * Math.sin(cam.el),
    cam.target.z + R * Math.cos(cam.el) * Math.cos(cam.az)
  );
  camera.lookAt(cam.target);

  const aspect = renderAspect;
  const fh = cam.fitH * cam.scale, fv = cam.fitV * cam.scale;
  const w = Math.max(fh, fv * aspect);      // whichever axis is the binding one
  const h = w / aspect;
  cam.w = w; cam.h = h;

  camera.left = -w + cam.sx;
  camera.right = w + cam.sx;
  camera.top = h + cam.sy;
  camera.bottom = -h + cam.sy;
  camera.updateProjectionMatrix();
}

const pointers = new Map();
let dragging = false, movedBy = 0, downAt = 0, pinchDist = 0;

canvas.addEventListener("pointerdown", function (e) {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 1) {
    dragging = true;
    movedBy = 0;
    downAt = performance.now();
    document.body.classList.add("dragging");
  } else if (pointers.size === 2) {
    const p = [...pointers.values()];
    pinchDist = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
  }
});

canvas.addEventListener("pointermove", function (e) {
  const prev = pointers.get(e.pointerId);
  if (!prev) { hoverAt(e.clientX, e.clientY); return; }

  const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (pointers.size === 2) {
    const p = [...pointers.values()];
    const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
    if (pinchDist > 0 && d > 0) {
      zoomAt((p[0].x + p[1].x) / 2, (p[0].y + p[1].y) / 2, pinchDist / d);
      cam.scale = want.scale;
    }
    pinchDist = d;
    movedBy += 20;
    return;
  }

  if (!dragging) return;
  movedBy += Math.abs(dx) + Math.abs(dy);
  stopMove();               // a hand on the world outranks a flight in progress
  want.az -= dx * 0.0085;
  want.el = clamp(want.el + dy * 0.006, 0.22, 1.36);
  cam.az = want.az;
  cam.el = want.el;
  userMoved = true;
  touched();
});

function endPointer(e) {
  const wasDragging = dragging;
  pointers.delete(e.pointerId);
  if (pointers.size === 0) {
    dragging = false;
    document.body.classList.remove("dragging");
    pinchDist = 0;
    // A short, still press is a click, not a drag.
    if (wasDragging && movedBy < 8 && performance.now() - downAt < 500) {
      clickAt(e.clientX, e.clientY);
    }
  } else if (pointers.size === 1) {
    pinchDist = 0;
  }
}
canvas.addEventListener("pointerup", endPointer);
canvas.addEventListener("pointercancel", endPointer);

canvas.addEventListener("wheel", function (e) {
  e.preventDefault();
  zoomAt(e.clientX, e.clientY, 1 + e.deltaY * 0.0012);
}, { passive: false });

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let hovered = null;

const _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _hit = new THREE.Vector3();

/* A pointer position, in the -1..1 the raycaster wants. Measured against the
   canvas rather than the window: the canvas is a whole number of pixel blocks
   and so is very slightly larger than the window, and centred in it, so the two
   no longer share an origin. */
function toNdc(px, py) {
  const r = canvas.getBoundingClientRect();
  ndc.x = ((px - r.left) / Math.max(1, r.width)) * 2 - 1;
  ndc.y = -((py - r.top) / Math.max(1, r.height)) * 2 + 1;
}

/** Where the pointer lands on the horizontal plane through the camera target. */
function groundPoint(px, py) {
  toNdc(px, py);
  ray.setFromCamera(ndc, camera);
  _plane.constant = -want.target.y;
  return ray.ray.intersectPlane(_plane, _hit) ? _hit : null;
}

/** Zooming in pulls the view toward whatever the pointer is over, so you can
    get close to one belt or one line on a whiteboard rather than always to the
    middle of an island. */
function zoomAt(px, py, factor) {
  stopMove();
  const before = want.scale;
  want.scale = clamp(before * factor, 0.12, 1.9);
  const k = 1 - want.scale / before;
  if (k > 0.0001) {
    const pt = groundPoint(px, py);
    if (pt) {
      want.target.x += (pt.x - want.target.x) * k * 0.9;
      want.target.z += (pt.z - want.target.z) * k * 0.9;
      const r = Math.hypot(want.target.x, want.target.z);
      if (r > 15) {                       // never let it wander off the ring
        want.target.x *= 15 / r;
        want.target.z *= 15 / r;
      }
    }
  }
  userMoved = true;
  touched();
}

/* Details sit inside a zone's own hit box, so they are tested first — a tap on
   the whiteboard should get you the whiteboard, not the island it stands on. */
function pick(px, py) {
  toNdc(px, py);
  ray.setFromCamera(ndc, camera);
  const dh = ray.intersectObjects(detailHits, false);
  for (const hit of dh) {
    const d = hit.object.userData.detail;
    if (d.enabled === false) continue;      // e.g. objects inside a shut chest
    return { detail: d, zone: d.zone };
  }
  const zh = ray.intersectObjects(pickables, false);
  return zh.length ? { zone: zh[0].object.userData.zone } : null;
}

/* Nothing is labelled, so hovering has to say "this is a thing" by itself: the
   island under the cursor floats up a little. */
function hoverAt(px, py) {
  const p = pick(px, py);
  const z = p ? p.zone : null;
  if (z === hovered) return;
  hovered = z;
  document.body.classList.toggle("overzone", !!z);
}

function clickAt(px, py) {
  const p = pick(px, py);
  if (!p) { clearFocus(); return; }
  if (p.detail) focusDetail(p.detail); else focusZone(p.zone);
}

/* =============================================================================
   Focus

   There is no panel. Selecting something only moves the camera — every word is
   already in the world, on a sign or a board or a screen, so getting close
   enough to read it IS the interface.
============================================================================= */

let activeZone = null;
let activeDetail = null;
let azBeforeFocus = HOME.az;

/** Show the card belonging to whatever is being looked at, and nothing else. */
function refreshCards() {
  for (const c of cardDetails) c.card.visible = (activeDetail === c);
}

/** Move the camera square onto one object. */
function focusDetail(d) {
  // Some targets are switches rather than places — a line on the clipboard
  // opens the form and the view stays where it is.
  if (d.instant) { if (d.act) d.act(); touched(); return; }
  // Already looking at it? Then the tap means "do the thing" — turn the board,
  // open the project, swing the door again.
  if (activeDetail === d && d.act) { d.act(); return; }
  if (!activeZone) azBeforeFocus = want.az;
  activeZone = d.zone;
  activeDetail = d;

  want.az = d.az;
  want.el = d.el;
  want.fitH = d.fitH;
  want.fitV = d.fitV;
  want.scale = 1;
  want.sx = 0;
  want.sy = 0;
  // A detail attached to something that moves reads its position now, once,
  // rather than every frame — otherwise the camera rides the bob. A static one
  // was measured before the island floats up, so add the float back on.
  if (d.obj) {
    d.obj.getWorldPosition(want.target);
    want.target.y += d.yOff || 0;
  } else {
    want.target.copy(d.pos);
    want.target.y += FOCUS_LIFT;
  }

  startMove();

  // Things that do something mechanical — a safe door, a dummy on the mat —
  // should do it the moment you touch them, not on a second tap. Tapping again
  // runs it again, through the branch above.
  if (d.actOnFocus && d.act) d.act();
  // And a target whose act is a way off the site gets to stir on arrival
  // without that stirring being the thing a second tap repeats.
  if (d.onFocus) d.onFocus();

  document.body.classList.add("focused");
  refreshGates();
  refreshCards();
  touched();
}

function focusZone(zone) {
  if (!activeZone) azBeforeFocus = want.az;
  activeZone = zone;
  activeDetail = null;

  const portrait = cssH > cssW * 1.15;
  // Offset off the island's facing, so a focused scene reads as a diorama in
  // three-quarters rather than flattening into a face-on rectangle.
  if (zone.focusAz !== null) want.az = zone.focusAz + 0.34;
  want.el = portrait ? 0.68 : 0.6;
  const small = zone.def.id === "hourglass";
  want.fitH = small ? 4.6 : 5.2;
  want.fitV = small ? 3.5 : 3.7;
  want.scale = 1;
  want.sx = 0;
  want.sy = 0;
  want.target.set(zone.group.position.x, small ? 2.1 : 1.4, zone.group.position.z);
  startMove();

  document.body.classList.add("focused");
  refreshGates();
  refreshCards();
  touched();
}

/* =============================================================================
   The message form

   The one piece of the site that has to be HTML — you cannot type into a mesh.
   There is no server here either: Send hands the message to the visitor's own
   mail app with everything filled in. Nothing is posted anywhere, nothing is
   stored.
============================================================================= */

const dialog = document.getElementById("formDialog");
const elFormTitle = document.getElementById("formTitle");
const elFormNote = document.getElementById("formNote");
const contactForm = document.getElementById("contactForm");
const fName = document.getElementById("fName");
const fEmail = document.getElementById("fEmail");
const fMsg = document.getElementById("fMsg");
const NOTE_IDLE = elFormNote.textContent;

function clearNote() {
  elFormNote.className = "field-note";
  elFormNote.textContent = NOTE_IDLE;
}

function formOpen() { return document.body.classList.contains("form-open"); }

function openForm(topic) {
  elFormTitle.textContent = topic;
  contactForm.dataset.topic = topic;
  clearNote();
  document.body.classList.add("form-open");
  requestAnimationFrame(function () { fName.focus(); });
}

function closeForm() {
  document.body.classList.remove("form-open");
}

document.getElementById("formClose").addEventListener("click", closeForm);
dialog.addEventListener("click", function (e) {
  if (e.target === dialog) closeForm();       // tapping the backdrop shuts it
});

contactForm.addEventListener("submit", function (e) {
  e.preventDefault();
  const name = fName.value.trim();
  const email = fEmail.value.trim();
  const msg = fMsg.value.trim();

  const bad = !name ? fName
            : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? fEmail
            : !msg ? fMsg
            : null;
  if (bad) {
    elFormNote.className = "field-note bad";
    elFormNote.textContent = bad === fEmail
      ? "That email address does not look right."
      : "Fill in all three and it will open your mail app.";
    bad.focus();
    return;
  }

  const topic = contactForm.dataset.topic || CLIPBOARD.title;
  const body = msg + "\n\n--\n" + name + "\n" + email;
  const href = "mailto:" + CONTACT.email
    + "?subject=" + encodeURIComponent(topic + " — alexparker.au")
    + "&body=" + encodeURIComponent(body);

  elFormNote.className = "field-note";
  elFormNote.textContent = "Opening your email app…";
  window.location.href = href;
});

/** Back out to the whole ring. */
function clearFocus() {
  if (!activeZone) return;
  activeZone = null;
  activeDetail = null;
  want.az = azBeforeFocus;
  want.el = HOME.el;
  want.fitH = HOME.fitH;
  want.fitV = HOME.fitV;
  want.scale = 1;
  want.sx = 0;
  want.sy = 0;
  want.target.copy(HOME.target);
  startMove();
  document.body.classList.remove("focused");
  refreshGates();
  refreshCards();
}

document.addEventListener("keydown", function (e) {
  if (e.key !== "Escape") return;
  // On the form, Escape shuts the form rather than throwing away the view as
  // well with a half-typed message in it.
  if (formOpen()) closeForm(); else clearFocus();
  // Backing out is still someone using the place, so the drift waits again.
  touched();
});

/* Every deliberate act a visitor makes goes through here — a drag, a tap, a
   pinch, and every switch and door those taps set off. It hides the hint, and
   it is also what tells the idle drift to get out of the way. */
let lastTouch = performance.now();
function touched() {
  lastTouch = performance.now();
  document.body.classList.add("touched");
}

/* =============================================================================
   Visitor count
============================================================================= */

const API = "https://api.counterapi.dev/v2/alexander-parkers-team-4716/first-counter-4716";
const LOCAL_KEY = "ap_count_local";
const counterEl = document.getElementById("counter");
if (counterEl) counterEl.title = "One grain for every visit";

function pickNumber(list) {
  for (const v of list) if (typeof v === "number" && isFinite(v)) return v;
  return null;
}

// Looking at the site locally should not add grains to the real jar, so a
// preview keeps its own private tally and never touches the hosted counter.
const PREVIEW = location.protocol === "file:" ||
  /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/.test(location.hostname);

function localTally() {
  let v = 0;
  try { v = parseInt(localStorage.getItem(LOCAL_KEY) || "0", 10); } catch (err) {}
  if (!isFinite(v) || v < 0) v = 0;
  v += 1;
  try { localStorage.setItem(LOCAL_KEY, String(v)); } catch (err) {}
  return Math.max(1, v);
}

function fetchCount() {
  if (PREVIEW) return Promise.resolve(localTally());

  const ctrl = new AbortController();
  const timer = setTimeout(function () { ctrl.abort(); }, 4500);

  return fetch(API + "/up", { signal: ctrl.signal, cache: "no-store" })
    .then(function (r) {
      clearTimeout(timer);
      if (!r.ok) throw new Error("bad status " + r.status);
      return r.json();
    })
    .then(function (j) {
      const d = (j && j.data) ? j.data : {};
      let v = pickNumber([d.up_count, d.value, d.count, j && j.count, j && j.value]);
      if (v === null) throw new Error("no count in response");
      v = Math.max(1, Math.floor(v));
      try { localStorage.setItem(LOCAL_KEY, String(v)); } catch (err) {}
      return v;
    })
    .catch(function () {
      // Offline or the counter is down: fall back to the per-browser tally so
      // the jar still fills and nothing looks broken.
      return localTally();
    });
}

/* The level in the glass used to stand for the visitor count. It does not any
   more — it runs out over a minute and turns itself over, because that is what
   an hourglass does, and a level that is really a logarithm of a tally is a
   chart pretending to be an object. The count is in the header, where it can
   be read, and this visit still gets its own grain dropped down the neck. */
let total = 0, pourStart = 0, pouring = false;
let grainFall = false, grainT = 0;

function startPour(count) {
  total = count;
  pourStart = performance.now();
  pouring = true;
}

function setCounter(v) { counterEl.textContent = Math.round(v).toLocaleString(); }

function dropGrain() {
  if (!grain) return;
  grain.visible = true;
  grain.position.set(0, HG_NECK - 0.06, 0);
  grainT = 0;
  grainFall = true;
}

/* =============================================================================
   Resize and loop
============================================================================= */

function resize() {
  cssW = Math.max(1, window.innerWidth);
  cssH = Math.max(1, window.innerHeight);

  /* Rendered at the screen's own resolution. This used to draw into a buffer
     about 720 across and let the browser blow it up without smoothing, which
     put the pixel-art look in the RENDERER — and made everything pay for it:
     a whiteboard could hold only so much lettering, a curve on a screen came
     out as a staircase, and every edge in the world crawled a pixel at a time
     as the camera moved.

     The look is in the MODELS instead, where it belongs. Everything here is
     built out of square blocks and coarsely faceted cylinders, and reading
     those cleanly at full resolution is a sharper version of the same thing,
     not a different thing. Nothing about the world changed; it is just no
     longer being viewed through a screen door.

     The ratio is capped at two. Past that it is spending four times the fill
     rate on a difference nobody can see at arm's length. */
  const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.setSize(cssW, cssH, false);
  renderAspect = cssW / cssH;

  // A shadow now sits next to a full-resolution edge, so it has to be a good
  // deal finer than it used to get away with being.
  const shadowRes = cssW < 700 ? 2048 : 4096;
  if (sun.shadow.mapSize.x !== shadowRes) {
    sun.shadow.mapSize.set(shadowRes, shadowRes);
    if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  }

  // Rotating a phone changes what a good default view is. Adopt the new one,
  // but never yank the camera away from a view the visitor set themselves —
  // nor back to the start of a drift that has been quietly turning for a while,
  // which from the outside is the same thing: an angle nobody asked to leave.
  const home = homeFor();
  HOME.fitH = home.fitH; HOME.fitV = home.fitV;
  HOME.az = home.az; HOME.el = home.el;
  if (!activeZone) {
    want.fitH = HOME.fitH;
    want.fitV = HOME.fitV;
    if (!userMoved && !drifted) {
      want.az = HOME.az; want.el = HOME.el; cam.az = HOME.az; cam.el = HOME.el;
    }
  }

  applyCamera();
}
window.addEventListener("resize", resize);
window.addEventListener("orientationchange", resize);

let last = performance.now();

// How long one island waits for its turn to stir, and how much of that turn it
// spends awake. Seven islands over eleven seconds means something somewhere is
// always moving, without the whole world twitching at once.
const IDLE_PERIOD = 11;
const IDLE_WAKE = 0.3;

/* Left alone, the ring turns. Slowly enough that you notice it has moved
   rather than watch it moving — a shade under two minutes to come all the way
   round, so an island drifts past about every twenty seconds.

   It is the camera that orbits, not the world. Same picture either way, and
   this way nothing downstream has to know: the islands stay where they were
   built, so every angle, hit box and framing computed from them still holds. */
const DRIFT_RATE = 0.055;     // radians a second
const DRIFT_WAIT = 3500;      // milliseconds of being left alone first
let drift = 0;                // eased 0..1, so it never lurches into motion
let drifted = false;          // has it moved the view off its starting angle?

// Anyone who has asked their system for less movement should not be given a
// slowly revolving room. Read live, since it can be changed while open.
const lessMotion = window.matchMedia
  ? window.matchMedia("(prefers-reduced-motion: reduce)")
  : { matches: false };

function frame(now) {
  requestAnimationFrame(frame);
  /* The clamp exists for one reason: a tab backgrounded for a while and then
     resumed must not replay the missed time in a single lurch — an island
     should not visibly leap across the ring because the frame rate stalled.

     It does not exist to assume a frame rate. It was 0.05 (a 20fps floor),
     which is fine for a cheap scene that always runs well above that — but
     this one no longer always does, and every dt-driven motion in the world
     shares this one number: below the floor, all of it quietly plays in slow
     motion, in exact proportion to how far short of 20fps the frame lands.
     That is not a guard against a pathological jump, it is a tax on ordinary
     slow frames. 0.1 still catches the real pathological case — a multi-
     second gap is clamped hard either way — while giving a phone room to
     dip into single digits without the picture visibly dragging. */
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const t = now / 1000;

  /* Drift only from the wide view, and only between journeys: turning the
     world while someone is reading a whiteboard, or while the camera is
     already flying somewhere, is a fight rather than an idle. */
  const idling = !activeZone && !dragging && moveT >= 1 && !lessMotion.matches &&
                 (now - lastTouch) > DRIFT_WAIT;
  // Slow to come on, quick to get out of the way.
  drift += ((idling ? 1 : 0) - drift) * (1 - Math.pow(idling ? 0.28 : 0.0005, dt));
  if (drift > 0.001) {
    // Both, and by the same amount, so the easing below has nothing to correct
    // and the drift cannot be quietly undone.
    const d = DRIFT_RATE * drift * dt;
    cam.az += d;
    want.az += d;
    drifted = true;
  }

  if (moveT < 1) {
    // A planned flight: a fixed run, eased at both ends, along the route
    // startMove() worked out. Slow away, quick through the middle, slow in.
    moveT = Math.min(1, moveT + dt / moveDur);
    const e = moveT < 0.5
      ? 4 * moveT * moveT * moveT
      : 1 - Math.pow(-2 * moveT + 2, 3) / 2;
    cam.az = from.az + (want.az - from.az) * e;
    cam.el = from.el + (want.el - from.el) * e;
    cam.fitH = from.fitH + (want.fitH - from.fitH) * e;
    cam.fitV = from.fitV + (want.fitV - from.fitV) * e;
    cam.scale = from.scale + (want.scale - from.scale) * e;
    cam.sx = from.sx + (want.sx - from.sx) * e;
    cam.sy = from.sy + (want.sy - from.sy) * e;
    cam.target.lerpVectors(from.target, want.target, e);
  } else {
    // Everything else — the opening zoom-out, a pinch, a window resize — is a
    // target that keeps shifting under the camera, so it just chases.
    const k = 1 - Math.pow(0.0016, dt);
    cam.az += (want.az - cam.az) * k;
    cam.el += (want.el - cam.el) * k;
    cam.fitH += (want.fitH - cam.fitH) * k;
    cam.fitV += (want.fitV - cam.fitV) * k;
    cam.scale += (want.scale - cam.scale) * k;
    cam.sx += (want.sx - cam.sx) * k;
    cam.sy += (want.sy - cam.sy) * k;
    cam.target.lerp(want.target, k);
  }
  applyCamera();

  /* Point the sun's shadow at whatever is being read. Aimed at where the
     camera is looking rather than at the island itself, so a detail you have
     zoomed right into is dead centre of the sharp region. Once the whole ring
     is in view, back out to covering all of it — a shadow that is one screen
     pixel wide does not need any more resolution than that. */
  if (activeZone) {
    aimSun(cam.target, sunHalfFor(Math.max(cam.fitH, cam.fitV) * cam.scale));
  } else {
    _aimWide.set(0, 1.1, 0);
    aimSun(_aimWide, RING_HALF);
  }

  const ease = 1 - Math.pow(0.006, dt);
  for (const zone of zones) {
    const selected = activeZone === zone;
    zone.amt += ((selected ? 1 : 0) - zone.amt) * ease;

    // Hover floats an island, which is the only cue that it can be selected.
    const liftTo = (!activeZone && hovered === zone) ? 0.34 : (selected ? FOCUS_LIFT : 0);
    zone.lift += (liftTo - zone.lift) * ease;
    zone.group.position.y = zone.lift;

    // Nothing is selected most of the time, and a still world looks broken. So
    // each island gets a turn: a slow swell that wakes whatever it animates for
    // a few seconds, then lets it settle again.
    const p = (t / IDLE_PERIOD + zone.idlePhase) % 1;
    const idle = p < IDLE_WAKE ? Math.sin((p / IDLE_WAKE) * Math.PI) * 0.7 : 0;

    if (zone.always || zone.amt > 0.002 || selected || idle > 0.002) {
      for (const u of zone.updaters) u(t, dt, zone.amt, idle);
    }
  }

  // The pour: the jar fills while the tally climbs, then one last grain drops.
  // The tally climbing to the real number, and then this visit's own grain.
  // The sand level is the hourglass's own business now — see animHourglass.
  if (pouring) {
    const p = (now - pourStart) / 1800;
    const e = p >= 1 ? 1 : 1 - Math.pow(1 - p, 3);
    setCounter(total * e);
    if (p >= 1) { pouring = false; setCounter(total); dropGrain(); }
  }

  if (grainFall && grain) {
    grainT += dt;
    const landY = HG_BASE + sandCol.scale.y + 0.07;
    const y = (HG_NECK - 0.06) - 4.2 * grainT * grainT;
    if (y <= landY) {
      grain.position.set(0, landY, 0);
      if (grainT > 1.4) { grain.visible = false; grainFall = false; }
    } else {
      grain.position.set(0, y, 0);
      grain.rotation.x += dt * 6;
      grain.rotation.z += dt * 4;
    }
  }

  renderer.render(scene, camera);
}

/* ---- Go ---------------------------------------------------------------------- */

resize();
requestAnimationFrame(frame);
requestAnimationFrame(function () { document.body.classList.add("loaded"); });

fetchCount().then(startPour);
