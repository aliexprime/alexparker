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
    todo: "Tap the whiteboard to read it. The questions on it are placeholders \u2014 rewrite BOARD at the bottom of this file, then delete this line."
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
      { name: "This site", tag: "2026" },
      { name: "Project two", tag: "Year" },
      { name: "Project three", tag: "Year" },
      { name: "Project four", tag: "Year" }
    ],
    todo: "Placeholder names. One toy appears per item, so adding or removing here changes the chest."
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

/* What is written on the whiteboard in the investing scene. Tap the board
   itself to read it. Long lines wrap to the board on their own. */
export const BOARD = {
  heading: "WHAT ACTUALLY MOVES IT",
  questions: [
    "AI BUBBLE POP?",
    "MORE COMPUTE = BETTER OUTCOMES?",
    "WHO PAYS FOR THE DATACENTRE?",
    "RATES DOWN - THEN WHAT?"
  ]
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
