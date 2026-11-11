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
      await expect(page.locator(".site-footer")).toHaveCount(0);
      await expect(page.locator(".trip-pin")).toHaveCount(data.trips.length);
      await expect(page.locator(".rank-list li")).toHaveCount(data.trips.length);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");

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
          const box = await el.boundingBox();
          expect(box.x).toBeGreaterThan(board.x + board.width - 4);
          expect(box.x + box.width).toBeLessThan(viewport.width);
        }
      }

      await openList(page, viewport);
      const first = page.locator('.rank-list [data-slug="big-island"]');
      await expect(first).toBeVisible();
      await expect(first).toContainText(range(trip("big-island").totals.jan5));
      await expect(page.locator('.rank-list [data-slug="puerto-vallarta"]')).toContainText("Level 3 advisory");
    });

    test(`${viewport.name} pin click flies there and opens the card`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/travel");
      await ready(page);

      await page.locator('.trip-pin[data-slug="oaxaca"] .pin-shape').click();
      const card = page.locator(".trip-card.open");
      await expect(card).toBeVisible();
      await expect(card.locator(".card-title")).toHaveText("Oaxaca, Mexico");
      await expect(card.locator(".eyebrow")).toContainText("Ranked #2 of 8");
      await expect(card.locator(".cost-total")).toHaveText(range(trip("oaxaca").totals.jan5));
      await expect(card.locator(".breakdown tbody tr")).toHaveCount(6);
      await expect(card.locator(".breakdown tbody")).toContainText("estimate, HIGH only");
      await expect(card.locator(".itinerary li")).toHaveCount(8);
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
      const pin = await page.locator('.trip-pin[data-slug="oaxaca"]').boundingBox();
      const cardBox = await page.locator(".trip-card").boundingBox();
      if (viewport.name === "desktop") expect(pin.x + pin.width).toBeLessThan(cardBox.x);
      else expect(pin.y + pin.height).toBeLessThan(cardBox.y + 4);
    });

    test(`${viewport.name} date toggle updates every price`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/travel?dest=big-island");
      await ready(page);
      const card = page.locator(".trip-card.open");
      await expect(card.locator(".cost-total")).toHaveText(range(trip("big-island").totals.jan5));
      await expect(card.locator(".breakdown tbody tr").first()).toContainText(usd(trip("big-island").breakdown.flights.jan5));

      await page.locator(".dates label", { hasText: "Jan 2–9" }).click();
      await expect(card.locator(".cost-total")).toHaveText(range(trip("big-island").totals.jan2));
      await expect(card.locator(".breakdown tbody tr").first()).toContainText(usd(trip("big-island").breakdown.flights.jan2));
      await expect(card.locator(".cost-note")).toContainText("Lodging prices are from a Jan 5–12 search");
      await expect(page).toHaveURL(/dest=big-island&dates=jan2$/);
      await page.locator(".close").click();
      await openList(page, viewport);
      for (const slug of ["oaxaca", "tucson", "guanacaste"]) {
        await expect(page.locator(`.rank-list [data-slug="${slug}"]`)).toContainText(range(trip(slug).totals.jan2));
      }
    });
  }

  test("keyboard: ranking list selects, Escape closes and returns focus", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/travel");
    await ready(page);

    const first = page.locator('.rank-list [data-slug="big-island"]');
    await first.focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await expect(page.locator('.rank-list [data-slug="la-paz"]')).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator(".trip-card.open .card-title")).toHaveText("La Paz + Todos Santos, Baja California Sur");
    await expect(page).toHaveURL(/dest=la-paz/);
    await expect(page.locator('.rank-list [data-slug="la-paz"]')).toBeFocused();
    const ring = await page
      .locator('.rank-list [data-slug="la-paz"]')
      .evaluate((el) => parseFloat(getComputedStyle(el).outlineWidth) || 0);
    expect(ring).toBeGreaterThanOrEqual(2);

    await page.keyboard.press("End");
    await page.keyboard.press("Space");
    await expect(page.locator(".trip-card.open .card-title")).toHaveText("Guanacaste, Costa Rica");
    await expect(page.locator(".trip-card.open .itinerary")).toHaveCount(0);

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

  test("shared links: advisory shows and an unknown slug is dropped", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/travel?dest=puerto-vallarta");
    await ready(page);
    const card = page.locator(".trip-card.open");
    await expect(card.locator(".advisory")).toContainText("Level 3 'Reconsider travel'");
    await expect(card.locator(".advisory")).toBeVisible();
    await expect(page.locator('.trip-pin[data-slug="puerto-vallarta"]')).toHaveClass(/warn/);

    await page.goto("/travel?dest=atlantis");
    await ready(page);
    await expect(page).toHaveURL(/\/travel$/);
    await expect(page.locator(".trip-card.open")).toHaveCount(0);
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
      for (const href of hrefs) {
        if (href.startsWith("https://openfreemap.org") || href.includes("openstreetmap.org") || href.includes("openmaptiles.org")) continue;
        expect(allowed.has(href), href).toBe(true);
      }
      await expect(page.locator(".travel form, .travel [type=submit]")).toHaveCount(0);
      await expect(page.getByRole("button", { name: /book|buy|reserve|checkout/i })).toHaveCount(0);
    }
  });
});
