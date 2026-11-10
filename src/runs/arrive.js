/** One globe-to-city flight. Zoom eases the whole way. Tilt and bearing
    stay flat, then rise with zero slope at both ends of the late window. */

export const ARRIVE_MS = 4800;

function clamp01(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t;
}

/** cubic-bezier(0.4, 0, 0.2, 1). Velocity is 0 at the start and the end. */
export function calmEase(x) {
  const p1x = 0.4;
  const p1y = 0;
  const p2x = 0.2;
  const p2y = 1;
  const cx = 3 * p1x;
  const bx = 3 * (p2x - p1x) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * p1y;
  const by = 3 * (p2y - p1y) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t) => ((ay * t + by) * t + cy) * t;
  const slope = (t) => (3 * ax * t + 2 * bx) * t + cx;
  let t = clamp01(x);
  const target = t;
  for (let i = 0; i < 6; i++) {
    const dx = sampleX(t) - target;
    const d = slope(t);
    if (Math.abs(dx) < 1e-5 || Math.abs(d) < 1e-6) break;
    t = Math.min(1, Math.max(0, t - dx / d));
  }
  return sampleY(t);
}

/** Flat, then a smoothstep. Slope is 0 where the lean begins and where it ends. */
export function lateLean(t) {
  const start = 0.38;
  const end = 0.9;
  if (t <= start) return 0;
  if (t >= end) return 1;
  const u = (t - start) / (end - start);
  return u * u * (3 - 2 * u);
}

export function arrivalFrame(elapsed, duration, from, to) {
  const raw = duration <= 0 ? 1 : clamp01(elapsed / duration);
  const t = calmEase(raw);
  const lean = lateLean(t);
  return {
    raw,
    t,
    lean,
    lng: from.lng + (to.lng - from.lng) * t,
    lat: from.lat + (to.lat - from.lat) * t,
    zoom: from.zoom + (to.zoom - from.zoom) * t,
    pitch: from.pitch + (to.pitch - from.pitch) * lean,
    bearing: from.bearing + (to.bearing - from.bearing) * lean,
  };
}
