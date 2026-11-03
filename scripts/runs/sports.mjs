/** Display names for the sports kept by RUN_TYPES in parse.mjs. */
export const FOOT_SPORTS = ["Run", "Trail Run", "Walk", "Hike"];

/** Map a Strava or FIT sport string onto a foot sport, or null when it is not one. */
export function normalizeSport(type) {
  if (type == null || String(type).trim() === "") return null;
  const text = String(type).trim().toLowerCase().replace(/[_-]+/g, " ");
  if (text.includes("virtual")) return null;
  if (text.includes("trail") && (text.includes("run") || text.includes("running"))) return "Trail Run";
  if (text === "hike" || text === "hiking" || text.includes("hike")) return "Hike";
  if (text === "walk" || text === "walking" || text.endsWith(" walk")) return "Walk";
  if (
    text === "run" ||
    text === "running" ||
    (text.endsWith(" run") && !text.includes("ride") && !text.includes("bike")) ||
    (text.endsWith(" running") && !text.includes("ride") && !text.includes("bike"))
  ) {
    return "Run";
  }
  return null;
}

/** Unknown types are kept so a track named only by its file is not dropped. */
export function isFootSport(type) {
  if (type == null || String(type).trim() === "") return true;
  return normalizeSport(type) != null;
}
