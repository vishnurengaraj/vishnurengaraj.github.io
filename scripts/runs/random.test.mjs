import assert from "node:assert/strict";
import test from "node:test";
import { pickRandomRun } from "../../src/runs/random.js";

const runs = [
  { id: "a", city: "la" },
  { id: "b", city: "sf" },
  { id: "c", city: "tokyo" },
];

test("a random run can come from any region and skips the open one", () => {
  assert.equal(pickRandomRun([], "a", () => 0), null);
  assert.equal(pickRandomRun(runs, "a", () => 0).id, "b");
  assert.equal(pickRandomRun(runs, "a", () => 0.99).id, "c");
  assert.equal(pickRandomRun(runs, null, () => 0).id, "a");
  assert.equal(pickRandomRun([{ id: "only", city: "la" }], "only", () => 0.4).id, "only");
});
