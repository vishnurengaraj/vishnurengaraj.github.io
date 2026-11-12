/* Formatting and lookups shared by the /training tabs. */
import { weekProgress } from "./progress.js";

export const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SUN_FIRST = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const ms = (iso) => Date.parse(`${iso}T00:00:00Z`);
export function fmtDate(iso) {
  const d = new Date(ms(iso));
  return `${SUN_FIRST[d.getUTCDay()]} ${MON[d.getUTCMonth()]} ${d.getUTCDate()}`;
}
export const monthDay = (iso) => {
  const d = new Date(ms(iso));
  return `${MON[d.getUTCMonth()]} ${d.getUTCDate()}`;
};
export const fmt1 = (n) => (Math.round(n * 10) / 10).toLocaleString("en-US", { maximumFractionDigits: 1 });
export const fmt0 = (n) => Math.round(n).toLocaleString("en-US");
export const roleWord = (r) =>
  ({ Key: "Key", Long: "Long", Race: "Race", Supporting: "Easy", Optional: "Optional", Rest: "Rest" })[r] || r;

export function sleepText(min) {
  if (min == null) return "";
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m`;
}

export function readinessShade(score) {
  return score >= 75 ? "#2d1d7a" : score >= 50 ? "#8b7fc4" : "#d6cfee";
}

export function createModel(data) {
  const { asOf, race } = data;
  const days = data.weeks.flatMap((w) => w.days.map((d) => ({ ...d, week: w.week })));
  const dayByDate = Object.fromEntries(days.map((d) => [d.date, d]));
  const progress = Object.fromEntries(
    data.weeks.map((w) => [
      w.week,
      weekProgress(
        w,
        w.days.map((d) => d.date),
        data.actuals,
        { asOf, raceWeek: w.days.some((d) => d.date === race.date), raceDate: race.date },
      ),
    ]),
  );
  const current = data.weeks.find((w) => progress[w.week].state === "current") || (asOf < data.weeks[0].start ? data.weeks[0] : data.weeks.at(-1));
  const daysToRace = Math.max(0, Math.round((ms(race.date) - ms(asOf)) / 864e5));
  const actual = (date) => {
    const list = data.actuals[date] || [];
    return { list, mi: list.reduce((s, a) => s + (a.mi || 0), 0), ft: list.reduce((s, a) => s + (a.ft || 0), 0) };
  };
  const isRaceWeek = (w) => w.days.some((d) => d.date === race.date);
  function chipText(d) {
    if (d.date === race.date) return `Race ${race.miles}`;
    if (!d.mi) return "Rest";
    let s = `${d.miText} mi`;
    if (d.role === "Key" && /plus \d/i.test(d.session)) s += " + hills";
    else if (d.role === "Key" && /strides/i.test(d.session)) s += " + strides";
    return s;
  }
  /** Which day to name on the key ring: the next Key day, else the last one. */
  function keyDay(w) {
    const keys = w.days.filter((d) => d.role === "Key" && d.date !== race.date);
    if (!keys.length) return null;
    return keys.find((d) => d.date >= asOf) || keys.at(-1);
  }
  return { ...data, days, dayByDate, progress, current, daysToRace, actual, chipText, keyDay, isRaceWeek };
}
export const isoOf = (t) => new Date(t).toISOString().slice(0, 10);
/** "Nov 9–15", or "Nov 30–Dec 6" across months. */
export function rangeText(a, b) {
  const [x, y] = [new Date(ms(a)), new Date(ms(b))];
  return x.getUTCMonth() === y.getUTCMonth() ? `${monthDay(a)}–${y.getUTCDate()}` : `${monthDay(a)}–${monthDay(b)}`;
}
