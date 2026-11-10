import assert from "node:assert/strict";
import test from "node:test";
import { arrivalFrame, lateLean } from "../../src/runs/arrive.js";

const from = { lng: -100, lat: 36, zoom: 1.55, pitch: 0, bearing: 0 };
const to = { lng: -118.4, lat: 33.86, zoom: 12.35, pitch: 64, bearing: -20 };

test("the flight starts flat and ends on the city camera", () => {
  const start = arrivalFrame(0, 4800, from, to);
  assert.equal(start.pitch, 0);
  assert.equal(start.bearing, 0);
  assert.equal(start.zoom, from.zoom);
  const end = arrivalFrame(4800, 4800, from, to);
  assert.equal(end.zoom, to.zoom);
  assert.equal(end.pitch, to.pitch);
  assert.equal(end.bearing, to.bearing);
  assert.equal(end.lng, to.lng);
});

test("tilt stays out of the early zoom and is already moving before the zoom finishes", () => {
  assert.equal(lateLean(0.2), 0);
  assert.equal(lateLean(0.38), 0);
  assert.ok(lateLean(0.6) > 0.1);
  assert.ok(lateLean(0.6) < 0.7);
  assert.equal(lateLean(0.9), 1);
  const early = arrivalFrame(700, 4800, from, to);
  assert.ok(early.zoom > from.zoom);
  assert.equal(early.pitch, 0);
  const mid = arrivalFrame(2600, 4800, from, to);
  assert.ok(mid.zoom > 6 && mid.zoom < to.zoom);
  assert.ok(mid.pitch > 8);
  assert.ok(mid.pitch < to.pitch);
  const step = lateLean(0.38 + 0.01) - lateLean(0.38);
  assert.ok(step < 0.02);
});
