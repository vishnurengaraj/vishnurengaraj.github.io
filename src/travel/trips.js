/** Read-side helpers for src/data/travel/trips.json. No numbers live here. */

export function tripBySlug(trips, slug) {
  return (trips || []).find((trip) => trip.slug === slug) || null;
}

export function hasTotals(trip, windowId) {
  const range = trip?.totals?.[windowId];
  return !!(range && Number.isFinite(range.low) && Number.isFinite(range.high));
}

export function totalFor(trip, windowId) {
  return hasTotals(trip, windowId) ? trip.totals[windowId] : null;
}

const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function formatUsd(value) {
  return Number.isFinite(value) ? USD.format(value) : "";
}

export function formatRange(range) {
  if (!range || !Number.isFinite(range.low) || !Number.isFinite(range.high)) return "Not priced";
  return `${formatUsd(range.low)}–${formatUsd(range.high)}`;
}

/** Cost rows for one date window. Labels keep the Sheet's estimate wording. */
export function costRows(trip, windowId) {
  if (!hasTotals(trip, windowId)) return [];
  const b = trip.breakdown;
  return [
    {
      key: "lax",
      label: "LAX fare",
      note: trip.drive ? "None, it’s a drive" : "1 person, round trip",
      low: b.flights.lax,
      high: b.flights.lax,
    },
    {
      key: "dtw",
      label: trip.drive ? "DTW–LAX fare" : "DTW fare",
      note: "1 person, round trip",
      low: b.flights.dtw,
      high: b.flights.dtw,
    },
    { key: "buffer", label: "Standard-economy / bag buffer", note: "estimate, HIGH only", low: null, high: b.buffer },
    { key: "lodging", label: "Lodging", note: "7 nights incl. est. tax", ...b.lodging },
    { key: "transport", label: "Car / transport / gas", note: "estimate", ...b.transport },
    { key: "food", label: "Food", note: "2 people, 7 days, estimate", ...b.food },
    { key: "activities", label: "Activities", note: "estimate", ...b.activities },
  ];
}

/** Shortest great-circle arc, as [lng, lat] points, for the line from home. */
export function arc(from, to, steps = 48) {
  const rad = Math.PI / 180;
  const [l1, p1] = [from[0] * rad, from[1] * rad];
  const [l2, p2] = [to[0] * rad, to[1] * rad];
  const d =
    2 *
    Math.asin(
      Math.sqrt(Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin((l2 - l1) / 2) ** 2),
    );
  if (!(d > 1e-9)) return [from, to];
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const a = Math.sin((1 - f) * d) / Math.sin(d);
    const b = Math.sin(f * d) / Math.sin(d);
    const x = a * Math.cos(p1) * Math.cos(l1) + b * Math.cos(p2) * Math.cos(l2);
    const y = a * Math.cos(p1) * Math.sin(l1) + b * Math.cos(p2) * Math.sin(l2);
    const z = a * Math.sin(p1) + b * Math.sin(p2);
    points.push([Math.atan2(y, x) / rad, Math.atan2(z, Math.hypot(x, y)) / rad]);
  }
  return points;
}

export function formatScore(value) {
  return Number.isFinite(value) ? value.toFixed(2) : "";
}

/** Sort by weighted total (default), a category key, or name. */
export function sortTrips(trips, sortKey = "weighted") {
  const list = [...(trips || [])];
  if (sortKey === "name") return list.sort((a, b) => a.name.localeCompare(b.name));
  const scoreOf = (trip) =>
    sortKey === "weighted" || !sortKey ? trip.scores?.weighted : trip.scores?.[sortKey];
  return list.sort((a, b) => {
    const diff = (scoreOf(b) ?? 0) - (scoreOf(a) ?? 0);
    return diff || b.scores.weighted - a.scores.weighted || a.name.localeCompare(b.name);
  });
}
