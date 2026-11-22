import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import {
  criteriaSummary,
  daysOnMarket,
  factBadge,
  filterListings,
  formatListedAgo,
  formatRent,
  formatType,
  formatUpdatedAt,
  freshnessColor,
  honorableMentions,
  sortListings,
  driveMapsUrl,
  stepAria,
  stepLabel,
  walkMapsUrl,
} from "../../src/housing/format.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SCRIPT = path.join(ROOT, "scripts/build-housing.mjs");
const FIXTURE = path.join(ROOT, "qa/housing.fixture.json");

function build(args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8", cwd: ROOT });
}

test("factBadge maps unknown and unverified to Unverified", () => {
  assert.deepEqual(factBadge("unknown"), { kind: "unverified", label: "Unverified" });
  assert.deepEqual(factBadge("unverified"), { kind: "unverified", label: "Unverified" });
  assert.deepEqual(factBadge(null), { kind: "unverified", label: "Unverified" });
  assert.deepEqual(factBadge(true), { kind: "yes", label: "Yes" });
  assert.deepEqual(factBadge(false), { kind: "no", label: "No" });
  assert.equal(factBadge("Patio").kind, "text");
});

test("format helpers", () => {
  assert.equal(formatRent(4500), "$4,500");
  assert.equal(formatType("SINGLE_FAMILY"), "House");
  assert.equal(formatType("APARTMENT BUILDING"), "Apartment building");
  assert.equal(formatUpdatedAt("2026-11-21T21:42-08:00"), "Nov 21, 2026, 9:42 PM PT");
  assert.ok(criteriaSummary({ beds_min: 2, baths_min: 2, budget_usd: 4500 }).includes("$4,500/month"));
});

test("rejected and stale listings are hidden until the toggle is on", () => {
  const list = [
    { id: "a", rank: 1, score: 90, rent_usd: 4000, walk_min_to_beach: 6, status: "new" },
    { id: "b", rank: 2, score: 20, rent_usd: 3000, walk_min_to_beach: 10, status: "rejected" },
    { id: "c", rank: 3, score: 80, rent_usd: 5000, walk_min_to_beach: 25, status: "new" },
    { id: "d", rank: null, score: 70, rent_usd: 3200, walk_min_to_beach: 12, status: "stale" },
  ];
  const hidden = filterListings(list, { showHidden: false });
  assert.deepEqual(hidden.map((l) => l.id), ["a", "c"]);
  const shown = filterListings(list, { showHidden: true });
  assert.deepEqual(shown.map((l) => l.id), ["a", "b", "c", "d"]);
  const priced = filterListings(list, { maxRent: 4500, showHidden: false });
  assert.deepEqual(priced.map((l) => l.id), ["a"]);
  const walked = filterListings(list, { maxWalk: 20, showHidden: false });
  assert.deepEqual(walked.map((l) => l.id), ["a"]);
  const byRank = sortListings(list, "rank");
  assert.equal(byRank.at(-1).id, "d");
  const byRent = sortListings(list, "rent");
  assert.equal(byRent.at(-1).rank, null);
  assert.deepEqual(byRent.filter((l) => l.rank != null).map((l) => l.id), ["b", "a", "c"]);
});

test("days on market uses listed_date vs today, then days_on_market", () => {
  assert.equal(daysOnMarket({ listed_date: "2026-11-21" }, "2026-11-21"), 0);
  assert.equal(daysOnMarket({ listed_date: "2026-11-20" }, "2026-11-21"), 1);
  assert.equal(daysOnMarket({ listed_date: "2026-11-07" }, "2026-11-21"), 14);
  assert.equal(daysOnMarket({ days_on_market: 9 }, "2026-11-21"), 9);
  assert.equal(formatListedAgo(0), "Listed today");
  assert.equal(formatListedAgo(1), "Listed 1 day ago");
  assert.equal(formatListedAgo(14), "Listed 14 days ago");
});

test("freshness color is green at 0-1 days and red at 14", () => {
  const fresh0 = freshnessColor(0);
  const fresh1 = freshnessColor(1);
  const mid = freshnessColor(7);
  const stale = freshnessColor(14);
  assert.equal(fresh0, fresh1);
  assert.equal(fresh0, "#1b7a3c");
  assert.equal(stale, "#b3261e");
  assert.notEqual(mid, fresh0);
  assert.notEqual(mid, stale);
  assert.equal(freshnessColor(null), null);
});

test("honorable mentions include rejected and stale listings", () => {
  const list = [
    { id: "a", rank: 1, score: 90, status: "new", honorable_mention: false },
    { id: "b", rank: 13, score: 76, status: "new", honorable_mention: true, honorable_mention_reason: "over budget house" },
    { id: "c", rank: null, score: 33, status: "rejected", honorable_mention: true, honorable_mention_reason: "no pets, good garage" },
    { id: "d", rank: null, score: 15, status: "rejected", honorable_mention: false },
  ];
  const mentions = honorableMentions(list);
  assert.deepEqual(mentions.map((l) => l.id), ["b", "c"]);
  assert.equal(filterListings(list, { showHidden: false }).length, 2);
});

test("build from the sample fixture writes listings and landmarks", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "housing-"));
  const out = path.join(dir, "housing.json");
  const result = build(["--in", FIXTURE, "--out", out]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr + result.stdout, /SAMPLE FIXTURE|fixture/i);
  const data = JSON.parse(readFileSync(out, "utf8"));
  assert.equal(data.source, "fixture");
  assert.equal(data.listings.length, 5);
  assert.equal(data.listings.filter((l) => l.status === "rejected").length, 1);
  assert.equal(data.listings.filter((l) => l.status === "stale").length, 1);
  assert.ok(data.listings.some((l) => l.rank == null && l.status === "new"));
  assert.ok(data.listings[0].score > 100);
  assert.equal(data.listings[0].listed_date, "2026-11-21");
  assert.ok(data.scoring_notes);
  assert.equal(data.criteria.max_listing_age_days, 14);
  assert.equal(data.listings.filter((l) => l.honorable_mention).length, 2);
  assert.ok(data.listings[0].score_breakdown);
  assert.ok(data.listings[0].nearest_beach_access);
  assert.ok(data.listings[0].walk_km_to_beach != null);
  assert.equal(data.listings[1].zpid, null);
  assert.equal(data.listings[1].cats_ok, "unknown");
  assert.ok(data.landmarks.beach.lat);
  assert.ok(data.landmarks.spacex.lat);
  assert.equal(data.landmarks.spacex.address, "1 Rocket Rd, Hawthorne, CA 90250");
});

test("build skips a listing that is missing required fields and reports it", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "housing-"));
  const src = path.join(dir, "shortlist.json");
  const out = path.join(dir, "housing.json");
  const fixture = JSON.parse(readFileSync(FIXTURE, "utf8"));
  fixture.listings = [fixture.listings[0], { rank: 9, address: "nowhere" }];
  writeFileSync(src, JSON.stringify(fixture));
  const result = build(["--in", src, "--out", out]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /missing required field/);
  const data = JSON.parse(readFileSync(out, "utf8"));
  assert.equal(data.listings.length, 1);
});

test("Google Maps links use walking to the beach and driving to SpaceX", () => {
  const listing = { lat: 33.9, lng: -118.4, nearest_beach_access: "Manhattan Beach 23rd St / The Strand" };
  const walk = walkMapsUrl(listing, { lat: 33.88415, lng: -118.41175 });
  assert.match(walk, /^https:\/\/www\.google\.com\/maps\/dir\/\?/);
  assert.match(walk, /travelmode=walking/);
  assert.match(walk, /origin=33\.9%2C-118\.4|origin=33\.9,-118\.4/);
  assert.match(walk, /23rd/);
  const fallback = walkMapsUrl({ lat: 33.9, lng: -118.4, nearest_beach_access: "" }, { lat: 33.88415, lng: -118.41175 });
  assert.match(fallback, /33\.88415/);
  const drive = driveMapsUrl(listing);
  assert.match(drive, /travelmode=driving/);
  assert.match(drive, /SpaceX/);
  assert.match(drive, /Rocket/);
});

test("prev/next labels use rank or a short mention tag", () => {
  assert.equal(stepLabel({ rank: 3, address: "100 Main St", city: "Hermosa Beach" }, "prev"), "← #3");
  assert.equal(stepLabel({ rank: 5, address: "200 Main St", city: "Hermosa Beach" }, "next"), "#5 →");
  assert.equal(stepLabel({ rank: null, honorable_mention: true, address: "9 Pine", city: "Redondo Beach" }, "prev"), "← HM");
  assert.equal(stepLabel({ rank: null, honorable_mention: false, address: "9 Pine", city: "Redondo Beach" }, "next"), "— →");
  assert.match(stepAria({ rank: 3, address: "100 Main St", city: "Hermosa Beach" }, "prev"), /100 Main St/);
});

test("build converts listing photos into webp under the media dir", (t) => {
  const photo = "/workspace/house-hunt/photos/20421474/1.jpg";
  if (!existsSync(photo)) {
    t.skip("real shortlist photos are not on this machine");
    return;
  }
  const dir = mkdtempSync(path.join(tmpdir(), "housing-"));
  const src = path.join(dir, "shortlist.json");
  const out = path.join(dir, "housing.json");
  const media = path.join(dir, "media");
  const fixture = JSON.parse(readFileSync(FIXTURE, "utf8"));
  fixture.listings = [
    {
      ...fixture.listings[0],
      photos: ["photos/20421474/1.jpg"],
      photo_source_url: "https://example.com/a.jpg",
      photo_source_urls: ["https://example.com/a.jpg"],
    },
  ];
  writeFileSync(src, JSON.stringify(fixture));
  const result = build(["--in", src, "--out", out, "--media", media]);
  assert.equal(result.status, 0, result.stderr);
  const data = JSON.parse(readFileSync(out, "utf8"));
  assert.equal(data.listings[0].photos.length, 1);
  assert.equal(data.listings[0].photos[0].src, "/media/housing/20421474/1.webp");
  assert.equal(data.listings[0].photos[0].thumb, "/media/housing/20421474/1.thumb.webp");
  assert.ok(!data.listings[0].source_path);
  assert.ok(existsSync(path.join(media, "20421474", "1.webp")));
  assert.ok(existsSync(path.join(media, "20421474", "1.thumb.webp")));
});
