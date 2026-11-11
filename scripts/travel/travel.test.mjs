import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { costRows, formatUsd, totalFor, tripBySlug } from "../../src/travel/trips.js";
import { buildTrips, splitDestination } from "./build-travel.mjs";
import { dollars, parseCsv } from "./csv.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const shipped = JSON.parse(readFileSync(path.join(ROOT, "src/data/travel/trips.json"), "utf8"));
const sheetText = ["ranking.csv", "cost-breakdown.csv", "itineraries.csv", "sources.csv"]
  .map((name) => readFileSync(path.join(ROOT, "src/data/travel/sheet", name), "utf8"))
  .join("\n");

test("csv parser keeps quoted commas, quotes, and blank rows", () => {
  assert.deepEqual(parseCsv('a,"b, c","say ""hi"""\n\nx,y,z'), [["a", "b, c", 'say "hi"'], [""], ["x", "y", "z"]]);
  assert.equal(dollars("$1,256"), 1256);
  assert.equal(dollars("$0"), 0);
  assert.throws(() => dollars("about $60"));
});

test("trips.json is exactly what the Sheet snapshot builds", () => {
  assert.deepEqual(shipped, JSON.parse(JSON.stringify(buildTrips())));
});

test("every total equals the sum of its Cost breakdown parts", () => {
  for (const trip of shipped.trips) {
    const b = trip.breakdown;
    for (const id of ["jan5", "jan2"]) {
      const low = b.flights[id] + b.lodging.low + b.transport.low + b.food.low + b.activities.low;
      const high = b.flights[id] + b.buffer + b.lodging.high + b.transport.high + b.food.high + b.activities.high;
      assert.equal(low, b.totals[id].low, `${trip.slug} ${id} low`);
      assert.equal(high, b.totals[id].high, `${trip.slug} ${id} high`);
      assert.deepEqual(trip.totals[id], b.totals[id], `${trip.slug} ${id}: Ranking tab matches Cost breakdown`);
    }
  }
});

test("every dollar figure on a trip appears in the Sheet", () => {
  for (const trip of shipped.trips) {
    for (const row of costRows(trip, "jan5").concat(costRows(trip, "jan2"))) {
      for (const value of [row.low, row.high]) {
        if (value == null) continue;
        assert.ok(sheetText.includes(formatUsd(value)), `${trip.slug} ${row.key} ${formatUsd(value)}`);
      }
    }
  }
});

test("ranking order, slugs, and the advisories that must show", () => {
  assert.deepEqual(
    shipped.trips.map((trip) => trip.rank),
    ["1", "2", "3", "4", "5", "6", "7", "8", "HM"],
  );
  assert.equal(new Set(shipped.trips.map((trip) => trip.slug)).size, shipped.trips.length);
  const pv = tripBySlug(shipped.trips, "puerto-vallarta");
  assert.equal(pv.advisoryLevel, 3);
  assert.match(pv.downsides, /Level 3 'Reconsider travel'/);
  assert.equal(tripBySlug(shipped.trips, "nope"), null);
  assert.deepEqual(
    shipped.trips.filter((trip) => trip.itinerary).map((trip) => trip.slug),
    ["big-island", "oaxaca", "la-paz"],
  );
  for (const trip of shipped.trips.filter((t) => t.itinerary)) assert.equal(trip.itinerary.days.length, 8);
});

test("Bookings' rounded summary matches the Sheet", () => {
  const k = (n) => `${(n / 1000).toFixed(1)}k`;
  const summary = {
    "big-island": ["3.8k", "6.1k", "4.1k", "6.5k"],
    oaxaca: ["2.4k", "3.9k", "3.2k", "4.8k"],
    "la-paz": ["2.9k", "4.8k", "3.0k", "5.0k"],
    "mexico-city": ["2.3k", "4.0k"],
    maui: ["4.2k", "6.5k"],
    "joshua-tree": ["2.2k", "3.3k"],
    "puerto-vallarta": ["3.0k", "5.1k"],
    tucson: ["1.7k", "2.7k"],
  };
  for (const [slug, want] of Object.entries(summary)) {
    const trip = tripBySlug(shipped.trips, slug);
    const got = [k(totalFor(trip, "jan5").low), k(totalFor(trip, "jan5").high), k(totalFor(trip, "jan2").low), k(totalFor(trip, "jan2").high)];
    assert.deepEqual(got.slice(0, want.length), want, slug);
  }
});

test("destination names split into name, stay plan, and tag", () => {
  assert.deepEqual(splitDestination("Maui, Hawaii (Kihei base): the Hawaii alternative"), {
    name: "Maui, Hawaii",
    plan: "Kihei base",
    tag: "the Hawaii alternative",
  });
  assert.deepEqual(splitDestination("Mexico City"), { name: "Mexico City", plan: "", tag: "" });
});

test("source links are plain citations, never a checkout", () => {
  for (const trip of shipped.trips) {
    for (const src of trip.sources) {
      for (const url of src.links) {
        assert.match(url, /^https:\/\//);
        assert.doesNotMatch(url, /checkout|book(ing)?[/?]|cart|reserve/i, url);
      }
    }
  }
});
