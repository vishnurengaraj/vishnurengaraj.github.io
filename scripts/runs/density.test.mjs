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

test("kernels along a curving route sit close enough to blend", () => {
  const coords = [];
  for (let i = 0; i <= 80; i++) {
    const t = i / 80;
    coords.push([-118.5 + t * 0.03, 33.95 + 0.006 * Math.sin(t * Math.PI * 3)]);
  }
  const heat = densityHeat(collection([line(coords)]));
  const points = heat.features.map((feature) => feature.geometry.coordinates);
  assert.ok(points.length > 20);
  const meters = (a, b) => {
    const mLng = 111320 * Math.cos((a[1] * Math.PI) / 180);
    return Math.hypot((a[0] - b[0]) * mLng, (a[1] - b[1]) * 111320);
  };
  const gaps = points.map((point) => {
    let best = Infinity;
    for (const other of points) {
      if (other === point) continue;
      best = Math.min(best, meters(point, other));
    }
    return best;
  });
  gaps.sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)];
  assert.ok(median < 75, `median kernel gap ${median}`);
  assert.ok(median > 20, `median kernel gap ${median}`);
});
