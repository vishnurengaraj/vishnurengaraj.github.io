/**
 * /training: three tabs (This week, Calendar, Road to Cool).
 * Chromium at phone and desktop sizes. Run: npm test
 */
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const data = JSON.parse(readFileSync(new URL("../src/data/training/training.json", import.meta.url), "utf8"));
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "phone", width: 390, height: 844 },
];
const RUN = new Set(["Run", "Trail Run"]);
const fmt1 = (n) => (Math.round(n * 10) / 10).toLocaleString("en-US", { maximumFractionDigits: 1 });
const current = data.weeks.find((w) => w.start <= data.asOf && w.end >= data.asOf) || data.weeks[0];
const weekActs = (w) => w.days.flatMap((d) => data.actuals[d.date] || []);
const weekMiles = (w) => weekActs(w).filter((a) => RUN.has(a.type)).reduce((s, a) => s + a.mi, 0);

function watchErrors(page) {
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  return errors;
}

for (const vp of VIEWPORTS) {
  test.describe(`/training ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("This week is the default tab; tabs switch and deep-link", async ({ page }) => {
      const errors = watchErrors(page);
      await page.goto("/training");
      const tabs = page.getByRole("tab");
      await expect(tabs).toHaveText(["This week", "Calendar", "Road to Cool"]);
      await expect(page.getByRole("tab", { name: "This week" })).toHaveAttribute("aria-selected", "true");
      await expect(page.locator("#panel-week")).toBeVisible();
      await expect(page.locator("#panel-calendar")).toBeHidden();

      await page.getByRole("tab", { name: "Calendar" }).click();
      await expect(page).toHaveURL(/\/training\?tab=calendar$/);
      await expect(page.locator("#panel-calendar")).toBeVisible();
      await expect(page.locator("#panel-week")).toBeHidden();

      await page.getByRole("tab", { name: "Calendar" }).press("ArrowRight");
      await expect(page).toHaveURL(/\?tab=road$/);
      await expect(page.getByRole("tab", { name: "Road to Cool" })).toBeFocused();
      await expect(page.locator("#panel-road")).toBeVisible();

      await page.getByRole("tab", { name: "Road to Cool" }).press("ArrowRight");
      await expect(page).toHaveURL(/\/training$/);
      await expect(page.locator("#panel-week")).toBeVisible();
      expect(errors).toEqual([]);
    });

    for (const [tab, panel] of [
      ["calendar", "#panel-calendar"],
      ["road", "#panel-road"],
      ["week", "#panel-week"],
      ["nonsense", "#panel-week"],
    ]) {
      test(`deep link ?tab=${tab} opens ${panel}, no console errors`, async ({ page }) => {
        const errors = watchErrors(page);
        await page.goto(`/training?tab=${tab}`);
        await expect(page.locator(panel)).toBeVisible();
        await expect(page.locator(`.panel-tab:visible`)).toHaveCount(1);
        await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
        await page.waitForTimeout(300);
        expect(errors).toEqual([]);
      });
    }

    test("This week rings show logged progress against the week's targets", async ({ page }) => {
      await page.goto("/training");
      const card = page.locator("#panel-week .week");
      const mi = weekMiles(current);
      await expect(card.locator(".week-head")).toHaveText(`${fmt1(mi)} of ${current.miles} miles`);
      const miles = card.locator('[data-ring="miles"]');
      await expect(miles.locator(".rv b")).toHaveText(fmt1(mi));
      await expect(miles.locator("svg.ring")).toHaveAttribute("data-frac", Math.min(1, mi / current.miles).toFixed(3));
      const longest = Math.max(0, ...weekActs(current).filter((a) => RUN.has(a.type)).map((a) => a.mi));
      await expect(card.locator('[data-ring="long"] .rv b')).toHaveText(fmt1(longest));
      await expect(card.locator('[data-ring="key"] .rr')).toContainText(`${Math.round(current.vertLo / 3)}+ ft`);
      await expect(card.locator('[data-ring="key"] .rs')).toHaveText(current.key);

      // Pick the peak week from the strip: a future week shows targets, empty rings.
      const peak = data.weeks.reduce((a, b) => (b.miles > a.miles ? b : a));
      await page.locator(`.wkb[data-week="${peak.week}"]`).click();
      await expect(card.locator(".week-head")).toHaveText(`${peak.miles} miles`);
      await expect(card.locator('[data-ring="long"] .rv b')).toHaveText(String(peak.long));
      await expect(card.locator('[data-ring="miles"] .ring-fill')).toHaveCount(0);
    });

    test("This week: moving a session is local and undoable; no missed-day wording", async ({ page }) => {
      await page.goto("/training");
      const future = current.days.find((d) => d.date > data.asOf && d.mi > 0);
      test.skip(!future, "no movable day left this week");
      const target = current.days.find((d) => d.date > data.asOf && d.date !== future.date);
      const from = page.locator(`.dc[data-date="${future.date}"]`);
      await from.locator("select").first().selectOption({ index: current.days.indexOf(target) });
      await expect(page.locator(`.dc[data-date="${target.date}"] .sug.moved`)).toHaveCount(1);
      await page.getByRole("button", { name: "Undo moves" }).click();
      await expect(page.locator(".sug.moved")).toHaveCount(0);
      await expect(page.locator("#panel-week")).not.toContainText(/missed|nothing logged/i);
    });

    test("Calendar: month grid with planned and logged chips", async ({ page }) => {
      const errors = watchErrors(page);
      await page.goto("/training?tab=calendar");
      const cal = page.locator("#panel-calendar");
      const [y, mo] = data.asOf.split("-").map(Number);
      const month = new Date(Date.UTC(y, mo - 1, 1)).toLocaleString("en-US", { month: "long", timeZone: "UTC" });
      await expect(cal.locator("#cal-title")).toHaveText(`${month} ${y}`);
      await expect(cal.locator(`.day[data-date="${data.asOf}"]`)).toHaveClass(/today/);
      for (const [date, list] of Object.entries(data.actuals)) {
        if (!date.startsWith(data.asOf.slice(0, 7))) continue;
        await expect(cal.locator(`.day[data-date="${date}"] .chip.done`)).toContainText(fmt1(list.reduce((s, a) => s + a.mi, 0)));
      }
      await expect(cal.locator(".chip.done")).toHaveCount(
        Object.keys(data.actuals).filter((d) => d.startsWith(data.asOf.slice(0, 7))).length,
      );
      // Race month: the race chip sits on race day.
      await cal.getByRole("button", { name: "Mar", exact: true }).click();
      await expect(cal.locator(`.day[data-date="${data.race.date}"] .chip.race`)).toBeVisible();

      // Readiness overlay toggles the per-day readiness marks.
      await cal.getByRole("button", { name: "Nov", exact: true }).click();
      const withReady = Object.keys(data.ready).filter((d) => d.startsWith(data.asOf.slice(0, 7)));
      await expect(cal.locator(".rd:visible")).toHaveCount(0);
      await cal.getByLabel("Readiness overlay").check();
      await expect(cal.locator(".rd:visible")).toHaveCount(withReady.length);

      // Day detail: the side panel on desktop, a sheet on phones.
      const day = current.days.find((d) => d.role === "Key") || current.days[0];
      await cal.locator(`.day[data-date="${day.date}"]`).click();
      if (vp.width >= 900) {
        await expect(cal.locator("aside .day-detail")).toContainText(day.session);
      } else {
        const sheet = page.locator("dialog.tsheet");
        await expect(sheet).toBeVisible();
        await expect(sheet).toContainText(day.session);
        await sheet.getByRole("button", { name: "Close" }).click();
        await expect(sheet).toBeHidden();
      }
      await expect(cal).not.toContainText(/nothing logged/i);
      expect(errors).toEqual([]);
    });

    test("Course profile: short on This week, scrubbable on Road to Cool", async ({ page }) => {
      const errors = watchErrors(page);
      await page.goto("/training");
      const short = page.locator("#panel-week .profile.compact svg");
      await expect(short).toBeVisible();
      await expect(page.locator("#panel-week .profile .sec-list")).toHaveCount(0);
      await page.getByRole("button", { name: "Full course profile" }).click();
      await expect(page).toHaveURL(/\?tab=road$/);

      const prof = page.locator("#panel-road .profile");
      const svg = prof.locator("svg");
      await expect(svg).toBeVisible();
      await expect(svg).toHaveAttribute("aria-label", /31\.4 miles, 4,799 feet of gain/);
      await expect(prof.locator(".sec-list button")).toHaveCount(data.course.sections.length);
      await svg.scrollIntoViewIfNeeded();
      const box = await svg.boundingBox();
      await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.6);
      await expect(prof.locator(".readout")).toHaveText(/^Mile \d+\.\d · [\d,]+ ft/);
      const goat = data.course.sections.find((s) => s.name === "Goat Hill");
      await prof.getByRole("button", { name: /Goat Hill/ }).click();
      await expect(prof.getByRole("button", { name: /Goat Hill/ })).toHaveAttribute("aria-pressed", "true");
      await expect(prof.locator(".readout")).toContainText("Goat Hill");
      await expect(prof.locator(".readout")).toContainText(`Mile ${((goat.from + goat.to) / 2).toFixed(1)}`);
      await svg.focus();
      await page.keyboard.press("Home");
      await expect(prof.locator(".readout")).toHaveText(/^Mile 0\.0 · /);
      expect(errors).toEqual([]);
    });

    test("Road to Cool: countdown, ladder, and charts", async ({ page }) => {
      const errors = watchErrors(page);
      await page.goto("/training?tab=road");
      const road = page.locator("#panel-road");
      const days = Math.round((Date.parse(`${data.race.date}T00:00:00Z`) - Date.parse(`${data.asOf}T00:00:00Z`)) / 864e5);
      await expect(road.locator(".big")).toHaveText(String(days));
      await expect(road.locator(".ladder li")).toHaveCount(data.weeks.length);
      await expect(road.locator(".ladder li.race .lv")).toContainText(String(data.race.miles));
      await expect(road.locator(".chart-box svg")).toHaveCount(2);
      await road.getByRole("button", { name: "Whole block" }).click();
      const total = data.weeks.reduce((s, w) => s + w.miles, 0);
      await expect(road.locator(".chart-box svg").first()).toContainText(`${total} mi by race week`);
      expect(errors).toEqual([]);
    });

    test("No weight or body-comp data, no IT band", async ({ page }) => {
      for (const tab of ["week", "calendar", "road"]) {
        await page.goto(`/training?tab=${tab}`);
        const text = await page.locator(".training").innerText();
        expect(text).not.toMatch(/\bIT band\b|\bITB\b|iliotibial|body fat|body comp|\bweight\b|\blbs?\b/i);
      }
    });
  });
}
