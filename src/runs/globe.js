/** Flat world hands off to the globe below this zoom. The globe camera rests
    lower, and a zoom-in past the exit line returns to the regional map. */
export const GLOBE_ENTER_ZOOM = 3.25;
export const GLOBE_EXIT_ZOOM = 2.2;
export const GLOBE_VIEW_ZOOM = 1.55;

export function globeHandoff(isGlobe, zoom) {
  if (!Number.isFinite(zoom)) return "none";
  if (!isGlobe && zoom <= GLOBE_ENTER_ZOOM) return "enter";
  if (isGlobe && zoom >= GLOBE_EXIT_ZOOM) return "leave";
  return "none";
}
