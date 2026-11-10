/** Top-down framing for one open route.

The camera padding that keeps a route out of the drawer is part of the map
transform. It has to be cleared when the drawer closes, or the next zoom-out
draws the globe around that shifted center. */

export const ROUTE_MAX_ZOOM = 15;
export const FRAME_GAP = 18;
const TILE = 512;
const MIN_VIEW = 88;

export function mercatorY(lat) {
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat));
  return (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (clamped * Math.PI) / 360))) / 360;
}

export function latFromMercatorY(y) {
  const y2 = 180 - y * 360;
  return (360 / Math.PI) * Math.atan(Math.exp((y2 * Math.PI) / 180)) - 90;
}

/** Axis-aligned bounds. Null when the line crosses the antimeridian. */
export function boundsFromGeometry(geometry) {
  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;
  let count = 0;
  const visit = (coords) => {
    if (!coords) return;
    if (typeof coords[0] === "number") {
      const lng = coords[0];
      const lat = coords[1];
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
      west = Math.min(west, lng);
      east = Math.max(east, lng);
      south = Math.min(south, lat);
      north = Math.max(north, lat);
      count += 1;
      return;
    }
    for (const child of coords) visit(child);
  };
  visit(geometry?.coordinates);
  if (!count || east - west > 180) return null;
  return { west, south, east, north };
}

/** Zoom and center that fit `bounds` in the padded viewport. Pitch stays the caller's job. */
export function routeCamera(bounds, viewport, padding, maxZoom = ROUTE_MAX_ZOOM) {
  if (!bounds || !viewport) return null;
  const availW = viewport.width - padding.left - padding.right;
  const availH = viewport.height - padding.top - padding.bottom;
  if (!(availW > 32) || !(availH > 32)) return null;
  const lngSpan = Math.max(bounds.east - bounds.west, 1e-6);
  const ySpan = Math.max(Math.abs(mercatorY(bounds.south) - mercatorY(bounds.north)), 1e-8);
  const zoomX = Math.log2(availW / ((lngSpan / 360) * TILE));
  const zoomY = Math.log2(availH / (ySpan * TILE));
  /* A hair of extra room so the stroke and globe-vs-mercator scale stay inside. */
  const fitted = Math.min(zoomX, zoomY) - 0.05;
  const zoom = Math.max(0.5, Math.min(fitted, maxZoom));
  const yMid = (mercatorY(bounds.north) + mercatorY(bounds.south)) / 2;
  return {
    center: [(bounds.west + bounds.east) / 2, latFromMercatorY(yMid)],
    zoom,
  };
}

/** Pad the occluded edges, then keep a usable window if the drawer is very tall. */
export function occlusionPadding({ width, height, top = 0, right = 0, bottom = 0, left = 0 }) {
  const pad = {
    top: Math.round(top + FRAME_GAP),
    right: Math.round(right + FRAME_GAP),
    bottom: Math.round(bottom + FRAME_GAP),
    left: Math.round(left + FRAME_GAP),
  };
  const fit = (start, end, limit) => {
    if (limit - start - end >= MIN_VIEW) return [start, end];
    const room = Math.max(FRAME_GAP * 2, limit - MIN_VIEW);
    if (end >= start) {
      end = Math.min(end, Math.max(FRAME_GAP, room - start));
      start = Math.min(start, Math.max(FRAME_GAP, room - end));
    } else {
      start = Math.min(start, Math.max(FRAME_GAP, room - end));
      end = Math.min(end, Math.max(FRAME_GAP, room - start));
    }
    return [Math.round(start), Math.round(end)];
  };
  [pad.left, pad.right] = fit(pad.left, pad.right, width || 0);
  [pad.top, pad.bottom] = fit(pad.top, pad.bottom, height || 0);
  return pad;
}
