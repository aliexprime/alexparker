/* =============================================================================
   world.js — a small 3D room, rendered small and scaled up.

   The scene is real geometry with real lights and real shadows. It only looks
   like pixel art because it is rendered into a buffer a few hundred pixels wide
   and then blown up with nearest-neighbour scaling. Nothing here is a sprite.

   Layout: a square plinth with one scene on each side — work, markets,
   projects, about — decorations in the corners, and a jar of sand in the
   middle that gains a grain for every visit.

   Each scene is authored in its own local space where +z points OUT of the
   plinth, then rotated into place. Whichever side you orbit to, you are looking
   at the front of something. Nothing tall is allowed on a scene's inner edge,
   so the middle of the room always stays open.
============================================================================= */

import * as THREE from "./vendor/three.module.min.js";
import { ZONES, JAR } from "./content.js";

/* ---- Palette ---------------------------------------------------------------
   Muted and warm, so a room full of colour still sits quietly on paper. */

const C = {
  baseDark:  0xb2aa9a,
  baseMid:   0xc7bfae,
  baseTop:   0xdfd8c8,
  path:      0xd3cab8,
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

  clinFloor: 0xdde5e4,
  clinPanel: 0xbcd0d1,
  bedFrame:  0x99a2a7,
  mattress:  0xf0efea,
  blanket:   0x5b99a1,
  blanket2:  0x477f87,
  screenTeal:0x86d9c8,

  invFloor:  0xded7c7,
  vault:     0x878f94,
  vaultDark: 0x606870,
  safe:      0x495257,
  board:     0xf4f3ee,
  boardInk:  0x3f7f5f,
  boardInk2: 0x4a6f9e,
  money:     0x8fae7d,
  screenGrn: 0x8ed49a,

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

  glass:     0xcadde4,
  sand:      0xd7ae66,
  sandDark:  0xb9884a
};

const BOOKS = [0xb5553f, 0x4a7a8c, 0xc9a44c, 0x6b8f5e, 0x8a6b9e, 0xc2725e,
               0x5f7f9e, 0xa8894a, 0x7d9e6b, 0x9e5f5f];

/* ---- Geometry builder ------------------------------------------------------
   Every static prop is accumulated here and merged into one mesh per zone, so
   the whole room costs about a dozen draw calls. */

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
  const mesh = new THREE.Mesh(
    builder.geometry(),
    new THREE.MeshLambertMaterial({ vertexColors: true })
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function glowMesh(builder) {
  return new THREE.Mesh(
    builder.geometry(),
    new THREE.MeshBasicMaterial({ vertexColors: true })
  );
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

/* ---- Shared props ---------------------------------------------------------- */

const F = 0.35;   // top of the plinth: everything sits on this

/** A bookcase with an actual cavity, so the books are visible inside it. */
function shelf(b, x, z, w, h, ry, seed) {
  const d = 0.42, t = 0.06;
  const [bxp, bzp] = loc(x, z, ry, 0, -d / 2 + t / 2);
  b.box(bxp, F, bzp, w, h, t, C.woodDark, ry);                       // back panel
  for (const side of [-1, 1]) {
    const [sx, sz] = loc(x, z, ry, side * (w / 2 - t / 2), 0);
    b.box(sx, F, sz, t, h, d, C.wood, ry);                           // sides
  }
  b.box(x, F + h - t, z, w, t, d, C.wood, ry);                       // top
  b.box(x, F, z, w, t, d, C.woodDark, ry);                           // plinth

  const r = rng(seed);
  const rows = Math.max(2, Math.round(h / 0.52));
  const gap = (h - 0.14) / rows;
  for (let i = 1; i <= rows; i++) {
    const boardY = F + 0.06 + i * gap;
    if (i < rows) b.box(x, boardY, z, w - 2 * t, t, d - 0.06, C.wood, ry);

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

/** A screen on a stand. Returns the y of the bottom of the panel. */
function monitor(b, g, x, y, z, w, h, ry, screenColor) {
  b.box(x, y, z, 0.26, 0.05, 0.18, C.metalDark, ry);
  b.box(x, y + 0.05, z, 0.06, 0.2, 0.06, C.metalDark, ry);
  b.box(x, y + 0.25, z, w, h, 0.05, C.metal, ry);
  const [fx, fz] = loc(x, z, ry, 0, 0.031);
  g.box(fx, y + 0.28, fz, w - 0.07, h - 0.06, 0.012, screenColor, ry);
  return y + 0.28;
}

/* ---- Zone: RLDatix ---------------------------------------------------------
   A bay. Bed in the middle, a low headwall behind it, tall storage pushed out
   to the sides so the centre of the room stays clear. */

function buildRLDatix(b, g) {
  b.box(0, F, 0, 7.4, 0.05, 7.4, C.clinFloor);

  const bx = -0.35, bz = 0.15;
  const frameY = F + 0.44;

  // Low headwall with the vitals screen on it — reads as a bay without walling
  // the scene off from the rest of the room.
  b.box(bx, F, bz - 1.62, 2.7, 0.86, 0.14, C.clinPanel);
  b.box(bx, F + 0.86, bz - 1.62, 2.8, 0.08, 0.2, 0xa9c0c1);
  b.box(bx + 0.95, F + 0.5, bz - 1.5, 0.56, 0.4, 0.1, C.white);
  g.box(bx + 0.95, F + 0.56, bz - 1.44, 0.46, 0.28, 0.02, 0x1f4a4a);
  const trace = [0.10, 0.10, 0.21, 0.05, 0.34, 0.10, 0.10];
  for (let i = 0; i < trace.length; i++) {
    g.box(bx + 0.95 - 0.18 + i * 0.06, F + 0.64 + trace[i] * 0.42, bz - 1.428,
          0.05, 0.032, 0.012, C.screenTeal);
  }
  b.box(bx - 0.9, F + 0.52, bz - 1.5, 0.4, 0.28, 0.1, 0xdfe9e0);   // gas outlets
  b.box(bx - 0.9, F + 0.6, bz - 1.44, 0.09, 0.09, 0.04, C.metal);
  b.box(bx - 0.74, F + 0.6, bz - 1.44, 0.09, 0.09, 0.04, C.metal);

  // Bed.
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
  b.box(bx + 0.4, frameY + 0.36, bz + 1.18, 0.3, 0.02, 0.22, C.paper);

  // IV pole beside the bed.
  b.box(bx - 1.35, F, bz - 0.5, 0.3, 0.05, 0.3, C.metalDark);
  b.cyl(bx - 1.35, F + 0.05, bz - 0.5, 0.035, 0.035, 1.55, 6, C.metal);
  b.box(bx - 1.35, F + 1.3, bz - 0.5, 0.24, 0.3, 0.08, 0xdfe9e0);
  b.box(bx - 1.35, F + 1.57, bz - 0.5, 0.3, 0.04, 0.1, C.metal);

  // Workstation on wheels, angled toward the foot of the bed.
  b.box(2.15, F + 0.02, 1.35, 0.62, 0.7, 0.5, C.white, -0.4);
  b.box(2.15, F, 1.35, 0.5, 0.06, 0.4, C.metalDark, -0.4);
  const my = monitor(b, g, 2.15, F + 0.72, 1.35, 0.62, 0.44, -0.4, 0x24506b);
  const bars = [0.14, 0.24, 0.1, 0.28, 0.18];
  for (let i = 0; i < bars.length; i++) {
    const [gx, gz] = loc(2.15, 1.35, -0.4, -0.2 + i * 0.1, 0.033);
    g.box(gx, my + 0.06 + bars[i] / 2, gz, 0.06, bars[i], 0.012, C.screenTeal, -0.4);
  }
  b.box(2.15, F + 0.72, 1.58, 0.44, 0.03, 0.16, 0xd6d6d0, -0.4);

  // Tall things live on the side edges only.
  b.box(-2.95, F, -0.7, 0.85, 1.7, 0.55, C.white);
  b.box(-2.95, F + 0.05, -0.42, 0.72, 0.5, 0.04, 0xdde6e7);
  b.box(-2.95, F + 0.6, -0.42, 0.72, 0.5, 0.04, 0xdde6e7);
  b.box(-2.95, F + 1.15, -0.42, 0.72, 0.44, 0.04, 0xdde6e7);
  b.box(-2.68, F + 0.28, -0.4, 0.1, 0.05, 0.05, C.metal);
  b.box(-2.68, F + 0.83, -0.4, 0.1, 0.05, 0.05, C.metal);

  b.box(2.95, F, -0.9, 0.62, 0.86, 1.9, C.white);           // counter run
  b.box(2.95, F + 0.86, -0.9, 0.7, 0.08, 2.0, 0xe4ebec);
  b.box(2.95, F + 0.94, -1.5, 0.34, 0.08, 0.42, 0xc8d6d7);  // basin
  b.box(2.8, F + 0.94, -1.72, 0.05, 0.24, 0.05, C.metal);

  b.cyl(-2.2, F, 1.5, 0.24, 0.2, 0.42, 8, C.metal);         // stool
  b.cyl(-2.2, F + 0.42, 1.5, 0.26, 0.26, 0.07, 8, C.blanket);
  b.cyl(2.5, F, -2.6, 0.2, 0.17, 0.42, 8, 0xd5dcdc);        // bin
  pottedPlant(b, -2.9, 2.3, 1.0);
}

/* ---- Zone: Investing -------------------------------------------------------- */

function buildInvesting(b, g) {
  b.box(0, F, 0, 7.4, 0.05, 7.4, C.invFloor);

  // Freestanding vault cabinet, door facing out.
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

  // Safe beside it.
  b.box(-2.5, F, 1.15, 0.95, 1.0, 0.8, C.safe);
  b.box(-2.5, F + 0.07, 1.53, 0.8, 0.86, 0.06, 0x5a636a);
  b.cylC(-2.36, F + 0.5, 1.59, 0.12, 0.12, 0.06, 8, C.brass, Math.PI / 2, 0, 0);
  b.box(-2.76, F + 0.46, 1.57, 0.05, 0.28, 0.05, C.brass);
  crate(b, -2.5, F + 1.0, 1.15, 0.34, 0.3);

  // Desk, screen mid-argument with itself.
  const topY = desk(b, 0.35, 0.75, 2.0, 1.0, 0, C.wood);
  const scrY = monitor(b, g, 0.15, topY, 0.55, 0.82, 0.52, 0, 0x1d3a2a);
  const r = rng(9);
  let level = 0.14;
  for (let i = 0; i < 10; i++) {
    const h = 0.05 + r() * 0.2;
    g.box(0.15 - 0.32 + i * 0.071, scrY + 0.06 + level, 0.582, 0.042, h, 0.012, C.screenGrn);
    level = clamp(level + (r() - 0.44) * 0.08, 0.02, 0.3);
  }
  b.box(0.9, topY, 0.95, 0.38, 0.03, 0.22, 0xd6d6d0);
  b.box(1.2, topY, 0.6, 0.2, 0.24, 0.14, C.paper);
  chair(b, 0.35, 2.05, Math.PI, C.woodDark);

  // Whiteboard on an easel, out on the side edge.
  const wx = 2.9, wz = -0.7;
  b.boxC(wx - 0.03, F + 1.12, wz, 0.06, 1.15, 2.1, C.board);
  b.boxC(wx + 0.02, F + 1.12, wz, 0.03, 1.25, 2.2, 0xb8b2a2);
  const marks = [[0.32, -0.55, 0.9], [0.1, -0.1, 1.2], [-0.16, -0.7, 0.6]];
  for (const [my, mz, mw] of marks) {
    b.boxC(wx - 0.07, F + 1.12 + my, wz + mz, 0.02, 0.045, mw, C.boardInk);
  }
  b.boxC(wx - 0.07, F + 0.9, wz + 0.75, 0.02, 0.32, 0.045, C.boardInk2);
  b.boxC(wx - 0.07, F + 0.82, wz + 0.2, 0.02, 0.045, 0.85, C.boardInk2);
  for (const lz of [-0.85, 0.85]) {
    b.boxC(wx + 0.12, F + 0.55, wz + lz, 0.05, 1.1, 0.05, C.woodDark, 0.16, 0, 0);
    b.boxC(wx - 0.16, F + 0.55, wz + lz, 0.05, 1.1, 0.05, C.woodDark, -0.16, 0, 0);
  }

  // Money: a low table of coin stacks and banded notes.
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

  // A press quietly running notes into a tray.
  b.box(0.1, F, -2.5, 1.15, 0.85, 0.8, C.metalDark, 0.18);
  b.box(0.1, F + 0.85, -2.5, 1.25, 0.16, 0.9, C.metal, 0.18);
  g.box(0.1, F + 0.66, -2.12, 0.34, 0.12, 0.02, C.screenGrn, 0.18);
  b.box(0.2, F + 0.3, -1.95, 0.6, 0.05, 0.34, C.money, 0.18);
  b.box(0.2, F + 0.35, -1.95, 0.56, 0.04, 0.3, 0xa3bd90, 0.18);
  pottedPlant(b, -1.0, 2.5, 1.1);
}

/* ---- Zone: Projects --------------------------------------------------------- */

function buildProjects(b, g) {
  b.cyl(0, F, 0.2, 3.1, 3.1, 0.05, 12, C.rug);
  b.cyl(0, F + 0.05, 0.2, 2.4, 2.4, 0.012, 12, 0xdcc6a6);

  // Chest body — the lid is a separate mesh so it can open.
  b.box(0, F + 0.05, -0.2, 2.3, 0.95, 1.45, C.chest);
  b.box(0, F + 0.05, -0.2, 2.36, 0.12, 1.51, C.chestLid);
  b.box(0, F + 0.88, -0.2, 2.36, 0.12, 1.51, C.chestLid);
  b.box(0, F + 0.1, 0.56, 0.28, 0.7, 0.06, C.brass);
  b.box(0, F + 0.42, 0.56, 0.22, 0.22, 0.08, C.brass);
  for (const sx of [-0.95, 0.95]) {
    b.box(sx, F + 0.1, 0.56, 0.14, 0.78, 0.05, C.brass);
    b.box(sx, F + 0.1, -0.96, 0.14, 0.78, 0.05, C.brass);
  }

  // Things that already spilled out and never went back in.
  b.box(-1.85, F + 0.05, 1.15, 0.34, 0.34, 0.34, C.toyBlue, 0.4);
  b.box(-1.5, F + 0.05, 1.5, 0.26, 0.26, 0.26, C.toyYellow, -0.2);
  b.rock(1.7, F + 0.28, 1.2, 0.24, C.toyRed);
  b.box(1.35, F + 0.05, 1.7, 0.5, 0.1, 0.34, C.toyGreen, 0.6);

  // Side edges.
  shelf(b, -2.95, -0.6, 2.4, 1.55, Math.PI / 2, 55);
  crate(b, 2.85, F, -1.5, 0.7, 0.25);
  crate(b, 2.75, F + 0.7, -1.45, 0.52, -0.15);
  crate(b, 2.9, F, -0.6, 0.5, 0.5);
  pottedPlant(b, -2.6, 2.4, 1.15);
}

/** The chest lid, hinged along its back edge. */
function buildChestLid() {
  const b = new Builder();
  b.box(0, 0, 0.72, 2.36, 0.2, 1.55, C.chestLid);
  b.box(0, 0.18, 0.72, 2.2, 0.1, 1.4, C.chest);
  b.box(0, 0.12, 1.44, 0.22, 0.16, 0.1, C.brass);
  for (const sx of [-0.95, 0.95]) b.box(sx, 0.18, 0.72, 0.12, 0.06, 1.5, C.brass);
  return solidMesh(b);
}

/** One toy per project, sitting in the chest until it is opened. */
function buildToys(count) {
  const group = new THREE.Group();
  const palette = [C.toyRed, C.toyBlue, C.toyYellow, C.toyGreen, C.toyPurple];
  const n = Math.max(1, Math.min(7, count));
  for (let i = 0; i < n; i++) {
    const b = new Builder();
    const col = palette[i % palette.length];
    switch (i % 5) {
      case 0:                                    // rocket
        b.cyl(0, -0.2, 0, 0.11, 0.13, 0.4, 8, col);
        b.cone(0, 0.3, 0, 0.13, 0.2, 8, C.paper);
        b.box(-0.14, -0.2, 0, 0.06, 0.16, 0.16, C.paper);
        b.box(0.14, -0.2, 0, 0.06, 0.16, 0.16, C.paper);
        break;
      case 1:                                    // cube
        b.box(-0.16, -0.16, -0.16, 0.32, 0.32, 0.32, col);
        b.box(-0.17, -0.02, -0.17, 0.34, 0.06, 0.34, C.paper);
        break;
      case 2:                                    // ball
        b.rock(0, 0, 0, 0.2, col, 1);
        break;
      case 3:                                    // controller
        b.box(-0.24, -0.08, -0.14, 0.48, 0.16, 0.28, col);
        b.cyl(-0.12, 0.08, 0, 0.05, 0.05, 0.04, 6, C.paper);
        b.cyl(0.12, 0.08, 0, 0.05, 0.05, 0.04, 6, C.paper);
        break;
      default:                                   // brush
        b.cyl(0, -0.24, 0, 0.035, 0.035, 0.42, 6, C.woodLight);
        b.cyl(0, 0.18, 0, 0.055, 0.05, 0.1, 6, C.brass);
        b.cyl(0, 0.28, 0, 0.04, 0.06, 0.12, 6, col);
    }
    const mesh = solidMesh(b);
    const a = (i / n) * Math.PI * 2 + 0.6;
    mesh.userData.home = new THREE.Vector3(Math.cos(a) * 0.64, 0, -0.2 + Math.sin(a) * 0.36);
    mesh.userData.phase = i * 0.8;
    mesh.userData.spin = 0.4 + (i % 3) * 0.25;
    mesh.position.set(0, -0.34, -0.4);
    group.add(mesh);
  }
  return group;
}

/* ---- Zone: About ------------------------------------------------------------ */

function buildAbout(b, g) {
  b.box(0, F, 0, 7.4, 0.05, 7.4, C.aboutFloor);
  b.cyl(0, F + 0.05, 0.75, 2.5, 2.5, 0.035, 12, C.rug2);

  shelf(b, -2.95, -0.5, 3.0, 2.0, Math.PI / 2, 17);
  shelf(b, 2.95, -0.8, 2.2, 1.55, -Math.PI / 2, 41);

  const topY = desk(b, 0, 0.55, 2.3, 1.05, 0, C.wood);
  b.box(-0.35, topY, 0.5, 0.72, 0.03, 0.5, C.metal);                       // laptop
  b.boxC(-0.35, topY + 0.24, 0.24, 0.72, 0.46, 0.03, C.metal, -0.22, 0, 0);
  g.boxC(-0.35, topY + 0.24, 0.27, 0.64, 0.38, 0.012, 0x2b3a44, -0.22, 0, 0);
  b.box(0.58, topY, 0.38, 0.16, 0.16, 0.16, C.paper);                      // mug
  b.cylC(0.69, topY + 0.08, 0.38, 0.05, 0.05, 0.03, 8, C.paper, 0, 0, Math.PI / 2);
  b.box(0.8, topY, 0.78, 0.34, 0.05, 0.24, C.paper, 0.3);
  b.box(0.83, topY + 0.05, 0.8, 0.3, 0.02, 0.2, 0xe6e2d8, 0.3);

  b.cyl(-1.02, topY, 0.22, 0.14, 0.16, 0.04, 8, C.metalDark);              // lamp
  b.boxC(-1.02, topY + 0.24, 0.22, 0.04, 0.44, 0.04, C.metalDark, 0.18, 0, 0);
  b.cone(-0.94, topY + 0.5, 0.3, 0.17, 0.2, 8, C.brass, Math.PI, 0, 0.3);
  g.rock(-0.94, topY + 0.42, 0.3, 0.09, C.lampGlow);

  chair(b, 0.1, 1.7, Math.PI, C.woodDark);
  pottedPlant(b, 2.6, 1.9, 1.3);
  pottedPlant(b, -2.5, 2.3, 0.9);
  crate(b, -1.9, F + 0.05, 2.6, 0.5, 0.3);
  for (let i = 0; i < 4; i++) {
    b.box(1.75, F + 0.05 + i * 0.075, 2.3, 0.42, 0.075, 0.32, BOOKS[i + 2], i * 0.16);
  }
}

/* ---- Plinth and corners ------------------------------------------------------ */

const PLAT = 21;

function buildPlatform(b) {
  b.box(0, -1.35, 0, PLAT + 1.1, 0.45, PLAT + 1.1, C.baseDark);
  b.box(0, -0.90, 0, PLAT + 0.6, 0.45, PLAT + 0.6, C.baseMid);
  b.box(0, -0.45, 0, PLAT, 0.8, PLAT, C.baseTop);      // top at F

  b.box(0, F, 0, 3.0, 0.02, PLAT - 1.2, C.path);
  b.box(0, F, 0, PLAT - 1.2, 0.02, 3.0, C.path);
  b.cyl(0, F, 0, 2.6, 2.6, 0.03, 16, 0xcbc2af);

  const e = PLAT / 2 - 0.15;
  for (const [x, z, w, d] of [[0, -e, PLAT, 0.3], [0, e, PLAT, 0.3],
                              [-e, 0, 0.3, PLAT], [e, 0, 0.3, PLAT]]) {
    b.box(x, F, z, w, 0.1, d, C.edge);
  }
}

function buildCorners(b, g) {
  // Reading corner.
  shelf(b, -7.9, -7.4, 2.8, 2.1, 0.4, 3);
  b.cyl(-6.1, F, -8.6, 0.2, 0.24, 0.05, 8, C.metalDark);
  b.cyl(-6.1, F + 0.05, -8.6, 0.035, 0.035, 1.5, 6, C.metalDark);
  b.cone(-6.1, F + 1.68, -8.6, 0.28, 0.3, 8, C.brass, Math.PI, 0, 0);
  g.rock(-6.1, F + 1.56, -8.6, 0.11, C.lampGlow);
  chair(b, -6.4, -7.0, 0.7, C.fabric);

  // Storage corner.
  crate(b, 7.7, F, -7.9, 0.85, 0.25);
  crate(b, 7.5, F + 0.85, -7.8, 0.62, -0.1);
  crate(b, 8.5, F, -6.9, 0.62, 0.5);
  crate(b, 6.7, F, -8.6, 0.55, -0.35);
  pottedPlant(b, 6.4, -7.0, 1.5);

  // Second reading corner.
  shelf(b, 8.0, 7.5, 2.6, 1.75, -0.4, 88);
  chair(b, 6.5, 8.2, -0.9, C.fabric);
  b.cyl(7.0, F, 7.2, 0.42, 0.46, 0.5, 10, C.woodDark);
  b.cyl(7.0, F + 0.5, 7.2, 0.5, 0.5, 0.07, 10, C.wood);
  pottedPlant(b, 8.8, 6.2, 1.2);

  // Floor books and a rug.
  b.cyl(-7.6, F, 7.6, 1.8, 1.8, 0.04, 12, C.rug2);
  pottedPlant(b, -8.3, 6.5, 1.4);
  for (let i = 0; i < 5; i++) {
    b.box(-7.1, F + 0.04 + i * 0.075, 7.8, 0.44, 0.075, 0.34, BOOKS[i], i * 0.14);
  }
  b.box(-8.3, F + 0.04, 8.2, 0.5, 0.09, 0.38, BOOKS[6], 0.5);
  crate(b, -6.2, F, 8.4, 0.5, 0.2);
}

/* ---- The jar ----------------------------------------------------------------- */

const JAR_R = 0.56;
const JAR_H = 1.5;
const JAR_Y = F + 1.32;      // where the inside of the jar starts

function buildPedestal(b) {
  b.cyl(0, F, 0, 1.3, 1.45, 0.22, 12, C.baseMid);
  b.cyl(0, F + 0.22, 0, 1.04, 1.16, 0.2, 12, C.edge);
  b.cyl(0, F + 0.42, 0, 0.66, 0.8, 0.72, 12, C.baseTop);
  b.cyl(0, F + 1.14, 0, 0.86, 0.68, 0.14, 12, C.edge);
}

/* ===========================================================================
   Scene
=========================================================================== */

const canvas = document.getElementById("stage");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf7f6f3);

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);

scene.add(new THREE.HemisphereLight(0xfff6e8, 0x9c9384, 1.0));
const sun = new THREE.DirectionalLight(0xfff2dd, 2.0);
sun.position.set(9, 14, 7);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -15;
sun.shadow.camera.right = 15;
sun.shadow.camera.top = 15;
sun.shadow.camera.bottom = -15;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 45;
sun.shadow.bias = -0.0018;
scene.add(sun);
const fill = new THREE.DirectionalLight(0xdfe8f2, 0.3);
fill.position.set(-8, 5, -6);
scene.add(fill);

const world = new THREE.Group();
scene.add(world);

{
  const b = new Builder(), g = new Builder();
  buildPlatform(b);
  buildCorners(b, g);
  buildPedestal(b);
  world.add(solidMesh(b));
  if (!g.empty) world.add(glowMesh(g));
}

/* ---- Zones ------------------------------------------------------------------- */

const ZONE_BUILD = {
  rldatix: buildRLDatix,
  investing: buildInvesting,
  projects: buildProjects,
  about: buildAbout
};

const PLACE = {
  rldatix:   { x: 0, z: -6.5 },
  investing: { x: 6.5, z: 0 },
  projects:  { x: 0, z: 6.5 },
  about:     { x: -6.5, z: 0 }
};

const zones = [];
const pickables = [];

for (const def of ZONES) {
  const place = PLACE[def.id];
  const build = ZONE_BUILD[def.id];
  if (!place || !build) continue;

  const group = new THREE.Group();
  group.position.set(place.x, 0, place.z);
  group.rotation.y = Math.atan2(place.x, place.z);

  const b = new Builder(), g = new Builder();
  build(b, g);
  group.add(solidMesh(b));
  if (!g.empty) group.add(glowMesh(g));

  // An invisible slab over the scene catches clicks and hovers.
  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(7.4, 3.2, 7.4),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hit.position.y = F + 1.6;
  group.add(hit);

  world.add(group);

  const zone = {
    def: def,
    group: group,
    hit: hit,
    // A ground point just beyond the plinth. Orthographic projection is
    // affine, so a point outside the plinth square is always outside its
    // silhouette — at any orbit angle.
    anchor: new THREE.Vector3(Math.sign(place.x) * 11.6, 0, Math.sign(place.z) * 11.6),
    focusAz: Math.atan2(place.x, place.z),
    label: null
  };
  hit.userData.zone = zone;
  zones.push(zone);
  pickables.push(hit);
}

/* ---- Chest lid and toys ------------------------------------------------------- */

const projectsZone = zones.find(function (z) { return z.def.id === "projects"; });
let chestPivot = null, toys = null;

if (projectsZone) {
  chestPivot = new THREE.Group();
  chestPivot.position.set(0, F + 0.95, -0.92);      // hinge along the back edge
  chestPivot.add(buildChestLid());
  projectsZone.group.add(chestPivot);

  toys = buildToys(projectsZone.def.items ? projectsZone.def.items.length : 4);
  toys.position.set(0, F + 0.62, 0);
  projectsZone.group.add(toys);
}

/* ---- The jar of sand ---------------------------------------------------------- */

const sandCol = new THREE.Mesh(
  new THREE.CylinderGeometry(JAR_R - 0.07, JAR_R - 0.07, 1, 12),
  new THREE.MeshLambertMaterial({ color: C.sand })
);
sandCol.receiveShadow = true;
sandCol.scale.y = 0.0001;
sandCol.position.set(0, JAR_Y, 0);
world.add(sandCol);

const glass = new THREE.Mesh(
  new THREE.CylinderGeometry(JAR_R, JAR_R, JAR_H, 12, 1, true),
  new THREE.MeshLambertMaterial({
    color: C.glass, transparent: true, opacity: 0.42,
    depthWrite: false, side: THREE.DoubleSide
  })
);
glass.position.set(0, JAR_Y + JAR_H / 2, 0);
world.add(glass);

{
  const b = new Builder();
  b.cyl(0, JAR_Y + JAR_H - 0.04, 0, JAR_R + 0.06, JAR_R + 0.06, 0.1, 12, 0xa8bfc9);
  b.cyl(0, JAR_Y - 0.07, 0, JAR_R + 0.05, JAR_R + 0.05, 0.08, 12, 0xa8bfc9);
  world.add(solidMesh(b));
}

const grain = new THREE.Mesh(
  new THREE.BoxGeometry(0.11, 0.11, 0.11),
  new THREE.MeshLambertMaterial({ color: C.sandDark })
);
grain.castShadow = true;
grain.visible = false;
world.add(grain);

/* ===========================================================================
   Camera, controls, picking
=========================================================================== */

/* The camera is described by how much world it must FIT, horizontally and
   vertically, rather than by a single zoom number. A portrait phone and a wide
   desktop need very different frustums to show the same room, and fitting on
   the smaller axis alone crops the plinth off the sides. */

let cssW = 1, cssH = 1;

function homeFor() {
  // Standing more overhead on a tall screen puts the room's height to work
  // instead of leaving it as empty paper.
  return (cssH > cssW * 1.15)
    ? { az: Math.PI * 0.08, el: 1.00, fitH: 13.4, fitV: 12.4 }
    : { az: Math.PI * 0.23, el: 0.62, fitH: 16.8, fitV: 10.6 };
}

let HOME = homeFor();
HOME.target = new THREE.Vector3(0, 1.3, 0);

const cam = {
  az: HOME.az, el: HOME.el, fitH: HOME.fitH, fitV: HOME.fitV,
  scale: 2.0, sx: 0, sy: 0, w: 1, h: 1, target: HOME.target.clone()
};
const want = {
  az: HOME.az, el: HOME.el, fitH: HOME.fitH, fitV: HOME.fitV,
  scale: 1, sx: 0, sy: 0, target: HOME.target.clone()
};

let userMoved = false;

function applyCamera() {
  const R = 60;
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

  // Shifting the frustum rather than the target keeps the focused scene clear
  // of the panel without having to guess at screen-space axes.
  camera.left = -w + cam.sx;
  camera.right = w + cam.sx;
  camera.top = h + cam.sy;
  camera.bottom = -h + cam.sy;
  camera.updateProjectionMatrix();
}

/* ---- Pointer ------------------------------------------------------------------ */

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
      want.scale = clamp(want.scale * (pinchDist / d), 0.32, 1.9);
      cam.scale = want.scale;
      userMoved = true;
    }
    pinchDist = d;
    movedBy += 20;
    return;
  }

  if (!dragging) return;
  movedBy += Math.abs(dx) + Math.abs(dy);
  want.az -= dx * 0.0085;
  want.el = clamp(want.el + dy * 0.006, 0.22, 1.32);
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
  want.scale = clamp(want.scale * (1 + e.deltaY * 0.0012), 0.32, 1.9);
  userMoved = true;
  touched();
}, { passive: false });

/* ---- Raycasting ---------------------------------------------------------------- */

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let hovered = null;

function pick(px, py) {
  ndc.x = (px / cssW) * 2 - 1;
  ndc.y = -(py / cssH) * 2 + 1;
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(pickables, false);
  return hits.length ? hits[0].object.userData.zone : null;
}

function hoverAt(px, py) {
  const z = pick(px, py);
  if (z === hovered) return;
  hovered = z;
  document.body.classList.toggle("overzone", !!z);
  for (const zone of zones) {
    if (zone.label) zone.label.classList.toggle("hot", zone === z);
  }
}

function clickAt(px, py) {
  const z = pick(px, py);
  if (z) focusZone(z); else closePanel();
}

/* ===========================================================================
   Panel and focus
=========================================================================== */

const panel = document.getElementById("panel");
const elEyebrow = document.getElementById("panelEyebrow");
const elTitle = document.getElementById("panelTitle");
const elLede = document.getElementById("panelLede");
const elText = document.getElementById("panelText");
const elItems = document.getElementById("panelItems");
const elTodo = document.getElementById("panelTodo");
const labelsRoot = document.getElementById("labels");

let activeZone = null;
let azBeforeFocus = HOME.az;

for (const zone of zones) {
  const el = document.createElement("div");
  el.className = "zone-label";
  el.textContent = zone.def.label;
  el.addEventListener("click", function (e) { e.stopPropagation(); focusZone(zone); });
  el.addEventListener("pointerenter", function () { el.classList.add("hot"); });
  el.addEventListener("pointerleave", function () { el.classList.remove("hot"); });
  labelsRoot.appendChild(el);
  zone.label = el;
}

/** Push the view clear of whichever edge the panel occupies.
    Measured against the frustum the camera is heading FOR, not the one it
    currently has — otherwise the shift is sized from the old zoom level and
    the focused scene lands well off to one side. */
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

function focusZone(zone) {
  if (!activeZone) azBeforeFocus = want.az;
  activeZone = zone;

  want.az = zone.focusAz;
  // Looking down a little more keeps the side of the plinth out of the frame.
  const portrait = cssH > cssW * 1.15;
  want.el = portrait ? 0.74 : 0.66;
  // Tighter on a phone, where the panel takes the bottom rather than the side.
  want.fitH = portrait ? 5.6 : 8.4;
  want.fitV = portrait ? 4.6 : 5.3;
  want.scale = 1;
  want.target.set(zone.group.position.x, 1.5, zone.group.position.z);

  const d = zone.def;
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
    name.textContent = item.name;
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

  elTodo.hidden = !d.todo;
  elTodo.textContent = d.todo || "";

  document.body.classList.add("panel-open");
  touched();
  requestAnimationFrame(applyPanelShift);   // measure once the panel has laid out
}

function closePanel() {
  if (!activeZone) return;
  activeZone = null;
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
  if (e.key === "Escape") closePanel();
});

function touched() { document.body.classList.add("touched"); }

/* ===========================================================================
   Visitor count
=========================================================================== */

const API = "https://api.counterapi.dev/v2/alexander-parkers-team-4716/first-counter-4716";
const LOCAL_KEY = "ap_count_local";
const counterEl = document.getElementById("counter");
if (counterEl && JAR && JAR.caption) counterEl.title = JAR.caption;

function pickNumber(list) {
  for (const v of list) if (typeof v === "number" && isFinite(v)) return v;
  return null;
}

function fetchCount() {
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
      // Offline or the counter is down: keep a per-browser tally so the jar
      // still fills and nothing looks broken.
      let v = 0;
      try { v = parseInt(localStorage.getItem(LOCAL_KEY) || "0", 10); } catch (err) {}
      if (!isFinite(v) || v < 0) v = 0;
      v += 1;
      try { localStorage.setItem(LOCAL_KEY, String(v)); } catch (err) {}
      return Math.max(1, v);
    });
}

// A jar that filled linearly would be full forever after a few thousand
// visits, so the level is logarithmic: always rising, never quite full.
function fillFor(count) {
  return clamp(0.09 + Math.log10(count + 1) / 5.4, 0.09, 0.94);
}

let total = 0, fillTarget = 0, pourStart = 0, pouring = false;
let grainFall = false, grainT = 0;

function startPour(count) {
  total = count;
  fillTarget = fillFor(count);
  pourStart = performance.now();
  pouring = true;
}

function setCounter(v) { counterEl.textContent = Math.round(v).toLocaleString(); }

function dropGrain() {
  grain.visible = true;
  grain.position.set(0, 4.1, 0);
  grainT = 0;
  grainFall = true;
}

/* ===========================================================================
   Resize and loop
=========================================================================== */

function resize() {
  cssW = Math.max(1, window.innerWidth);
  cssH = Math.max(1, window.innerHeight);

  // The whole pixel-art effect: render small, let CSS scale it up.
  const div = cssW < 700 ? 1.7 : 2.3;
  const w = clamp(Math.round(cssW / div), 240, 820);
  const h = Math.max(1, Math.round(w * (cssH / cssW)));
  renderer.setSize(w, h, false);

  const shadowRes = cssW < 700 ? 512 : 1024;
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

const _v = new THREE.Vector3();
const _vc = new THREE.Vector3();

/* Labels are projected from each scene, then pushed outward in screen space
   away from the middle of the room and clamped inside the viewport. Doing the
   offset on screen rather than in the world keeps them off the props at every
   orbit angle, and keeps them on screen at every aspect ratio. */
function positionLabels() {
  _vc.set(0, 1.6, 0).project(camera);
  const cx = (_vc.x * 0.5 + 0.5) * cssW;
  const cy = (-_vc.y * 0.5 + 0.5) * cssH;
  const push = 46;
  const m = 56;

  for (const zone of zones) {
    if (!zone.label) continue;
    _v.copy(zone.anchor).project(camera);
    let x = (_v.x * 0.5 + 0.5) * cssW;
    let y = (-_v.y * 0.5 + 0.5) * cssH;
    const dx = x - cx, dy = y - cy;
    const len = Math.hypot(dx, dy) || 1;
    x = clamp(x + (dx / len) * push, m, cssW - m);
    y = clamp(y + (dy / len) * push, m + 30, cssH - m);
    zone.label.style.transform =
      "translate(-50%, -50%) translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px)";
  }
}

let last = performance.now();

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

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

  // The chest opens when its scene is the one being read.
  if (chestPivot) {
    const open = !!activeZone && activeZone.def.id === "projects";
    const ease = 1 - Math.pow(0.004, dt);
    chestPivot.rotation.x += ((open ? -1.85 : 0) - chestPivot.rotation.x) * ease;

    if (toys) {
      const slow = 1 - Math.pow(0.006, dt);
      for (const t of toys.children) {
        const home = t.userData.home;
        const wobble = Math.sin(now * 0.0018 + t.userData.phase) * 0.05;
        t.position.x += ((open ? home.x : 0) - t.position.x) * slow;
        t.position.z += ((open ? home.z : -0.4) - t.position.z) * slow;
        t.position.y += ((open ? 0.5 + wobble : -0.34) - t.position.y) * slow;
        t.rotation.y += dt * t.userData.spin * (open ? 1 : 0.15);
        t.visible = t.position.y > -0.3;
      }
    }
  }

  // The pour: the jar fills while the tally climbs, then one last grain drops.
  if (pouring) {
    const t = (now - pourStart) / 1800;
    const e = t >= 1 ? 1 : 1 - Math.pow(1 - t, 3);
    const fill = fillTarget * JAR_H * e;
    setCounter(total * e);
    sandCol.scale.y = Math.max(0.0001, fill);
    sandCol.position.y = JAR_Y + fill / 2;
    if (t >= 1) { pouring = false; setCounter(total); dropGrain(); }
  }

  if (grainFall) {
    grainT += dt;
    const landY = JAR_Y + fillTarget * JAR_H + 0.06;
    const y = 4.1 - 9.0 * grainT * grainT;
    if (y <= landY) {
      grain.position.set(0, landY, 0);
      if (grainT > 1.5) { grain.visible = false; grainFall = false; }
    } else {
      grain.position.set(0, y, 0);
      grain.rotation.x += dt * 6;
      grain.rotation.z += dt * 4;
    }
  }

  positionLabels();
  renderer.render(scene, camera);
}

/* ---- Go ------------------------------------------------------------------------ */

resize();
requestAnimationFrame(frame);
requestAnimationFrame(function () { document.body.classList.add("loaded"); });

fetchCount().then(startPour);
