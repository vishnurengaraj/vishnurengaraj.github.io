/**
 * Build src/data/training/training.json for /training.
 *
 *   node scripts/training/build-training.mjs
 *   node scripts/training/build-training.mjs --as-of 2026-11-11
 *
 * Inputs (override any with --flag path):
 *   --plan    src/data/training/plan.json      editable plan, by week
 *   --course  src/data/training/course.json    editable course notes + GPX path
 *   --strava  /workspace/strava/activities_raw.json
 *   --master  /workspace/ha-health-dashboard/exercise_master.json (the /runs Garmin pairing list;
 *             adds Garmin-only runs that Strava does not have)
 *   --daily   /workspace/garmin/daily-log.csv  readiness, HRV, sleep (no other columns are read)
 *   --gpx     course GPX (default: course.json "gpx")
 *
 * Actuals are only ever copied from those files. Nothing is estimated or filled in.
 * The as-of date defaults to today in America/Los_Angeles.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "../travel/csv.mjs";
import { weekDates } from "../../src/training/progress.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};

const laToday = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
const asOf = flag("as-of", laToday);
if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) throw new Error(`--as-of must be YYYY-MM-DD, got ${asOf}`);

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const plan = readJson(flag("plan", path.join(ROOT, "src/data/training/plan.json")));
const course = readJson(flag("course", path.join(ROOT, "src/data/training/course.json")));
const stravaPath = flag("strava", "/workspace/strava/activities_raw.json");
const masterPath = flag("master", "/workspace/ha-health-dashboard/exercise_master.json");
const dailyPath = flag("daily", "/workspace/garmin/daily-log.csv");
const gpxPath = flag("gpx", course.gpx);
const outPath = flag("out", path.join(ROOT, "src/data/training/training.json"));

/* ---- plan ---- */
if (plan.weeks.length !== 17) throw new Error(`plan has ${plan.weeks.length} weeks, expected 17`);
const weeks = plan.weeks.map((w, i) => {
  const dates = weekDates(plan.start, i);
  if (w.days.length !== 7) throw new Error(`week ${w.week} has ${w.days.length} days`);
  for (const d of w.days) {
    if (!["Key", "Supporting", "Optional", "Rest"].includes(d.role)) throw new Error(`week ${w.week}: bad role ${d.role}`);
  }
  return { ...w, start: dates[0], end: dates[6], days: w.days.map((d, j) => ({ date: dates[j], ...d })) };
});
const first = weeks[0].start;
const last = weeks.at(-1).end;
if (!weeks.some((w) => w.days.some((d) => d.date === plan.race.date))) throw new Error("race date is outside the plan");

/* ---- actuals ---- */
const inWindow = (d) => d >= first && d <= last && d <= asOf;
const actuals = {};
const seen = new Set();
const add = (a) => (actuals[a.date] ||= []).push(a);
const num = (v) => (v === "" || v == null || Number.isNaN(+v) ? null : +v);

for (const a of readJson(stravaPath)) {
  if (!inWindow(a.date)) continue;
  seen.add(String(a.id));
  add({
    id: String(a.id),
    date: a.date,
    type: a.type,
    title: a.title,
    mi: num(a.distance_mi) ?? 0,
    ft: num(a.elevation_ft) ?? 0,
    time: a.moving_time || "",
    hr: num(a.avg_hr),
    url: a.url,
    src: "Strava",
  });
}
let masterRows = [];
try {
  masterRows = readJson(masterPath);
} catch (err) {
  console.warn(`skip ${masterPath}: ${err.message}`);
}
for (const a of masterRows) {
  if (!inWindow(a.date)) continue;
  if (a.sid && seen.has(String(a.sid))) continue;
  if (!a.gid) continue; // only Garmin-recorded rows; Strava rows come from the raw file
  add({
    id: `g${a.gid}`,
    date: a.date,
    type: a.type,
    title: (a.notes && a.notes[0]) || a.type,
    mi: num(a.mi) ?? 0,
    ft: num(a.asc) ?? 0,
    time: (a.dur || "").replace(/^0:/, ""),
    hr: num(a.hr),
    url: a.url || "",
    src: "Garmin",
  });
}
for (const list of Object.values(actuals)) list.sort((x, y) => x.id.localeCompare(y.id));

/* ---- readiness, HRV, sleep ---- */
const rows = parseCsv(readFileSync(dailyPath, "utf8")).filter((r) => r.length > 1);
const head = rows[0];
const col = (name) => {
  const i = head.indexOf(name);
  if (i < 0) throw new Error(`${dailyPath} has no ${name} column`);
  return i;
};
const C = {
  date: col("date"),
  score: col("training_readiness_score"),
  level: col("training_readiness_level"),
  hrv: col("hrv_7d_avg_ms"),
  hrvStatus: col("hrv_status"),
  sleep: col("sleep_score"),
  sleepMin: col("sleep_duration_min"),
};
const ready = {};
for (const r of rows.slice(1)) {
  const date = r[C.date];
  if (!inWindow(date)) continue;
  const score = num(r[C.score]);
  if (score == null) continue;
  ready[date] = {
    score,
    level: r[C.level] || "",
    hrv: num(r[C.hrv]),
    hrvStatus: r[C.hrvStatus] || "",
    sleep: num(r[C.sleep]),
    sleepMin: num(r[C.sleepMin]),
  };
}

/* ---- course profile ---- */
const gpx = readFileSync(gpxPath, "utf8");
const pts = [...gpx.matchAll(/<trkpt\s+lat="([-\d.]+)"\s+lon="([-\d.]+)"\s*>\s*<ele>([-\d.]+)<\/ele>/g)].map((m) => [
  +m[1],
  +m[2],
  +m[3],
]);
if (pts.length < 100) throw new Error(`GPX has only ${pts.length} points with elevation`);
const R = 3958.8;
const rad = (x) => (x * Math.PI) / 180;
const cum = [0];
for (let i = 1; i < pts.length; i++) {
  const [a, b] = [pts[i - 1], pts[i]];
  const h =
    Math.sin(rad(b[0] - a[0]) / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(rad(b[1] - a[1]) / 2) ** 2;
  cum.push(cum[i - 1] + 2 * R * Math.asin(Math.sqrt(h)));
}
const gpxMi = cum.at(-1);
const scale = course.officialMiles / gpxMi;
const profile = [];
let j = 0;
const steps = Math.round(course.officialMiles * 10);
for (let s = 0; s <= steps; s++) {
  const mi = s / 10;
  while (j < cum.length - 1 && cum[j + 1] * scale < mi) j++;
  let sum = 0;
  let n = 0;
  for (let q = Math.max(0, j - 6); q < Math.min(pts.length, j + 7); q++) {
    sum += pts[q][2];
    n++;
  }
  profile.push([mi, Math.round((sum / n) * 3.28084)]);
}

const out = {
  _generated: "by scripts/training/build-training.mjs; edit plan.json or course.json instead",
  asOf,
  start: plan.start,
  race: plan.race,
  phases: plan.phases,
  planSource: plan.source,
  planUpdated: plan.updated,
  weeks,
  actuals,
  ready,
  course: {
    officialMiles: course.officialMiles,
    gainFt: course.gainFt,
    gpxMi: +gpxMi.toFixed(2),
    sections: course.sections,
    aids: course.aids,
    profile,
  },
};
writeFileSync(outPath, `${JSON.stringify(out)}\n`);
const nAct = Object.values(actuals).flat().length;
console.log(
  `training.json: as of ${asOf}, ${nAct} activities on ${Object.keys(actuals).length} days, ${Object.keys(ready).length} readiness mornings, profile ${profile.length} points (GPX ${gpxMi.toFixed(2)} mi)`,
);
