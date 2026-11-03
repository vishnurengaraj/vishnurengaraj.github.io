/** How a map click becomes a run, a short chooser, or a closer look.

Below the zoom where ink veins are readable, several routes in one pixel are
not a choice yet — the map moves in. One hit-tested route opens. Empty map
does nothing. */
export const VEIN_PICK_ZOOM = 13.6;

export function resolvePick(ids, zoom) {
  const unique = [];
  const seen = new Set();
  for (const id of ids || []) {
    const key = id == null ? "" : String(id);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(key);
  }
  if (unique.length === 0) return { action: "none", ids: [] };
  if (unique.length === 1) return { action: "open", ids: unique };
  if (!Number.isFinite(zoom) || zoom < VEIN_PICK_ZOOM) return { action: "zoom", ids: unique };
  return { action: "choose", ids: unique };
}

/** Next overview step: veins readable, still short of the max zoom. */
export function closerZoom(zoom) {
  const current = Number.isFinite(zoom) ? zoom : 0;
  return Math.min(15.4, Math.max(current + 2.1, 14.2));
}
