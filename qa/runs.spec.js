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
      const map = page.locator("#runs-map");
      await expect(map).toHaveAttribute("data-map", "ready", { timeout: 30_000 });
      await expect(map).toHaveAttribute("data-city", "la");
      const regions = page.getByRole("button", { name: "Regions, LA selected" });
      await expect(regions).toBeVisible();
      await expect(regions).toHaveAttribute("aria-expanded", "false");
      await expect(page.getByRole("radio", { name: "SF", exact: true })).toHaveCount(0);
      const globeButton = await page.getByRole("button", { name: "Globe" }).boundingBox();
      const regionBox = await regions.boundingBox();
      expect(regionBox.x).toBeGreaterThan(globeButton.x + globeButton.width - 1);

      await regions.click();
      await expect(regions).toHaveAttribute("aria-expanded", "true");
      const chipLabels = await page.locator(".chips button").allTextContents();
      expect(chipLabels).toContain("LA");
      expect(chipLabels).toContain("SF");
      expect(chipLabels).toContain("Tokyo");
      expect(chipLabels).not.toContain("Away");
      expect(chipLabels.join(" ")).not.toMatch(/away-/);
      const chipBox = await page.locator(".chips").boundingBox();
      expect(chipBox.x).toBeGreaterThanOrEqual(-1);
      expect(chipBox.x + chipBox.width).toBeLessThanOrEqual(viewport.width + 1);
      await expect(page.getByRole("radio", { name: "LA", exact: true })).toHaveAttribute("aria-checked", "true");

      const gap = await page.evaluate(() => {
        const root = document.querySelector(".runs");
        return Math.round(window.innerHeight - root.getBoundingClientRect().bottom);
      });
      expect(gap).toBeLessThanOrEqual(2);
      expect(gap).toBeGreaterThanOrEqual(-2);

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

      await page.getByRole("button", { name: "Regions, SF selected" }).click();
      await page.getByRole("radio", { name: "LA", exact: true }).click();
      await expect(map).toHaveAttribute("data-city", "la");
      await expect(page.getByRole("button", { name: "Regions, LA selected" })).toHaveAttribute("aria-expanded", "false");
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
      const photos = card.locator(".photo-strip img");
      const photoCount = await photos.count();
      for (let i = 0; i < photoCount; i++) {
        await expect(photos.nth(i)).toHaveAttribute("src", /\/media\/runs\/photos\/[^/]+\/\d+\.webp/);
      }

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

  test("deep link opens the Humboldt run", async ({ page }) => {
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
    if (run.photos > 0) {
      await expect(card.locator(".photo-strip img")).toHaveCount(run.photos);
    } else {
      await expect(card.locator(".photo-strip")).toHaveCount(0);
    }
    await expect(page.locator(".section-nav")).toHaveCount(0);
    await expect(page.locator(".sample-tag")).toHaveCount(0);
  });
});

async function clickLngLat(page, map, lngLat) {
  const point = await map.evaluate((el, at) => el._runsMap.project(at), lngLat);
  const box = await map.boundingBox();
  expect(point.x).toBeGreaterThan(8);
  expect(point.y).toBeGreaterThan(8);
  expect(point.x).toBeLessThan(box.width - 8);
  expect(point.y).toBeLessThan(box.height - 8);
  await page.mouse.click(box.x + point.x, box.y + point.y);
  return point;
}

test.describe("globe click reaches one run", () => {
  test.describe.configure({ timeout: 120_000 });

  for (const viewport of VIEWPORTS) {
    test(`${viewport.name} opens the Humboldt run from the globe`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/runs");
      await ready(page);

      const map = page.locator("#runs-map");
      await expect(map).toHaveAttribute("data-map", "ready", { timeout: 30_000 });
      const manifest = await (await page.request.get("/media/runs/manifest.json")).json();
      const city = manifest.cities.find((item) => item.id === "humboldt");
      const run = manifest.runs.find((item) => item.city === "humboldt");
      expect(run.title).toContain("Humboldt");

      await page.getByRole("button", { name: "Globe" }).click();
      await expect(map).toHaveAttribute("data-globe", "on");
      await expect.poll(async () => Number(await map.getAttribute("data-zoom"))).toBeLessThan(3);

      const ocean = await map.evaluate((el) => {
        const width = el.clientWidth;
        const height = el.clientHeight;
        const candidates = [
          [-100, -20],
          [-150, 0],
          [-40, -10],
          [20, -30],
        ];
        for (const lngLat of candidates) {
          const point = el._runsMap.project(lngLat);
          if (point.x < 16 || point.y < 16 || point.x > width - 16 || point.y > height - 16) continue;
          if (el._runsMap.regionAt(lngLat)) continue;
          return { lngLat, point };
        }
        return null;
      });
      expect(ocean).toBeTruthy();
      const globeBox = await map.boundingBox();
      await page.mouse.click(globeBox.x + ocean.point.x, globeBox.y + ocean.point.y);
      await expect(map).toHaveAttribute("data-globe", "on");
      await expect(page.locator(".detail.open")).toHaveCount(0);
      await expect(page.locator(".chooser")).toHaveCount(0);

      await expect
        .poll(async () => map.evaluate((el, lngLat) => el._runsMap.regionAt(lngLat), city.center), { timeout: 15000 })
        .toBe("humboldt");
      await clickLngLat(page, map, city.center);
      await expect(map).toHaveAttribute("data-city", "humboldt");
      await expect(map).toHaveAttribute("data-globe", "off");
      await expect(map).toHaveAttribute("data-runs", "1");
      await expect(page.locator(".detail.open")).toHaveCount(0);

      await expect
        .poll(async () => map.evaluate((el, lngLat) => el._runsMap.hitIds(lngLat), run.mid), { timeout: 15000 })
        .toContain(String(run.id));

      const miss = await map.evaluate((el) => {
        const width = el.clientWidth;
        const height = el.clientHeight;
        const samples = [
          [28, 96],
          [width - 28, 96],
          [28, height * 0.45],
          [width * 0.5, 72],
        ];
        for (const [x, y] of samples) {
          const lngLat = el._runsMap.unproject([x, y]);
          if (el._runsMap.hitIds(lngLat).length === 0) return { x, y };
        }
        return null;
      });
      expect(miss).toBeTruthy();
      const cityBox = await map.boundingBox();
      await page.mouse.click(cityBox.x + miss.x, cityBox.y + miss.y);
      await expect(page.locator(".detail.open")).toHaveCount(0);

      await clickLngLat(page, map, run.mid);
      const card = page.locator(".detail.open");
      await expect(card).toBeVisible();
      await expect(card.locator("h2")).toHaveText("Humboldt Redwoods Marathon");
      await expect(card.locator(".run-type")).toHaveText("Run");
      await expect(card.locator(".run-distance")).toContainText("mi");
      await expect(card.locator(".run-pace")).toContainText("/mi");
      await expect(card.locator(".run-date")).toContainText(/\d{4}/);
      await expect(card.locator(".run-elev")).toContainText("ft");
      await expect(card.locator(".run-companions")).toHaveCount(0);
      await expect(card.locator(".photo-strip img")).toHaveAttribute(
        "src",
        new RegExp(`/media/runs/photos/${run.id}/1\\.webp`),
      );
      await expect(card.locator(".photo-strip img")).toHaveJSProperty("complete", true);

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

    test(`${viewport.name} crowded city click zooms toward routes`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/runs");
      await ready(page);
      const map = page.locator("#runs-map");
      await expect(map).toHaveAttribute("data-map", "ready", { timeout: 30_000 });
      await expect(map).toHaveAttribute("data-city", "la");
      const manifest = await (await page.request.get("/media/runs/manifest.json")).json();
      const la = manifest.cities.find((item) => item.id === "la");
      await expect
        .poll(async () => map.evaluate((el, lngLat) => el._runsMap.hitIds(lngLat).length, la.center), {
          timeout: 15000,
        })
        .toBeGreaterThan(1);
      const before = Number(await map.getAttribute("data-zoom"));
      await clickLngLat(page, map, la.center);
      await expect(page.locator(".detail.open")).toHaveCount(0);
      await expect(page.locator(".chooser")).toHaveCount(0);
      await expect.poll(async () => Number(await map.getAttribute("data-zoom"))).toBeGreaterThan(before + 1.4);
      await expect(map).toHaveAttribute("data-globe", "off");
      await expect(page.getByRole("button", { name: "Globe" })).toBeVisible();
    });
  }
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
      expect(Number.isInteger(run.photos)).toBe(true);
      expect(run.photos).toBeGreaterThanOrEqual(0);
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

test.describe("activity photos", () => {
  for (const viewport of VIEWPORTS) {
    test(`${viewport.name} opens a photo strip for a run that has pictures`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const manifest = await (await page.request.get("/media/runs/manifest.json")).json();
      const run = manifest.runs.find((item) => item.photos > 0);
      expect(run).toBeTruthy();
      const detail = await (await page.request.get(`/media/runs/activities/${run.id}.json`)).json();
      expect(detail.photos).toHaveLength(run.photos);
      expect(detail.photos[0].src).toBe(`/media/runs/photos/${run.id}/1.webp`);
      expect(detail.photos[0].w).toBeGreaterThan(0);
      expect(detail.photos[0].h).toBeGreaterThan(0);
      const image = await page.request.get(detail.photos[0].src);
      expect(image.status()).toBe(200);
      expect(image.headers()["content-type"] || "").toContain("image");

      await page.goto(`/runs?run=${run.id}`);
      await ready(page);
      const card = page.locator(".detail.open");
      await expect(card.locator("h2")).toHaveText(run.title, { timeout: 30_000 });
      const strip = card.locator(".photo-strip");
      await expect(strip.locator("img")).toHaveCount(run.photos);
      await strip.scrollIntoViewIfNeeded();
      await expect(strip).toBeVisible();
      await expect
        .poll(async () => strip.locator("img").first().evaluate((img) => img.naturalWidth))
        .toBeGreaterThan(0);
      const sheet = await card.boundingBox();
      const photos = await strip.boundingBox();
      expect(photos.x).toBeGreaterThanOrEqual(sheet.x - 1);
      expect(photos.x + photos.width).toBeLessThanOrEqual(sheet.x + sheet.width + 1);
    });
  }
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
