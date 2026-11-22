/**
 * Build src/data/housing/housing.json for /housing.
 *
 *   node scripts/build-housing.mjs
 *   node scripts/build-housing.mjs --in /workspace/house-hunt/shortlist.json
 *   node scripts/build-housing.mjs --in qa/housing.fixture.json --out src/data/housing/housing.json
 *
 * Reads House Hunter's shortlist (default: /workspace/house-hunt/shortlist.json).
 * That file is owned by another agent — this script only reads it.
 * If the file is missing, the clearly labeled sample at qa/housing.fixture.json
 * is used and a warning is printed.
 *
 * Optional listing fields may be missing, null, "unknown", or "unverified".
 * Extra fields (including zpid) are kept. Schema issues are reported to stderr.
 * The page is rebuilt from the written JSON; the shortlist is not read at runtime.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};

const DEFAULT_IN = "/workspace/house-hunt/shortlist.json";
const FIXTURE = path.join(ROOT, "qa/housing.fixture.json");
const DEFAULT_OUT = path.join(ROOT, "src/data/housing/housing.json");

const STATUSES = new Set(["new", "contacted", "toured", "rejected", "stale", "off_market"]);
const UNVERIFIED = new Set(["unknown", "unverified"]);

const SPACEX = {
  id: "spacex",
  label: "SpaceX",
  address: "1 Rocket Rd, Hawthorne, CA 90250",
  lat: 33.9207,
  lng: -118.328,
};
const BEACH = {
  id: "beach",
  label: "Manhattan Beach Pier",
  note: "Walk times are to the nearest sand, not this pier.",
  // OSM way 49605324 (man_made=pier), landward (eastmost) node 630795162.
  // The pier meets land at Manhattan Beach Blvd / The Strand.
  lat: 33.8842043,
  lng: -118.4121426,
};

const issues = [];
const warn = (msg) => {
  issues.push(msg);
  console.error(`housing: ${msg}`);
};

function slugPart(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function listingId(row, index) {
  if (row.zpid != null && String(row.zpid).trim() !== "") return String(row.zpid);
  const slug = [slugPart(row.address), slugPart(row.city)].filter(Boolean).join("-");
  if (slug) return slug;
  if (Number.isFinite(Number(row.rank))) return `rank-${row.rank}`;
  return `listing-${index + 1}`;
}

function isNum(v) {
  return typeof v === "number" && Number.isFinite(v);
}

function optNum(v, field, id) {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) {
    warn(`${id}: ${field} is not a number (${JSON.stringify(v)}); treating as missing`);
    return null;
  }
  return n;
}

function optStr(v) {
  if (v == null) return "";
  return String(v);
}

function triageUnknown(v) {
  if (v === true || v === false) return v;
  if (v == null || v === "") return "unknown";
  if (typeof v === "string" && UNVERIFIED.has(v.toLowerCase().trim())) return "unknown";
  return v;
}

function normalizeCriteria(raw) {
  const c = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    warn("criteria is missing or not an object; using an empty criteria object");
  }
  return { ...c };
}


function listedDate(value, id) {
  if (value == null || value === "") return null;
  const text = String(value);
  if (!/^\d{4}-\d{2}-\d{2}/.test(text)) {
    warn(`${id}: listed_date is not YYYY-MM-DD (${JSON.stringify(value)}); treating as missing`);
    return null;
  }
  return text.slice(0, 10);
}


function beachAccess(value) {
  if (value == null || value === "") return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const label = value.name || value.label || value.title || value.access || value.description || "";
    return String(label);
  }
  return String(value);
}

function scoreBreakdown(value, id) {
  if (value == null || value === "") return null;
  if (typeof value === "object") return value;
  warn(`${id}: score_breakdown is not an object; dropping`);
  return null;
}

function normalizeListing(row, index) {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    warn(`listings[${index}] is not an object; skipped`);
    return null;
  }
  const id = listingId(row, index);
  const required = {
    score: row.score,
    address: row.address,
    city: row.city,
    lat: row.lat,
    lng: row.lng,
    rent_usd: row.rent_usd,
    beds: row.beds,
    type: row.type,
    url: row.url,
    status: row.status,
    first_seen: row.first_seen,
  };
  for (const [key, value] of Object.entries(required)) {
    if (value == null || value === "") {
      warn(`${id}: missing required field ${key}; skipped`);
      return null;
    }
  }
  if (!isNum(row.lat) || !isNum(row.lng)) {
    warn(`${id}: lat/lng must be finite numbers; skipped`);
    return null;
  }
  if (row.lat < 32 || row.lat > 35 || row.lng > -117 || row.lng < -120) {
    warn(`${id}: lat/lng ${row.lat},${row.lng} looks outside the South Bay; kept`);
  }
  const rank = row.rank == null || row.rank === "" ? null : optNum(row.rank, "rank", id);
  if (row.rank != null && row.rank !== "" && rank == null) return null;
  const score = optNum(row.score, "score", id);
  const rent = optNum(row.rent_usd, "rent_usd", id);
  const beds = optNum(row.beds, "beds", id);
  if (score == null || rent == null || beds == null) return null;
  const status = String(row.status).toLowerCase();
  if (!STATUSES.has(status)) warn(`${id}: unexpected status ${JSON.stringify(row.status)}; kept`);
  const url = String(row.url);
  if (!/^https:\/\/(www\.)?zillow\.com\//i.test(url)) {
    warn(`${id}: url is not a zillow.com https link; kept`);
  }

  const listing = {
    id,
    rank,
    score,
    address: String(row.address),
    city: String(row.city),
    lat: row.lat,
    lng: row.lng,
    rent_usd: rent,
    beds,
    baths: optNum(row.baths, "baths", id),
    sqft: optNum(row.sqft, "sqft", id),
    type: String(row.type),
    url,
    walk_min_to_beach: optNum(row.walk_min_to_beach, "walk_min_to_beach", id),
    drive_min_to_spacex: optNum(row.drive_min_to_spacex, "drive_min_to_spacex", id),
    cats_ok: triageUnknown(row.cats_ok),
    parking: row.parking == null || row.parking === "" ? "unknown" : row.parking,
    garage: triageUnknown(row.garage),
    yard: row.yard == null || row.yard === "" ? "unknown" : String(row.yard),
    notes: optStr(row.notes),
    status,
    first_seen: String(row.first_seen),
    days_on_market: optNum(row.days_on_market, "days_on_market", id),
    listed_date: listedDate(row.listed_date, id),
    recency_boost: optNum(row.recency_boost, "recency_boost", id),
    walk_km_to_beach: optNum(row.walk_km_to_beach, "walk_km_to_beach", id),
    drive_km_to_spacex: optNum(row.drive_km_to_spacex, "drive_km_to_spacex", id),
    drive_min_to_spacex_rush: optNum(row.drive_min_to_spacex_rush, "drive_min_to_spacex_rush", id),
    score_breakdown: scoreBreakdown(row.score_breakdown, id),
    nearest_beach_access: beachAccess(row.nearest_beach_access),
    honorable_mention: Boolean(row.honorable_mention),
    honorable_mention_reason: optStr(row.honorable_mention_reason),
  };
  if (row.zpid != null && String(row.zpid).trim() !== "") listing.zpid = String(row.zpid);
  else listing.zpid = null;
  for (const [key, value] of Object.entries(row)) {
    if (!(key in listing)) listing[key] = value;
  }
  return listing;
}


const PHOTO_ROOT = "/workspace/house-hunt";
const DEFAULT_MEDIA = path.join(ROOT, "public/media/housing");

function photoFolder(relPath, fallback) {
  const parts = String(relPath || "")
    .replaceAll("\\", "/")
    .split("/")
    .filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 2];
  return fallback;
}

function resolvePhoto(relPath) {
  const root = path.resolve(PHOTO_ROOT);
  const abs = path.resolve(root, String(relPath));
  if (abs !== root && !abs.startsWith(root + path.sep)) return null;
  return abs;
}

async function convertPhoto(abs, destDir, base) {
  mkdirSync(destDir, { recursive: true });
  const webpPath = path.join(destDir, `${base}.webp`);
  const thumbPath = path.join(destDir, `${base}.thumb.webp`);
  const image = sharp(abs, { failOn: "none" }).rotate();
  const full = await image
    .clone()
    .resize({ width: 800, height: 800, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 78 })
    .toFile(webpPath);
  await image
    .clone()
    .resize({ width: 400, height: 400, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 72 })
    .toFile(thumbPath);
  return { webpPath, thumbPath, width: full.width, height: full.height };
}

async function processPhotos(listings, mediaDir) {
  const used = new Set();
  let converted = 0;
  let missing = 0;
  for (const listing of listings) {
    delete listing.source_path;
    const paths = Array.isArray(listing.photos) ? listing.photos.filter(Boolean).map(String) : [];
    const sources = Array.isArray(listing.photo_source_urls) ? listing.photo_source_urls.map(String) : [];
    const fallback = listing.photo_source_url ? String(listing.photo_source_url) : "";
    const out = [];
    for (let i = 0; i < paths.length; i++) {
      const rel = paths[i];
      const abs = resolvePhoto(rel);
      if (!abs || !existsSync(abs)) {
        warn(`${listing.id}: photo missing at ${rel}; skipped`);
        missing += 1;
        continue;
      }
      const key = photoFolder(rel, listing.id);
      const base = path.basename(rel, path.extname(rel)) || String(i + 1);
      used.add(key);
      try {
        const done = await convertPhoto(abs, path.join(mediaDir, key), base);
        const photo = {
          src: `/media/housing/${key}/${base}.webp`,
          thumb: `/media/housing/${key}/${base}.thumb.webp`,
          w: done.width,
          h: done.height,
        };
        const source = sources[i] || fallback;
        if (source) photo.source = source;
        out.push(photo);
        converted += 1;
      } catch (error) {
        warn(`${listing.id}: failed to convert ${rel}: ${error.message}`);
        missing += 1;
      }
    }
    listing.photos = out;
  }
  if (used.size && existsSync(mediaDir)) {
    for (const name of readdirSync(mediaDir)) {
      if (!used.has(name)) rmSync(path.join(mediaDir, name), { recursive: true, force: true });
    }
  }
  return { converted, missing };
}

function isFixturePath(p) {
  return path.resolve(p) === path.resolve(FIXTURE);
}

function readSource() {
  const requested = flag("in", DEFAULT_IN);
  if (existsSync(requested)) {
    return { path: requested, usedFixture: isFixturePath(requested), raw: readFileSync(requested, "utf8") };
  }
  warn(`source not found at ${requested}; using sample fixture ${FIXTURE}`);
  if (!existsSync(FIXTURE)) {
    throw new Error(`housing: no shortlist at ${requested} and fixture missing at ${FIXTURE}`);
  }
  return { path: FIXTURE, usedFixture: true, raw: readFileSync(FIXTURE, "utf8") };
}

async function main() {
  const source = readSource();
  let parsed;
  try {
    parsed = JSON.parse(source.raw);
  } catch (error) {
    throw new Error(`housing: cannot parse ${source.path}: ${error.message}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`housing: ${source.path} must be an object with listings`);
  }

  const listingsIn = Array.isArray(parsed.listings) ? parsed.listings : null;
  if (!listingsIn) throw new Error(`housing: ${source.path} is missing a listings array`);

  const listings = [];
  const ids = new Set();
  for (let i = 0; i < listingsIn.length; i++) {
    const row = normalizeListing(listingsIn[i], i);
    if (!row) continue;
    if (ids.has(row.id)) {
      warn(`${row.id}: duplicate id; suffixing`);
      row.id = `${row.id}-${row.rank ?? i + 1}`;
    }
    ids.add(row.id);
    listings.push(row);
  }
  if (!listings.length) throw new Error("housing: no valid listings after validation");

  listings.sort((a, b) => {
    const ar = a.rank == null;
    const br = b.rank == null;
    if (ar !== br) return ar ? 1 : -1;
    if (!ar && a.rank !== b.rank) return a.rank - b.rank;
    return b.score - a.score;
  });
  const ranks = listings.map((l) => l.rank).filter((r) => r != null);
  if (new Set(ranks).size !== ranks.length) warn("listing ranks are not unique");

  const updatedAt = typeof parsed.updated_at === "string" && parsed.updated_at ? parsed.updated_at : null;
  if (!updatedAt) warn("updated_at is missing; the page will omit a precise time");

  const scoringNotes = typeof parsed.scoring_notes === "string" ? parsed.scoring_notes : parsed.scoring_notes == null ? "" : String(parsed.scoring_notes);

  const mediaDir = flag("media", DEFAULT_MEDIA);
  const photos = await processPhotos(listings, mediaDir);

  const out = {
    updated_at: updatedAt,
    source: source.usedFixture ? "fixture" : "shortlist",
    criteria: normalizeCriteria(parsed.criteria),
    scoring_notes: scoringNotes,
    landmarks: { beach: BEACH, spacex: SPACEX },
    listings,
  };

  const outPath = flag("out", DEFAULT_OUT);
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`);
  const rejected = listings.filter((l) => l.status === "rejected").length;
  const stale = listings.filter((l) => l.status === "stale").length;
  const offMarket = listings.filter((l) => l.status === "off_market").length;
  const unranked = listings.filter((l) => l.rank == null).length;
  const mentions = listings.filter((l) => l.honorable_mention).length;
  const open = listings.length - rejected - stale - offMarket;
  const photoNote = photos.converted || photos.missing ? `; ${photos.converted} photos` + (photos.missing ? `, ${photos.missing} missing` : "") : "";
  console.log(
    `housing: wrote ${listings.length} listings (${open} open, ${rejected} rejected, ${stale} stale, ${offMarket} off-market, ${unranked} unranked, ${mentions} honorable mentions) from ${source.path} → ${path.relative(ROOT, outPath)}${
      source.usedFixture ? " (SAMPLE FIXTURE)" : ""
    }${photoNote}${issues.length ? `; ${issues.length} schema note(s)` : ""}`,
  );
}

await main();
