#!/usr/bin/env node
/**
 * Build static run assets for /runs.
 *
 *   node scripts/build-runs.mjs
 *   node scripts/build-runs.mjs --export ~/Downloads/strava-export
 *   node scripts/build-runs.mjs --streams ./streams.json --photos /workspace/strava/photos
 *   node scripts/build-runs.mjs --geojson ./runs.geojson --meta /workspace/strava/activities_raw.json
 *   node scripts/build-runs.mjs --garmin /workspace/garmin/fit --master /workspace/ha-health-dashboard/exercise_master.json --meta /workspace/strava/activities_raw.json
 *
 * With no source flags this writes the labeled sample. Pass any real source
 * and the sample is left out unless you also pass --sample.
 * See RUNS.md.
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { assignCity, orderCities } from "./runs/cities.mjs";
import {
  applyPrivacy,
  distanceToLine,
  distanceToMeters,
  lineMidpoint,
  pathLength,
  roundCoord,
  sampleHeat,
} from "./runs/geo.mjs";
import {
  activitiesFromGeojson,
  activityFromFit,
  activityFromRecord,
  claimStravaId,
  isRunType,
  listPhotoFiles,
  loadExport,
  pairsFromMaster,
  publicStravaId,
  readJsonFlexible,
  resolveFitFile,
} from "./runs/parse.mjs";
import { SAMPLE_PIER, buildSampleActivities } from "./runs/sample.mjs";
import { FOOT_SPORTS, normalizeSport } from "./runs/sports.mjs";

export { FOOT_SPORTS };

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "public/media/runs");
const MANIFEST_PATH = path.join(ROOT, "src/data/runs/manifest.json");

function readArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next == null || next.startsWith("--")) out[key] = true;
    else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

function mergeActivity(map, incoming, { replaceGeometry }) {
  if (!incoming?.id) return;
  const prev = map.get(incoming.id);
  if (!prev) {
    map.set(incoming.id, { ...incoming });
    return;
  }
  for (const key of ["title", "date", "type", "distanceM", "movingS", "elapsedS", "elevM"]) {
    if ((prev[key] == null || prev[key] === "" || prev[key] === "Run") && incoming[key] != null && incoming[key] !== "") {
      prev[key] = incoming[key];
    }
  }
  if (incoming.companions?.length && !prev.companions?.length) prev.companions = incoming.companions;
  if (incoming.stravaId && !prev.stravaId) prev.stravaId = incoming.stravaId;
  if (incoming.samplePhoto) prev.samplePhoto = true;
  if (incoming.coords?.length >= 2 && (replaceGeometry || !prev.coords?.length)) {
    prev.coords = incoming.coords;
    prev.geometrySource = incoming.geometrySource || prev.geometrySource;
  }
  if (incoming.sample === false) prev.sample = false;
}

async function loadSources(flags) {
  const map = new Map();
  const explicit = Boolean(flags.export || flags.geojson || flags.streams || flags.meta || flags.garmin);
  if (!explicit || flags.sample) {
    for (const activity of buildSampleActivities()) mergeActivity(map, activity, { replaceGeometry: false });
  }
  if (flags.meta) {
    const records = await readJsonFlexible(path.resolve(flags.meta));
    for (const record of records) {
      const activity = activityFromRecord(record);
      if (activity) mergeActivity(map, claimStravaId(activity), { replaceGeometry: false });
    }
  }
  if (flags.export) {
    for (const activity of await loadExport(path.resolve(flags.export))) {
      activity.geometrySource = "strava";
      mergeActivity(map, claimStravaId(activity), { replaceGeometry: true });
    }
  }
  if (flags.geojson) {
    const collection = JSON.parse(await readFile(path.resolve(flags.geojson), "utf8"));
    for (const activity of activitiesFromGeojson(collection)) {
      activity.geometrySource = "strava";
      mergeActivity(map, claimStravaId(activity), { replaceGeometry: true });
    }
  }
  if (flags.streams) {
    const records = await readJsonFlexible(path.resolve(flags.streams));
    for (const record of records) {
      const activity = activityFromRecord(record);
      if (!activity) continue;
      activity.geometrySource = "strava";
      mergeActivity(map, claimStravaId(activity), { replaceGeometry: true });
    }
  }
  if (flags.garmin) {
    if (!flags.master) throw new Error("--garmin needs --master pointing at exercise_master.json");
    const master = JSON.parse(await readFile(path.resolve(flags.master), "utf8"));
    const pairs = pairsFromMaster(master);
    const garminDir = path.resolve(flags.garmin);
    for (const pair of pairs) {
      const existing = map.get(pair.strava);
      if (existing?.coords?.length >= 2) continue;
      const file = await resolveFitFile(garminDir, pair);
      if (!file) continue;
      const activity = await activityFromFit(file, pair.strava, { stravaId: pair.strava });
      if (!activity) continue;
      mergeActivity(map, activity, { replaceGeometry: false });
    }
  }
  return [...map.values()];
}

async function writeSamplePhoto(file) {
  const width = 960;
  const height = 640;
  const raw = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      const t = x / width;
      const u = y / height;
      raw[i] = Math.round(246 - u * 70);
      raw[i + 1] = Math.round(214 - t * 90);
      raw[i + 2] = Math.round(150 + u * 40);
    }
  }
  await sharp(raw, { raw: { width, height, channels: 3 } })
    .webp({ quality: 62 })
    .toFile(file);
  return { width, height };
}

async function writePhotos(activity, photosDir) {
  const sources = photosDir ? await listPhotoFiles(photosDir, activity.id) : [];
  const destDir = path.join(OUT_DIR, "photos", activity.id);
  const photos = [];
  if (sources.length) await mkdir(destDir, { recursive: true });
  for (let index = 0; index < sources.length; index++) {
    const dest = path.join(destDir, `${index + 1}.webp`);
    const image = sharp(sources[index]).rotate();
    const meta = await image.metadata();
    await image
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 76 })
      .toFile(dest);
    photos.push({
      src: `/media/runs/photos/${activity.id}/${index + 1}.webp`,
      w: Math.min(meta.width || 1600, 1600),
      h: meta.height && meta.width ? Math.round((meta.height / meta.width) * Math.min(meta.width, 1600)) : null,
      sample: false,
    });
  }
  if (!photos.length && activity.samplePhoto) {
    await mkdir(destDir, { recursive: true });
    const dest = path.join(destDir, "1.webp");
    const size = await writeSamplePhoto(dest);
    photos.push({
      src: `/media/runs/photos/${activity.id}/1.webp`,
      w: size.width,
      h: size.height,
      sample: true,
    });
  }
  return photos;
}

function safeId(id) {
  const cleaned = String(id).replace(/[^A-Za-z0-9_-]/g, "_");
  if (!cleaned || cleaned === "." || cleaned === "..") throw new Error(`Unsafe activity id: ${id}`);
  return cleaned;
}

async function main() {
  const flags = readArgs(process.argv.slice(2));
  const radiusM = Math.min(500, Math.max(300, Number(flags.trim || 400)));
  if (!Number.isFinite(radiusM)) throw new Error("--trim must be a number of meters");
  let zones = null;
  if (flags.zones) zones = JSON.parse(await readFile(path.resolve(flags.zones), "utf8"));
  else if (flags.export) {
    try {
      zones = JSON.parse(await readFile(path.join(path.resolve(flags.export), "privacy-zones.geojson"), "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }

  // Run, Trail Run, Walk, and Hike. Rides and virtual activities are dropped.
  const loaded = (await loadSources(flags)).filter((activity) => isRunType(activity.type));
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(path.dirname(MANIFEST_PATH), { recursive: true });
  await mkdir(path.join(OUT_DIR, "cities"), { recursive: true });
  await mkdir(path.join(OUT_DIR, "activities"), { recursive: true });

  const photosDir = flags.photos ? path.resolve(flags.photos) : null;
  const byCity = new Map();
  const summaries = [];
  let dropped = 0;
  let missingGps = 0;

  for (const activity of loaded) {
    if (!activity.coords || activity.coords.length < 2) {
      missingGps++;
      continue;
    }
    const raw = activity.coords;
    const parts = applyPrivacy(raw, { radiusM, zones });
    if (!parts) {
      dropped++;
      continue;
    }
    const id = safeId(activity.id);
    const stravaId = publicStravaId(activity);
    const flat = parts.flat();
    const start = raw[0];
    const end = raw[raw.length - 1];
    for (const point of flat) {
      const fromStart = distanceToPoint(point, start);
      const fromEnd = distanceToPoint(point, end);
      if (fromStart < radiusM - 1 || fromEnd < radiusM - 1) {
        throw new Error(`${id} published a point inside the ${radiusM}m privacy radius`);
      }
    }
    const longest = parts.reduce((best, line) => (pathLength(line) > pathLength(best) ? line : best));
    const mid = lineMidpoint(longest);
    const city = assignCity(mid[0], mid[1]);
    const distanceM = distanceToMeters(activity.distanceM ?? pathLength(raw), activity.movingS);
    const movingS = activity.movingS;
    const photos = await writePhotos({ ...activity, id }, photosDir);
    const summary = {
      id,
      ...(stravaId ? { stravaId } : {}),
      city: city.id,
      title: activity.title || "Run",
      type: normalizeSport(activity.type) || "Run",
      date: activity.date,
      distanceM: round(distanceM),
      movingS: movingS == null ? null : Math.round(movingS),
      elevM: activity.elevM == null ? null : round(activity.elevM),
      mid: roundCoord(mid),
      photos: photos.length,
      companions: activity.companions?.length || 0,
      sample: Boolean(activity.sample),
    };
    summaries.push(summary);
    const detail = {
      ...summary,
      elapsedS: activity.elapsedS == null ? null : Math.round(activity.elapsedS),
      companions: activity.companions || [],
      photos,
    };
    await writeFile(path.join(OUT_DIR, "activities", `${id}.json`), `${JSON.stringify(detail, null, 2)}\n`);
    if (!byCity.has(city.id)) byCity.set(city.id, { city, features: [], heat: [] });
    const bucket = byCity.get(city.id);
    bucket.features.push({
      type: "Feature",
      properties: {
        id,
        title: summary.title,
        type: summary.type,
        date: summary.date || "",
        distanceM: summary.distanceM,
        movingS: summary.movingS ?? 0,
        elevM: summary.elevM ?? 0,
      },
      geometry:
        parts.length === 1
          ? { type: "LineString", coordinates: parts[0].map(roundCoord) }
          : { type: "MultiLineString", coordinates: parts.map((line) => line.map(roundCoord)) },
    });
    for (const point of sampleHeat(parts)) {
      bucket.heat.push({
        type: "Feature",
        properties: { w: 1 },
        geometry: { type: "Point", coordinates: roundCoord(point) },
      });
    }
  }

  const cities = [];
  for (const bucket of byCity.values()) {
    const generated = bucket.city.generated;
    let center = bucket.city.center;
    if (generated && bucket.features.length) {
      const mids = summaries.filter((run) => run.city === bucket.city.id).map((run) => run.mid);
      center = [
        mids.reduce((sum, mid) => sum + mid[0], 0) / mids.length,
        mids.reduce((sum, mid) => sum + mid[1], 0) / mids.length,
      ];
    }
    cities.push({
      id: bucket.city.id,
      label: bucket.city.label,
      name: bucket.city.name,
      center: roundCoord(center),
      zoom: bucket.city.zoom,
      count: bucket.features.length,
      generated,
    });
    await writeFile(
      path.join(OUT_DIR, "cities", `${bucket.city.id}.lines.geojson`),
      JSON.stringify({ type: "FeatureCollection", features: bucket.features }),
    );
    await writeFile(
      path.join(OUT_DIR, "cities", `${bucket.city.id}.heat.geojson`),
      JSON.stringify({ type: "FeatureCollection", features: bucket.heat }),
    );
  }

  const away = cities.filter((city) => city.generated).sort((a, b) => b.count - a.count);
  away.forEach((city, index) => {
    city.label = index === 0 ? "Away" : `Away ${index + 1}`;
  });

  const ordered = orderCities(cities);
  const la = byCity.get("la");
  let probes;
  if (la && summaries.some((run) => run.sample)) {
    let near = 0;
    for (const feature of la.features) {
      const lines =
        feature.geometry.type === "LineString" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
      const dist = Math.min(...lines.map((line) => distanceToLine(SAMPLE_PIER, line)));
      if (dist < 30) near++;
    }
    if (near < 3) throw new Error(`Sample overlap at the Strand pier only hit ${near} runs`);
    probes = {
      overlap: { lng: SAMPLE_PIER[0], lat: SAMPLE_PIER[1], count: near },
    };
  }

  const manifest = {
    sample: summaries.length > 0 && summaries.every((run) => run.sample),
    privacy: { method: "radius", meters: radiusM },
    defaultCity: ordered.some((city) => city.id === "la") ? "la" : ordered[0]?.id || null,
    cities: ordered,
    runs: summaries.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || a.title.localeCompare(b.title)),
    probes,
  };
  const pretty = `${JSON.stringify(manifest, null, 2)}\n`;
  await writeFile(MANIFEST_PATH, pretty);
  await writeFile(path.join(OUT_DIR, "manifest.json"), pretty);

  const counts = ordered.map((city) => `${city.count} ${city.label}`).join(", ");
  console.log(
    `runs: ${summaries.length} (${counts || "none"})\nprivacy: ${radiusM}m radius, ${dropped} dropped, ${missingGps} without GPS\noutput: public/media/runs`,
  );
}

function distanceToPoint(a, b) {
  const φ1 = (a[1] * Math.PI) / 180;
  const φ2 = (b[1] * Math.PI) / 180;
  const dφ = ((b[1] - a[1]) * Math.PI) / 180;
  const dλ = ((b[0] - a[0]) * Math.PI) / 180;
  const s = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(s)));
}

function round(value) {
  return Math.round(value * 100) / 100;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
