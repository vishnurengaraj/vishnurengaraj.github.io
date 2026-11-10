import { gunzipSync } from "node:zlib";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import fitMod from "fit-file-parser";
import { decodePolyline } from "./geo.mjs";
import { normalizeSport } from "./sports.mjs";

const FitParser = typeof fitMod === "function" ? fitMod : fitMod.default;

/** Strava CSV / FIT sport names kept on /runs. */
export const RUN_TYPES = ["run", "trail run", "trailrun", "walk", "hike", "walking", "hiking"];
const RUN_TYPE_SET = new Set(RUN_TYPES);

export function isRunType(type) {
  if (type == null || String(type).trim() === "") return true;
  const text = String(type).trim().toLowerCase().replace(/[_-]+/g, " ");
  if (text.includes("virtual")) return false;
  if (RUN_TYPE_SET.has(text)) return true;
  if (text.includes("hik")) return true;
  if (text.includes("walk")) return true;
  return text.endsWith(" run") && !text.includes("ride") && !text.includes("bike");
}

/** FIT sport or a parsed FIT file. Accepts run, walk, and hike names. */
export function fitIsRun(nameOrData) {
  if (nameOrData && typeof nameOrData === "object") {
    const rows = [...(nameOrData.sports || []), ...(nameOrData.sessions || [])];
    const names = rows.map((row) => String(row.sport || row.sub_sport || "")).filter((name) => name.trim());
    if (!names.length) return true;
    return names.some((name) => fitIsRun(name));
  }
  const text = String(nameOrData || "").toLowerCase();
  if (!text || text.includes("virtual")) return !text.includes("virtual");
  return text.includes("run") || text.includes("walk") || text.includes("hik");
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
    } else cell += char;
  }
  if (cell.length || row.length) {
    row.push(cell);
    if (row.some((value) => value !== "")) rows.push(row);
  }
  if (!rows.length) return [];
  const header = rows.shift().map((name) => name.trim());
  return rows.map((values) => {
    const obj = {};
    header.forEach((name, index) => {
      if (obj[name] === undefined) obj[name] = values[index] ?? "";
    });
    return obj;
  });
}

function num(value) {
  if (value == null || value === "") return null;
  const n = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function parseDate(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value > 1e12 ? value : value > 1e9 ? value * 1000 : null;
    if (ms) return new Date(ms).toISOString();
  }
  const parsed = Date.parse(String(value));
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  return null;
}

export function parseGpx(xml) {
  const coords = [];
  const pattern = /<(?:trkpt|rtept)\b([^>]*)>/gi;
  let match = pattern.exec(xml);
  while (match) {
    const lat = /lat="([^"]+)"/.exec(match[1]);
    const lon = /lon="([^"]+)"/.exec(match[1]);
    if (lat && lon) coords.push([Number(lon[1]), Number(lat[1])]);
    match = pattern.exec(xml);
  }
  return coords.filter((coord) => Number.isFinite(coord[0]) && Number.isFinite(coord[1]));
}

export function parseTcx(xml) {
  const coords = [];
  const pattern = /<LatitudeDegrees>([^<]+)<\/LatitudeDegrees>\s*<LongitudeDegrees>([^<]+)<\/LongitudeDegrees>/gi;
  let match = pattern.exec(xml);
  while (match) {
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) coords.push([lng, lat]);
    match = pattern.exec(xml);
  }
  return coords;
}

function semicirclesToDeg(value) {
  if (!Number.isFinite(value)) return null;
  if (Math.abs(value) > 180) return value * (180 / 2 ** 31);
  return value;
}

export function parseFit(buffer) {
  return new Promise((resolve, reject) => {
    const parser = new FitParser({
      force: true,
      mode: "list",
      lengthUnit: "m",
      speedUnit: "m/s",
    });
    parser.parse(buffer, (error, data) => {
      if (error && !data) reject(new Error(String(error)));
      else resolve(data || {});
    });
  });
}

function fitCoords(data) {
  const coords = [];
  for (const record of data.records || []) {
    const lat = semicirclesToDeg(record.position_lat);
    const lng = semicirclesToDeg(record.position_long);
    if (lat == null || lng == null) continue;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    coords.push([lng, lat]);
  }
  return coords;
}

function fitSport(data) {
  if (!fitIsRun(data)) return null;
  const rows = [...(data.sports || []), ...(data.sessions || [])];
  for (const row of rows) {
    const named = normalizeSport(row.sport || row.sub_sport || "");
    if (named) return named;
  }
  return "Run";
}

function first(obj, keys) {
  for (const key of keys) {
    if (obj[key] != null && obj[key] !== "") return obj[key];
  }
  return null;
}

const STRAVA_ID_KEYS = ["strava_id", "stravaId", "strava_activity_id", "stravaActivityId"];
const GARMIN_ID_KEYS = ["garmin_id", "garminId", "garmin_activity_id", "garminActivityId"];

/** Strava activity ids are positive integers with no leading zero. */
export function numericActivityId(value) {
  if (value == null || value === "") return null;
  const text = String(value).trim();
  if (!/^[1-9]\d*$/.test(text)) return null;
  return text;
}

/**
 * Strava id for one source record.
 * A string means the record named a Strava activity.
 * null means the record is Garmin-only or otherwise not a Strava activity.
 * undefined means this record did not say, so a Strava file may still claim its id.
 */
export function stravaIdFromRecord(record) {
  if (!record || typeof record !== "object") return null;
  const explicit = numericActivityId(first(record, STRAVA_ID_KEYS));
  if (explicit) return explicit;
  const garmin = first(record, GARMIN_ID_KEYS);
  if (garmin != null && String(garmin).trim() !== "") return null;
  const markers = ["start_date", "start_date_local", "moving_time", "upload_id", "athlete", "resource_state", "Activity ID"];
  const looksStrava = markers.some((key) => record[key] != null && record[key] !== "");
  if (!looksStrava) return undefined;
  return numericActivityId(first(record, ["id", "activity_id", "activityId", "Activity ID"]));
}

/** Fill stravaId from a numeric activity id. Does not override an explicit null. */
export function claimStravaId(activity) {
  if (!activity || activity.sample) return activity;
  if (activity.stravaId) return activity;
  if (activity.stravaId === null) return activity;
  activity.stravaId = numericActivityId(activity.id);
  return activity;
}

export function publicStravaId(activity) {
  if (!activity || activity.sample) return null;
  return numericActivityId(activity.stravaId);
}

function coordsFromUnknown(record) {
  if (Array.isArray(record.latlng) && record.latlng.length > 1 && Array.isArray(record.latlng[0])) {
    return record.latlng
      .map((pair) => [Number(pair[1]), Number(pair[0])])
      .filter((coord) => Number.isFinite(coord[0]) && Number.isFinite(coord[1]));
  }
  if (Array.isArray(record.coordinates)) {
    return record.coordinates
      .map((pair) => [Number(pair[0]), Number(pair[1])])
      .filter((coord) => Number.isFinite(coord[0]) && Number.isFinite(coord[1]));
  }
  const encoded = record.map?.summary_polyline || record.map?.polyline || record.summary_polyline || record.polyline;
  if (typeof encoded === "string" && encoded.length > 4) return decodePolyline(encoded);
  return null;
}

export function activityFromRecord(record) {
  if (!record || typeof record !== "object") return null;
  const id = first(record, ["id", "activity_id", "activityId", "strava_id", "stravaId"]);
  if (id == null) return null;
  const type = first(record, ["type", "sport_type", "sportType", "activity_type", "Activity Type"]);
  if (!isRunType(type)) return null;
  const coords = coordsFromUnknown(record);
  return {
    id: String(id),
    stravaId: stravaIdFromRecord(record),
    title: String(first(record, ["name", "title", "Activity Name"]) || "Run"),
    date: parseDate(first(record, ["start_date", "start_date_local", "date", "Activity Date"])),
    type: type ? String(type) : "Run",
    distanceM: num(first(record, ["distance", "distanceM", "Distance"])),
    movingS: num(first(record, ["moving_time", "movingS", "Moving Time"])),
    elapsedS: num(first(record, ["elapsed_time", "elapsedS", "Elapsed Time"])),
    elevM: num(first(record, ["total_elevation_gain", "elevM", "Elevation Gain"])),
    coords: coords && coords.length >= 2 ? coords : null,
    companions: Array.isArray(record.companions) ? record.companions.filter((name) => typeof name === "string") : [],
    sample: false,
  };
}

export function activitiesFromGeojson(collection) {
  const features = collection?.type === "FeatureCollection" ? collection.features : [];
  const out = [];
  for (const feature of features) {
    const geometry = feature.geometry;
    if (!geometry) continue;
    const lines =
      geometry.type === "LineString"
        ? [geometry.coordinates]
        : geometry.type === "MultiLineString"
          ? geometry.coordinates
          : [];
    const coords = lines.flat().filter((coord) => Array.isArray(coord) && coord.length >= 2);
    const props = feature.properties || {};
    const activity = activityFromRecord({ ...props, id: props.id ?? props.activity_id });
    if (!activity) continue;
    if (coords.length >= 2) activity.coords = coords.map((coord) => [Number(coord[0]), Number(coord[1])]);
    out.push(activity);
  }
  return out;
}

export async function readJsonFlexible(file) {
  const text = await readFile(file, "utf8");
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const data = JSON.parse(trimmed);
    if (Array.isArray(data)) return data;
    if (data.type === "FeatureCollection") return activitiesFromGeojson(data);
    if (Array.isArray(data.activities)) return data.activities;
    if (Array.isArray(data.runs)) return data.runs;
    return [data];
  }
  return trimmed
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

export async function loadExport(dir) {
  const csvPath = path.join(dir, "activities.csv");
  let rows = [];
  try {
    rows = parseCsv(await readFile(csvPath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const activities = [];
  for (const row of rows) {
    if (!isRunType(row["Activity Type"])) continue;
    const id = row["Activity ID"];
    if (!id) continue;
    const filename = row.Filename || "";
    let coords = null;
    if (filename) {
      const file = path.resolve(dir, filename);
      coords = await coordsFromTrackFile(file);
    }
    activities.push({
      id: String(id),
      stravaId: numericActivityId(id),
      title: row["Activity Name"] || "Run",
      date: parseDate(row["Activity Date"]),
      type: row["Activity Type"] || "Run",
      distanceM: num(row.Distance),
      movingS: num(row["Moving Time"]),
      elapsedS: num(row["Elapsed Time"]),
      elevM: num(row["Elevation Gain"]),
      coords,
      companions: [],
      sample: false,
    });
  }
  if (!rows.length) {
    const folder = path.join(dir, "activities");
    let names = [];
    try {
      names = await readdir(folder);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    for (const name of names) {
      const coords = await coordsFromTrackFile(path.join(folder, name));
      if (!coords) continue;
      let base = name;
      if (base.toLowerCase().endsWith(".gz")) base = base.slice(0, -3);
      const id = path.basename(base, path.extname(base));
      activities.push({
        id,
        title: "Run",
        date: null,
        type: "Run",
        distanceM: null,
        movingS: null,
        elapsedS: null,
        elevM: null,
        coords,
        companions: [],
        sample: false,
      });
    }
  }
  return activities;
}

/** GPX, TCX, or FIT bytes. A `.gz` name is inflated first, then parsed as the inner type. */
export async function coordsFromTrackBytes(filename, buffer) {
  let name = filename;
  let body = buffer;
  if (name.toLowerCase().endsWith(".gz")) {
    body = gunzipSync(body);
    name = name.slice(0, -3);
  }
  const ext = path.extname(name).toLowerCase();
  if (ext === ".gpx") return parseGpx(body.toString("utf8"));
  if (ext === ".tcx") return parseTcx(body.toString("utf8"));
  if (ext === ".fit") {
    const data = await parseFit(body);
    if (!fitSport(data)) return null;
    const coords = fitCoords(data);
    return coords.length >= 2 ? coords : null;
  }
  return null;
}

async function coordsFromTrackFile(file) {
  let info;
  try {
    info = await stat(file);
  } catch {
    return null;
  }
  if (!info.isFile()) return null;
  return coordsFromTrackBytes(path.basename(file), await readFile(file));
}

export function pairsFromMaster(node, pairs = [], seen = new WeakSet()) {
  if (!node || typeof node !== "object") return pairs;
  if (seen.has(node)) return pairs;
  seen.add(node);
  if (Array.isArray(node)) {
    for (const item of node) pairsFromMaster(item, pairs, seen);
    return pairs;
  }
  const strava = first(node, ["strava_id", "stravaId", "strava_activity_id", "stravaActivityId"]);
  const garmin = first(node, ["garmin_id", "garminId", "garmin_activity_id", "garminActivityId"]);
  const file = first(node, ["fit", "fit_file", "fitFile", "file", "filename", "path"]);
  if (strava != null && (garmin != null || file)) {
    pairs.push({ strava: String(strava), garmin: garmin == null ? null : String(garmin), file: file ? String(file) : null });
  }
  for (const value of Object.values(node)) pairsFromMaster(value, pairs, seen);
  return pairs;
}

export async function activityFromFit(file, id, options = {}) {
  const data = await parseFit(await readFile(file));
  const sport = fitSport(data);
  if (!sport) return null;
  const coords = fitCoords(data);
  if (coords.length < 2) return null;
  const session = (data.sessions && data.sessions[0]) || {};
  return {
    id: String(id),
    stravaId: numericActivityId(options.stravaId),
    title: "Run",
    date: parseDate(session.start_time || session.timestamp),
    type: sport,
    distanceM: num(session.total_distance),
    movingS: num(session.total_timer_time ?? session.total_elapsed_time),
    elapsedS: num(session.total_elapsed_time),
    elevM: num(session.total_ascent),
    coords,
    companions: [],
    sample: false,
    geometrySource: "garmin",
  };
}

export async function resolveFitFile(garminDir, pair) {
  const candidates = [];
  if (pair.file) {
    candidates.push(path.resolve(garminDir, pair.file), path.resolve(pair.file));
  }
  if (pair.garmin) {
    candidates.push(path.join(garminDir, `${pair.garmin}.fit`), path.join(garminDir, `${pair.garmin}.FIT`));
  }
  candidates.push(path.join(garminDir, `${pair.strava}.fit`));
  for (const candidate of candidates) {
    try {
      const info = await stat(candidate);
      if (info.isFile()) return candidate;
    } catch {
      /* try the next name */
    }
  }
  return null;
}

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

export async function listPhotoFiles(root, id) {
  const dir = path.join(root, id);
  const found = [];
  try {
    const names = await readdir(dir);
    for (const name of names) {
      if (!IMAGE_EXT.has(path.extname(name).toLowerCase())) continue;
      const file = path.join(dir, name);
      const info = await stat(file);
      if (info.isFile()) found.push(file);
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  found.sort((a, b) => path.basename(a).localeCompare(path.basename(b), "en", { numeric: true }));
  // 10.jpg sorts before 2.jpg in plain lexicographic order, so a cap of 8
  // kept the tenth still and dropped 8.jpg and 9.jpg. Morning Run has 10.
  return found.slice(0, 16);
}
