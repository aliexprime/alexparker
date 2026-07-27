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
import { ZONES, JAR_ZONE, BOARD, CHEST, CLIPBOARD, CONTACT } from "./content.js";

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
  pot:       0xb9714f,
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
  beltWhite: 0xe8e5dc,
  beltBlack: 0x2f2c2a,
  gi:        0xe4e2da,

  deckBody:  0x4a4f55,
  platter:   0x9aa1a6,
  vinyl:     0x2b2926,
  mixer:     0x3b4046,
  speaker:   0x3f4348,
  cone:      0x8d7f6d,
  ledCyan:   0x7fd6d0,
  ledAmber:  0xe8b95c,

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
    for (let i = 0; i < pos.length; i += 3) {
      this.p.push(pos[i], pos[i + 1], pos[i + 2]);
      this.n.push(nor[i], nor[i + 1], nor[i + 2]);
      this.c.push(r, gr, b);
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
};
const GLYPH_W = 5, GLYPH_H = 7;

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
    let bx = -w / 2 + t + 0.05;
    while (bx < w / 2 - t - 0.12) {
      const bw = 0.055 + r() * 0.055;
      const bh = Math.min(0.34, gap - 0.12) * (0.7 + r() * 0.3);
      if (r() > 0.16 && shelfY + bh < cap + 0.12) {
        const [px, pz] = loc(x, z, ry, bx + bw / 2, 0.02);
        b.box(px, shelfY, pz, bw, bh, 0.24, BOOKS[(r() * BOOKS.length) | 0], ry);
      }
      bx += bw + 0.012;
    }
  }
}

function pottedPlant(b, x, z, scale) {
  const s = scale || 1;
  b.cyl(x, F, z, 0.19 * s, 0.15 * s, 0.26 * s, 8, C.pot);
  b.cyl(x, F + 0.26 * s, z, 0.2 * s, 0.2 * s, 0.04 * s, 8, 0xa56243);
  b.box(x, F + 0.28 * s, z, 0.05 * s, 0.28 * s, 0.05 * s, C.plantDark);
  b.rock(x, F + 0.62 * s, z, 0.26 * s, C.plant);
  b.rock(x + 0.18 * s, F + 0.48 * s, z - 0.1 * s, 0.17 * s, C.plantDark);
  b.rock(x - 0.15 * s, F + 0.52 * s, z + 0.12 * s, 0.15 * s, C.plant);
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
const CHART_Y = F + 0.6;

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
  b.box(bx, frameY + 0.1, bz - 0.62, 1.0, 0.2, 0.62, C.mattress);
  b.box(bx, frameY + 0.3, bz - 0.92, 1.0, 0.18, 0.42, C.mattress);
  b.box(bx, frameY + 0.48, bz - 1.0, 0.66, 0.1, 0.3, C.paper);
  b.box(bx, frameY + 0.27, bz + 0.62, 1.02, 0.07, 1.0, C.blanket);
  b.box(bx, frameY + 0.27, bz + 1.06, 1.02, 0.09, 0.16, C.blanket2);
  b.box(bx, frameY, bz - 1.2, 1.06, 0.5, 0.07, C.metal);
  b.box(bx, frameY, bz + 1.2, 1.06, 0.36, 0.07, C.metal);
  b.box(bx - 0.55, frameY + 0.16, bz + 0.2, 0.05, 0.26, 1.3, C.metal);
  b.box(bx + 0.55, frameY + 0.16, bz + 0.2, 0.05, 0.26, 1.3, C.metal);
  // Chart hanging off the end of the bed — a focus target of its own.
  const cbY = CHART_Y - 0.3;
  b.box(bx, cbY, bz + 1.4, 0.46, 0.6, 0.03, C.woodDark);
  b.box(bx, cbY + 0.03, bz + 1.42, 0.39, 0.5, 0.02, C.paper);
  b.box(bx, cbY + 0.46, bz + 1.42, 0.39, 0.07, 0.025, C.rld);
  b.box(bx, cbY + 0.56, bz + 1.4, 0.2, 0.07, 0.06, C.metal);
  textXY(b, "RLDATIX", bx - 0.147, cbY + 0.52, bz + 1.4425, 0.0072, C.paper);
  // The four lines the panel offers, written on the paper as well, so zooming
  // in on the chart shows the same thing the panel does.
  const CHART_ROWS = ["RISK", "POLICY", "WORKFORCE", "DATA"];
  for (let i = 0; i < CHART_ROWS.length; i++) {
    const ry = cbY + 0.41 - i * 0.095;
    b.box(bx - 0.185, ry - 0.032, bz + 1.435, 0.03, 0.03, 0.01, 0xb4bcb9);
    b.box(bx - 0.18, ry - 0.027, bz + 1.44, 0.02, 0.02, 0.01, C.rld);
    textXY(b, CHART_ROWS[i], bx - 0.145, ry, bz + 1.4375, 0.0052, 0x4a5250);
  }

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
  b.box(-2.95, F + 0.6, -0.42, 0.72, 0.5, 0.04, 0xdde6e7);
  b.box(-2.95, F + 1.15, -0.42, 0.72, 0.44, 0.04, 0xdde6e7);
  b.box(-2.68, F + 0.28, -0.4, 0.1, 0.05, 0.05, C.metal);
  b.box(-2.68, F + 0.83, -0.4, 0.1, 0.05, 0.05, C.metal);

  b.box(2.95, F, -0.9, 0.62, 0.86, 1.9, C.white);
  b.box(2.95, F + 0.86, -0.9, 0.7, 0.08, 2.0, 0xe4ebec);
  b.box(2.95, F + 0.94, -1.5, 0.34, 0.08, 0.42, 0xc8d6d7);
  b.box(2.8, F + 0.94, -1.72, 0.05, 0.24, 0.05, C.metal);

  b.cyl(-2.2, F, 1.5, 0.24, 0.2, 0.42, 8, C.metal);
  b.cyl(-2.2, F + 0.42, 1.5, 0.26, 0.26, 0.07, 8, C.blanket);
  b.cyl(2.5, F, -2.6, 0.2, 0.17, 0.42, 8, 0xd5dcdc);
  pottedPlant(b, -2.9, 2.3, 1.0);
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

function animRLDatix(group) {
  const ups = [];

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
  ups.push(function (t, dt, amt, idle) {
    const a = Math.max(amt, idle);
    for (let i = 0; i < bars.length; i++) {
      bars[i].position.y = ecgWave(t * 0.75 - i * 0.055) * 0.10 * a;
    }
  });

  // A drip working its way down the line.
  const drop = part(b => b.box(0, -0.025, 0, 0.045, 0.05, 0.045, 0xbcd6e0));
  drop.castShadow = false;
  group.add(drop);
  ups.push(function (t, dt, amt, idle) {
    drop.visible = Math.max(amt, idle) > 0.4;
    if (!drop.visible) return;
    const p = (t * 0.75) % 1;
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
  ups.push(function (t, dt, amt, idle) {
    const a = Math.max(amt, idle);
    for (let i = 0; i < dashBars.length; i++) {
      const h = 0.05 + walk(t * 0.5 + i * 3.7) * 0.26;
      dashBars[i].scale.y = 0.04 + h * a;
    }
  });

  return ups;
}

/* =============================================================================
   Section: Investing
============================================================================= */

// The board is big enough, and specific enough, to be worth looking at on its
// own — so its geometry is described here and picked up as a focus target.
const BOARD_X = 1.35, BOARD_Z = -2.95, BOARD_W = 3.5, BOARD_H = 2.15;
const BOARD_Y = F + 1.55;

function buildInvesting(b, g) {
  island(b, ISLAND, C.invFloor);

  const vx = -2.55, vz = -0.9;
  b.box(vx, F, vz, 1.9, 2.0, 0.95, C.vaultDark);
  b.box(vx, F + 0.05, vz + 0.5, 1.7, 1.85, 0.06, C.vault);
  b.cylC(vx, F + 0.98, vz + 0.56, 0.62, 0.62, 0.14, 10, C.vault, Math.PI / 2, 0, 0);
  b.cylC(vx, F + 0.98, vz + 0.64, 0.5, 0.5, 0.05, 10, C.vaultDark, Math.PI / 2, 0, 0);
  b.cylC(vx, F + 0.98, vz + 0.69, 0.12, 0.12, 0.08, 8, C.brass, Math.PI / 2, 0, 0);
  for (let i = 0; i < 4; i++) {
    b.boxC(vx, F + 0.98, vz + 0.69, 0.72, 0.055, 0.055, C.brass, 0, 0, (i * Math.PI) / 4);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.4;
    b.boxC(vx + Math.cos(a) * 0.74, F + 0.98 + Math.sin(a) * 0.74, vz + 0.53, 0.08, 0.08, 0.06, C.brass);
  }
  b.box(vx, F + 2.0, vz, 2.0, 0.1, 1.05, C.vault);

  b.box(-2.5, F, 1.15, 0.95, 1.0, 0.8, C.safe);
  b.box(-2.5, F + 0.07, 1.53, 0.8, 0.86, 0.06, 0x5a636a);
  b.cylC(-2.36, F + 0.5, 1.59, 0.12, 0.12, 0.06, 8, C.brass, Math.PI / 2, 0, 0);
  b.box(-2.76, F + 0.46, 1.57, 0.05, 0.28, 0.05, C.brass);
  crate(b, -2.5, F + 1.0, 1.15, 0.34, 0.3);

  const topY = desk(b, 0.35, 0.75, 2.0, 1.0, 0, C.wood);
  monitor(b, g, 0.15, topY, 0.55, 0.82, 0.52, 0, 0x1d3a2a);
  b.box(0.9, topY, 0.95, 0.38, 0.03, 0.22, 0xd6d6d0);
  b.box(1.2, topY, 0.6, 0.2, 0.24, 0.14, C.paper);
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

  b.box(-0.6, F, -2.45, 1.15, 0.85, 0.8, C.metalDark, 0.18);
  b.box(-0.6, F + 0.85, -2.45, 1.25, 0.16, 0.9, C.metal, 0.18);
  g.box(-0.6, F + 0.66, -2.07, 0.34, 0.12, 0.02, C.screenGrn, 0.18);
  b.box(-0.5, F + 0.3, -1.9, 0.6, 0.05, 0.34, C.money, 0.18);
  pottedPlant(b, -1.0, 2.5, 1.1);
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

function animInvesting(group) {
  const ups = [];

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

  // The chart scrolls: each candle inherits the one to its right.
  const chart = new THREE.Group();
  chart.position.set(0.15, F + 1.14, 0.582);
  group.add(chart);
  const candles = [];
  for (let i = 0; i < 10; i++) {
    const m = part(b => b.box(0, 0, 0, 0.042, 1, 0.012, C.screenGrn), true);
    m.position.set(-0.32 + i * 0.071, 0, 0);
    chart.add(m);
    candles.push(m);
  }
  ups.push(function (t, dt, amt, idle) {
    const a = Math.max(amt, idle);
    for (let i = 0; i < candles.length; i++) {
      const k = t * 0.6 + i * 0.55;
      const h = 0.04 + walk(k) * 0.22;
      candles[i].scale.y = 0.03 + h * a;
      candles[i].position.y = -0.16 + walk(k * 0.5 + 11) * 0.2 * a;
    }
  });

  // The press keeps running notes out onto the tray.
  const press = new THREE.Group();
  press.position.set(-0.6, 0, -2.45);
  press.rotation.y = 0.18;
  group.add(press);
  const note = part(b => {
    b.box(0, 0, 0, 0.52, 0.035, 0.28, C.money);
    b.box(0, 0.035, 0, 0.48, 0.012, 0.24, 0xa3bd90);
  });
  press.add(note);
  ups.push(function (t, dt, amt, idle) {
    note.visible = Math.max(amt, idle) > 0.35;
    if (!note.visible) return;
    const p = (t * 0.45) % 1;
    const slide = Math.min(1, p / 0.6);
    const fall = p < 0.6 ? 0 : Math.min(1, (p - 0.6) / 0.4);
    note.position.set(0.08, F + 0.56 - fall * 0.24, 0.15 + slide * 0.44);
    note.rotation.x = fall * 0.14;
  });

  return ups;
}

/* =============================================================================
   Section: Jiu-jitsu — mats, a heavy bag, and the belts that came before
============================================================================= */

const BAG_X = -2.85, BAG_Z = -1.5;

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

  // White belt, two stripes taped across the bar.
  const wx = rx - 0.46;
  b.box(wx, F + 0.96, rz, 0.28, 0.82, 0.08, C.beltWhite);
  b.box(wx, F + 1.02, rz, 0.3, 0.36, 0.1, C.beltBlack);          // the rank bar
  b.box(wx, F + 1.10, rz, 0.32, 0.055, 0.12, C.beltWhite);       // tape, across
  b.box(wx, F + 1.21, rz, 0.32, 0.055, 0.12, C.beltWhite);

  // Taekwondo black belt, one gold stripe across it.
  const kx = rx + 0.56;
  b.box(kx, F + 0.96, rz, 0.28, 0.82, 0.08, C.beltBlack);
  b.box(kx, F + 1.02, rz, 0.3, 0.36, 0.1, 0x201e1c);
  b.box(kx, F + 1.15, rz, 0.32, 0.065, 0.12, C.brass);

  // A gi folded on a bench, off the mat.
  b.box(0.3, F, 3.0, 2.0, 0.42, 0.55, C.woodDark);
  b.box(0.3, F + 0.42, 3.0, 2.1, 0.08, 0.62, C.wood);
  b.box(-0.2, F + 0.5, 3.0, 0.6, 0.16, 0.42, C.gi);
  b.box(-0.2, F + 0.66, 3.0, 0.56, 0.1, 0.38, 0xd6d4cb);
  b.box(0.26, F + 0.5, 3.0, 0.2, 0.08, 0.32, C.beltWhite);
  b.box(0.26, F + 0.5, 3.0, 0.09, 0.09, 0.34, 0x2f2c2a);
  b.cyl(1.0, F + 0.5, 3.0, 0.09, 0.09, 0.28, 8, 0x7fb0c4);
  b.cyl(1.0, F + 0.78, 3.0, 0.05, 0.05, 0.06, 8, C.metalDark);

  // A dummy left out on the mat, mid-round.
  const dx = 0.9, dz = 0.4, dry = -0.5;
  b.box(dx, F + 0.1, dz, 0.5, 0.34, 1.1, C.bagLeather, dry);
  const [hx, hz] = loc(dx, dz, dry, 0, -0.72);
  b.rock(hx, F + 0.27, hz, 0.22, C.bagDark);
  for (const side of [-1, 1]) {
    const [ax, az] = loc(dx, dz, dry, side * 0.42, -0.3);
    b.boxC(ax, F + 0.25, az, 0.2, 0.2, 0.72, C.bagLeather, 0, dry, 0);
  }
  const [lgx, lgz] = loc(dx, dz, dry, 0, 0.86);
  b.boxC(lgx, F + 0.25, lgz, 0.42, 0.22, 0.6, C.bagDark, 0, dry, 0);

  // Spare mats stacked in the corner.
  for (let i = 0; i < 3; i++) {
    b.box(-2.7, F + i * 0.11, 2.6, 1.15, 0.11, 0.8, i % 2 ? C.matA : C.matB, 0.2);
  }
  pottedPlant(b, 2.8, 2.6, 1.0);
  void g;
}

function animBJJ(group) {
  // The bag hangs off the arm and swings, on two frequencies so it never looks
  // like a metronome.
  const pivot = new THREE.Group();
  pivot.position.set(BAG_X + 0.78, F + 2.3, BAG_Z);
  group.add(pivot);
  pivot.add(part(b => {
    b.cyl(0, -0.16, 0, 0.05, 0.05, 0.16, 6, C.metalDark);
    b.cyl(0, -1.5, 0, 0.27, 0.24, 1.34, 10, C.bagLeather);
    b.cyl(0, -1.5, 0, 0.29, 0.29, 0.1, 10, C.bagDark);
    b.cyl(0, -0.34, 0, 0.28, 0.28, 0.12, 10, C.bagDark);
  }));

  return [function (t, dt, amt, idle) {
    const a = Math.max(amt, idle);
    pivot.rotation.x = a * (Math.sin(t * 2.1) * 0.16 + Math.sin(t * 1.31 + 1.2) * 0.06);
    pivot.rotation.z = a * Math.sin(t * 1.7 + 0.6) * 0.05;
  }];
}

/* =============================================================================
   Section: Music — decks in the corner
============================================================================= */

const DECK_Y = F + 0.92;

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
  b.box(0, DECK_Y + 0.1, -0.35, 0.72, 0.13, 0.66, C.mixer);
  for (let i = 0; i < 3; i++) {
    b.box(-0.2 + i * 0.2, DECK_Y + 0.23, -0.2, 0.06, 0.02, 0.26, 0xd6d6d0);  // faders
    b.cyl(-0.2 + i * 0.2, DECK_Y + 0.23, -0.52, 0.045, 0.045, 0.04, 6, C.brass);
  }

  // Laptop at the back of the booth.
  b.box(0.05, DECK_Y + 0.1, 0.12, 0.6, 0.03, 0.4, C.metal);
  b.boxC(0.05, DECK_Y + 0.32, -0.06, 0.6, 0.4, 0.03, C.metal, -0.24, 0, 0);
  g.boxC(0.05, DECK_Y + 0.32, -0.03, 0.53, 0.33, 0.012, 0x25333d, -0.24, 0, 0);

  // Headphones resting on the corner.
  b.cylC(-1.15, DECK_Y + 0.12, 0.28, 0.16, 0.16, 0.05, 10, 0x33373b, Math.PI / 2, 0, 0);
  b.cylC(-0.82, DECK_Y + 0.12, 0.28, 0.16, 0.16, 0.05, 10, 0x33373b, Math.PI / 2, 0, 0);
  b.box(-0.99, DECK_Y + 0.24, 0.28, 0.36, 0.05, 0.06, 0x44484c);

  // Speakers on stands. Cones are animated separately.
  for (const side of [-1, 1]) {
    const x = side * 2.6;
    b.box(x, F, 0.5, 0.5, 0.06, 0.5, C.metalDark);
    b.cyl(x, F + 0.06, 0.5, 0.05, 0.06, 0.95, 6, C.metalDark);
    b.box(x, F + 1.0, 0.5, 0.72, 1.05, 0.6, C.speaker, side * 0.32);
  }

  // Synth on a stand, angled in toward the booth.
  const syx = -2.4, syz = -1.85, syr = 0.55;
  for (const side of [-1, 1]) {
    const [px, pz] = loc(syx, syz, syr, side * 0.66, 0);
    b.box(px, F, pz, 0.07, 0.72, 0.07, C.metalDark);
    b.box(px, F, pz, 0.1, 0.05, 0.5, C.metalDark, syr);
  }
  b.box(syx, F + 0.72, syz, 1.72, 0.14, 0.54, 0x3f4348, syr);
  for (let i = 0; i < 13; i++) {
    const [kx, kz] = loc(syx, syz, syr, -0.72 + i * 0.12, 0.11);
    const black = (i % 7 === 1 || i % 7 === 3 || i % 7 === 5);
    b.box(kx, F + 0.86, kz, 0.1, 0.03, 0.26, black ? 0x2c2f33 : C.paper, syr);
  }
  for (let i = 0; i < 4; i++) {
    const [nx, nz] = loc(syx, syz, syr, -0.62 + i * 0.19, -0.16);
    b.cyl(nx, F + 0.86, nz, 0.04, 0.04, 0.05, 6, C.brass);
  }

  // Record crate.
  b.box(2.5, F, -1.9, 0.95, 0.7, 0.8, C.woodDark, -0.35);
  const r = rng(21);
  for (let i = 0; i < 9; i++) {
    b.box(2.5 - 0.3 + i * 0.075, F + 0.16, -1.9 + (i - 4) * 0.028,
          0.05, 0.62, 0.62, BOOKS[(r() * BOOKS.length) | 0], -0.35);
  }
  b.cylC(1.4, F + 0.34, 1.9, 0.34, 0.34, 0.035, 12, C.vinyl, 0, 0, 0);  // one left out
  b.cylC(1.4, F + 0.36, 1.9, 0.1, 0.1, 0.02, 10, C.brass, 0, 0, 0);
  pottedPlant(b, -2.9, 2.4, 1.15);
}

function animMusic(group) {
  const ups = [];
  const platters = [];

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
  ups.push(function (t, dt, amt, idle) {
    const a = Math.max(amt, idle);
    for (const p of platters) p.rotation.y += dt * (0.35 + 3.1 * a);
  });

  // Mixer meters.
  const meters = [];
  const meterRoot = new THREE.Group();
  meterRoot.position.set(0, DECK_Y + 0.24, -0.35);
  group.add(meterRoot);
  for (let i = 0; i < 6; i++) {
    const m = part(b => b.box(0, 0, 0, 0.035, 1, 0.05, i > 3 ? C.ledAmber : C.ledCyan), true);
    m.position.set(-0.13 + i * 0.052, 0, 0.22);
    meterRoot.add(m);
    meters.push(m);
  }
  ups.push(function (t, dt, amt, idle) {
    const a = Math.max(amt, idle);
    for (let i = 0; i < meters.length; i++) {
      const level = walk(t * 3.4 + i * 5.1);
      meters[i].scale.y = 0.02 + level * 0.1 * a;
    }
  });

  // Speaker cones, pushing air.
  const cones = [];
  for (const side of [-1, 1]) {
    const g2 = new THREE.Group();
    g2.position.set(side * 2.6, F + 1.0, 0.5);
    g2.rotation.y = side * 0.32;
    group.add(g2);
    const woof = part(b => b.cylC(0, 0, 0, 0.2, 0.2, 0.07, 10, C.cone, Math.PI / 2, 0, 0));
    woof.position.set(0, 0.32, 0.31);
    const tweet = part(b => b.cylC(0, 0, 0, 0.09, 0.09, 0.06, 8, C.cone, Math.PI / 2, 0, 0));
    tweet.position.set(0, 0.78, 0.31);
    g2.add(woof); g2.add(tweet);
    cones.push(woof, tweet);
  }
  ups.push(function (t, dt, amt, idle) {
    const a = Math.max(amt, idle);
    const pulse = 1 + Math.sin(t * 8.4) * 0.09 * a + Math.sin(t * 3.1) * 0.05 * a;
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
  crate(b, 2.85, F, -1.5, 0.7, 0.25);
  crate(b, 2.75, F + 0.7, -1.45, 0.52, -0.15);
  crate(b, 2.9, F, -0.6, 0.5, 0.5);
  pottedPlant(b, -2.6, 2.4, 1.15);
  void g;
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
      b.boxC(0, 0, 0.062, 0.07, 0.17, 0.02, 0xa8853c);
      b.boxC(0, 0.05, 0.062, 0.15, 0.06, 0.02, 0xa8853c);
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
    if (typeof entry !== "string") {
      addMovingDetail(zone, mesh, {
        eyebrow: "In the chest",
        title: entry.title || shape,
        lede: entry.text || "",
        items: entry.href
          ? [{ name: entry.href.replace(/^https?:\/\//, ""), tag: "Visit", href: entry.href }]
          : null,
        todo: null
      });
    }
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
  }

  ups.push(function (t, dt, amt, idle) {
    // A touch past the stop, then back — a lid thrown open, not eased open.
    // Idle only creaks it: whatever is inside stays a surprise until it is
    // actually opened.
    pivot.rotation.x = -1.85 * amt - Math.sin(amt * Math.PI) * 0.16
                     - idle * 0.1 * (1 - amt);
    for (const m of toys.children) {
      const home = m.userData.home;
      const wobble = Math.sin(t * 1.15 + m.userData.phase) * 0.09;
      m.position.x += (home.x * amt - m.position.x) * Math.min(1, dt * 5);
      m.position.z += ((home.z * amt) + (1 - amt) * -0.4 - m.position.z) * Math.min(1, dt * 5);
      m.position.y += (((0.82 + home.y + wobble) * amt - 0.34 * (1 - amt)) - m.position.y) * Math.min(1, dt * 5);
      m.rotation.y += dt * (0.12 + m.userData.spin * amt);
      if (m.userData.detail) m.userData.detail.enabled = amt > 0.55;
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

  b.cyl(-1.02, topY, 0.22, 0.14, 0.16, 0.04, 8, C.metalDark);
  b.boxC(-1.02, topY + 0.24, 0.22, 0.04, 0.44, 0.04, C.metalDark, 0.18, 0, 0);
  b.cone(-0.94, topY + 0.5, 0.3, 0.17, 0.2, 8, C.brass, Math.PI, 0, 0);

  chair(b, 0.1, 1.7, Math.PI, C.woodDark);
  pottedPlant(b, 2.6, 1.9, 1.3);
  pottedPlant(b, -2.5, 2.3, 0.9);
  crate(b, -1.9, F + 0.05, 2.6, 0.5, 0.3);
  for (let i = 0; i < 4; i++) {
    b.box(1.75, F + 0.05 + i * 0.075, 2.3, 0.42, 0.075, 0.32, BOOKS[i + 2], i * 0.16);
  }
}

function animAbout(group) {
  const ups = [];
  const topY = ABOUT_TOP;

  // The lamp warms up.
  const bulb = part(b => b.rock(0, 0, 0, 0.09, C.lampGlow), true);
  bulb.position.set(-0.94, topY + 0.42, 0.3);
  group.add(bulb);
  ups.push(function (t, dt, amt, idle) {
    const a = Math.max(amt, idle);
    const s = 0.55 + a * (0.75 + Math.sin(t * 2.6) * 0.07 + Math.sin(t * 7.3) * 0.03);
    bulb.scale.setScalar(s);
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
  ups.push(function (t, dt, amt, idle) {
    const a = Math.max(amt, idle);
    for (let i = 0; i < puffs.length; i++) {
      const p = ((t * 0.42) + i / puffs.length) % 1;
      const m = puffs[i];
      m.position.y = topY + 0.18 + p * 0.42;
      m.position.x = 0.58 + Math.sin(p * 5.2 + i) * 0.05;
      m.scale.setScalar(0.5 + p * 1.1);
      m.material.opacity = a * 0.5 * Math.sin(p * Math.PI);
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

function buildHourglass(b, g) {
  island(b, 5.2, C.baseTop);

  // Plinth and cap, kept narrower than the bulbs are wide so the glass is not
  // swallowed by the woodwork.
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

  void g;
}

/* Reachable by the visitor-count code as well as by the animation below. */
let sandCol = null, grain = null;

/** The lower bulb tapers, so the sand has to taper with it. */
function sandGeometry(fill) {
  const rTop = HG_R + (HG_WAIST - HG_R) * clamp(fill, 0, 1);
  return new THREE.CylinderGeometry(Math.max(0.09, rTop), HG_R - 0.04, 1, 14);
}

function animHourglass(group) {
  const ups = [];
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

  // Sand still up top, funnelling into the neck.
  const topSand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.44, HG_WAIST + 0.02, 0.52, 14),
    new THREE.MeshLambertMaterial({ color: C.sand })
  );
  topSand.position.set(0, HG_NECK + 0.26, 0);
  group.add(topSand);

  // The glass, last so it draws over what is inside it.
  const lower = new THREE.Mesh(
    new THREE.CylinderGeometry(HG_WAIST, HG_R, HG_BULB, 14, 1, true), glassMat);
  lower.position.set(0, HG_BASE + HG_BULB / 2, 0);
  group.add(lower);
  const upper = new THREE.Mesh(
    new THREE.CylinderGeometry(HG_R, HG_WAIST, HG_BULB, 14, 1, true), glassMat);
  upper.position.set(0, HG_NECK + HG_BULB / 2, 0);
  group.add(upper);

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
    const top = HG_BASE + sandCol.scale.y;         // surface of the lower sand
    const drop = Math.max(0.05, HG_NECK - 0.06 - top);

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
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf7f6f3);

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 240);

scene.add(new THREE.HemisphereLight(0xfff6e8, 0x9c9384, 1.0));
const sun = new THREE.DirectionalLight(0xfff2dd, 2.0);
sun.position.set(12, 20, 9);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -21;
sun.shadow.camera.right = 21;
sun.shadow.camera.top = 21;
sun.shadow.camera.bottom = -21;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 60;
sun.shadow.bias = -0.0015;
sun.shadow.normalBias = 0.05;   // stops the stepped cylinders self-shadowing
scene.add(sun);
const fill = new THREE.DirectionalLight(0xdfe8f2, 0.3);
fill.position.set(-10, 6, -8);
scene.add(fill);

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
function addMovingDetail(zone, mesh, panel) {
  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(0.66, 0.66, 0.66),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  mesh.add(hit);
  const detail = {
    zone: zone,
    obj: mesh,
    az: zone.group.rotation.y + 0.34,
    el: 0.5,
    fitH: 1.65,
    fitV: 1.02,
    enabled: false,
    panel: panel
  };
  hit.userData.detail = detail;
  mesh.userData.detail = detail;
  detailHits.push(hit);
  return detail;
}

/** A single object inside a scene worth looking at on its own. Local coords. */
function addDetail(zone, lx, ly, lz, w, h, fitH, fitV, el, act) {
  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, 0.6),
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
  }

  // The chart on the end of the bed: tap it and it comes up as the clipboard,
  // whose four lines each turn the page over to a message form.
  if (def.id === "rldatix") {
    const d = addDetail(zone, BED_X, CHART_Y, BED_Z + 1.42, 0.62, 0.8, 1.0, 0.74, 0.24);
    d.panel = {
      eyebrow: CLIPBOARD.eyebrow,
      title: CLIPBOARD.title,
      lede: CLIPBOARD.lede,
      choices: CLIPBOARD.lines
    };
  }
});
addZone(JAR_ZONE, 0, 0, 0, 4.8, 5.0);

/* =============================================================================
   Camera, controls, picking
============================================================================= */

let cssW = 1, cssH = 1;

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

function applyCamera() {
  const R = 90;
  camera.position.set(
    cam.target.x + R * Math.cos(cam.el) * Math.sin(cam.az),
    cam.target.y + R * Math.sin(cam.el),
    cam.target.z + R * Math.cos(cam.el) * Math.cos(cam.az)
  );
  camera.lookAt(cam.target);

  const aspect = cssW / cssH;
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

/** Where the pointer lands on the horizontal plane through the camera target. */
function groundPoint(px, py) {
  ndc.x = (px / cssW) * 2 - 1;
  ndc.y = -(py / cssH) * 2 + 1;
  ray.setFromCamera(ndc, camera);
  _plane.constant = -want.target.y;
  return ray.ray.intersectPlane(_plane, _hit) ? _hit : null;
}

/** Zooming in pulls the view toward whatever the pointer is over, so you can
    get close to one belt or one line on a whiteboard rather than always to the
    middle of an island. */
function zoomAt(px, py, factor) {
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
  ndc.x = (px / cssW) * 2 - 1;
  ndc.y = -(py / cssH) * 2 + 1;
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
  if (!p) { closePanel(); return; }
  if (p.detail) focusDetail(p.detail); else focusZone(p.zone);
}

/* =============================================================================
   Panel and focus
============================================================================= */

const panel = document.getElementById("panel");
const elEyebrow = document.getElementById("panelEyebrow");
const elTitle = document.getElementById("panelTitle");
const elLede = document.getElementById("panelLede");
const elText = document.getElementById("panelText");
const elItems = document.getElementById("panelItems");
const elChoices = document.getElementById("panelChoices");
const elTodo = document.getElementById("panelTodo");

let activeZone = null;
let activeDetail = null;
let azBeforeFocus = HOME.az;

/** Push the view clear of whichever edge the panel occupies. Measured against
    the frustum the camera is heading FOR, not the one it currently has. */
function applyPanelShift() {
  if (!activeZone) { want.sx = 0; want.sy = 0; return; }
  const r = panel.getBoundingClientRect();
  const aspect = cssW / cssH;
  const w = Math.max(want.fitH * want.scale, want.fitV * want.scale * aspect);
  if (cssW >= 861) {
    want.sx = w * (r.width / cssW);
    want.sy = 0;
  } else {
    want.sx = 0;
    want.sy = -(w / aspect) * (r.height / cssH);
  }
}

/** Move the camera square onto one object and leave the panel as it is. */
function focusDetail(d) {
  // Already looking at it? Then the tap means "do the thing" — turn the board.
  if (activeDetail === d && d.act) { d.act(); return; }
  if (!activeZone) azBeforeFocus = want.az;
  activeZone = d.zone;
  activeDetail = d;

  const portrait = cssH > cssW * 1.15;
  want.az = d.az;
  want.el = d.el;
  want.fitH = portrait ? d.fitH * 0.78 : d.fitH;
  want.fitV = portrait ? d.fitV * 1.2 : d.fitV;
  want.scale = 1;
  // A detail attached to something that moves reads its position now, once,
  // rather than every frame — otherwise the camera rides the bob. A static one
  // was measured before the island floats up, so add the float back on.
  if (d.obj) {
    d.obj.getWorldPosition(want.target);
  } else {
    want.target.copy(d.pos);
    want.target.y += FOCUS_LIFT;
  }

  fillPanel(d.panel || d.zone.def);
  document.body.classList.add("panel-open");
  touched();
  requestAnimationFrame(applyPanelShift);
}

function focusZone(zone) {
  if (!activeZone) azBeforeFocus = want.az;
  activeZone = zone;
  activeDetail = null;

  const portrait = cssH > cssW * 1.15;
  // Offset off the island's facing, so a focused scene reads as a diorama in
  // three-quarters rather than flattening into a face-on rectangle.
  if (zone.focusAz !== null) want.az = zone.focusAz + 0.34;
  want.el = portrait ? 0.74 : 0.66;
  const small = zone.def.id === "hourglass";
  want.fitH = portrait ? (small ? 5.4 : 5.6) : (small ? 7.6 : 8.4);
  want.fitV = portrait ? (small ? 4.6 : 4.6) : (small ? 5.0 : 5.3);
  want.scale = 1;
  want.target.set(zone.group.position.x, small ? 2.3 : 1.5, zone.group.position.z);

  fillPanel(zone.def);
  document.body.classList.add("panel-open");
  touched();
  requestAnimationFrame(applyPanelShift);   // measure once the panel has laid out
}

function fillPanel(d) {
  showMainPage();
  elEyebrow.textContent = d.eyebrow || "";
  elTitle.textContent = d.title || d.label;
  elLede.textContent = d.lede || "";
  elLede.hidden = !d.lede;

  elText.innerHTML = "";
  for (const para of d.text || []) {
    const p = document.createElement("p");
    p.textContent = para;
    elText.appendChild(p);
  }

  elItems.innerHTML = "";
  elItems.hidden = !(d.items && d.items.length);
  for (const item of d.items || []) {
    const row = document.createElement("div");
    row.className = "item";
    const name = document.createElement("div");
    name.className = "item-name";
    if (item.href) {
      const a = document.createElement("a");
      a.href = item.href;
      a.textContent = item.name;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      name.appendChild(a);
    } else {
      name.textContent = item.name;
    }
    row.appendChild(name);
    if (item.tag) {
      const tag = document.createElement("div");
      tag.className = "item-tag";
      tag.textContent = item.tag;
      row.appendChild(tag);
    }
    if (item.note) {
      const note = document.createElement("div");
      note.className = "item-note";
      note.textContent = item.note;
      row.appendChild(note);
    }
    elItems.appendChild(row);
  }

  elChoices.innerHTML = "";
  elChoices.hidden = !(d.choices && d.choices.length);
  for (const line of d.choices || []) {
    const btn = document.createElement("button");
    btn.className = "choice";
    btn.type = "button";
    btn.textContent = line;
    btn.addEventListener("click", function () { openForm(line); });
    elChoices.appendChild(btn);
  }

  elTodo.hidden = !d.todo;
  elTodo.textContent = d.todo || "";
}

/* =============================================================================
   The message form — the page behind the clipboard

   There is no server here: this is a static site, so Send hands the message to
   the visitor's own mail app with everything filled in. Nothing is posted
   anywhere, and nothing is stored.
============================================================================= */

const panelBody = document.getElementById("panelBody");
const pageMain = document.getElementById("pageMain");
const pageForm = document.getElementById("pageForm");
const elFormTitle = document.getElementById("formTitle");
const elFormNote = document.getElementById("formNote");
const contactForm = document.getElementById("contactForm");
const fName = document.getElementById("fName");
const fEmail = document.getElementById("fEmail");
const fMsg = document.getElementById("fMsg");
const NOTE_IDLE = elFormNote.textContent;

let turning = false;

/** The page turn: the outgoing page swings away on its spine, the incoming one
    swings in behind it. Swapped at the halfway point so they never overlap. */
function turnPage(to) {
  const from = to === pageForm ? pageMain : pageForm;
  if (turning || from.hidden) return;
  turning = true;
  document.body.classList.add("turning");
  setTimeout(function () {
    document.body.classList.remove("turning");
    from.hidden = true;
    to.hidden = false;
    to.classList.remove("arriving");
    void to.offsetWidth;                 // restart the animation
    to.classList.add("arriving");
    panelBody.scrollTop = 0;
    turning = false;
  }, 220);
}

/** Back to the front of the panel with no animation — used whenever the panel
    is refilled, so a new section never opens on someone else's form. */
function showMainPage() {
  document.body.classList.remove("turning");
  turning = false;
  pageForm.hidden = true;
  pageMain.hidden = false;
  pageMain.classList.remove("arriving");
  clearNote();
}

function clearNote() {
  elFormNote.className = "field-note";
  elFormNote.textContent = NOTE_IDLE;
}

function openForm(topic) {
  elFormTitle.textContent = topic;
  contactForm.dataset.topic = topic;
  clearNote();
  turnPage(pageForm);
}

document.getElementById("formBack").addEventListener("click", function () {
  turnPage(pageMain);
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

function closePanel() {
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
  document.body.classList.remove("panel-open");
}

document.getElementById("panelClose").addEventListener("click", closePanel);
document.addEventListener("keydown", function (e) {
  if (e.key !== "Escape") return;
  // On the form, Escape turns the page back rather than throwing the whole
  // panel away with a half-typed message in it.
  if (!pageForm.hidden) turnPage(pageMain); else closePanel();
});

function touched() { document.body.classList.add("touched"); }

/* =============================================================================
   Visitor count
============================================================================= */

const API = "https://api.counterapi.dev/v2/alexander-parkers-team-4716/first-counter-4716";
const LOCAL_KEY = "ap_count_local";
const counterEl = document.getElementById("counter");
if (counterEl && JAR_ZONE.lede) counterEl.title = "One grain for every visit";

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

// A jar that filled linearly would be full forever after a few thousand visits,
// so the level is logarithmic: always rising, never quite full.
function fillFor(count) {
  return clamp(0.09 + Math.log10(count + 1) / 5.4, 0.09, 0.94);
}

let total = 0, fillTarget = 0, pourStart = 0, pouring = false;
let grainFall = false, grainT = 0;

function startPour(count) {
  total = count;
  fillTarget = fillFor(count);
  if (sandCol) {
    sandCol.geometry.dispose();
    sandCol.geometry = sandGeometry(fillTarget);
  }
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

  // The whole pixel-art effect: render small, let CSS scale it up.
  const div = cssW < 700 ? 1.35 : 1.6;
  const w = clamp(Math.round(cssW / div), 300, 1400);
  const h = Math.max(1, Math.round(w * (cssH / cssW)));
  renderer.setSize(w, h, false);

  const shadowRes = cssW < 700 ? 1024 : 2048;
  if (sun.shadow.mapSize.x !== shadowRes) {
    sun.shadow.mapSize.set(shadowRes, shadowRes);
    if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  }

  // Rotating a phone changes what a good default view is. Adopt the new one,
  // but never yank the camera away from a view the visitor set themselves.
  const home = homeFor();
  HOME.fitH = home.fitH; HOME.fitV = home.fitV;
  HOME.az = home.az; HOME.el = home.el;
  if (!activeZone) {
    want.fitH = HOME.fitH;
    want.fitV = HOME.fitV;
    if (!userMoved) { want.az = HOME.az; want.el = HOME.el; cam.az = HOME.az; cam.el = HOME.el; }
  }

  applyCamera();
  applyPanelShift();
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

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const t = now / 1000;

  const k = 1 - Math.pow(0.0016, dt);
  cam.az += (want.az - cam.az) * k;
  cam.el += (want.el - cam.el) * k;
  cam.fitH += (want.fitH - cam.fitH) * k;
  cam.fitV += (want.fitV - cam.fitV) * k;
  cam.scale += (want.scale - cam.scale) * k;
  cam.sx += (want.sx - cam.sx) * k;
  cam.sy += (want.sy - cam.sy) * k;
  cam.target.lerp(want.target, k);
  applyCamera();

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
  if (pouring && sandCol) {
    const p = (now - pourStart) / 1800;
    const e = p >= 1 ? 1 : 1 - Math.pow(1 - p, 3);
    const fillH = fillTarget * HG_BULB * e;
    setCounter(total * e);
    sandCol.scale.y = Math.max(0.0001, fillH);
    sandCol.position.y = HG_BASE + fillH / 2;
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
