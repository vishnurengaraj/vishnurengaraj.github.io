import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { costRows, formatUsd, hasTotals, totalFor, tripBySlug } from "../../src/travel/trips.js";
import { HIGH_BUFFER, buildTrips, sanitizePublic, splitDestination, weightLegend, weightedScore } from "./build-travel.mjs";
import { sortTrips } from "../../src/travel/trips.js";
import { dollars, parseCsv } from "./csv.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const shipped = JSON.parse(readFileSync(path.join(ROOT, "src/data/travel/trips.json"), "utf8"));
const sheetText = ["worldwide.csv", "asia-europe.csv", "south-america.csv", "sources.csv", "scores.csv", "safety.csv"]
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

test("every total equals the sum of its Worldwide parts, and Jan 2–9 is unpriced", () => {
  for (const trip of shipped.trips) {
    assert.equal(hasTotals(trip, "jan2"), false);
    assert.equal(trip.totals.jan2, null);
    assert.ok(hasTotals(trip, "jan5"));
    const b = trip.breakdown;
    assert.equal(b.flights.lax + b.flights.dtw, b.flights.jan5, `${trip.slug} flight parts`);
    const low = b.flights.jan5 + b.lodging.low + b.transport.low + b.food.low + b.activities.low;
    const high = b.flights.jan5 + HIGH_BUFFER + b.lodging.high + b.transport.high + b.food.high + b.activities.high;
    assert.equal(low, b.totals.jan5.low, `${trip.slug} jan5 low`);
    assert.equal(high, b.totals.jan5.high, `${trip.slug} jan5 high`);
    assert.deepEqual(trip.totals.jan5, b.totals.jan5);
  }
});

test("every dollar figure on a trip appears in the Sheet", () => {
  for (const trip of shipped.trips) {
    for (const row of costRows(trip, "jan5")) {
      for (const value of [row.low, row.high]) {
        if (value == null) continue;
        assert.ok(sheetText.includes(formatUsd(value)), `${trip.slug} ${row.key} ${formatUsd(value)}`);
      }
    }
  }
});

test("ranking order, slugs, drive trips, and the Level 3 advisory", () => {
  assert.deepEqual(
    shipped.trips.map((trip) => trip.slug),
    [
      "mexico-city",
      "tucson",
      "oaxaca",
      "naples",
      "andalusia",
      "joshua-tree",
      "taiwan",
      "lisbon",
      "hong-kong",
      "puerto-rico",
      "big-island",
      "madeira",
      "tenerife",
      "maui",
      "la-paz",
      "puerto-vallarta",
      "guanacaste",
    ],
  );
  assert.deepEqual(
    shipped.trips.map((trip) => trip.rank),
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17"],
  );
  assert.equal(new Set(shipped.trips.map((trip) => trip.slug)).size, shipped.trips.length);
  const pv = tripBySlug(shipped.trips, "puerto-vallarta");
  assert.equal(pv.advisoryLevel, 3);
  assert.match(pv.advisory, /Level 3/);
  assert.equal(tripBySlug(shipped.trips, "nope"), null);
  assert.equal(tripBySlug(shipped.trips, "joshua-tree").drive, true);
  assert.equal(tripBySlug(shipped.trips, "tucson").drive, true);
  assert.equal(tripBySlug(shipped.trips, "mexico-city").drive, false);
  for (const trip of shipped.trips) {
    assert.ok(trip.week.trim(), trip.slug);
    assert.ok(trip.laxFlight.length > 0, trip.slug);
    assert.ok(trip.dtwFlight.length > 0, trip.slug);
  }
  assert.match(tripBySlug(shipped.trips, "mexico-city").week, /La Malinche summit \(7\.9 mi, 4,320 ft, 14,600 ft/);
  assert.match(tripBySlug(shipped.trips, "mexico-city").week, /Ajusco dropped/);
  assert.doesNotMatch(tripBySlug(shipped.trips, "mexico-city").week, /Pico del Aguila\/Ajusco/);
  assert.match(tripBySlug(shipped.trips, "naples").week, /guided out-and-back/);
  assert.match(tripBySlug(shipped.trips, "andalusia").week, /closed Mondays and Jan 11-19/);
  assert.match(tripBySlug(shipped.trips, "madeira").week, /EUR 10\.50/);
});

test("Bookings' Jan 5–12 totals and fares match the Sheet", () => {
  const want = {
    "mexico-city": { low: 2638, high: 4402, lax: 487, dtw: 583 },
    oaxaca: { low: 2580, high: 4150, lax: 551, dtw: 768 },
    "big-island": { low: 3840, high: 6183, lax: 447, dtw: 500 },
    madeira: { low: 3887, high: 5524, lax: 907, dtw: 1208 },
    lisbon: { low: 3161, high: 4854, lax: 789, dtw: 859 },
    andalusia: { low: 3431, high: 5129, lax: 835, dtw: 791 },
    "hong-kong": { low: 4278, high: 6014, lax: 977, dtw: 1923 },
    naples: { low: 3582, high: 5506, lax: 872, dtw: 838 },
    tenerife: { low: 4001, high: 5828, lax: 1232, dtw: 941 },
    "puerto-rico": { low: 2824, high: 4682, lax: 384, dtw: 290 },
  };
  for (const [slug, nums] of Object.entries(want)) {
    const trip = tripBySlug(shipped.trips, slug);
    const tot = totalFor(trip, "jan5");
    assert.equal(tot.low, nums.low, `${slug} low`);
    assert.equal(tot.high, nums.high, `${slug} high`);
    assert.equal(trip.breakdown.flights.lax, nums.lax, `${slug} lax`);
    assert.equal(trip.breakdown.flights.dtw, nums.dtw, `${slug} dtw`);
  }
});

test("destination names split into name, stay plan, and tag", () => {
  assert.deepEqual(splitDestination("Mexico City (+ La Malinche, Ajusco, Tepoztlan)"), {
    name: "Mexico City",
    plan: "La Malinche, Ajusco, Tepoztlan",
    tag: "",
  });
  assert.deepEqual(splitDestination("Andalusia: Malaga, Granada, Seville"), {
    name: "Andalusia",
    plan: "Malaga, Granada, Seville",
    tag: "",
  });
  assert.deepEqual(splitDestination("Joshua Tree + Palm Springs (drive)"), {
    name: "Joshua Tree + Palm Springs",
    plan: "drive",
    tag: "",
  });
  assert.deepEqual(splitDestination("Hong Kong"), { name: "Hong Kong", plan: "", tag: "" });
});

test("source links are plain citations, never a checkout, and the card number stays off the page", () => {
  assert.equal(sanitizePublic("Use the Sapphire Preferred ...8838 for travel"), "Use the Sapphire Preferred for travel");
  assert.doesNotMatch(JSON.stringify(shipped), /\.{2,}\d{3,5}/);
  for (const trip of shipped.trips) {
    for (const src of trip.sources) {
      for (const url of src.links) {
        assert.match(url, /^https:\/\//);
        assert.doesNotMatch(url, /checkout|book(ing)?[/?]|cart|reserve/i, url);
      }
    }
  }
});

test("the page data keeps noindex helpers and the mild-weather criterion", () => {
  assert.equal(shipped.asOf, "Nov 11, 2026");
  assert.match(shipped.criterion, /mild, not freezing or soaked/);
  assert.match(shipped.paymentNote, /Chase Sapphire Preferred/);
  assert.match(shipped.paymentNote, /Credit Max and are unverified/);
  assert.equal(shipped.windows.find((w) => w.id === "jan2").priced, false);
  assert.equal(shipped.windows.find((w) => w.id === "jan5").priced, true);
  assert.equal(shipped.defaultWindow, "jan5");
});

test("computed weighted scores match the Scores tab and Bookings' totals", () => {
  const want = {
    "mexico-city": 8.2,
    tucson: 7.7,
    oaxaca: 7.65,
    naples: 7.0,
    andalusia: 6.98,
    "joshua-tree": 6.95,
    taiwan: 6.85,
    lisbon: 6.73,
    "hong-kong": 6.7,
    "puerto-rico": 6.28,
    "big-island": 6.23,
    madeira: 6.13,
    tenerife: 5.88,
    maui: 5.75,
    "la-paz": 5.68,
    "puerto-vallarta": 5.55,
    guanacaste: 4.68,
  };
  assert.equal(weightLegend(shipped.weights), shipped.weightLegend);
  assert.match(shipped.weightLegend, /Outdoors 25%/);
  for (const [slug, total] of Object.entries(want)) {
    const trip = tripBySlug(shipped.trips, slug);
    assert.equal(trip.scores.weighted, total, slug);
    assert.equal(weightedScore(trip.scores, shipped.weights), total, `${slug} recomputed`);
  }
  assert.deepEqual(
    shipped.trips.map((trip) => trip.scores.weighted),
    [...shipped.trips.map((trip) => trip.scores.weighted)].sort((a, b) => b - a),
  );
});

test("the default sort is weighted, and other sorts rearrange the list", () => {
  assert.deepEqual(sortTrips(shipped.trips, "weighted").map((t) => t.slug), shipped.trips.map((t) => t.slug));
  const byName = sortTrips(shipped.trips, "name").map((t) => t.name);
  assert.deepEqual(byName, [...byName].sort((a, b) => a.localeCompare(b)));
  const byFood = sortTrips(shipped.trips, "food");
  assert.ok(byFood[0].scores.food >= byFood[1].scores.food);
});

test("Safety tab notes land on the researched cards, and the rest are labeled", () => {
  const cdmx = tripBySlug(shipped.trips, "mexico-city");
  assert.equal(cdmx.safety.researched, true);
  assert.match(cdmx.safety.advisory, /Level 2/);
  assert.match(cdmx.safety.consensus, /Uber or DiDi/);
  assert.match(cdmx.safety.risks, /Street or airport taxis/);
  assert.match(cdmx.safety.stay, /Roma Norte, Condesa, Polanco/);
  const tucson = tripBySlug(shipped.trips, "tucson");
  assert.equal(tucson.safety.researched, false);
  assert.match(shipped.safetyHowToRead, /11-17 were not researched/);
});
