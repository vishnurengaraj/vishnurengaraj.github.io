/* /training progress against the plan. Pure functions; the page, the build
   script, and the tests all import these. Nothing here marks a day as missed:
   progress is weekly target completion only. */

export const DAY_MS = 864e5;

/** Activity types that count toward miles, the long run, and the key session. */
export const RUN_TYPES = new Set(["Run", "Trail Run"]);
/** Hikes count toward weekly vert only (the plan treats hiking as vert practice). */
export const VERT_TYPES = new Set(["Run", "Trail Run", "Hike"]);

export const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);
export const dayMs = (iso) => Date.parse(`${iso}T00:00:00Z`);

export function weekDates(start, index) {
  const base = dayMs(start) + index * 7 * DAY_MS;
  return Array.from({ length: 7 }, (_, i) => isoDay(base + i * DAY_MS));
}

/**
 * Key-session rule.
 *
 * Hills cannot be detected from Strava summaries, and the long run already has
 * its own ring, so the long run never counts as the key session. The key
 * session is done when a run OTHER than the week's longest run climbs at least
 * a third of the week's low vert target (vertLo / 3). If two runs tie for
 * longest, only one of them is set aside. Race week is different: its key
 * session is the race, done when a run is logged on race day.
 *
 * @param {{vertLo:number}} week
 * @param {{date:string, type:string, mi:number, ft:number}[]} activities  this week's activities
 * @param {{raceWeek?:boolean, raceDate?:string}} [opts]
 * @returns {{done:boolean, by:object|null, threshold:number|null}}
 */
export function keySession(week, activities, opts = {}) {
  const runs = activities.filter((a) => RUN_TYPES.has(a.type));
  if (opts.raceWeek) {
    const race = runs.find((a) => a.date === opts.raceDate) || null;
    return { done: !!race, by: race, threshold: null };
  }
  const threshold = Math.round(week.vertLo / 3);
  if (runs.length < 2) return { done: false, by: null, threshold };
  let longest = 0;
  for (let i = 1; i < runs.length; i++) if (runs[i].mi > runs[longest].mi) longest = i;
  const by = runs.find((a, i) => i !== longest && (a.ft || 0) >= threshold) || null;
  return { done: !!by, by, threshold };
}

/** Totals for one plan week. `byDate` maps ISO date to activities. */
export function weekProgress(week, dates, byDate, opts = {}) {
  const acts = dates.flatMap((d) => byDate[d] || []);
  const runs = acts.filter((a) => RUN_TYPES.has(a.type));
  const mi = runs.reduce((s, a) => s + (a.mi || 0), 0);
  const ft = acts.filter((a) => VERT_TYPES.has(a.type)).reduce((s, a) => s + (a.ft || 0), 0);
  const longest = runs.reduce((m, a) => Math.max(m, a.mi || 0), 0);
  const key = keySession(week, acts, opts);
  const asOf = opts.asOf || "";
  const state = dates[6] < asOf ? "past" : dates[0] > asOf ? "future" : "current";
  const daysLeft = dates.filter((d) => d > asOf).length;
  return { mi, ft, longest, key, state, daysLeft, count: runs.length };
}
