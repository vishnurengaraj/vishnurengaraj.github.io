/**
 * /training key-session rule. Pure function tests; no browser page.
 * Run: npx playwright test qa/training-rules.spec.js --project=chromium
 */
import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { keySession, weekDates, weekProgress } from "../src/training/progress.js";

const week = { vertLo: 300, long: 6 };
const run = (date, mi, ft, type = "Run") => ({ date, type, mi, ft });

test.describe("key session rule", () => {
  test("the long run alone never counts, even at 90%+ of the long-run target with big vert", () => {
    const k = keySession(week, [run("2026-11-14", 6, 900)]);
    expect(k.done).toBe(false);
    expect(k.threshold).toBe(100);
  });

  test("a second run below vertLo / 3 does not count", () => {
    expect(keySession(week, [run("2026-11-14", 6, 800), run("2026-11-12", 5, 99)]).done).toBe(false);
  });

  test("a run other than the longest that climbs vertLo / 3 counts", () => {
    const k = keySession(week, [run("2026-11-14", 6, 0), run("2026-11-12", 5, 100)]);
    expect(k.done).toBe(true);
    expect(k.by.date).toBe("2026-11-12");
  });

  test("the vert has to be on the other run, not the longest", () => {
    expect(keySession(week, [run("2026-11-12", 3, 20), run("2026-11-14", 6, 400)]).done).toBe(false);
  });

  test("two runs tied for longest: one is set aside, the other can count", () => {
    expect(keySession(week, [run("2026-11-12", 6, 150), run("2026-11-14", 6, 150)]).done).toBe(true);
  });

  test("hikes and walks never count as the key session", () => {
    const acts = [run("2026-11-14", 6, 0), run("2026-11-13", 4, 1200, "Hike"), run("2026-11-12", 3, 500, "Walk")];
    expect(keySession(week, acts).done).toBe(false);
  });

  test("race week: done only when a run is logged on race day", () => {
    const opts = { raceWeek: true, raceDate: "2027-03-06" };
    expect(keySession({ vertLo: 4799 }, [run("2027-03-02", 4, 50)], opts).done).toBe(false);
    expect(keySession({ vertLo: 4799 }, [run("2027-03-06", 31.4, 4799)], opts).done).toBe(true);
  });

  test("weekProgress: hikes add vert, not miles; states never say missed", () => {
    const dates = weekDates("2026-11-09", 0);
    const byDate = { "2026-11-10": [run("2026-11-10", 4, 16)], "2026-11-11": [run("2026-11-11", 2, 300, "Hike")] };
    const p = weekProgress({ vertLo: 300 }, dates, byDate, { asOf: "2026-11-11" });
    expect(p.mi).toBe(4);
    expect(p.ft).toBe(316);
    expect(p.longest).toBe(4);
    expect(p.state).toBe("current");
    expect(p.daysLeft).toBe(4);
    for (const asOf of ["2026-11-01", "2026-11-12", "2026-12-30"]) {
      expect(["past", "current", "future"]).toContain(weekProgress({ vertLo: 300 }, dates, {}, { asOf }).state);
    }
  });

  test("built data: every actual comes from a source row, never invented", () => {
    test.skip(!existsSync("/workspace/strava/activities_raw.json"), "Strava source only exists on the build box");
    const data = JSON.parse(readFileSync(new URL("../src/data/training/training.json", import.meta.url), "utf8"));
    const strava = JSON.parse(readFileSync("/workspace/strava/activities_raw.json", "utf8"));
    const ids = new Map(strava.map((a) => [String(a.id), a]));
    for (const [date, list] of Object.entries(data.actuals)) {
      expect(date <= data.asOf).toBe(true);
      for (const a of list) {
        if (a.src !== "Strava") continue;
        const s = ids.get(a.id);
        expect(s, a.id).toBeTruthy();
        expect(a.mi).toBe(s.distance_mi);
        expect(a.ft).toBe(s.elevation_ft);
        expect(a.date).toBe(s.date);
      }
    }
  });
});
