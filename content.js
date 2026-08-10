/* =============================================================================
   content.js — every word on the site lives here, and there should not be many.

   There is no side panel, and no signs hanging over the world either. Each
   scene says what it is by what is in it. So the only words left are the ones
   with a real surface to sit on, printed into the world in the 5x7 pixel font:
   a whiteboard, a screen, a chart on a bed, a label beside a toy. Write short
   lines in upper case and only what a passer-by needs.

   The font covers A-Z 0-9 and . , - ! ? = & / : ' + % $ @ ( ). Anything else
   is skipped silently, so keep to those.

   Each entry in ZONES is one floating island, and the ARRAY ORDER is the order
   they sit in the ring, starting at the front and going clockwise. Move an
   entry up or down and its island moves with it. The scene for each one is
   built in world.js — this file only holds its id, its name, and any note to
   yourself about what is still unfinished.

   `todo` no longer shows on the site — nothing does, there is nowhere to put
   it. It prints once to the browser console instead, so unfinished copy still
   nags at you without a visitor ever seeing it. Delete the line when it's done.
============================================================================= */

export const ZONES = [
  {
    id: "rldatix",
    label: "RLDatix"
  },

  {
    id: "investing",
    label: "Investing"
  },

  {
    id: "bjj",
    label: "Jiu-jitsu"
  },

  {
    id: "music",
    label: "Music",
    todo: "The mixer is the way out to SoundCloud and Spotify. Individual track or set names could still go on the record sleeves if you want them named."
  },

  {
    id: "projects",
    label: "Projects"
  },

  {
    id: "about",
    label: "About"
  }
];

/* Both sides of the whiteboard in the investing room. Tap the board to read
   it, tap again and it turns over. Long lines wrap to the board on their own. */
export const BOARD = {
  front: {
    heading: "WHAT ACTUALLY MOVES IT",
    lines: [
      "AI BUBBLE POP?",
      "MORE COMPUTE = BETTER OUTCOMES?",
      "WHO PAYS FOR THE DATACENTRE?",
      "RATES DOWN - THEN WHAT?"
    ]
  },
  back: {
    heading: "BEFORE ANY OF IT",
    lines: [
      "WHAT MAKES THIS WRONG?",
      "WHAT IS PRICED IN?",
      "HOW BIG, AND WHY?",
      "WHEN DO I ADMIT IT?"
    ]
  }
};

/* The screen on the investing desk. Tap it and it fills the view while the
   equity curve draws itself out, drawdown and all. The curve is the point, so
   there is nothing under it — add a line or two to `lines` only if you really
   want words there. */
export const SCREEN = {
  title: "PORTFOLIO",
  lines: []
};

/* `booth` is lit across the front of the DJ booth — the name over the decks,
   and nothing else, because that is all a booth front ever says.

   `cue` is the word that comes up over the mixer when you look at it. Tap the
   mixer once and it appears; tap it again and it turns into the two icons in
   `links`, each of which opens its own `href` in a new tab. Keep `cue` to a
   single short word — it is a light on a mixer, not a button — and keep
   `links` at two: the icon is built by hand for each id in world.js, so a
   third id needs a matching shape added there before it does anything. */
export const MUSIC_LINK = {
  booth: "RESPRAY",
  cue: "LISTEN",
  links: [
    { id: "soundcloud", href: "https://soundcloud.com/1respray" },
    { id: "spotify", href: "https://open.spotify.com/track/5PgfeOzraZI73RTaK6Rpwc" }
  ]
};

/* What is in the toy chest, in order — one object per project. The chest stays
   shut until it is tapped; once open, each object turns and bobs. Tap one and a
   label comes up beside it; tap it again and the site opens, if there is one.

   Scentcloud is out for now. Its `perfume` shape is still in makeToy, so
   putting it back is one entry.

   Known shapes: coin, football (AFL), perfume, rocket, cube, ball, controller,
   brush. Add a case to makeToy in world.js for anything else. */
export const CHEST = [
  {
    shape: "football",
    title: "AFLMARKET.COM",
    lines: [],
    href: "https://aflmarket.com"
  },
  {
    shape: "coin",
    title: "HEADSORTAILSHERO.COM",
    lines: [],
    href: "https://headsortailshero.com"
  }
];

/* The chart hanging on the end of the hospital bed. Tap it to read it, then
   tap any one of the four lines to open a message form.

   `lines` is what is written on the paper and what the four tappable rows are.
   `topics` is the longer version of each, used as the subject of the email —
   same order, same length. */
export const CLIPBOARD = {
  brand: "RLDATIX",
  title: "MAKING HEALTH",
  title2: "AND CARE SAFER",
  lines: ["RISK", "POLICY", "WORKFORCE", "DATA"],
  topics: ["Risk & Safety", "Policy & Governance", "Workforce & People", "Data & Archival"],
  foot: "TAP A LINE"
};

/* Where the form sends. It opens the visitor's own mail app with the fields
   filled in — a static site has nothing to post to. */
export const CONTACT = {
  email: "hello@alexparker.au"
};

/* The hourglass on the centre island — one grain of sand per visit, which is
   where this site started. The count in the header is the same number.

   That island has two faces. Tap the hourglass and the whole thing turns over;
   what is on the other side is the memory shelf below. */
export const JAR_ZONE = {
  id: "hourglass",
  label: "The hourglass"
};

/* The memory shelf, on the underside of the centre island. One entry per orb,
   in shelf order: they fill the bottom shelf first and work upward, and every
   slot they do not take gets a dim orb so the rack reads as a shelf rather than
   a display of five things.

   `tint` is the colour it glows and must be one of joy, sadness, fear, disgust,
   anger or core — the six from the film, and nothing else is a valid value.
   `scene` names the diorama built for it in world.js: the memory itself lives
   there, as actual geometry, and adding one means adding a case to
   makeMemoryScene.

   There is no title, and there should not be. Nothing in this world is labelled
   from the outside; every scene says what it is by what is in it, and a memory
   with a caption under it is a slide rather than a memory.

   These five are placeholders. They exist to show what the shelf DOES, so they
   are deliberately generic — each one is meant to be replaced by a scene built
   from a real photograph. Known scenes: beach, summit, city, campfire, stage. */
export const MEMORIES = [
  { scene: "beach",    tint: "joy" },
  { scene: "summit",   tint: "core" },
  { scene: "city",     tint: "sadness" },
  { scene: "campfire", tint: "disgust" },
  { scene: "stage",    tint: "anger" }
];
