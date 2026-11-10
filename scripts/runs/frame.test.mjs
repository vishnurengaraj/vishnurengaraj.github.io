import assert from "node:assert/strict";
import test from "node:test";
import {
  ROUTE_MAX_ZOOM,
  boundsFromGeometry,
  occlusionPadding,
  routeCamera,
} from "../../src/runs/frame.js";

const sonoma = { west: -123.090368, south: 38.682279, east: -123.001413, north: 38.716828 };

test("route bounds follow every vertex and reject a dateline span", () => {
  const bounds = boundsFromGeometry({
    type: "LineString",
    coordinates: [
      [-123.01, 38.7],
      [-123.09, 38.68],
      [-123.04, 38.716],
    ],
  });
  assert.equal(bounds.west, -123.09);
  assert.equal(bounds.east, -123.01);
  assert.equal(bounds.south, 38.68);
  assert.equal(bounds.north, 38.716);
  assert.equal(
    boundsFromGeometry({
      type: "LineString",
      coordinates: [
        [179, 0],
        [-179, 0],
      ],
    }),
    null,
  );
  assert.equal(boundsFromGeometry(null), null);
});

test("a marathon fits the visible band and a tiny route stops at the zoom cap", () => {
  const phone = { width: 390, height: 844 };
  const pad = { top: 110, right: 18, bottom: 560, left: 18 };
  const framed = routeCamera(sonoma, phone, pad);
  assert.ok(framed.zoom < 14, `zoom ${framed.zoom}`);
  assert.ok(framed.zoom > 10, `zoom ${framed.zoom}`);
  assert.ok(framed.center[1] > sonoma.south && framed.center[1] < sonoma.north);

  const tiny = routeCamera(
    { west: -113.05, south: 37.2, east: -113.0493, north: 37.2006 },
    phone,
    pad,
  );
  assert.equal(tiny.zoom, ROUTE_MAX_ZOOM);
});

test("drawer padding is the occluded edge, with air, and still leaves a window", () => {
  const phone = occlusionPadding({ width: 390, height: 844, top: 92, bottom: 520, left: 0, right: 0 });
  assert.ok(phone.bottom > 520);
  assert.ok(phone.top > 92);
  assert.ok(390 - phone.left - phone.right > 80);
  assert.ok(844 - phone.top - phone.bottom > 80);

  const desktop = occlusionPadding({ width: 1440, height: 900, top: 92, right: 412, bottom: 48, left: 0 });
  assert.ok(desktop.right > 412);
  assert.ok(desktop.bottom > 48);
  assert.equal(desktop.left > 0, true);
});
