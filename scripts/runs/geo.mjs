/** Geometry helpers for the runs build. Coordinates are [lng, lat]. */

const EARTH_M = 6371000;

export function haversine(a, b) {
  const φ1 = (a[1] * Math.PI) / 180;
  const φ2 = (b[1] * Math.PI) / 180;
  const dφ = ((b[1] - a[1]) * Math.PI) / 180;
  const dλ = ((b[0] - a[0]) * Math.PI) / 180;
  const s = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function moveMeters(coord, eastM, northM) {
  const lat = coord[1];
  const mLat = 111320;
  const mLng = 111320 * Math.cos((lat * Math.PI) / 180);
  return [coord[0] + eastM / mLng, coord[1] + northM / mLat];
}

/**
 * Strava's activities.csv Distance column is meters. Some rebuilds stored
 * kilometers instead (a marathon shows up as ~42.2, a long run as 11.82).
 * A sub-200 value with enough moving time to be a real outing, and a
 * plausible walking/running speed once scaled, is treated as kilometers.
 */
export function distanceToMeters(distance, movingSeconds) {
  if (distance == null || !Number.isFinite(Number(distance)) || Number(distance) <= 0) {
    return distance == null ? null : Number(distance);
  }
  const value = Number(distance);
  const moving = Number(movingSeconds);
  if (!(value > 0) || value >= 200 || !Number.isFinite(moving) || moving <= 0) return value;
  const asMeters = value / moving;
  const asKilometers = (value * 1000) / moving;
  // 1.25 m over 398 s is not a walk. 1.25 km over that time is about 8:30 per mile.
  if (asMeters < 0.4 && asKilometers >= 0.4 && asKilometers <= 7) {
    return Math.round(value * 1000 * 100) / 100;
  }
  return value;
}

export function pathLength(coords) {
  let total = 0;
  for (let i = 1; i < coords.length; i++) total += haversine(coords[i - 1], coords[i]);
  return total;
}

export function densify(coords, stepM = 16) {
  if (!coords || coords.length < 2) return (coords || []).map((c) => c.slice());
  const out = [coords[0].slice()];
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1];
    const b = coords[i];
    const dist = haversine(a, b);
    const steps = Math.max(1, Math.ceil(dist / stepM));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

function pointSegmentDistance(point, a, b) {
  const lat = ((a[1] + b[1]) * 0.5 * Math.PI) / 180;
  const mLng = 111320 * Math.cos(lat);
  const mLat = 111320;
  const bx = (b[0] - a[0]) * mLng;
  const by = (b[1] - a[1]) * mLat;
  const px = (point[0] - a[0]) * mLng;
  const py = (point[1] - a[1]) * mLat;
  const len2 = bx * bx + by * by;
  let t = len2 === 0 ? 0 : (px * bx + py * by) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - bx * t, py - by * t);
}

export function distanceToLine(point, coords) {
  if (!coords?.length) return Infinity;
  let best = haversine(point, coords[0]);
  for (let i = 1; i < coords.length; i++) {
    best = Math.min(best, pointSegmentDistance(point, coords[i - 1], coords[i]));
  }
  return best;
}

export function simplify(coords, toleranceM = 7) {
  if (!coords || coords.length < 3) return (coords || []).map((c) => c.slice());
  const keep = new Uint8Array(coords.length);
  keep[0] = 1;
  keep[coords.length - 1] = 1;
  const stack = [[0, coords.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop();
    let maxD = 0;
    let index = -1;
    for (let i = start + 1; i < end; i++) {
      const d = pointSegmentDistance(coords[i], coords[start], coords[end]);
      if (d > maxD) {
        maxD = d;
        index = i;
      }
    }
    if (index !== -1 && maxD > toleranceM) {
      keep[index] = 1;
      stack.push([start, index], [index, end]);
    }
  }
  const out = [];
  for (let i = 0; i < coords.length; i++) if (keep[i]) out.push(coords[i].slice());
  return out;
}

export function offsetPath(coords, meters) {
  if (!coords || !meters) return (coords || []).map((c) => c.slice());
  const out = [];
  for (let i = 0; i < coords.length; i++) {
    const a = coords[Math.max(0, i - 1)];
    const b = coords[Math.min(coords.length - 1, i + 1)];
    const lat = (coords[i][1] * Math.PI) / 180;
    const mLng = 111320 * Math.cos(lat);
    const mLat = 111320;
    const dx = (b[0] - a[0]) * mLng;
    const dy = (b[1] - a[1]) * mLat;
    const len = Math.hypot(dx, dy) || 1;
    out.push([
      coords[i][0] + ((-dy / len) * meters) / mLng,
      coords[i][1] + ((dx / len) * meters) / mLat,
    ]);
  }
  return out;
}

export function pointAlong(from, toward, meters) {
  const dist = haversine(from, toward);
  if (dist < 1) return from.slice();
  const t = Math.min(1, meters / dist);
  return [from[0] + (toward[0] - from[0]) * t, from[1] + (toward[1] - from[1]) * t];
}

function inRing(point, ring) {
  const x = point[0];
  const y = point[1];
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function inPolygon(point, rings) {
  if (!rings?.length || !inRing(point, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) if (inRing(point, rings[i])) return false;
  return true;
}

export function pointInZones(point, zones) {
  if (!zones) return false;
  const features =
    zones.type === "FeatureCollection"
      ? zones.features
      : zones.type === "Feature"
        ? [zones]
        : [{ geometry: zones }];
  for (const feature of features) {
    const geometry = feature.geometry;
    if (!geometry) continue;
    if (geometry.type === "Polygon" && inPolygon(point, geometry.coordinates)) return true;
    if (geometry.type === "MultiPolygon" && geometry.coordinates.some((rings) => inPolygon(point, rings))) {
      return true;
    }
  }
  return false;
}

/**
 * Indexes into `dense` of the first point after the track first leaves
 * `radiusM` around its start, and the last point before it finally enters
 * `radiusM` around its end. Everything outside [head, tail] is hidden.
 */
export function privacyWindow(dense, radiusM) {
  const start = dense[0];
  const end = dense[dense.length - 1];
  let head = 0;
  while (head < dense.length && haversine(dense[head], start) < radiusM) head++;
  let tail = dense.length - 1;
  while (tail >= 0 && haversine(dense[tail], end) < radiusM) tail--;
  return { head, tail };
}

/**
 * Hide the start and end of a route.
 * The track is trimmed from its first point until it first leaves a circle of
 * `radiusM` (default 400, the middle of the 300–500m band) around the start,
 * and from its last point back until it last leaves the same circle around
 * the end. Only those two stretches are removed: a lap or out-and-back that
 * passes near the start later stays on the map, so a park loop run 21 times
 * is drawn in full. Optional polygons (`zones`) hide every pass, anywhere in
 * the activity. Short leftovers are dropped.
 * Returns an array of polylines, or null when nothing safe is left.
 */
export function applyPrivacy(coords, { radiusM = 400, zones = null, minPartM = 80, minTotalM = 150 } = {}) {
  if (!coords || coords.length < 2) return null;
  const dense = densify(coords, 12);
  const { head, tail } = privacyWindow(dense, radiusM);
  if (head > tail) return null;
  const parts = [];
  let current = [];
  const flush = () => {
    if (current.length >= 2 && pathLength(current) >= minPartM) parts.push(simplify(current, 7));
    current = [];
  };
  for (let i = head; i <= tail; i++) {
    const point = dense[i];
    if (pointInZones(point, zones)) flush();
    else current.push(point);
  }
  flush();
  const total = parts.reduce((sum, line) => sum + pathLength(line), 0);
  if (!parts.length || total < minTotalM) return null;
  return parts;
}

export function sampleHeat(parts, stepM = 55, cap = 500) {
  const lines = parts.filter((line) => line.length >= 2);
  const total = lines.reduce((sum, line) => sum + pathLength(line), 0);
  const step = Math.max(stepM, total / cap);
  const points = [];
  for (const line of lines) {
    points.push(line[0].slice());
    let carry = 0;
    for (let i = 1; i < line.length; i++) {
      let left = haversine(line[i - 1], line[i]);
      let prev = line[i - 1];
      while (carry + left >= step) {
        const need = step - carry;
        const t = need / left;
        const next = [prev[0] + (line[i][0] - prev[0]) * t, prev[1] + (line[i][1] - prev[1]) * t];
        points.push(next);
        prev = next;
        left -= need;
        carry = 0;
      }
      carry += left;
    }
  }
  return points;
}

export function lineMidpoint(coords) {
  const total = pathLength(coords);
  if (!coords?.length) return null;
  if (total < 1) return coords[0].slice();
  let walked = 0;
  const half = total / 2;
  for (let i = 1; i < coords.length; i++) {
    const dist = haversine(coords[i - 1], coords[i]);
    if (walked + dist >= half) {
      const t = (half - walked) / dist;
      return [
        coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * t,
        coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * t,
      ];
    }
    walked += dist;
  }
  return coords[coords.length - 1].slice();
}

export function roundCoord(coord) {
  return [Math.round(coord[0] * 1e6) / 1e6, Math.round(coord[1] * 1e6) / 1e6];
}

/** Google encoded polyline (1e5), as Strava `map.summary_polyline`. */
export function decodePolyline(str) {
  if (!str) return [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const coords = [];
  while (index < str.length) {
    let result = 0;
    let shift = 0;
    let byte = 0;
    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index <= str.length);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    result = 0;
    shift = 0;
    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index <= str.length);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    coords.push([lng / 1e5, lat / 1e5]);
  }
  return coords;
}
