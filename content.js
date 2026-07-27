/* =============================================================================
   content.js — every word on the site lives here, and there should not be many.

   The room does the talking. If a fact can be shown — a belt with two stripes,
   a ticker on a whiteboard, a chest with one toy per project — build it into
   the scene in world.js rather than writing it down here.

   Each entry in ZONES is one floating island, and the ARRAY ORDER is the order
   they sit in the ring, starting at the front and going clockwise. Move an
   entry up or down and its island moves with it.

   Delete the `todo` line from a section once its placeholder is gone — that
   dashed box only exists to stop placeholder text quietly shipping as if it
   were real.
============================================================================= */

export const ZONES = [
  {
    id: "rldatix",
    label: "RLDatix",
    eyebrow: "Work",
    title: "Healthcare software",
    lede: "Governance, policy and rostering systems for hospitals and aged care.",
    items: [
      { name: "DatixCloudIQ", tag: "Governance" },
      { name: "PolicyStat", tag: "Policy" },
      { name: "Optima", tag: "Rostering" },
      { name: "VitalCenter Online", tag: "Archival" }
    ]
  },

  {
    id: "investing",
    label: "Investing",
    eyebrow: "Practice",
    title: "Markets",
    lede: "Write the reasoning down before the outcome is known. Nothing here is advice.",
    todo: "Tap the board to read it, tap again to turn it over. Both sides are placeholders \u2014 rewrite BOARD at the bottom of this file, then delete this line."
  },

  {
    id: "bjj",
    label: "Jiu-jitsu",
    eyebrow: "Training",
    title: "The mats",
    lede: "Taekwondo as a kid. Jiu-jitsu now.",
    items: [
      { name: "Brazilian jiu-jitsu", tag: "Now" },
      { name: "Taekwondo", tag: "Then" }
    ],
    todo: "Both belts are on the rack — zoom in. Add your gym here if you want it named, then delete this line."
  },

  {
    id: "music",
    label: "Music",
    eyebrow: "Studio",
    title: "Decks and records",
    lede: "DJing, and music made for its own sake.",
    items: [
      { name: "Track or set one", tag: "Year" },
      { name: "Track or set two", tag: "Year" },
      { name: "Track or set three", tag: "Year" }
    ],
    todo: "Placeholder. Real names and years, and links if there are any."
  },

  {
    id: "projects",
    label: "Projects",
    eyebrow: "Archive",
    title: "The toy chest",
    lede: "Side builds. Open it and things fall out.",
    items: [
      { name: "AFLmarket.com", tag: "Site", href: "https://aflmarket.com" },
      { name: "headsortailshero.com", tag: "Site", href: "https://headsortailshero.com" },
      { name: "Scentcloud", tag: "Unfinished" }
    ],
    todo: "Open the chest and tap an object to read about that project. The two live ones still need a line each saying what they are \u2014 see CHEST at the bottom of this file."
  },

  {
    id: "about",
    label: "About",
    eyebrow: "Who",
    title: "Alex Parker",
    lede: "Australia. Somewhere between the clinical side and the software.",
    items: [
      { name: "hello@alexparker.au", tag: "Email" }
    ],
    todo: "One or two sentences of your own, if you want them. Otherwise leave it this short and delete this line."
  }
];

/* Both sides of the whiteboard. Tap the board to read it, tap again and it
   turns over. Long lines wrap to the board on their own. */
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

/* What is in the toy chest, in order — one object per project. Each one turns
   and bobs while the chest is open, and can be tapped on its own.

   Known shapes: coin, football (AFL), perfume, rocket, cube, ball, controller,
   brush. Add a case to makeToy in world.js for anything else. */
export const CHEST = [
  {
    shape: "football",
    title: "AFLmarket.com",
    text: "Placeholder. One line on what it is.",
    href: "https://aflmarket.com"
  },
  {
    shape: "coin",
    title: "headsortailshero.com",
    text: "Placeholder. One line on what it is.",
    href: "https://headsortailshero.com"
  },
  {
    shape: "perfume",
    title: "Scentcloud",
    text: "An app. Not finished yet."
  }
];

/* The chart hanging on the end of the hospital bed. Tap it to pick it up, then
   tap a line to turn the page to a message form. */
export const CLIPBOARD = {
  eyebrow: "RLDatix",
  title: "Making Health and Care Safer",
  lede: "Pick a line to send me a message.",
  lines: [
    "Risk & Safety",
    "Policy & Governance",
    "Workforce & People",
    "Data & Archival"
  ]
};

/* Where the form sends. It opens the visitor's own mail app with the fields
   filled in — a static site has nothing to post to. */
export const CONTACT = {
  email: "hello@alexparker.au"
};

/* The hourglass on the centre island — one grain of sand per visit, which is
   where this site started. `keepAz` stops the camera swinging round, since an
   hourglass in the middle of the ring has no front to face. */
export const JAR_ZONE = {
  id: "hourglass",
  label: "The hourglass",
  eyebrow: "Visitors",
  title: "One grain per visit",
  lede: "The level in the lower bulb is the visitor count. Logarithmic, so it never quite fills.",
  keepAz: true
};
