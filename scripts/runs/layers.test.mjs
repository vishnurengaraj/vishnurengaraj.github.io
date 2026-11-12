import assert from "node:assert/strict";
import test from "node:test";
import { layerMode, stampLines } from "../../src/runs/layers.js";

function line(props) {
  return { type: "Feature", properties: props, geometry: { type: "LineString", coordinates: [] } };
}

test("unknown layer names fall back to density", () => {
  assert.equal(layerMode("pace"), "pace");
  assert.equal(layerMode("nope"), "density");
  assert.equal(layerMode(""), "density");
});

test("recency, distance, and elevation climb with the value", () => {
  const features = [
    line({ id: "old", date: "2020-01-01", distanceM: 1000, movingS: 400, elevM: 10 }),
    line({ id: "new", date: "2026-01-01", distanceM: 5000, movingS: 1000, elevM: 80 }),
  ];
  const recency = stampLines(features, "recency");
  assert.ok(recency.find((f) => f.properties.id === "new").properties.t > recency.find((f) => f.properties.id === "old").properties.t);
  const distance = stampLines(features, "distance");
  assert.ok(distance.find((f) => f.properties.id === "new").properties.t > distance.find((f) => f.properties.id === "old").properties.t);
  const elev = stampLines(features, "elevation");
  assert.ok(elev.find((f) => f.properties.id === "new").properties.t > elev.find((f) => f.properties.id === "old").properties.t);
});

test("pace scores a faster route higher", () => {
  const features = [
    line({ id: "fast", distanceM: 5000, movingS: 1000 }),
    line({ id: "slow", distanceM: 5000, movingS: 2500 }),
  ];
  const paced = stampLines(features, "pace");
  assert.ok(paced.find((f) => f.properties.id === "fast").properties.t > paced.find((f) => f.properties.id === "slow").properties.t);
});
