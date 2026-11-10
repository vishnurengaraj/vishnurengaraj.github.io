import assert from "node:assert/strict";
import test from "node:test";
import { approachTiles, expandTileURL, tileXY } from "../../src/runs/warm.js";

test("the destination tile is the LA cell, and the list stays bounded", () => {
  const cell = tileXY(-118.4016, 33.8622, 12);
  assert.equal(cell.z, 12);
  assert.ok(cell.x > 0 && cell.y > 0);
  const tiles = approachTiles({
    from: [-100, 36],
    to: [-118.4016, 33.8622, 12.35],
    width: 1440,
    height: 900,
    maxZoom: 14,
  });
  assert.ok(tiles.length > 8);
  assert.ok(tiles.length <= 72);
  assert.ok(tiles.some((tile) => tile.z === 12 && tile.x === cell.x && tile.y === cell.y));
  assert.ok(tiles.some((tile) => tile.z < 12));
  const url = expandTileURL("https://tiles.example/{z}/{x}/{y}.pbf", cell);
  assert.equal(url, `https://tiles.example/${cell.z}/${cell.x}/${cell.y}.pbf`);
});
