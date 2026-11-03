/** Activity density for the /runs heatmap.

Each activity increments a cell once, no matter how many GPS samples fall in it.
Weight is sqrt(count / hot), so one pass stays on the cool end of the ramp and
repeated corridors climb toward 1. Map paint in map.js is tuned for CELL_M. */

export const CELL_M = 110;
export const DENSITY_HOT = 80;

const M_PER_DEG_LAT = 111320;

export function densityWeight(count, hot = DENSITY_HOT) {
  if (!count || count < 1) return 0;
  return Math.min(1, Math.sqrt(count / hot));
}

function project(lng, lat, lat0) {
  const mLng = M_PER_DEG_LAT * Math.cos((lat0 * Math.PI) / 180);
  return [lng * mLng, lat * M_PER_DEG_LAT];
}

function unproject(x, y, lat0) {
  const mLng = M_PER_DEG_LAT * Math.cos((lat0 * Math.PI) / 180);
  return [x / mLng, y / M_PER_DEG_LAT];
}

function partsOf(geometry) {
  if (!geometry) return [];
  if (geometry.type === "LineString") return [geometry.coordinates];
  if (geometry.type === "MultiLineString") return geometry.coordinates;
  return [];
}

function firstLat(features) {
  for (const feature of features) {
    for (const line of partsOf(feature.geometry)) {
      if (line?.[0]?.length >= 2) return line[0][1];
    }
  }
  return 0;
}

/** FeatureCollection of points. `w` is 0–1 activity density. */
export function densityHeat(collection, { cellM = CELL_M, hot = DENSITY_HOT } = {}) {
  const features = Array.isArray(collection?.features) ? collection.features : [];
  const counts = new Map();
  if (!features.length) return { type: "FeatureCollection", features: [] };

  const lat0 = firstLat(features);
  const step = cellM * 0.45;

  for (const feature of features) {
    const seen = new Set();
    for (const line of partsOf(feature.geometry)) {
      if (!line || line.length < 2) continue;
      const mark = (lng, lat) => {
        const [x, y] = project(lng, lat, lat0);
        seen.add(`${Math.round(x / cellM)}:${Math.round(y / cellM)}`);
      };
      mark(line[0][0], line[0][1]);
      for (let i = 1; i < line.length; i++) {
        const a = line[i - 1];
        const b = line[i];
        const [x0, y0] = project(a[0], a[1], lat0);
        const [x1, y1] = project(b[0], b[1], lat0);
        const dist = Math.hypot(x1 - x0, y1 - y0);
        const n = Math.max(1, Math.ceil(dist / step));
        for (let s = 1; s <= n; s++) {
          const t = s / n;
          mark(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);
        }
      }
    }
    for (const key of seen) counts.set(key, (counts.get(key) || 0) + 1);
  }

  const points = [];
  for (const [key, count] of counts) {
    const [ix, iy] = key.split(":").map(Number);
    const [lng, lat] = unproject(ix * cellM, iy * cellM, lat0);
    points.push({
      type: "Feature",
      properties: { w: Math.round(densityWeight(count, hot) * 1000) / 1000 },
      geometry: {
        type: "Point",
        coordinates: [Math.round(lng * 1e6) / 1e6, Math.round(lat * 1e6) / 1e6],
      },
    });
  }
  return { type: "FeatureCollection", features: points };
}
