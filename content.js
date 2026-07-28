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
    label: "Jiu-jitsu",
    todo: "The belt rack has both belts on it — zoom in. Nothing names the gym — say if you want it lettered onto the mats or the rack."
  },

  {
    id: "music",
    label: "Music",
    todo: "The laptop links out to SoundCloud. Individual track or set names could still go on the record sleeves if you want them named."
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

/* The laptop open on the DJ booth. Tap it to read the screen, tap it again and
   SoundCloud opens in a new tab. Keep the lines short — the screen is small. */
export const MUSIC_LINK = {
  title: "SOUNDCLOUD",
  handle: "1RESPRAY",
  foot: "TAP AGAIN TO OPEN",
  href: "https://soundcloud.com/1respray"
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
   where this site started. The count in the header is the same number. */
export const JAR_ZONE = {
  id: "hourglass",
  label: "The hourglass"
};
