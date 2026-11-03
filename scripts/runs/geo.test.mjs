import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { assignCity } from "./cities.mjs";
import { applyPrivacy, decodePolyline, haversine, moveMeters, pathLength } from "./geo.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function northLine(meters, step = 20) {
  const start = [-118.4, 33.86];
  const coords = [start];
  for (let walked = step; walked <= meters; walked += step) coords.push(moveMeters(start, 0, walked));
  return coords;
}

test("privacy radius removes both ends of a long run", () => {
  const coords = northLine(2000);
  const parts = applyPrivacy(coords, { radiusM: 400 });
  assert.ok(parts);
  assert.equal(parts.length, 1);
  const line = parts[0];
  const start = coords[0];
  const end = coords[coords.length - 1];
  assert.ok(haversine(line[0], start) >= 399, `start cut ${haversine(line[0], start)}`);
  assert.ok(haversine(line[line.length - 1], end) >= 399, `end cut ${haversine(line[line.length - 1], end)}`);
  for (const point of line) {
    assert.ok(haversine(point, start) >= 399);
    assert.ok(haversine(point, end) >= 399);
  }
  assert.ok(pathLength(line) > 1000);
  assert.ok(pathLength(line) < 1300);
});

test("a run that stays inside the privacy radius is dropped", () => {
  const start = [-118.4, 33.86];
  const coords = [start, moveMeters(start, 80, 40), moveMeters(start, 0, 300)];
  assert.equal(applyPrivacy(coords, { radiusM: 400 }), null);
});

test("optional zones hide a middle pass as well as the ends", () => {
  const coords = northLine(2000);
  const mid = coords[Math.floor(coords.length / 2)];
  const zones = {
    type: "Polygon",
    coordinates: [[
      moveMeters(mid, -80, -80),
      moveMeters(mid, 80, -80),
      moveMeters(mid, 80, 80),
      moveMeters(mid, -80, 80),
      moveMeters(mid, -80, -80),
    ]],
  };
  const parts = applyPrivacy(coords, { radiusM: 400, zones });
  assert.ok(parts);
  assert.ok(parts.length >= 2);
  for (const line of parts) {
    for (const point of line) assert.ok(haversine(point, mid) > 60);
  }
});

test("city assignment keeps South Bay on LA and does not smear a distant run", () => {
  assert.equal(assignCity(-118.4016, 33.8622).id, "la");
  assert.equal(assignCity(-122.47, 37.804).id, "sf");
  assert.equal(assignCity(-73.966, 40.782).id, "nyc");
  const away = assignCity(-105.5, 39.0);
  assert.notEqual(away.id, "la");
  assert.equal(away.generated, true);
});

test("shipped sample is one heatmap per city", () => {
  const manifest = JSON.parse(readFileSync(path.join(ROOT, "src/data/runs/manifest.json"), "utf8"));
  assert.equal(manifest.sample, true);
  assert.equal(manifest.defaultCity, "la");
  assert.equal(manifest.privacy.meters, 400);
  assert.ok(manifest.probes.overlap.count >= 3);
  const labels = manifest.cities.map((city) => city.label);
  assert.deepEqual(labels.slice(0, 3), ["LA", "SF", "NYC"]);
  for (const city of manifest.cities) {
    const lines = JSON.parse(
      readFileSync(path.join(ROOT, "public/media/runs/cities", `${city.id}.lines.geojson`), "utf8"),
    );
    assert.equal(lines.features.length, city.count);
    assert.equal(new Set(lines.features.map((feature) => feature.properties.id)).size, city.count);
  }
});

test("polyline decoder round-trips a short path", () => {
  const coords = decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
  assert.ok(coords.length >= 2);
  assert.ok(Math.abs(coords[0][1] - 38.5) < 0.01);
  assert.ok(Math.abs(coords[0][0] + 120.2) < 0.01);
});
