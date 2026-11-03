import assert from "node:assert/strict";
import test from "node:test";
import { VEIN_PICK_ZOOM, closerZoom, resolvePick } from "../../src/runs/pick.js";

test("a click with no route does nothing", () => {
  assert.deepEqual(resolvePick([], 12), { action: "none", ids: [] });
  assert.deepEqual(resolvePick([""], 15), { action: "none", ids: [] });
  assert.deepEqual(resolvePick(null, 15), { action: "none", ids: [] });
});

test("one hit-tested route opens at any zoom", () => {
  assert.deepEqual(resolvePick(["20547259461"], 10.8), { action: "open", ids: ["20547259461"] });
  assert.deepEqual(resolvePick(["20547259461", "20547259461"], 15), {
    action: "open",
    ids: ["20547259461"],
  });
});

test("overlapping routes at city zoom zoom in instead of picking one", () => {
  const decision = resolvePick(["a", "b", "c"], 12.35);
  assert.equal(decision.action, "zoom");
  assert.deepEqual(decision.ids, ["a", "b", "c"]);
  assert.ok(closerZoom(12.35) >= VEIN_PICK_ZOOM);
  assert.ok(closerZoom(12.35) > 12.35);
});

test("overlapping routes once veins are readable offer a chooser", () => {
  assert.equal(resolvePick(["a", "b"], VEIN_PICK_ZOOM).action, "choose");
  assert.equal(resolvePick(["a", "b", "c", "d"], 15).action, "choose");
  assert.ok(closerZoom(15) <= 15.4);
});
