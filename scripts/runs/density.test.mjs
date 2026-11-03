import assert from "node:assert/strict";
import test from "node:test";
import { DENSITY_HOT, densityHeat, densityWeight } from "../../src/runs/density.js";

function line(coords) {
  return {
    type: "Feature",
    properties: { id: "a" },
    geometry: { type: "LineString", coordinates: coords },
  };
}

function collection(features) {
  return { type: "FeatureCollection", features };
}

const segment = [
  [-118.4, 33.86],
  [-118.4, 33.87],
];

function maxWeight(heat) {
  return Math.max(0, ...heat.features.map((feature) => feature.properties.w));
}

test("one pass stays cool and repeated passes climb to hot", () => {
  assert.ok(densityWeight(1) < 0.2);
  assert.ok(densityWeight(1) > 0);
  assert.ok(densityWeight(20) > densityWeight(4));
  assert.equal(densityWeight(DENSITY_HOT), 1);
  assert.equal(densityWeight(DENSITY_HOT * 4), 1);

  const once = densityHeat(collection([line(segment)]));
  const mid = densityHeat(collection(Array.from({ length: 16 }, () => line(segment))));
  const hot = densityHeat(collection(Array.from({ length: DENSITY_HOT }, () => line(segment))));
  assert.ok(once.features.length > 0);
  assert.ok(maxWeight(once) < 0.25);
  assert.ok(maxWeight(mid) > maxWeight(once));
  assert.ok(maxWeight(mid) < 1);
  assert.equal(maxWeight(hot), 1);
});

test("a second overlapping route weighs more than either route alone", () => {
  const north = line([
    [-122.48, 37.78],
    [-122.48, 37.79],
  ]);
  const only = densityHeat(collection([north]));
  const both = densityHeat(
    collection([
      north,
      line([
        [-122.48, 37.78],
        [-122.48, 37.79],
      ]),
    ]),
  );
  assert.ok(maxWeight(both) > maxWeight(only));
});

test("empty and broken geometry produce no heat", () => {
  assert.deepEqual(densityHeat(null), { type: "FeatureCollection", features: [] });
  assert.deepEqual(densityHeat(collection([{ type: "Feature", geometry: null }])).features, []);
});
