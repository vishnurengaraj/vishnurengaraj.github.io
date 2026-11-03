import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const MEDIA = path.join(ROOT, "public/media/runs");

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

test("shipped photos match activity cards and both manifests", () => {
  const src = readJson(path.join(ROOT, "src/data/runs/manifest.json"));
  const published = readJson(path.join(MEDIA, "manifest.json"));
  assert.deepEqual(published, src);

  const photoDirs = readdirSync(path.join(MEDIA, "photos")).filter((name) =>
    statSync(path.join(MEDIA, "photos", name)).isDirectory(),
  );
  const byId = new Map(src.runs.map((run) => [String(run.id), run]));
  let linked = 0;

  for (const id of photoDirs) {
    const files = readdirSync(path.join(MEDIA, "photos", id))
      .filter((name) => /^\d+\.webp$/.test(name))
      .sort((a, b) => Number(a) - Number(b));
    const activityPath = path.join(MEDIA, "activities", `${id}.json`);
    if (!statExists(activityPath)) continue;
    const activity = readJson(activityPath);
    assert.deepEqual(
      activity.photos.map((photo) => photo.src),
      files.map((file) => `/media/runs/photos/${id}/${file}`),
      id,
    );
    for (const photo of activity.photos) {
      assert.equal(typeof photo.w, "number");
      assert.equal(typeof photo.h, "number");
      assert.ok(photo.w > 0 && photo.h > 0);
      assert.equal(photo.sample, false);
    }
    const run = byId.get(id);
    assert.ok(run, id);
    assert.equal(run.photos, files.length, id);
    linked++;
  }

  assert.ok(linked > 50, `linked ${linked} photo activities`);
  for (const run of src.runs) {
    const activity = readJson(path.join(MEDIA, "activities", `${run.id}.json`));
    assert.equal(activity.photos.length, run.photos, run.id);
    assert.equal(Array.isArray(activity.photos), true);
  }
});

function statExists(file) {
  try {
    return statSync(file).isFile();
  } catch {
    return false;
  }
}
