/* =============================================================================
   content.js — every word on the site lives here.

   Edit this file freely; nothing in world.js needs to change. Each entry in
   ZONES is one floating island, and the ARRAY ORDER is the order they sit in
   the ring, starting at the front and going clockwise. Move an entry up or down
   and its island moves with it. Add a seventh and the ring re-spaces itself.

   Delete the `todo` line from a section once you have replaced its placeholder
   copy — that dashed box only exists to stop placeholder text quietly shipping
   as if it were real.
============================================================================= */

export const ZONES = [
  {
    id: "rldatix",
    label: "RLDatix",
    eyebrow: "Work",
    title: "Healthcare software",
    lede: "Clinical governance, policy and workforce systems for hospitals and aged care providers.",
    text: [
      "Day to day this is scoping what a provider actually needs, mapping it to what the platform can do, and writing the proposal that gets it approved — then staying close enough through delivery that the thing which was sold is the thing that lands.",
      "The work sits between the clinical side and the software side. Neither group has much patience for the other's vocabulary, so most of the value is in translation."
    ],
    items: [
      { name: "DatixCloudIQ", tag: "Governance", note: "Incident, risk and compliance management." },
      { name: "PolicyStat", tag: "Policy", note: "Policy and document control." },
      { name: "Optima", tag: "Rostering", note: "Workforce planning and rostering." },
      { name: "VitalCenter Online", tag: "Archival", note: "Legacy system archival and decommissioning." }
    ],
    todo: "Placeholder. Replace the lede, the two paragraphs and the notes above with your own account of the role — and delete this `todo` line in content.js when you do."
  },

  {
    id: "investing",
    label: "Investing",
    eyebrow: "Practice",
    title: "Markets",
    lede: "A long-running interest in how capital gets allocated, and in being honest about what I actually know.",
    text: [
      "Mostly this is reading, position sizing, and writing down the reasoning before the outcome is known so it can be judged fairly afterwards. The whiteboard is the real tool.",
      "Nothing here is advice. It is a record of thinking, kept mainly so that later I can see where it was wrong."
    ],
    items: [
      { name: "Thesis notes", tag: "Writing", note: "Positions written up before they are taken." },
      { name: "Portfolio review", tag: "Process", note: "A standing check on concentration and drawdown." },
      { name: "Post-mortems", tag: "Review", note: "What the reasoning missed, in hindsight." }
    ],
    todo: "Placeholder. Swap in what you actually want public here — this section deliberately says very little until you decide how much to share."
  },

  {
    id: "bjj",
    label: "Jiu-jitsu",
    eyebrow: "Training",
    title: "The mats",
    lede: "Taekwondo as a kid, Brazilian jiu-jitsu as an adult. Twenty-odd years apart and not much alike.",
    text: [
      "Taekwondo taught distance and timing at an age when neither meant anything yet. Jiu-jitsu took the same problem and moved it to the ground, where being wrong is immediate and unarguable.",
      "It is the one thing on this page with no deliverable. You turn up, you get better slowly, and the only record is that the same people keep catching you in the same places until they don't."
    ],
    items: [
      { name: "Brazilian jiu-jitsu", tag: "Current", note: "Training on the mats now." },
      { name: "Taekwondo", tag: "As a kid", note: "Where it started." }
    ],
    todo: "Placeholder. Add your belt, your gym, how long you have trained — I have deliberately not invented any of it. Delete this line once you have."
  },

  {
    id: "music",
    label: "Music",
    eyebrow: "Studio",
    title: "Decks and records",
    lede: "DJing, and music made for the sake of making it.",
    text: [
      "The studio is the corner of this room with the least justification and the most hours in it. Nothing here needed to exist, which is the point.",
      "Mixes, edits, and tracks that mostly never left the drive."
    ],
    items: [
      { name: "Track or set one", tag: "Year", note: "One line on what it is, and a link if there is one." },
      { name: "Track or set two", tag: "Year", note: "One line on what it is, and a link if there is one." },
      { name: "Track or set three", tag: "Year", note: "One line on what it is, and a link if there is one." }
    ],
    todo: "Placeholder. Drop in the real tracks, sets or mixes — item names and notes both. Delete this line when you do."
  },

  {
    id: "projects",
    label: "Projects",
    eyebrow: "Archive",
    title: "The toy chest",
    lede: "Everything else — the side builds, the experiments, the things made for their own sake.",
    text: [
      "Some of it shipped, most of it did not, and a fair amount was abandoned the moment the interesting problem was solved. The chest is the honest format: open it and things fall out."
    ],
    items: [
      { name: "This site", tag: "2026", note: "A pixel-art room rendered in real 3D. One grain of sand in the jar for every visitor." },
      { name: "Project two", tag: "Year", note: "One line on what it was and why it existed." },
      { name: "Project three", tag: "Year", note: "One line on what it was and why it existed." },
      { name: "Project four", tag: "Year", note: "One line on what it was and why it existed." }
    ],
    todo: "Placeholder. Add or remove `items` here and the toys in the chest follow automatically — world.js reads the count from this list."
  },

  {
    id: "about",
    label: "About",
    eyebrow: "Who",
    title: "Alex Parker",
    lede: "Based in Australia. Interested in the seam between clinical work and the software that carries it.",
    text: [
      "The shelf is the part of the room that says the most. Books, a desk, a lamp left on — the setting the rest of it happens in.",
      "Best way to reach me is email."
    ],
    items: [
      { name: "hello@alexparker.au", tag: "Email" },
      { name: "Australia", tag: "Located" }
    ],
    todo: "Placeholder. Write the two or three sentences you would actually want a stranger to read first, and delete this line."
  }
];

/* The jar on the centre island. One grain of sand per visit — the original idea
   this site started from, kept literally. It is a selectable section like any
   other; `keepAz` stops the camera swinging round, since a jar in the middle of
   the room has no front to face. */
export const JAR_ZONE = {
  id: "jar",
  label: "The jar",
  eyebrow: "Visitors",
  title: "One grain per visit",
  lede: "The site began as a single grain of sand falling. This is what is left of that idea.",
  text: [
    "Every time someone opens this page a counter ticks over and one more grain lands in the jar. The number in the header is that count.",
    "The level is logarithmic rather than linear, so it always rises and never quite fills. A jar that filled honestly would have been full for good after a few thousand visits, which is a worse thing to look at."
  ],
  keepAz: true
};
