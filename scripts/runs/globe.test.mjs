import assert from "node:assert/strict";
import test from "node:test";
import { GLOBE_ENTER_ZOOM, GLOBE_EXIT_ZOOM, GLOBE_VIEW_ZOOM, globeHandoff } from "../../src/runs/globe.js";

test("zooming out of the flat map enters the globe", () => {
  assert.equal(globeHandoff(false, GLOBE_ENTER_ZOOM), "enter");
  assert.equal(globeHandoff(false, 1), "enter");
  assert.equal(globeHandoff(false, GLOBE_ENTER_ZOOM + 0.4), "none");
  assert.equal(globeHandoff(false, 12.35), "none");
});

test("the resting globe does not bounce back to the flat map", () => {
  assert.ok(GLOBE_VIEW_ZOOM < GLOBE_EXIT_ZOOM);
  assert.ok(GLOBE_EXIT_ZOOM < GLOBE_ENTER_ZOOM);
  assert.equal(globeHandoff(true, GLOBE_VIEW_ZOOM), "none");
  assert.equal(globeHandoff(true, GLOBE_EXIT_ZOOM - 0.05), "none");
});

test("zooming in from the globe leaves it", () => {
  assert.equal(globeHandoff(true, GLOBE_EXIT_ZOOM), "leave");
  assert.equal(globeHandoff(true, GLOBE_VIEW_ZOOM + 1), "leave");
  assert.equal(globeHandoff(false, Number.NaN), "none");
});
