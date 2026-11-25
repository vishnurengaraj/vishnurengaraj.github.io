/** Display helpers for /housing. */

export const STATUSES = ["new", "contacted", "toured", "rejected", "stale", "off_market"];
export const HIDDEN_STATUSES = new Set(["rejected", "stale", "off_market"]);

export const STATUS_LABELS = {
  new: "New",
  contacted: "Contacted",
  toured: "Toured",
  rejected: "Rejected",
  stale: "Stale",
  off_market: "Off market",
};

const TYPE_LABELS = {
  SINGLE_FAMILY: "House",
  DUPLEX: "Duplex",
  TOWNHOUSE: "Townhouse",
  CONDO: "Condo",
  APARTMENT: "Apartment",
  "APARTMENT BUILDING": "Apartment building",
  MULTI_FAMILY: "Multi-family",
};

/** Preferred chip order; types not in this list follow alphabetically by label. */
export const TYPE_ORDER = [
  "SINGLE_FAMILY",
  "DUPLEX",
  "TOWNHOUSE",
  "CONDO",
  "APARTMENT",
  "APARTMENT BUILDING",
  "MULTI_FAMILY",
];

const UNVERIFIED = new Set(["unknown", "unverified"]);

const BREAKDOWN_LABELS = {
  base: "Base",
  budget: "Budget",
  budget_fit: "Budget fit",
  rent: "Rent",
  walk: "Walk to beach",
  beach: "Walk to beach",
  beach_walk: "Walk to beach",
  walk_to_beach: "Walk to beach",
  drive: "Drive to SpaceX",
  drive_rush: "Rush-hour drive",
  spacex: "Drive to SpaceX",
  spacex_drive: "Drive to SpaceX",
  drive_to_spacex: "Drive to SpaceX",
  type: "Home type",
  home_type: "Home type",
  size: "Size",
  cats: "Cats",
  parking: "Parking",
  verified: "Verified cats/parking",
  unvetted: "Unvetted",
  recency: "Recency",
  recency_boost: "Recency",
  freshness: "Freshness",
};

/** Fresh pin at 0–1 days; site error red at 14 days. Midpoints stay dark enough for white type. */
export const FRESHNESS_GREEN = "#1b7a3c";
export const FRESHNESS_RED = "#b3261e";

export function formatRent(n) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return `$${Number(n).toLocaleString("en-US")}`;
}

export function formatMins(n) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return `${n} min`;
}

export function formatSqft(n) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return `${Number(n).toLocaleString("en-US")} sq ft`;
}

export function formatKm(n) {
  if (n == null || !Number.isFinite(Number(n))) return "";
  const x = Number(n);
  const text = x < 10 ? x.toLocaleString("en-US", { maximumFractionDigits: 1 }) : String(Math.round(x));
  return `${text} km`;
}

export function formatBedsBaths(beds, baths) {
  const b = Number.isFinite(Number(beds)) ? `${beds} bd` : null;
  const a = baths == null || !Number.isFinite(Number(baths)) ? null : `${baths} ba`;
  return [b, a].filter(Boolean).join(" / ") || "—";
}

export function formatType(type) {
  if (!type) return "Home";
  if (TYPE_LABELS[type]) return TYPE_LABELS[type];
  return String(type).replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (ch) => ch.toUpperCase());
}

/** Unique listing types in display order, for filter chips. */
export function typeFilterOptions(list) {
  const present = new Set((list || []).map((row) => row?.type).filter(Boolean));
  const known = TYPE_ORDER.filter((id) => present.has(id));
  const rest = [...present].filter((id) => !TYPE_ORDER.includes(id)).sort((a, b) => formatType(a).localeCompare(formatType(b)));
  return [...known, ...rest].map((id) => ({ id, label: formatType(id) }));
}

/** `2026-11-21T21:42-08:00` → `Nov 21, 2026, 9:42 PM PT`. */
export function formatUpdatedAt(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const text = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
  return `${text} PT`;
}

export function formatSeen(value) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00-08:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

/** Today's calendar date in America/Los_Angeles, YYYY-MM-DD. */
export function todayLA(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(now);
}

function ymdToDayCount(ymd) {
  const match = String(ymd || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86_400_000;
}

/** Days on market from listed_date vs today in PT; falls back to days_on_market. */
export function daysOnMarket(listing, today = todayLA()) {
  const fromDate = ymdToDayCount(listing?.listed_date);
  const todayCount = ymdToDayCount(today);
  if (fromDate != null && todayCount != null) return Math.max(0, Math.round(todayCount - fromDate));
  if (listing?.days_on_market != null && Number.isFinite(Number(listing.days_on_market))) {
    return Math.max(0, Math.round(Number(listing.days_on_market)));
  }
  return null;
}

export function formatListedAgo(days) {
  if (days == null || !Number.isFinite(Number(days))) return "";
  const n = Math.max(0, Math.round(Number(days)));
  if (n <= 0) return "Listed today";
  if (n === 1) return "Listed 1 day ago";
  return `Listed ${n} days ago`;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function hslToHex(h, s, l) {
  const sat = s;
  const light = l;
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = light - c / 2;
  const hex = (v) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

function hexLum(hex) {
  const n = hex.replace("#", "");
  const to = (p) => {
    const v = Number.parseInt(n.slice(p, p + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * to(0) + 0.7152 * to(2) + 0.0722 * to(4);
}

/** Green at 0–1 days, red at maxAge (default 14), gradient between. Null if age is unknown. */
export function freshnessColor(days, maxAge = 14) {
  if (days == null || !Number.isFinite(Number(days))) return null;
  const span = Math.max(1, Number(maxAge) - 1);
  const t = Math.min(1, Math.max(0, (Number(days) - 1) / span));
  if (t === 0) return FRESHNESS_GREEN;
  if (t === 1) return FRESHNESS_RED;
  const mid = 4 * t * (1 - t);
  const h = lerp(142, 3, t);
  const s = lerp(0.64, 0.71, t);
  const l = lerp(0.29, 0.41, t) - 0.05 * mid;
  return hslToHex(h, s, l);
}

export function freshnessInk(bg) {
  if (!bg) return "#fff";
  return hexLum(bg) > 0.32 ? "#1f1f1f" : "#fff";
}

export function isUnverified(value) {
  if (value == null || value === "") return true;
  if (value === true || value === false) return false;
  return UNVERIFIED.has(String(value).trim().toLowerCase());
}

/** Neutral 'Unverified' badge for unknown/unverified; Yes/No for booleans; otherwise the text. */
export function factBadge(value) {
  if (value === true) return { kind: "yes", label: "Yes" };
  if (value === false) return { kind: "no", label: "No" };
  if (isUnverified(value)) return { kind: "unverified", label: "Unverified" };
  return { kind: "text", label: String(value) };
}

export function isHiddenStatus(status) {
  return HIDDEN_STATUSES.has(status);
}

export function compareListings(a, b, key) {
  const unranked = (a.rank == null) - (b.rank == null);
  if (unranked) return unranked;
  const num = (row, field) => {
    const v = row[field];
    return v == null || !Number.isFinite(Number(v)) ? Number.POSITIVE_INFINITY : Number(v);
  };
  switch (key) {
    case "score":
      return b.score - a.score || (a.rank ?? 0) - (b.rank ?? 0);
    case "rent":
      return num(a, "rent_usd") - num(b, "rent_usd") || (a.rank ?? 0) - (b.rank ?? 0);
    case "walk":
      return num(a, "walk_min_to_beach") - num(b, "walk_min_to_beach") || (a.rank ?? 0) - (b.rank ?? 0);
    case "drive":
      return num(a, "drive_min_to_spacex") - num(b, "drive_min_to_spacex") || (a.rank ?? 0) - (b.rank ?? 0);
    case "rank":
    default:
      return (a.rank ?? 0) - (b.rank ?? 0) || b.score - a.score;
  }
}

export function sortListings(list, key) {
  return [...list].sort((a, b) => compareListings(a, b, key));
}

export function filterListings(list, { maxRent = null, maxWalk = null, status = "all", showHidden = false, types = null } = {}) {
  const allowed = types == null ? null : types instanceof Set ? types : new Set(types);
  return list.filter((row) => {
    const hidden = isHiddenStatus(row.status);
    if (hidden && !showHidden) return false;
    if (!hidden && status !== "all" && row.status !== status) return false;
    if (maxRent != null && Number.isFinite(maxRent) && row.rent_usd > maxRent) return false;
    if (maxWalk != null && Number.isFinite(maxWalk)) {
      if (row.walk_min_to_beach == null || row.walk_min_to_beach > maxWalk) return false;
    }
    if (allowed && !allowed.has(row.type)) return false;
    return true;
  });
}

export function criteriaSummary(criteria) {
  if (!criteria || typeof criteria !== "object") return [];
  const lines = [];
  const beds = criteria.beds_min != null ? `${criteria.beds_min} bed` : null;
  const baths = criteria.baths_min != null ? `${criteria.baths_min} bath` : null;
  const size = [beds, baths].filter(Boolean).join(" / ");
  if (size) lines.push(size);
  if (criteria.pets) lines.push(criteria.pets);
  if (criteria.parking) {
    const p = String(criteria.parking);
    lines.push(p.charAt(0).toUpperCase() + p.slice(1));
  }
  if (criteria.walk_to_ocean_max_min != null) {
    lines.push(`${criteria.walk_to_ocean_max_min}-minute walk to the ocean`);
  }
  if (criteria.drive_to_spacex_max_min != null) {
    lines.push(`About ${criteria.drive_to_spacex_max_min}-minute drive to SpaceX`);
  }
  if (criteria.budget_usd != null) {
    lines.push(`${formatRent(criteria.budget_usd)}/month`);
  }
  if (criteria.max_listing_age_days != null) {
    lines.push(`Listed in the last ${criteria.max_listing_age_days} days`);
  }
  return lines;
}

export function criteriaPlaces(criteria) {
  const move = criteria?.move_in ? `Move-in ${criteria.move_in}` : "";
  const areas = Array.isArray(criteria?.areas) && criteria.areas.length ? criteria.areas.join(", ") : "";
  return [move, areas].filter(Boolean).join(" · ");
}

export function breakdownRows(breakdown) {
  if (!breakdown || typeof breakdown !== "object") return [];
  const entries = Array.isArray(breakdown)
    ? breakdown.map((row, i) => [row.label || row.key || String(i), row.points ?? row.value ?? row.score])
    : Object.entries(breakdown);
  return entries
    .map(([key, value]) => ({
      key: String(key),
      label: BREAKDOWN_LABELS[key] || String(key).replaceAll("_", " ").replace(/\b\w/g, (ch) => ch.toUpperCase()),
      value: Number(value),
    }))
    .filter((row) => Number.isFinite(row.value));
}

export function formatPoints(n) {
  if (!Number.isFinite(Number(n))) return "—";
  const v = Number(n);
  const text = Number.isInteger(v) ? String(v) : v.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (v > 0) return `+${text}`;
  return text;
}

export function isHonorable(listing) {
  return Boolean(listing?.honorable_mention);
}

export function honorableMentions(list) {
  return [...(list || []).filter(isHonorable)].sort((a, b) => {
    const ar = a.rank == null;
    const br = b.rank == null;
    if (ar !== br) return ar ? 1 : -1;
    if (!ar && a.rank !== b.rank) return a.rank - b.rank;
    return b.score - a.score;
  });
}

export function formatBeachAccess(value) {
  if (value == null || value === "") return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    return [value.name, value.label, value.title, value.access, value.description].find(Boolean) || "";
  }
  return String(value);
}

export function maxScore(list) {
  const nums = (list || []).map((row) => Number(row.score)).filter((n) => Number.isFinite(n));
  return nums.length ? Math.max(...nums) : 0;
}


export const SPACEX_DIRECTIONS = "SpaceX, 1 Rocket Rd, Hawthorne, CA";

export function walkMapsUrl(listing, beach) {
  if (listing?.lat == null || listing?.lng == null) return "";
  const origin = `${listing.lat},${listing.lng}`;
  const access = String(listing.nearest_beach_access || "").trim();
  const dest = access
    ? access
    : beach?.lat != null && beach?.lng != null
      ? `${beach.lat},${beach.lng}`
      : "Manhattan Beach Pier";
  const params = new URLSearchParams({
    api: "1",
    origin,
    destination: dest,
    travelmode: "walking",
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function driveMapsUrl(listing) {
  if (listing?.lat == null || listing?.lng == null) return "";
  const origin = `${listing.lat},${listing.lng}`;
  const params = new URLSearchParams({
    api: "1",
    origin,
    destination: SPACEX_DIRECTIONS,
    travelmode: "driving",
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function stepLabel(listing, dir = "next") {
  let tag = "—";
  if (listing?.rank != null) tag = `#${listing.rank}`;
  else if (listing?.honorable_mention) tag = "HM";
  return dir === "prev" ? `← ${tag}` : `${tag} →`;
}

export function stepAria(listing, dir = "next") {
  const which = dir === "prev" ? "Previous" : "Next";
  if (!listing) return which;
  const tag = listing.rank != null ? `rank ${listing.rank}` : listing.honorable_mention ? "honorable mention" : "unranked";
  return `${which}: ${listing.address}, ${listing.city} (${tag})`;
}

export function listingPhotos(listing) {
  return Array.isArray(listing?.photos) ? listing.photos.filter((p) => p && (p.src || p.thumb)) : [];
}

export function listingThumb(listing) {
  const first = listingPhotos(listing)[0];
  return first?.thumb || first?.src || "";
}

export function listingNotes(listing) {
  const text = listing?.description_notes;
  if (text == null) return "";
  return String(text).trim();
}

export function listingDescription(listing) {
  const text = listing?.description;
  if (text == null) return "";
  return String(text).trim();
}

/** Split listing copy into paragraphs of plain-text lines. */
export function descriptionParagraphs(text) {
  const raw = String(text ?? "").replace(/\r\n?/g, "\n").trim();
  if (!raw) return [];
  return raw
    .split(/\n[ \t]*\n+/)
    .map((para) => para.split("\n").map((line) => line.trimEnd()))
    .filter((lines) => lines.some(Boolean));
}
