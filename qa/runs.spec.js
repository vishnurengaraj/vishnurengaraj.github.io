/**
 * /runs on Chromium and WebKit, phone and desktop.
 * The WebKit project in playwright.config.js matches this file only.
 *
 * Run: npm test
 */
import { expect, test } from "@playwright/test";
import { FOOT_SPORTS, isFootSport } from "../scripts/runs/sports.mjs";

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "phone", width: 390, height: 844 },
];

async function ready(page) {
  await page.waitForFunction(() => document.documentElement.classList.contains("vue-ready"));
}

async function visibleLinks(page, href) {
  return page.locator(`a[href="${href}"]`).evaluateAll((els) =>
    els.filter((el) => {
      let node = el;
      while (node) {
        if (getComputedStyle(node).display === "none") return false;
        node = node.parentElement;
      }
      return true;
    }).length,
  );
}

async function zoomTo(page, target) {
  const map = page.locator("#runs-map");
  const button = page.locator(".maplibregl-ctrl-zoom-in");
  await expect(button).toBeVisible();
  for (let i = 0; i < 8; i++) {
    const zoom = Number(await map.getAttribute("data-zoom"));
    if (zoom >= target) break;
    await button.click();
    await expect
      .poll(async () => Number(await map.getAttribute("data-zoom")), { timeout: 8000 })
      .toBeGreaterThan(zoom + 0.5);
  }
  let previous = -1;
  await expect
    .poll(async () => {
      const zoom = Number(await map.getAttribute("data-zoom"));
      const stable = zoom >= target && Math.abs(zoom - previous) < 0.01;
      previous = zoom;
      return stable;
    })
    .toBe(true);
}

test.describe("runs map", () => {
  test.describe.configure({ timeout: 120_000 });

  for (const viewport of VIEWPORTS) {
    test(`${viewport.name} loads, switches cities, and opens a run`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/runs");
      await ready(page);

      await expect(page.locator(".runs")).toBeVisible();
      await expect(page.locator("h1")).toHaveText("Runs");
      await expect(page.locator(".section-nav")).toHaveCount(0);
      await expect(page.locator(".site-footer")).toHaveCount(0);
      await expect(page.locator(".prlx")).toHaveCount(0);
      await expect(page.locator(".scroll-tail")).toHaveCount(0);
      await expect(page.locator(".sample-tag")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Globe" })).toBeVisible();
      const chipLabels = await page.locator(".chips button").allTextContents();
      expect(chipLabels).toContain("LA");
      expect(chipLabels).toContain("SF");
      expect(chipLabels).toContain("Tokyo");
      expect(chipLabels).not.toContain("Away");
      expect(chipLabels.join(" ")).not.toMatch(/away-/);
      await expect(page.getByRole("radio", { name: "LA", exact: true })).toHaveAttribute("aria-checked", "true");

      const gap = await page.evaluate(() => {
        const root = document.querySelector(".runs");
        return Math.round(window.innerHeight - root.getBoundingClientRect().bottom);
      });
      expect(gap).toBeLessThanOrEqual(2);
      expect(gap).toBeGreaterThanOrEqual(-2);

      const map = page.locator("#runs-map");
      await expect(map).toHaveAttribute("data-map", "ready", { timeout: 30_000 });
      await expect(map).toHaveAttribute("data-city", "la");

      const manifest = await (await page.request.get("/media/runs/manifest.json")).json();
      expect(manifest.sample).toBe(false);
      const sf = manifest.cities.find((city) => city.id === "sf");
      const la = manifest.cities.find((city) => city.id === "la");
      const tokyo = manifest.cities.find((city) => city.id === "tokyo");
      expect(sf.count).not.toBe(la.count);

      await page.getByRole("radio", { name: "Tokyo", exact: true }).click();
      await expect(map).toHaveAttribute("data-city", "tokyo");
      await expect(map).toHaveAttribute("data-runs", String(tokyo.count));
      await expect.poll(async () => Number(await map.getAttribute("data-lng"))).toBeGreaterThan(100);

      await page.getByRole("button", { name: "Globe" }).click();
      await expect(map).toHaveAttribute("data-globe", "on");
      await expect.poll(async () => Number(await map.getAttribute("data-zoom"))).toBeLessThan(3);
      await expect
        .poll(async () => map.evaluate((el, lngLat) => el._runsMap.regionAt(lngLat), sf.center), { timeout: 15000 })
        .toBe("sf");
      const sfPoint = await map.evaluate((el, lngLat) => el._runsMap.project(lngLat), sf.center);
      const globeBox = await map.boundingBox();
      expect(sfPoint.x).toBeGreaterThan(8);
      expect(sfPoint.y).toBeGreaterThan(8);
      expect(sfPoint.x).toBeLessThan(globeBox.width - 8);
      expect(sfPoint.y).toBeLessThan(globeBox.height - 8);
      await page.mouse.click(globeBox.x + sfPoint.x, globeBox.y + sfPoint.y);
      await expect(map).toHaveAttribute("data-city", "sf");
      await expect(map).toHaveAttribute("data-globe", "off");
      await expect(map).toHaveAttribute("data-runs", String(sf.count));
      await expect.poll(async () => Number(await map.getAttribute("data-lng"))).toBeLessThan(-122);

      await page.getByRole("radio", { name: "LA", exact: true }).click();
      await expect(map).toHaveAttribute("data-city", "la");
      await expect(map).toHaveAttribute("data-runs", String(la.count));
      await expect.poll(async () => Number(await map.getAttribute("data-lng"))).toBeGreaterThan(-119);

      await zoomTo(page, 15);
      const probe = manifest.runs.find(
        (run) => run.city === "la" && Math.abs(run.mid[0] + 118.4016) < 0.004 && Math.abs(run.mid[1] - 33.8622) < 0.004,
      ).mid;
      await expect
        .poll(async () => map.evaluate((el, lngLat) => el._runsMap.veinHits(lngLat), probe), { timeout: 15000 })
        .toBeGreaterThan(0);
      const point = await map.evaluate((el, lngLat) => el._runsMap.project(lngLat), probe);
      const box = await map.boundingBox();
      expect(point.x).toBeGreaterThan(8);
      expect(point.y).toBeGreaterThan(8);
      expect(point.x).toBeLessThan(box.width - 8);
      expect(point.y).toBeLessThan(box.height - 8);
      await page.mouse.click(box.x + point.x, box.y + point.y);

      const chooser = page.locator(".chooser");
      const card = page.locator(".detail.open");
      await expect(chooser.or(card)).toBeVisible();
      if (await chooser.isVisible()) {
        const title = (await chooser.locator(".chooser-title").first().innerText()).trim();
        await chooser.getByRole("option").first().click();
        await expect(card.locator("h2")).toHaveText(title);
      }
      await expect(card).toBeVisible();
      await expect(card.locator("h2")).not.toBeEmpty();
      await expect(card.locator(".run-type")).toHaveText(/^(Run|Trail Run|Walk|Hike)$/);
      await expect(card.locator(".run-distance")).toContainText("mi");
      await expect(card.locator(".run-pace")).toContainText("/mi");
      await expect(card.locator(".run-date")).toContainText(/\d{4}/);
      await expect(card.locator(".run-elev")).toContainText("ft");
      await expect(card.locator(".run-companions")).toHaveCount(0);
      await expect(card.locator(".sample-line")).toHaveCount(0);
      await expect(card.locator(".photo-strip")).toHaveCount(0);

      const sheet = await card.boundingBox();
      if (viewport.name === "phone") {
        expect(sheet.y).toBeGreaterThan(viewport.height * 0.15);
        expect(sheet.y + sheet.height).toBeGreaterThan(viewport.height - 8);
        expect(sheet.width).toBeGreaterThan(viewport.width - 4);
      } else {
        expect(sheet.x).toBeGreaterThan(viewport.width * 0.45);
        expect(sheet.y).toBeLessThan(120);
      }
    });
  }

  test("deep link opens a real run without a photo", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1280, height: 900 });
    const manifest = await (await page.request.get("/media/runs/manifest.json")).json();
    const run = manifest.runs.find((item) => item.title.includes("Humboldt"));
    await page.goto(`/runs?run=${run.id}`);
    await ready(page);
    const card = page.locator(".detail.open");
    await expect(card.locator("h2")).toHaveText("Humboldt Redwoods Marathon", { timeout: 30_000 });
    await expect(card.locator(".run-type")).toHaveText("Run");
    await expect(card.locator(".run-distance")).toContainText("mi");
    await expect(card.locator(".run-pace")).toContainText("/mi");
    await expect(card.locator(".photo-strip")).toHaveCount(0);
    await expect(page.locator(".section-nav")).toHaveCount(0);
    await expect(page.locator(".sample-tag")).toHaveCount(0);
  });
});

test.describe("served lines keep the privacy trim", () => {
  test("real routes stay trimmed and foot sports stay on the map", async ({ request }) => {
    const manifest = await (await request.get("/media/runs/manifest.json")).json();
    expect(manifest.privacy.method).toBe("radius");
    expect(manifest.privacy.meters).toBeGreaterThanOrEqual(300);
    expect(manifest.privacy.meters).toBeLessThanOrEqual(500);
    expect(manifest.sample).toBe(false);
    expect(manifest.runs.length).toBeGreaterThan(400);
    expect(manifest.cities.some((city) => city.label === "Away" || city.id.startsWith("away-"))).toBe(false);
    expect(FOOT_SPORTS).toEqual(expect.arrayContaining(["Run", "Trail Run", "Walk", "Hike"]));
    for (const type of FOOT_SPORTS) expect(isFootSport(type)).toBe(true);
    expect(isFootSport("Ride")).toBe(false);
    expect(isFootSport("Virtual Run")).toBe(false);

    const types = new Set(manifest.runs.map((run) => run.type));
    for (const type of ["Run", "Trail Run", "Walk", "Hike"]) expect(types.has(type)).toBe(true);
    for (const run of manifest.runs) {
      expect(FOOT_SPORTS).toContain(run.type);
      expect(String(run.id)).not.toMatch(/^sample-/);
      expect(run.photos).toBe(0);
      expect(run.distanceM).toBeGreaterThan(500);
    }
    for (const type of ["Trail Run", "Walk", "Hike"]) {
      const sample = manifest.runs.find((run) => run.type === type);
      const lines = await (await request.get(`/media/runs/cities/${sample.city}.lines.geojson`)).json();
      const feature = lines.features.find((item) => item.properties.id === sample.id);
      expect(feature).toBeTruthy();
      expect(feature.properties.type).toBe(type);
    }

    for (const city of manifest.cities) {
      const cityLines = await (await request.get(`/media/runs/cities/${city.id}.lines.geojson`)).json();
      expect(cityLines.features.length).toBe(city.count);
    }
    const marathon = manifest.runs.find((run) => run.title.includes("Humboldt"));
    expect(marathon.distanceM).toBeGreaterThan(40000);
  });
});

test.describe("runs stays off the main nav", () => {
  for (const viewport of VIEWPORTS) {
    test(`${viewport.name} links runs from the footer only`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/");
      await ready(page);
      await expect(page.locator(".section-nav")).not.toContainText("Runs");
      await expect(page.locator(".section-nav")).not.toContainText("Diners");
      expect(await visibleLinks(page, "/runs")).toBe(1);
      expect(await visibleLinks(page, "/diners")).toBe(1);
    });
  }
});
