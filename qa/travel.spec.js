/**
 * /travel: January trip options on the /runs globe.
 * Chromium at phone and desktop sizes (see playwright.config.js).
 *
 * Run: npm test
 */
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const data = JSON.parse(readFileSync(new URL("../src/data/travel/trips.json", import.meta.url), "utf8"));
const SHEET = data.sheetUrl;

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "phone", width: 390, height: 844 },
];

const usd = (n) => `$${n.toLocaleString("en-US")}`;
const range = (t) => `${usd(t.low)}–${usd(t.high)}`;
const formatScore = (n) => n.toFixed(2);
const trip = (slug) => data.trips.find((t) => t.slug === slug);

async function ready(page) {
  await page.waitForFunction(() => document.documentElement.classList.contains("vue-ready"));
  await expect(page.locator("#travel-map")).toHaveAttribute("data-map", "ready", { timeout: 30_000 });
}

async function openList(page, viewport) {
  if (viewport.name !== "phone") return;
  const toggle = page.locator(".list-toggle");
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
}

test.describe("travel page", () => {
  test.describe.configure({ timeout: 90_000 });

  for (const viewport of VIEWPORTS) {
    test(`${viewport.name} shows every option as a pin and in the ranking`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/travel");
      await ready(page);

      await expect(page.locator("h1")).toHaveText("January trips");
      await expect(page.locator(".sub")).toContainText("17 trip options, scored");
      await expect(page.locator(".site-footer")).toHaveCount(0);
      await expect(page.locator(".trip-pin")).toHaveCount(data.trips.length);
      await expect(page.locator(".rank-list li")).toHaveCount(data.trips.length);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
      await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /mild weather/);
      await expect(page.locator('meta[name="description"]')).not.toHaveAttribute("content", /warm-weather|hot/i);

      const note = page.locator(".board-foot .asof");
      await expect(note).toBeVisible();
      await expect(note).toContainText("Prices as of Nov 11, 2026; estimates labeled");
      await expect(note.locator("a")).toHaveAttribute("href", SHEET);

      /* At the overview every pin's head is the topmost thing under it, so each one is clickable. */
      const blocked = await page.evaluate(() =>
        [...document.querySelectorAll(".trip-pin")]
          .filter((el) => {
            const r = el.querySelector(".pin-shape").getBoundingClientRect();
            const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height * 0.35);
            return hit?.closest(".trip-pin") !== el;
          })
          .map((el) => el.dataset.slug),
      );
      expect(blocked).toEqual([]);

      /* Pins stay on screen and clear of the side panel at the overview. */
      if (viewport.name === "desktop") {
        const board = await page.locator(".board").boundingBox();
        for (const el of await page.locator(".trip-pin").all()) {
          const box = await el.locator(".pin-shape").boundingBox();
          expect(box.x, await el.getAttribute("data-slug")).toBeGreaterThan(board.x + board.width - 4);
          expect(box.x + box.width).toBeLessThan(viewport.width);
        }
      }

      await openList(page, viewport);
      await expect(page.locator(".list-weights")).toHaveText(data.weightLegend);
      await expect(page.locator("#travel-sort")).toHaveValue("weighted");
      const first = page.locator('.rank-list [data-slug="tucson"]');
      await expect(first).toBeVisible();
      await expect(first).toContainText(range(trip("tucson").totals.jan5));
      await expect(first).toContainText("8.03");
      const items = page.locator(".rank-list [data-slug]");
      await expect(items).toHaveCount(17);
      await expect(items.nth(1)).toHaveAttribute("data-slug", "mexico-city");
      await expect(page.locator('.rank-list [data-slug="puerto-vallarta"]')).toContainText("Level 3 advisory");
      await expect(page.locator('.rank-list [data-slug="joshua-tree"]')).toContainText("drive");
      for (const slug of ["madeira", "hong-kong", "puerto-rico", "taiwan"]) {
        await expect(page.locator(`.trip-pin[data-slug="${slug}"]`)).toHaveCount(1);
        await expect(page.locator(`.rank-list [data-slug="${slug}"]`)).toHaveCount(1);
      }
    });

    test(`${viewport.name} pin click flies there and opens the card`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/travel");
      await ready(page);

      await page.locator('.trip-pin[data-slug="oaxaca"] .pin-shape').click();
      const card = page.locator(".trip-card.open");
      await expect(card).toBeVisible();
      await expect(card.locator(".card-title")).toHaveText("Oaxaca");
      await expect(card.locator(".eyebrow")).toContainText("Ranked #3 of 17");
      await expect(card.locator(".cost-total")).toHaveText(range(trip("oaxaca").totals.jan5));
      await expect(card.locator(".breakdown tbody tr")).toHaveCount(7);
      await expect(card.locator(".breakdown tbody")).toContainText("DTW fare");
      await expect(card.locator(".breakdown tbody")).toContainText("estimate, HIGH only");
      await expect(card.locator(".pay-note")).toContainText("Chase Sapphire Preferred");
      await expect(card.locator(".score")).toHaveText(formatScore(trip("oaxaca").scores.weighted));
      await expect(card.locator(".score-chips li")).toHaveCount(data.weights.categories.length);
      await expect(card.getByText("What a week looks like")).toBeVisible();
      await expect(card).toContainText(trip("oaxaca").week);
      await expect(card.locator(".safety")).toContainText("Level 2");
      await expect(card.locator(".safety")).toContainText("Jalatlaco");
      await expect(card).toContainText("From LAX");
      await expect(card).toContainText("From DTW");
      await expect(card.locator(".sources a").first()).toHaveAttribute("href", /^https:\/\//);
      await expect(page).toHaveURL(/\/travel\?dest=oaxaca$/);
      await expect(page.locator("#travel-map")).toHaveAttribute("data-selected", "oaxaca");
      await expect
        .poll(async () => Math.abs(Number(await page.locator("#travel-map").getAttribute("data-lat")) - 17.07), {
          timeout: 8000,
        })
        .toBeLessThan(3);
      await expect(page.locator('.rank-list [data-slug="oaxaca"]')).toHaveAttribute("aria-current", "true");

      /* Selected pin sits in the open part of the map. */
      const pin = await page.locator('.trip-pin[data-slug="oaxaca"] .pin-shape').boundingBox();
      const cardBox = await page.locator(".trip-card").boundingBox();
      if (viewport.name === "desktop") expect(pin.x + pin.width).toBeLessThan(cardBox.x);
      else expect(pin.y + pin.height).toBeLessThan(cardBox.y + 4);
    });

    test(`${viewport.name} date toggle labels the unpriced Jan 2–9 window`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/travel?dest=mexico-city");
      await ready(page);
      const card = page.locator(".trip-card.open");
      await expect(card.locator(".cost-total")).toHaveText(range(trip("mexico-city").totals.jan5));
      await expect(card.locator(".breakdown tbody tr").first()).toContainText(usd(trip("mexico-city").breakdown.flights.lax));

      await page.locator(".dates label", { hasText: "Jan 2–9" }).click();
      await expect(card.locator(".cost-total")).toHaveText("Not priced");
      await expect(card.locator(".cost-note")).toContainText("no Jan 2–9 fares");
      await expect(card.locator(".breakdown")).toHaveCount(0);
      await expect(page).toHaveURL(/dest=mexico-city&dates=jan2$/);
      await page.locator(".close").click();
      await openList(page, viewport);
      await expect(page.locator(".window-note")).toContainText("priced for Jan 5–12 only");
      for (const slug of ["oaxaca", "tucson", "guanacaste", "hong-kong"]) {
        await expect(page.locator(`.rank-list [data-slug="${slug}"]`)).toContainText("Not priced");
      }
    });
  }

  test("keyboard: ranking list selects, Escape closes and returns focus", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/travel");
    await ready(page);

    const first = page.locator('.rank-list [data-slug="tucson"]');
    await first.focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await expect(page.locator('.rank-list [data-slug="oaxaca"]')).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator(".trip-card.open .card-title")).toHaveText("Oaxaca");
    await expect(page).toHaveURL(/dest=oaxaca/);
    await expect(page.locator('.rank-list [data-slug="oaxaca"]')).toBeFocused();
    const ring = await page
      .locator('.rank-list [data-slug="oaxaca"]')
      .evaluate((el) => parseFloat(getComputedStyle(el).outlineWidth) || 0);
    expect(ring).toBeGreaterThanOrEqual(2);

    await page.keyboard.press("End");
    await page.keyboard.press("Space");
    await expect(page.locator(".trip-card.open .card-title")).toHaveText("Guanacaste, Costa Rica");

    await page.keyboard.press("Escape");
    await expect(page.locator(".trip-card.open")).toHaveCount(0);
    await expect(page).toHaveURL(/\/travel$/);
    await expect(page.locator('.rank-list [data-slug="guanacaste"]')).toBeFocused();
  });

  test("keyboard picks jump the camera, pointer picks fly", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/travel");
    await ready(page);
    const map = page.locator("#travel-map");
    await page.locator('.rank-list [data-slug="tucson"]').focus();
    await page.keyboard.press("Enter");
    await expect
      .poll(async () => Math.abs(Number(await map.getAttribute("data-lat")) - 32.22), { timeout: 400 })
      .toBeLessThan(0.5);

    await page.locator('.rank-list [data-slug="guanacaste"]').click();
    await page.waitForTimeout(150);
    expect(await map.getAttribute("data-moving")).toBe("true");
    await expect
      .poll(async () => Math.abs(Number(await map.getAttribute("data-lat")) - 10.3), { timeout: 6000 })
      .toBeLessThan(0.5);
  });

  test("shared links: advisory shows, old slugs work, and an unknown slug is dropped", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/travel?dest=puerto-vallarta");
    await ready(page);
    const card = page.locator(".trip-card.open");
    await expect(card.locator(".advisory")).toContainText("Level 3");
    await expect(card.locator(".advisory")).toBeVisible();
    await expect(page.locator('.trip-pin[data-slug="puerto-vallarta"]')).toHaveClass(/warn/);

    await page.goto("/travel?dest=mexico-city");
    await ready(page);
    await expect(page.locator(".trip-card.open .card-title")).toHaveText("Mexico City");
    await expect(page.locator(".trip-card.open")).toContainText("La Malinche");
    await expect(page.locator(".trip-card.open")).toContainText("Ajusco dropped");
    await expect(page.locator(".trip-card.open .score")).toHaveText("7.90");

    await page.goto("/travel?dest=atlantis");
    await ready(page);
    await expect(page).toHaveURL(/\/travel$/);
    await expect(page.locator(".trip-card.open")).toHaveCount(0);
  });

  test("sort dropdown reorders the list on desktop and phone", async ({ page }) => {
    for (const viewport of VIEWPORTS) {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/travel");
      await ready(page);
      await openList(page, viewport);
      const items = page.locator(".rank-list [data-slug]");
      await expect(items.nth(0)).toHaveAttribute("data-slug", "tucson");
      await expect(items.nth(1)).toHaveAttribute("data-slug", "mexico-city");
      await page.locator("#travel-sort").selectOption("name");
      const names = (await items.allTextContents()).map((t) => t.trim());
      const firstNames = await items.evaluateAll((els) => els.map((el) => el.dataset.slug));
      expect(firstNames[0]).toBe("andalusia");
      await page.locator("#travel-sort").selectOption("food");
      await expect(items.nth(0)).toHaveAttribute("data-slug", "mexico-city");
      await page.locator("#travel-sort").selectOption("weighted");
      await expect(items.nth(0)).toHaveAttribute("data-slug", "tucson");
      await expect(items.nth(1)).toHaveAttribute("data-slug", "mexico-city");
    }
  });

  test("updated week sketches and safety notes are on the cards", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/travel?dest=mexico-city");
    await ready(page);
    let card = page.locator(".trip-card.open");
    await expect(card).toContainText("Ajusco dropped");
    await expect(card).toContainText("14,600 ft");
    await expect(card).toContainText("4,320 ft");
    await expect(card.locator(".safety")).toContainText("Roma Norte, Condesa, Polanco");
    await expect(card.locator(".safety")).toContainText("Uber or DiDi");

    await page.goto("/travel?dest=naples");
    await ready(page);
    card = page.locator(".trip-card.open");
    await expect(card).toContainText("guided out-and-back");
    await expect(card.locator(".eyebrow")).toContainText("Ranked #6 of 17");

    await page.goto("/travel?dest=andalusia");
    await ready(page);
    card = page.locator(".trip-card.open");
    await expect(card).toContainText("closed Mondays and Jan 11-19");

    await page.goto("/travel?dest=tucson");
    await ready(page);
    card = page.locator(".trip-card.open");
    await expect(card).toContainText("Wasson Peak");
    await expect(card).toContainText("Arizona-Sonora Desert Museum");
    await expect(card.locator(".score")).toHaveText("8.03");

    await page.goto("/travel?dest=joshua-tree");
    await ready(page);
    await expect(page.locator(".trip-card.open")).toContainText("Palm Springs Aerial Tramway");

    await page.goto("/travel?dest=taiwan");
    await ready(page);
    await expect(page.locator(".trip-card.open")).toContainText("Teapot Mountain");
    await expect(page.locator(".trip-card.open")).toContainText("Tainan");
  });

  test("nothing on the page books or buys", async ({ page }) => {
    await page.goto("/travel");
    await ready(page);
    const allowed = new Set([SHEET]);
    for (const t of data.trips) for (const s of t.sources) for (const u of s.links) allowed.add(u);
    for (const m of data.method) for (const u of m.links) allowed.add(u);
    for (const slug of data.trips.map((t) => t.slug)) {
      await page.goto(`/travel?dest=${slug}`);
      await expect(page.locator(".trip-card.open")).toBeVisible();
      const hrefs = await page.locator(".travel a[href]").evaluateAll((els) => els.map((el) => el.href));
      const allowedNorm = new Set([...allowed].map((u) => u.replace(/\/$/, "")));
      for (const href of hrefs) {
        if (href.startsWith("https://openfreemap.org") || href.includes("openstreetmap.org") || href.includes("openmaptiles.org")) continue;
        expect(allowedNorm.has(href.replace(/\/$/, "")), href).toBe(true);
      }
      await expect(page.locator(".travel form, .travel [type=submit]")).toHaveCount(0);
      await expect(page.getByRole("button", { name: /book|buy|reserve|checkout/i })).toHaveCount(0);
    }
  });
});
