/**
 * Turn the Sheet snapshot (src/data/travel/sheet/*.csv, exported from
 * "January 2027 Warm-Weather Trip Options") into src/data/travel/trips.json.
 *
 * The Worldwide tab is the ranking and the prices. places.json adds only the
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

/** HIGH adds this for standard economy or bags, per the Worldwide how-to-read. */
export const HIGH_BUFFER = 300;

function loadWeights() {
  return JSON.parse(readFileSync(path.join(DATA, "weights.json"), "utf8"));
}

export function parseScore(value) {
  const n = Number(String(value).trim());
  if (!Number.isFinite(n)) throw new Error(`Not a score: ${JSON.stringify(value)}`);
  return n;
}

/** Weighted total, rounded to two decimals, from weights.json shares. */
export function weightedScore(scores, weights) {
  const total = weights.categories.reduce((sum, cat) => sum + scores[cat.key] * cat.share, 0);
  return Math.round(total * 100) / 100;
}

export function weightLegend(weights) {
  return `Weighted = ${weights.categories.map((cat) => `${cat.label} ${Math.round(cat.share * 100)}%`).join(" · ")}`;
}

function scoreTable() {
  const rows = parseCsv(readFileSync(path.join(DATA, "sheet", "scores.csv"), "utf8"));
  const body = rows.filter((row) => /^\d+$/.test(String(row[0] || "").trim()) && row[1]);
  return { legend: rows[0]?.[0] || "", header: rows[1], rows: body };
}

function findByShort(rows, nameCol, place) {
  const short = place.short.toLowerCase();
  const hits = rows.filter((row) => String(row[nameCol] || "").toLowerCase().includes(short));
  if (hits.length !== 1) throw new Error(`Expected one ${place.short} row, found ${hits.length}`);
  return hits[0];
}

function table(name) {
  const rows = parseCsv(readFileSync(path.join(DATA, "sheet", name), "utf8"));
  return { header: rows[0], rows: rows.slice(1) };
}

function urlsIn(text) {
  return (String(text).match(/https?:\/\/[^\s;]+/g) || []).filter((url) => !url.includes("<"));
}

/** Keep Sheet prose, but do not publish a card's last digits. */
export function sanitizePublic(text) {
  return String(text)
    .replace(/\s*\.{2,}\d{3,5}/g, "")
    .replace(/[ \t]{2,}/g, " ");
}

/** "Mexico City (+ La Malinche, Ajusco, Tepoztlan)" → name + plan; "Andalusia: Malaga, Granada, Seville" → name + plan. */
export function splitDestination(text) {
  const raw = String(text).trim();
  const paren = /^(.*?)\s*\((.*?)\)(?::\s*(.*))?$/.exec(raw);
  if (paren) {
    return {
      name: paren[1].trim(),
      plan: paren[2].trim().replace(/^\+\s*/, ""),
      tag: (paren[3] || "").trim(),
    };
  }
  const colon = /^(.*?):\s*(.+)$/.exec(raw);
  if (colon) return { name: colon[1].trim(), plan: colon[2].trim(), tag: "" };
  return { name: raw, plan: "", tag: "" };
}

function advisoryLevel(text) {
  const match = /^Level\s+(\d+)/i.exec(String(text).trim());
  return match ? Number(match[1]) : null;
}

/** Sources-tab rows by key. `pick` narrows a multi-link row to one place. */
const SOURCE_RULES = {
  flights: { item: "Google Flights (queried" },
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
  worldwide: { section: "Sources: Worldwide" },
};

export function buildTrips() {
  const places = JSON.parse(readFileSync(path.join(DATA, "places.json"), "utf8"));
  const weights = loadWeights();
  const shareSum = weights.categories.reduce((sum, cat) => sum + cat.share, 0);
  if (Math.abs(shareSum - 1) > 1e-9) throw new Error(`weights.json shares sum to ${shareSum}, not 1`);
  const worldwide = table("worldwide.csv");
  const sources = table("sources.csv");
  const scoresTab = scoreTable();
  const safetyTab = table("safety.csv");
  const safetyHow = safetyTab.rows.find((row) => row[0] === "How to read");

  const howRow = worldwide.rows.find((row) => row[0] === "How to read");
  const sourceRows = sources.rows.filter((row) => row[0]);
  const asOfRow = sourceRows.find((row) => row[0] === "As-of");

  function source(key) {
    const rule = SOURCE_RULES[key];
    if (!rule) throw new Error(`Unknown source key ${key}`);
    const row = sourceRows.find((r) => (rule.section ? r[0] === rule.section : r[1].startsWith(rule.item)));
    if (!row) throw new Error(`Sources tab has no row for ${key}`);
    let links = urlsIn(row[2]);
    if (rule.pick) links = links.filter((url) => url.includes(rule.pick));
    return { key, section: row[0], title: row[1], detail: sanitizePublic(row[2]), links };
  }

  const trips = places.places.map((place) => {
    const r = worldwide.rows.find((row) => row[0] === place.rank);
    if (!r) throw new Error(`Worldwide tab has no rank ${place.rank}`);
    const scoreRow = findByShort(scoresTab.rows, 1, place);
    const scores = {
      outdoors: parseScore(scoreRow[2]),
      food: parseScore(scoreRow[3]),
      museums: parseScore(scoreRow[4]),
      price: parseScore(scoreRow[5]),
      gettingThere: parseScore(scoreRow[6]),
      safety: parseScore(scoreRow[7]),
    };
    const computed = weightedScore(scores, weights);
    const sheetWeighted = parseScore(scoreRow[8]);
    if (computed !== sheetWeighted) {
      throw new Error(`${place.slug}: computed ${computed} !== Sheet ${sheetWeighted}`);
    }
    scores.weighted = computed;
    const safetyRow = safetyTab.rows.find((row) => row[0] === place.rank && /^\d+$/.test(row[0]));
    const dest = splitDestination(r[1]);
    const laxFare = dollars(r[8]);
    const dtwFare = dollars(r[9]);
    const flightsTotal = dollars(r[10]);
    if (laxFare + dtwFare !== flightsTotal) {
      throw new Error(`${place.slug}: LAX ${laxFare} + DTW ${dtwFare} !== flights ${flightsTotal}`);
    }
    const lodging = { low: dollars(r[11]), high: dollars(r[12]) };
    const transport = { low: dollars(r[13]), high: dollars(r[14]) };
    const food = { low: dollars(r[15]), high: dollars(r[16]) };
    const activities = { low: dollars(r[17]), high: dollars(r[18]) };
    const totals = { low: dollars(r[19]), high: dollars(r[20]) };
    const lowSum = flightsTotal + lodging.low + transport.low + food.low + activities.low;
    const highSum = flightsTotal + HIGH_BUFFER + lodging.high + transport.high + food.high + activities.high;
    if (lowSum !== totals.low) throw new Error(`${place.slug}: low ${lowSum} !== ${totals.low}`);
    if (highSum !== totals.high) throw new Error(`${place.slug}: high ${highSum} !== ${totals.high}`);

    const sheetAdvisory = advisoryLevel(r[7]);
    return {
      slug: place.slug,
      worldwideRank: place.rank,
      short: place.short,
      center: place.center,
      nudge: place.nudge,
      drive: !!place.drive,
      advisoryLevel: place.advisoryLevel || sheetAdvisory,
      name: dest.name,
      plan: dest.plan === "drive" ? "" : dest.plan,
      tag: dest.tag,
      sheetName: r[1],
      why: r[2],
      week: r[3],
      weather: r[4],
      laxFlight: r[5],
      dtwFlight: r[6],
      advisory: r[7],
      downsides: r[7],
      cardPoints: sanitizePublic(r[21] || ""),
      oldRank: r[22] || "",
      scores,
      scoreWhy: scoreRow[12] || "",
      safety: safetyRow
        ? {
            researched: true,
            advisory: safetyRow[2],
            consensus: safetyRow[3],
            risks: safetyRow[4],
            stay: safetyRow[5],
          }
        : {
            researched: false,
            advisory: r[7],
            consensus: "",
            risks: "",
            stay: "",
          },
      totals: {
        jan5: totals,
        jan2: null,
      },
      breakdown: {
        flights: { jan5: flightsTotal, jan2: null, lax: laxFare, dtw: dtwFare },
        buffer: HIGH_BUFFER,
        lodging,
        transport,
        food,
        activities,
        totals: { jan5: totals, jan2: null },
      },
      sources: place.sources.map(source),
    };
  });

  trips.sort((a, b) => b.scores.weighted - a.scores.weighted || a.name.localeCompare(b.name));
  trips.forEach((trip, index) => {
    trip.rank = String(index + 1);
  });

  const method = sourceRows
    .filter((row) => /^(Method|QA pass|Estimates|South America QA|Worldwide QA)/.test(row[0]))
    .map((row) => ({ section: row[0], item: row[1], detail: sanitizePublic(row[2]), links: urlsIn(row[2]) }));

  return {
    title: "January 2027 Warm-Weather Trip Options",
    sheetUrl: SHEET_URL,
    asOf: "Nov 11, 2026",
    criterion: "mild, not freezing or soaked",
    windows: [
      { id: "jan2", label: "Jan 2–9", sheetLabel: "Jan 2-9", priced: false },
      { id: "jan5", label: "Jan 5–12", sheetLabel: "Jan 5-12", priced: true },
    ],
    defaultWindow: "jan5",
    missingWindowNote:
      "The Worldwide ranking was priced for Jan 5–12 only. The Sheet has no Jan 2–9 fares for this ranking.",
    paymentNote:
      "Pay with Chase Sapphire Preferred (no foreign transaction fee). Points estimates come from Credit Max and are unverified.",
    notes:
      "Totals are for 2 people and 7 nights: one LAX round trip plus one DTW round trip. For drive trips, she flies DTW–LAX and they drive the HR-V from Hawthorne.",
    howToRead: howRow ? sanitizePublic(howRow[1]) : "",
    asOfDetail: asOfRow ? sanitizePublic(asOfRow[2]) : "",
    method,
    home: places.home,
    weights,
    weightLegend: weightLegend(weights),
    scoreLegend: scoresTab.legend,
    safetyHowToRead: safetyHow ? sanitizePublic(safetyHow[1]) : "",
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
