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
 * The long run has its own ring, so it never counts as the key session. Walks
 * never count either. A key session is done when some other run reaches that
 * week's key-session minimum (`keyMin` in plan.json). A week with no minimum
 * falls back to a third of the weekly low vert target (vertLo / 3), and then
 * the longest run is the one set aside. If two runs tie for longest, only one
 * is set aside. Race week is different: its key session is the race, done when
 * a run is logged on race day.
 *
 * @param {{vertLo:number, keyMin?:number, longDate?:string}} week
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
  const hasMin = Number.isFinite(week.keyMin);
  const threshold = hasMin ? week.keyMin : Math.round(week.vertLo / 3);
  const excluded = new Set();
  if (week.longDate) {
    runs.forEach((a, i) => {
      if (a.date === week.longDate) excluded.add(i);
    });
  } else if (runs.length) {
    let longest = 0;
    for (let i = 1; i < runs.length; i++) if (runs[i].mi > runs[longest].mi) longest = i;
    excluded.add(longest);
  }
  const by = runs.find((a, i) => !excluded.has(i) && (a.ft || 0) >= threshold) || null;
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
