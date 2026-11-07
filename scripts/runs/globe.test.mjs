import assert from "node:assert/strict";
import test from "node:test";
import { REGION_ZOOM, WORLD_ZOOM, cityDistance, nearestCity, pitchForZoom } from "../../src/runs/globe.js";

const cities = [
  { id: "la", center: [-118.4, 33.86] },
  { id: "humboldt", center: [-124, 40.32] },
  { id: "tokyo", center: [139.76, 35.7] },
];

test("the nearest region follows the camera", () => {
  assert.equal(nearestCity(cities, [-118.5, 33.9]).id, "la");
  assert.equal(nearestCity(cities, [-123.8, 40.2]).id, "humboldt");
  assert.equal(nearestCity(cities, [139.8, 35.6]).id, "tokyo");
  assert.equal(nearestCity([], [-118, 34]), null);
  assert.ok(cityDistance([-118.4, 33.86], [-124, 40.32]) > 500000);
});

test("pitch drops only as the view opens toward the world", () => {
  assert.equal(pitchForZoom(12, 64), 64);
  assert.equal(pitchForZoom(3, 64), 0);
  assert.ok(pitchForZoom(5.5, 64) > 0);
  assert.ok(pitchForZoom(5.5, 64) < 64);
  assert.ok(WORLD_ZOOM < REGION_ZOOM);
});
