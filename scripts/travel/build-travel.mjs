/**
 * Turn the Sheet snapshot (src/data/travel/sheet/*.csv, exported from
 * "January 2027 Warm-Weather Trip Options") into src/data/travel/trips.json.
 *
 * Every figure and sentence comes from the CSVs. places.json adds only the
 * slug, pin label, map position, and which Sources rows apply.
 *
 * Run: node scripts/travel/build-travel.mjs [--check]
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dollars, parseCsv } from "./csv.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DATA = path.join(ROOT, "src/data/travel");
export const SHEET_URL = "https://docs.google.com/spreadsheets/d/1ryfjLvoGTmf63buDqLxvHFbxLKBbhXAJswBkxhYBb_Q/edit";

function table(name) {
  const rows = parseCsv(readFileSync(path.join(DATA, "sheet", name), "utf8"));
  return { header: rows[0], rows: rows.slice(1) };
}

function splitList(text) {
  return String(text)
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
}

/** "Big Island, Hawaii (Kona 4 nights + Volcano 3 nights)" → name + plan; "…): honorable mention" → tag. */
export function splitDestination(text) {
  const match = /^(.*?)\s*\((.*?)\)(?::\s*(.*))?$/.exec(String(text).trim());
  if (!match) return { name: String(text).trim(), plan: "", tag: "" };
  return { name: match[1].trim(), plan: match[2].trim(), tag: (match[3] || "").trim() };
}

function urlsIn(text) {
  return (String(text).match(/https?:\/\/[^\s;]+/g) || []).filter((url) => !url.includes("<"));
}

/** Sources-tab rows by key. `pick` narrows a multi-link row to one place. */
const SOURCE_RULES = {
  flights: { item: "Google Flights" },
  lodging: { item: "Airbnb search results" },
  noaa: { item: "NOAA 1991-2020" },
  smn: { item: "Mexico Servicio" },
  era5: { item: "Open-Meteo ERA5" },
  "mexico-advisory": { item: "US State Dept Mexico" },
  "costa-rica-advisory": { item: "US State Dept Costa Rica" },
  "hawaii-tax": { item: "Hawaii Dept of Taxation" },
  kilauea: { item: "USGS Kilauea" },
  "havo-fees": { item: "NPS fees", pick: "/havo/" },
  "hale-fees": { item: "NPS fees", pick: "/hale/" },
  kayak: { item: "KAYAK" },
  aaa: { item: "AAA California" },
};

export function buildTrips() {
  const places = JSON.parse(readFileSync(path.join(DATA, "places.json"), "utf8"));
  const ranking = table("ranking.csv");
  const costs = table("cost-breakdown.csv");
  const itin = table("itineraries.csv");
  const sources = table("sources.csv");

  const notesRow = ranking.rows.find((row) => row[0] === "Notes");
  const howRow = costs.rows.find((row) => row[0] === "How to read this");

  const sourceRows = sources.rows.filter((row) => row[0]);
  function source(key) {
    const rule = SOURCE_RULES[key];
    if (!rule) throw new Error(`Unknown source key ${key}`);
    const row = sourceRows.find((r) => r[1].startsWith(rule.item));
    if (!row) throw new Error(`Sources tab has no row for ${key}`);
    let links = urlsIn(row[2]);
    if (rule.pick) links = links.filter((url) => url.includes(rule.pick));
    return { key, section: row[0], title: row[1], detail: row[2], links };
  }

  const dayRows = itin.rows.filter((row) => /^Day \d/.test(row[0]));
  const bookRow = itin.rows.find((row) => row[0] === "Book ahead");

  const trips = places.places.map((place) => {
    const r = ranking.rows.find((row) => row[0] === place.rank);
    if (!r) throw new Error(`Ranking tab has no rank ${place.rank}`);
    const prefix = place.rank === "HM" ? "HM." : `${place.rank}.`;
    const c = costs.rows.find((row) => row[0].startsWith(`${prefix} `));
    if (!c) throw new Error(`Cost breakdown has no row for ${place.rank}`);
    const dest = splitDestination(r[1]);
    const money = (i) => dollars(c[i]);
    const trip = {
      slug: place.slug,
      rank: place.rank,
      short: place.short,
      center: place.center,
      nudge: place.nudge,
      advisoryLevel: place.advisoryLevel || null,
      name: dest.name,
      plan: dest.plan,
      tag: dest.tag,
      sheetName: r[1],
      costLabel: c[0],
      why: r[2],
      hikes: splitList(r[3]),
      museumsFood: r[4],
      weather: r[5],
      travelTime: r[6],
      bestDates: r[11],
      downsides: r[12],
      totals: {
        "jan5": { low: dollars(r[7]), high: dollars(r[8]) },
        "jan2": { low: dollars(r[9]), high: dollars(r[10]) },
      },
      breakdown: {
        flights: { jan5: money(1), jan2: money(2) },
        buffer: money(3),
        lodging: { low: money(4), high: money(5) },
        transport: { low: money(6), high: money(7) },
        food: { low: money(8), high: money(9) },
        activities: { low: money(10), high: money(11) },
        totals: {
          jan5: { low: money(12), high: money(13) },
          jan2: { low: money(14), high: money(15) },
        },
        basis: c[16],
      },
      sources: place.sources.map(source),
      itinerary: null,
    };
    if (place.itineraryColumn) {
      const col = place.itineraryColumn;
      trip.itinerary = {
        heading: itin.header[col],
        days: dayRows.map((row) => ({ day: row[0], plan: row[col] })),
        bookAhead: bookRow ? bookRow[col] : "",
      };
    }
    return trip;
  });

  const method = sourceRows.filter((row) => row[0].startsWith("Method") || row[0].startsWith("QA pass") || row[0] === "Estimates");
  return {
    title: "January 2027 Warm-Weather Trip Options",
    sheetUrl: SHEET_URL,
    asOf: "Nov 11, 2026",
    windows: [
      { id: "jan2", label: "Jan 2–9", sheetLabel: "Jan 2-9" },
      { id: "jan5", label: "Jan 5–12", sheetLabel: "Jan 5-12" },
    ],
    defaultWindow: "jan5",
    columns: {
      flights: { jan5: costs.header[1], jan2: costs.header[2] },
      buffer: costs.header[3],
      lodgingLow: costs.header[4],
      lodgingHigh: costs.header[5],
      transportLow: costs.header[6],
      foodLow: costs.header[8],
      activitiesLow: costs.header[10],
    },
    notes: notesRow ? notesRow[1] : "",
    howToRead: howRow ? howRow[1] : "",
    method: method.map((row) => ({ section: row[0], item: row[1], detail: row[2], links: urlsIn(row[2]) })),
    asOfDetail: sourceRows.find((row) => row[0] === "As-of")?.[2] || "",
    home: places.home,
    trips,
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const out = path.join(DATA, "trips.json");
  const json = `${JSON.stringify(buildTrips(), null, 2)}\n`;
  if (process.argv.includes("--check")) {
    const current = readFileSync(out, "utf8");
    if (current !== json) {
      console.error("trips.json is stale. Run: node scripts/travel/build-travel.mjs");
      process.exit(1);
    }
    console.log("trips.json is current.");
  } else {
    writeFileSync(out, json);
    console.log(`Wrote ${path.relative(ROOT, out)}`);
  }
}
