import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { assignCity } from "./cities.mjs";
import { applyPrivacy, decodePolyline, distanceToMeters, haversine, moveMeters, pathLength } from "./geo.mjs";
import { coordsFromTrackBytes, fitIsRun, isRunType, RUN_TYPES } from "./parse.mjs";

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

test("city assignment keeps South Bay on LA and names away regions", () => {
  assert.equal(assignCity(-118.4016, 33.8622).id, "la");
  assert.equal(assignCity(-122.47, 37.804).id, "sf");
  assert.equal(assignCity(-73.966, 40.782).id, "nyc");
  assert.equal(assignCity(139.77, 35.72).id, "tokyo");
  assert.equal(assignCity(139.75, 35.68).id, "tokyo");
  assert.equal(assignCity(-83.73, 42.29).id, "michigan");
  assert.equal(assignCity(-83.15, 42.69).id, "michigan");
  assert.equal(assignCity(-97.14, 31.56).id, "waco");
  assert.equal(assignCity(-97.45, 31.4).id, "waco");
  assert.equal(assignCity(-119.0, 37.66).id, "sierra");
  assert.equal(assignCity(-118.51, 37.35).id, "sierra");
  assert.equal(assignCity(-3.72, 40.43).label, "Madrid");
  const away = assignCity(-105.5, 39.0);
  assert.notEqual(away.id, "la");
  assert.equal(away.generated, true);
});

test("walk, hike, and trail run are kept", () => {
  for (const type of RUN_TYPES) assert.equal(isRunType(type), true, type);
  assert.equal(isRunType("Ride"), false);
  assert.equal(isRunType("Virtual Run"), false);
  assert.equal(fitIsRun("running"), true);
  assert.equal(fitIsRun("trail_running"), true);
  assert.equal(fitIsRun("walking"), true);
  assert.equal(fitIsRun("hiking"), true);
  assert.equal(fitIsRun("cycling"), false);
  assert.equal(fitIsRun({ sports: [{ sport: "hiking" }] }), true);
});

test("kilometer distances from a Strava drop become meters", () => {
  assert.ok(Math.abs(distanceToMeters(11.82, 3861) - 11820) < 1);
  assert.ok(Math.abs(distanceToMeters(42.195, 16000) - 42195) < 1);
  assert.equal(distanceToMeters(11820, 3861), 11820);
  assert.equal(distanceToMeters(150, 90), 150);
  assert.equal(distanceToMeters(150, 600), 150);
  assert.equal(distanceToMeters(1.25, 398), 1250);
});

test("gzipped gpx inflates before parsing", async () => {
  const xml = `<?xml version="1.0"?><gpx><trk><trkseg>
    <trkpt lat="33.86" lon="-118.40"></trkpt>
    <trkpt lat="33.87" lon="-118.41"></trkpt>
  </trkseg></trk></gpx>`;
  const coords = await coordsFromTrackBytes("activity.gpx.gz", gzipSync(Buffer.from(xml)));
  assert.equal(coords.length, 2);
  assert.ok(Math.abs(coords[0][0] + 118.4) < 0.001);
});

test("shipped routes are one heatmap per named city", () => {
  const manifest = JSON.parse(readFileSync(path.join(ROOT, "src/data/runs/manifest.json"), "utf8"));
  assert.equal(manifest.sample, false);
  assert.equal(manifest.defaultCity, "la");
  assert.equal(manifest.privacy.meters, 400);
  assert.ok(manifest.runs.length > 400);
  const types = new Set(manifest.runs.map((run) => run.type));
  for (const type of ["Run", "Trail Run", "Walk", "Hike"]) assert.ok(types.has(type), type);
  for (const city of manifest.cities) {
    assert.equal(city.label === "Away" || city.id.startsWith("away-"), false);
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
