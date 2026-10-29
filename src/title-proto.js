/* Title scroll. The ridges are position:absolute inside the scroller,
   so they already travel 1:1 with the sunrise bands. --rate adds
   translateY = --scroll * --rate. --scroll follows scrollTop for one
   viewport, then holds. Speed against the bars is 1 - rate.

   Shipping is variant D: the front ridge rate is 0, so it stays with
   the bars, and the far ridges lift (l7 -0.36) so their peaks rise
   above the treeline. The old l1 rate of -0.62 ran the front at 1.62×
   the bars. ?proto=1 still opens the comparison picker. */

export const LAYER_IDS = ["l1", "l2", "l3", "l4", "l5", "l6", "l7"];

export const CURRENT_RATES = {
  l1: -0.62,
  l2: -0.4,
  l3: -0.32,
  l4: -0.18,
  l5: -0.12,
  l6: -0.08,
  l7: -0.04,
};

/* Far-ridge lift for B and D. A downward lag (the classic "backs move
   slower") sinks those peaks behind the front silhouette, so the depth
   disappears. Lifting l7 by 0.36 of the scroll, with the layers stepped
   toward the locked front, pulls the hazy ranges up above the treeline.
   0.50 cleared the desktop sky; 0.36 still filled the frame at 1440 and
   at 390. */
export const ACCENT_LIFT = -0.36;

const LIVE_BANDS = [
  { id: "night", className: "band-night" },
  { id: "mauve", className: "band-mauve" },
  { id: "pink", className: "band-pink" },
  { id: "coral", className: "band-coral" },
  { id: "orange", className: "band-orange" },
  { id: "gold", className: "band-gold" },
  { id: "yellow", className: "band-yellow" },
  { id: "bright", className: "band-bright" },
  { id: "white", className: "band-white" },
];

/* Opaque fill of the front ridge, sampled from l1 (rgb 61, 51, 84).
   The first sunrise bar uses it so the treeline meets the bars. */
export const RIDGE_COLOR = "#3d3354";

/* 18 bars over the same sunrise length as the old 9. The live stops
   from mauve onward stay exact. Each shorter step gets one OKLab
   midpoint. Mauve → pink is the long step, so it gets two (thirds).
   The sheet end stays #f7f7f8. The first bar is the ridge, not the
   old night #221445. */
const DENSE_COLORS = [
  RIDGE_COLOR,
  "#3f245a",
  "#5e3470",
  "#7f4074",
  "#a14b77",
  "#c45478",
  "#d25f6e",
  "#e06a62",
  "#ee7556",
  "#fd8046",
  "#ff9938",
  "#ffb020",
  "#ffbd5a",
  "#fec97f",
  "#fdd5a0",
  "#fbe1be",
  "#f9ecdb",
  "#f7f7f8",
];

function round4(n) {
  return Math.round(n * 10000) / 10000;
}

export function ratesFor(kind) {
  if (kind === "current") return CURRENT_RATES;
  const shift = -CURRENT_RATES.l1;
  const sync = {};
  for (const id of LAYER_IDS) sync[id] = round4(CURRENT_RATES[id] + shift);
  if (kind === "sync") return sync;
  const accent = {};
  const last = LAYER_IDS.length - 1;
  LAYER_IDS.forEach((id, index) => {
    accent[id] = round4((index / last) * ACCENT_LIFT);
  });
  return accent;
}

export function bandsFor(dense) {
  if (!dense) return LIVE_BANDS.map((band) => ({ ...band, style: null }));
  const top = DENSE_COLORS.length;
  return DENSE_COLORS.map((color, index) => ({
    id: `d${index}`,
    className: index === top - 1 ? "band-white" : null,
    style: {
      backgroundColor: color,
      zIndex: String(top - index),
    },
  }));
}

export const VARIANTS = [
  {
    id: "current",
    label: "Now",
    short: "Current",
    rates: "current",
    dense: false,
    blurb:
      "Front ridge rate −0.62. Over the first screen it pulls ahead of the bars by 0.62× the viewport, and that lead stays for the rest of the sunrise.",
    warn: "",
  },
  {
    id: "a",
    label: "A",
    short: "Sync",
    rates: "sync",
    dense: false,
    blurb:
      "Front rate 0, matched to the color bars. Farther ridges keep today’s gaps, so they sit just behind that front line.",
    warn: "",
  },
  {
    id: "b",
    label: "B",
    short: "Accent",
    rates: "accent",
    dense: false,
    blurb:
      "Front stays on the bars. Far ridges lift (l7 −0.36) so the hazy peaks rise above the treeline. A downward lag hides those peaks behind the front.",
    warn: "Phone: far ridges rise by up to 0.36× the screen during the first viewport. They stayed in frame at 390. No extra paint.",
  },
  {
    id: "c",
    label: "C",
    short: "Dense",
    rates: "sync",
    dense: true,
    blurb:
      "18 bars across the same sunrise height, front on the Sync rates. The 9 live colors stay, with OKLab steps between them.",
    warn: "Phone: twice the shadowed bands. The scroll is the same length, and the extra paint can hitch.",
  },
  {
    id: "d",
    label: "D",
    short: "Combo",
    rates: "accent",
    dense: true,
    blurb:
      "Shipping look. 18 bars, far peaks lifted, front locked to the bars. The first bar is the ridge color.",
    warn: "Phone: extra shadowed bands, plus the far-ridge lift. The bars are the hitch risk; the lift is the crop risk.",
  },
];

const BY_ID = new Map(VARIANTS.map((variant) => [variant.id, variant]));

export function variantById(id) {
  if (typeof id !== "string") return null;
  return BY_ID.get(id) || null;
}

export const PRODUCTION_VARIANT = "d";

export function readTitleVariant(queryValue, stored) {
  return variantById(queryValue)?.id || variantById(stored)?.id || PRODUCTION_VARIANT;
}

export const PROTO_STORAGE_KEY = "title-proto";
