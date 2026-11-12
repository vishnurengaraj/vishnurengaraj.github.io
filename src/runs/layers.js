/** How a route is colored when the map is not showing density. */

export const LAYER_MODES = ["density", "recency", "distance", "pace", "elevation"];

export const LAYER_LABELS = {
  density: "Density",
  recency: "Recency",
  distance: "Distance",
  pace: "Pace",
  elevation: "Elevation",
};

export const LAYER_LEGENDS = {
  density: "Low to high activity density",
  recency: "Older to newer",
  distance: "Shorter to longer",
  pace: "Slower to faster",
  elevation: "Less to more elevation gain",
};

/* One ramp per mode, low t to high t. Each one gets darker or more saturated as
   it climbs, so the order still reads in grayscale and for red-green color
   blindness, and the low end stays dark enough to show on the light Positron
   basemap at every zoom. Density is the heatmap and keeps the thermal ramp. */
export const LAYER_RAMPS = {
  density: ["#ffd6a0", "#ffa840", "#ec702e", "#c43a48", "#2d1d7a"],
  // Faded slate for old routes, hot coral for the newest.
  recency: ["#9aa9c4", "#5b73c9", "#8a3fb8", "#d0367f", "#ff4f2e"],
  // Sea-glass teal to deep navy.
  distance: ["#7fcbb4", "#3aa39a", "#1f7a8c", "#21507a", "#1b2a52"],
  // Diverging: slow blue, neutral stone, fast vermilion.
  pace: ["#2c6bb5", "#7fa3cf", "#a8a091", "#ec8a5a", "#d0402a"],
  // Terrain: valley green, ochre, umber, near-black summit.
  elevation: ["#8fbf6a", "#c7b04a", "#b07433", "#7a4220", "#3b2214"],
};

/** MapLibre line-color expression over the stamped `t`. */
export function rampExpression(mode) {
  const stops = LAYER_RAMPS[layerMode(mode)];
  const out = ["interpolate", ["linear"], ["coalesce", ["get", "t"], 0]];
  stops.forEach((color, i) => out.push(i / (stops.length - 1), color));
  return out;
}

/** CSS gradient for the legend swatch, same stops as the map. */
export function rampGradient(mode) {
  return `linear-gradient(90deg, ${LAYER_RAMPS[layerMode(mode)].join(", ")})`;
}

export function layerMode(value) {
  const id = String(value || "density");
  return LAYER_MODES.includes(id) ? id : "density";
}

function metric(props, mode) {
  if (mode === "recency") {
    const t = Date.parse(props?.date);
    return Number.isFinite(t) ? t : null;
  }
  if (mode === "distance") {
    const d = Number(props?.distanceM);
    return Number.isFinite(d) ? d : null;
  }
  if (mode === "pace") {
    const d = Number(props?.distanceM);
    const s = Number(props?.movingS);
    if (!(d > 0) || !(s > 0)) return null;
    return s / d;
  }
  if (mode === "elevation") {
    const e = Number(props?.elevM);
    return Number.isFinite(e) ? e : null;
  }
  return null;
}

/** Copy features with `t` in 0..1 by rank, not by min/max. A few long hikes or
    slow walks would otherwise squeeze every ordinary run into one end of the
    ramp. Ties share a rank. Pace flips so a faster route scores higher. */
export function stampLines(features, mode) {
  const list = features || [];
  if (mode === "density") return list;
  const sorted = list
    .map((feature) => metric(feature?.properties, mode))
    .filter((value) => value != null)
    .sort((a, b) => a - b);
  const rank = new Map();
  sorted.forEach((value, i) => {
    if (!rank.has(value)) rank.set(value, { first: i, last: i });
    else rank.get(value).last = i;
  });
  const span = sorted.length - 1;
  return list.map((feature) => {
    const value = metric(feature?.properties, mode);
    let t = 0.5;
    if (value != null && span > 0) {
      const { first, last } = rank.get(value);
      t = (first + last) / 2 / span;
    }
    if (mode === "pace") t = 1 - t;
    return {
      ...feature,
      properties: { ...(feature?.properties || {}), t: Math.round(t * 1000) / 1000 },
    };
  });
}
