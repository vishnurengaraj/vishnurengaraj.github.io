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

/** Copy features with `t` in 0..1. Pace flips so a faster route scores higher. */
export function stampLines(features, mode) {
  const list = features || [];
  if (mode === "density") return list;
  const values = list.map((feature) => metric(feature?.properties, mode)).filter((value) => value != null);
  const lo = values.length ? Math.min(...values) : 0;
  const hi = values.length ? Math.max(...values) : 0;
  const span = hi - lo;
  return list.map((feature) => {
    const value = metric(feature?.properties, mode);
    let t = value == null || span === 0 ? 0.5 : (value - lo) / span;
    if (mode === "pace") t = 1 - t;
    return {
      ...feature,
      properties: { ...(feature?.properties || {}), t: Math.round(t * 1000) / 1000 },
    };
  });
}
