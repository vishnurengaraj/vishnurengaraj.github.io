/** Slippy-map tiles along the approach into a city. The map loads them by
    visiting that camera; this is the footprint of the visit. */

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function tileXY(lng, lat, zoom) {
  const z = clamp(Math.floor(zoom), 0, 22);
  const n = 2 ** z;
  const x = clamp(Math.floor(((lng + 180) / 360) * n), 0, n - 1);
  const rad = clamp(lat, -85.05112878, 85.05112878) * (Math.PI / 180);
  const y = clamp(
    Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n),
    0,
    n - 1,
  );
  return { z, x, y };
}

function viewTiles(center, zoom, width, height) {
  const { z, x, y } = tileXY(center[0], center[1], zoom);
  const n = 2 ** z;
  const cols = Math.max(1, Math.ceil(width / 512));
  const rows = Math.max(1, Math.ceil(height / 512));
  const tiles = [];
  for (let dx = -Math.floor(cols / 2) - 1; dx <= Math.ceil(cols / 2); dx++) {
    for (let dy = -Math.floor(rows / 2) - 1; dy <= Math.ceil(rows / 2); dy++) {
      const tileY = y + dy;
      if (tileY < 0 || tileY >= n) continue;
      const tileX = (((x + dx) % n) + n) % n;
      tiles.push({ z, x: tileX, y: tileY });
    }
  }
  return tiles;
}

/** Tiles along the flight, denser near the destination. Capped so a slow
    network cannot queue an unbounded download. */
export function approachTiles({ from, to, width, height, maxZoom = 14, limit = 72 }) {
  const destZoom = clamp(Math.round(to[2] ?? maxZoom), 0, maxZoom);
  const startZoom = Math.max(5, destZoom - 6);
  const seen = new Set();
  const tiles = [];
  for (let z = destZoom; z >= startZoom; z--) {
    const along = (z - startZoom) / Math.max(1, destZoom - startZoom);
    const center =
      z >= destZoom - 1
        ? [to[0], to[1]]
        : [from[0] + (to[0] - from[0]) * (0.4 + 0.6 * along), from[1] + (to[1] - from[1]) * (0.4 + 0.6 * along)];
    for (const tile of viewTiles(center, z, width, height)) {
      const key = `${tile.z}/${tile.x}/${tile.y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      tiles.push(tile);
      if (tiles.length >= limit) return tiles;
    }
  }
  return tiles;
}

export function expandTileURL(template, tile) {
  return String(template)
    .replaceAll("{z}", String(tile.z))
    .replaceAll("{x}", String(tile.x))
    .replaceAll("{y}", String(tile.y));
}
