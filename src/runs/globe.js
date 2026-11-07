/** One map. The world view is just the camera pulled back, not a second mode. */

export const WORLD_ZOOM = 1.55;
export const WORLD_CENTER = [-100, 36];
/** Chip follows the camera once a region fills the view. */
export const REGION_ZOOM = 6.5;

export function cityDistance(a, b) {
  if (!a || !b) return Infinity;
  const mid = ((a[1] + b[1]) / 2) * (Math.PI / 180);
  const mLng = 111320 * Math.cos(mid);
  return Math.hypot((a[0] - b[0]) * mLng, (a[1] - b[1]) * 111320);
}

export function nearestCity(cities, lngLat) {
  let best = null;
  let bestDistance = Infinity;
  for (const city of cities || []) {
    if (!city?.center) continue;
    const distance = cityDistance(city.center, lngLat);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = city;
    }
  }
  return best;
}

/** Pitch eases down as the camera pulls back, so the world stays in frame. */
export function pitchForZoom(zoom, fullPitch) {
  if (!Number.isFinite(zoom) || !Number.isFinite(fullPitch)) return 0;
  if (zoom >= 8) return fullPitch;
  if (zoom <= 3) return 0;
  return (fullPitch * (zoom - 3)) / 5;
}
