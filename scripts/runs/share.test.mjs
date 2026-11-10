import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { activitySharePath, plainRunsBehind, stravaActivityUrl } from "../../src/runs/share.js";
import {
  activityFromRecord,
  claimStravaId,
  loadExport,
  numericActivityId,
  publicStravaId,
} from "./parse.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("strava links use only a real strava id", () => {
  assert.equal(numericActivityId("8572874138"), "8572874138");
  assert.equal(numericActivityId(" 123 "), "123");
  assert.equal(numericActivityId("0123"), null);
  assert.equal(numericActivityId("sample-la-strand"), null);
  assert.equal(numericActivityId(""), null);
  assert.equal(stravaActivityUrl({ id: "8572874138" }), null);
  assert.equal(stravaActivityUrl({ id: "8572874138", stravaId: "8572874138" }), "https://www.strava.com/activities/8572874138");
  assert.equal(stravaActivityUrl({ stravaId: "sample-la-strand" }), null);
  assert.equal(stravaActivityUrl({ stravaId: null }), null);
  assert.equal(stravaActivityUrl(null), null);
});

test("share path and back target stay on /runs", () => {
  assert.equal(activitySharePath("20547259461"), "/runs?activity=20547259461");
  assert.equal(activitySharePath("sample la"), "/runs?activity=sample%20la");
  assert.equal(plainRunsBehind("/runs"), true);
  assert.equal(plainRunsBehind("/runs/"), true);
  assert.equal(plainRunsBehind("/runs?city=tokyo"), true);
  assert.equal(plainRunsBehind("/runs?activity=1"), false);
  assert.equal(plainRunsBehind("/runs?run=1"), false);
  assert.equal(plainRunsBehind("/about"), false);
  assert.equal(plainRunsBehind(null), false);
  assert.equal(plainRunsBehind(""), false);
});

test("strava records keep their activity id and garmin-only records do not", () => {
  const strava = activityFromRecord({
    id: 8572874138,
    name: "Night Run",
    type: "Run",
    start_date: "2023-02-15T00:00:00Z",
    distance: 6470,
    moving_time: 2120,
  });
  assert.equal(strava.id, "8572874138");
  assert.equal(strava.stravaId, "8572874138");
  assert.equal(stravaActivityUrl(strava), "https://www.strava.com/activities/8572874138");

  const paired = activityFromRecord({
    id: "5556667778",
    strava_id: "8572874138",
    garmin_id: "5556667778",
    name: "Morning Run",
    type: "Run",
    moving_time: 1800,
  });
  assert.equal(paired.id, "5556667778");
  assert.equal(paired.stravaId, "8572874138");

  const garmin = activityFromRecord({
    id: "5556667778",
    garmin_id: "5556667778",
    name: "Morning Run",
    type: "Run",
    start_date: "2024-01-01T00:00:00Z",
    moving_time: 1800,
    distance: 5000,
  });
  assert.equal(garmin.stravaId, null);
  claimStravaId(garmin);
  assert.equal(garmin.stravaId, null);
  assert.equal(stravaActivityUrl(garmin), null);
  assert.equal(publicStravaId(garmin), null);
});

test("a strava file can claim a numeric id, and a sample never can", () => {
  const bare = { id: "123456789" };
  claimStravaId(bare);
  assert.equal(bare.stravaId, "123456789");
  assert.equal(publicStravaId(bare), "123456789");

  const sample = { id: "sample-la-strand", sample: true, stravaId: "123456789" };
  claimStravaId(sample);
  assert.equal(sample.stravaId, "123456789");
  assert.equal(publicStravaId(sample), null);

  const slug = { id: "sample-la-strand" };
  claimStravaId(slug);
  assert.equal(slug.stravaId, null);
  assert.equal(publicStravaId(slug), null);
});

test("a strava csv activity id is the strava id", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "strava-export-"));
  try {
    writeFileSync(
      path.join(dir, "activities.csv"),
      [
        "Activity ID,Activity Date,Activity Name,Activity Type,Elapsed Time,Distance,Moving Time,Elevation Gain,Filename",
        '123456789,"Jan 2, 2024, 8:00:00 AM",Morning Run,Run,1800,5000,1700,20,',
        '555666777,"Jan 3, 2024, 8:00:00 AM",Bike,Ride,1800,20000,1700,20,',
      ].join("\n"),
    );
    const activities = await loadExport(dir);
    assert.equal(activities.length, 1);
    assert.equal(activities[0].id, "123456789");
    assert.equal(activities[0].stravaId, "123456789");
    assert.equal(activities[0].title, "Morning Run");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("shipped runs publish the strava id beside the activity id", () => {
  const src = JSON.parse(readFileSync(path.join(ROOT, "src/data/runs/manifest.json"), "utf8"));
  const published = JSON.parse(readFileSync(path.join(ROOT, "public/media/runs/manifest.json"), "utf8"));
  assert.deepEqual(published, src);
  assert.ok(src.runs.length > 400);
  for (const run of src.runs) {
    assert.equal(run.sample, false);
    assert.match(run.stravaId, /^[1-9]\d+$/);
    assert.equal(run.stravaId, run.id);
    assert.equal(stravaActivityUrl(run), `https://www.strava.com/activities/${run.id}`);
    const detail = JSON.parse(readFileSync(path.join(ROOT, "public/media/runs/activities", `${run.id}.json`), "utf8"));
    assert.equal(detail.stravaId, run.stravaId);
  }
});
