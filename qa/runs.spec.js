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
      expect(sf.count).not.toBe(la.count);

      const total = manifest.cities.reduce((sum, city) => sum + city.count, 0);
      await expect(map).toHaveAttribute("data-runs", String(total));
      expect(total).toBeGreaterThan(la.count);

      await page.getByRole("radio", { name: "Tokyo", exact: true }).click();
      await expect(map).toHaveAttribute("data-city", "tokyo");
      await expect(map).toHaveAttribute("data-runs", String(total));
      await expect.poll(async () => Number(await map.getAttribute("data-lng"))).toBeGreaterThan(100);

      await page.getByRole("button", { name: "Regions, Tokyo selected" }).click();
      await page.getByRole("radio", { name: "LA", exact: true }).click();
      await expect(map).toHaveAttribute("data-city", "la");
      await expect(page.getByRole("button", { name: "Regions, LA selected" })).toHaveAttribute("aria-expanded", "false");
      await expect(map).toHaveAttribute("data-runs", String(total));
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

  for (const viewport of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "phone", width: 390, height: 844 },
  ]) {
    test(`${viewport.name} keyboard opens a run and escape returns focus`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/runs");
      await ready(page);

      const description = await page.locator('meta[name="description"]').getAttribute("content");
      expect(description).toBeTruthy();
      expect(description).not.toMatch(/https?:\/\/|vishnu\.rengaraj\.com/);
      expect(description.length).toBeGreaterThan(40);

      const opener = page.getByRole("button", { name: /^Runs in LA \(/ });
      await opener.focus();
      await page.keyboard.press("Enter");
      const chooser = page.locator("#run-chooser");
      await expect(chooser).toBeVisible();
      const option = chooser.getByRole("option").first();
      await expect(option).toBeFocused();
      await page.keyboard.press("Enter");
      const card = page.locator(".detail.open");
      await expect(card).toBeVisible();
      await expect(card.locator("h2")).not.toBeEmpty();
      const labelSize = await card.locator(".stats span").first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      expect(labelSize).toBeGreaterThanOrEqual(12);
      const labelCase = await card.locator(".stats span").first().evaluate((el) => getComputedStyle(el).textTransform);
      expect(labelCase).toBe("none");
      const border = await card.evaluate((el) => getComputedStyle(el).borderLeftWidth);
      expect(parseFloat(border)).toBe(0);

      await page.keyboard.press("Escape");
      await expect(card).toBeHidden();
      await expect(option).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(chooser).toBeHidden();
      await expect(opener).toBeFocused();
    });
  }

  test("phone region chips align to the start of the row", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/runs");
    await ready(page);
    await page.getByRole("button", { name: "Regions, LA selected" }).click();
    const align = await page.locator(".chips").evaluate((el) => getComputedStyle(el).justifyContent);
    expect(align).toBe("flex-start");
    await expect(page.locator(".map-key h1")).toHaveText("Runs");
    await expect(page.locator(".heat-key")).toContainText("activity density");
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

test.describe("one continuous map", () => {
  test.describe.configure({ timeout: 120_000 });

  for (const viewport of VIEWPORTS) {
    test(`${viewport.name} zooms out to the world and into Humboldt`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/runs");
      await ready(page);
      const map = page.locator("#runs-map");
      await expect(map).toHaveAttribute("data-map", "ready", { timeout: 30_000 });
      await expect(map).toHaveAttribute("data-city", "la");
      await expect(page.getByRole("button", { name: "Regions, LA selected" })).toBeVisible();
      const manifest = await (await page.request.get("/media/runs/manifest.json")).json();
      const total = manifest.cities.reduce((sum, city) => sum + city.count, 0);
      await expect(map).toHaveAttribute("data-runs", String(total));
      const humboldt = manifest.cities.find((city) => city.id === "humboldt");
      const whitney = manifest.cities.find((city) => city.id === "whitney");

      await page.getByRole("button", { name: "Globe" }).click();
      await expect.poll(async () => Number(await map.getAttribute("data-zoom"))).toBeLessThan(3);
      await expect(page.getByRole("button", { name: "Globe" })).not.toHaveAttribute("aria-pressed", "true");
      const box = await map.boundingBox();
      for (const city of [humboldt, whitney]) {
        const point = await map.evaluate((el, lngLat) => el._runsMap.project(lngLat), city.center);
        expect(point.x).toBeGreaterThan(-2);
        expect(point.y).toBeGreaterThan(-2);
        expect(point.x).toBeLessThan(box.width + 2);
        expect(point.y).toBeLessThan(box.height + 2);
      }

      const anchored = await map.evaluate((el) => ({
        zoom: Number(el.dataset.zoom),
        lng: Number(el.dataset.lng),
        lat: Number(el.dataset.lat),
      }));
      await page.mouse.move(box.x + box.width * 0.42, box.y + box.height * 0.48);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.22, box.y + box.height * 0.62, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(500);
      const dragged = await map.evaluate((el) => ({
        zoom: Number(el.dataset.zoom),
        lng: Number(el.dataset.lng),
        lat: Number(el.dataset.lat),
      }));
      expect(dragged.zoom).toBeLessThan(4);
      expect(Math.hypot(dragged.lng - anchored.lng, dragged.lat - anchored.lat)).toBeGreaterThan(1);
      await expect(page.locator(".detail.open")).toHaveCount(0);

      await page.getByRole("button", { name: "Globe" }).click();
      await expect.poll(async () => Number(await map.getAttribute("data-zoom"))).toBeLessThan(3);
      const world = await map.boundingBox();
      const point = await map.evaluate((el, lngLat) => el._runsMap.project(lngLat), humboldt.center);
      await page.mouse.move(world.x + point.x, world.y + point.y);
      const worldZoom = Number(await map.getAttribute("data-zoom"));
      await page.mouse.wheel(0, -500);
      await page.mouse.wheel(0, -500);
      await expect.poll(async () => Number(await map.getAttribute("data-zoom"))).toBeGreaterThan(worldZoom + 0.6);
      await expect.poll(async () => Number(await map.getAttribute("data-zoom"))).toBeLessThan(11);
      await expect(page.locator(".detail.open")).toHaveCount(0);

      const run = manifest.runs.find((item) => item.city === "humboldt");
      await map.evaluate((el, center) => el._runsMap.zoomToward(center), run.mid);
      await expect(map).toHaveAttribute("data-city", "humboldt");
      await expect.poll(async () => Number(await map.getAttribute("data-zoom"))).toBeGreaterThan(10);
      await expect.poll(async () => Number(await map.getAttribute("data-lng"))).toBeLessThan(-121);
      await expect(page.getByRole("button", { name: "Regions, Humboldt selected" })).toBeVisible();
      await expect(map).toHaveAttribute("data-runs", String(total));
      await expect
        .poll(async () => map.evaluate((el, lngLat) => el._runsMap.hitIds(lngLat), run.mid), { timeout: 15000 })
        .toContain(String(run.id));
      await clickLngLat(page, map, run.mid);
      const card = page.locator(".detail.open");
      await expect(card.locator("h2")).toHaveText(run.title);
      await expect(card.locator(".run-distance")).toContainText("mi");
      await expect(card.locator(".run-pace")).toContainText("/mi");
    });
  }

  test("phone pinch-out from LA reaches the world without snapping back", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "pinch uses CDP touch events");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/runs");
    await ready(page);
    const map = page.locator("#runs-map");
    await expect(map).toHaveAttribute("data-map", "ready", { timeout: 30_000 });
    await expect(map).toHaveAttribute("data-city", "la");
    await expect.poll(async () => Number(await map.getAttribute("data-zoom"))).toBeGreaterThan(10);

    const client = await page.context().newCDPSession(page);
    async function pinchOut() {
      let left = { x: 40, y: 250, id: 1 };
      let right = { x: 350, y: 620, id: 2 };
      await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [left, right] });
      let lowest = Infinity;
      for (let i = 1; i <= 14; i++) {
        left = { x: 40 + i * 9, y: 250 + i * 10, id: 1 };
        right = { x: 350 - i * 9, y: 620 - i * 10, id: 2 };
        await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [left, right] });
        await page.waitForTimeout(30);
        lowest = Math.min(lowest, Number(await map.getAttribute("data-zoom")));
      }
      const during = Number(await map.getAttribute("data-zoom"));
      await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await page.waitForTimeout(500);
      const after = Number(await map.getAttribute("data-zoom"));
      return { lowest, during, after };
    }

    let zoom = Number(await map.getAttribute("data-zoom"));
    for (let n = 0; n < 8 && zoom > 2.5; n++) {
      const step = await pinchOut();
      expect(step.after).toBeLessThan(zoom - 0.8);
      expect(step.after).toBeLessThanOrEqual(step.lowest + 0.35);
      zoom = step.after;
    }
    expect(zoom).toBeLessThan(2.5);
    await expect(page.locator(".detail.open")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Regions, LA selected" })).toBeVisible();
    const humboldt = await map.evaluate((el) => el._runsMap.project([-124, 40.32]));
    const tokyo = await map.evaluate((el) => el._runsMap.project([139.76, 35.7]));
    const box = await map.boundingBox();
    for (const point of [humboldt, tokyo]) {
      expect(point.x).toBeGreaterThan(0);
      expect(point.y).toBeGreaterThan(0);
      expect(point.x).toBeLessThan(box.width);
      expect(point.y).toBeLessThan(box.height);
    }
    await client.detach();
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

async function plainRuns(page) {
  await expect
    .poll(() => {
      const url = new URL(page.url());
      return url.pathname === "/runs" && !url.searchParams.has("activity") && !url.searchParams.has("run");
    })
    .toBe(true);
}

async function expectFramed(page, run) {
  const map = page.locator("#runs-map");
  const card = page.locator(".detail.open");
  await expect(card.locator("h2")).toHaveText(run.title);
  await expect(map).toHaveAttribute("data-highlight", String(run.id));
  await expect.poll(async () => Number(await map.getAttribute("data-zoom"))).toBeGreaterThanOrEqual(14.5);
  await expect.poll(async () => Number(await map.getAttribute("data-lng"))).toBeCloseTo(run.mid[0], 1);
  await expect.poll(async () => Number(await map.getAttribute("data-lat"))).toBeCloseTo(run.mid[1], 1);
  const point = await map.evaluate((el, lngLat) => el._runsMap.project(lngLat), run.mid);
  const box = await map.boundingBox();
  expect(point.x).toBeGreaterThan(8);
  expect(point.y).toBeGreaterThan(8);
  expect(point.x).toBeLessThan(box.width - 8);
  expect(point.y).toBeLessThan(box.height - 8);
}

test.describe("activity link and share url", () => {
  test.describe.configure({ timeout: 120_000 });

  for (const viewport of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "phone", width: 390, height: 844 },
  ]) {
    test(`${viewport.name} opens a run, reloads that url, and falls back on a bad id`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.addInitScript(() => {
        window.__copied = [];
        window.__shared = [];
        const clipboard = {
          writeText: async (text) => {
            window.__copied.push(text);
          },
        };
        Object.defineProperty(navigator, "clipboard", { configurable: true, value: clipboard });
        navigator.share = async (data) => {
          window.__shared.push(data);
        };
      });
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/runs");
      await ready(page);
      const map = page.locator("#runs-map");
      await expect(map).toHaveAttribute("data-map", "ready", { timeout: 30_000 });

      const manifest = await (await page.request.get("/media/runs/manifest.json")).json();
      const humboldt = manifest.runs.find((run) => run.title.includes("Humboldt"));
      expect(humboldt.stravaId).toBe(humboldt.id);

      await page.getByRole("button", { name: /^Runs in LA \(/ }).click();
      const option = page.locator("#run-chooser").getByRole("option").first();
      const title = (await option.locator(".chooser-title").innerText()).trim();
      const run = manifest.runs.find((item) => item.title === title && item.city === "la");
      await option.click();
      const card = page.locator(".detail.open");
      await expect(card.locator("h2")).toHaveText(title);
      await expect.poll(() => new URL(page.url()).searchParams.get("activity")).toBe(String(run.id));
      await expect(page).toHaveTitle(`${title} · Runs · Vishnu Rengaraj`);

      const strava = card.getByRole("link", { name: "View on Strava" });
      await expect(strava).toHaveAttribute("href", `https://www.strava.com/activities/${run.stravaId}`);
      await expect(strava).toHaveAttribute("target", "_blank");
      await expect(strava).toHaveAttribute("rel", "noopener");
      await expect(strava).toBeVisible();

      await page.keyboard.press("Tab");
      await expect(strava).toBeFocused();
      const linkStyle = await strava.evaluate((el) => {
        const style = getComputedStyle(el);
        return {
          outlineWidth: parseFloat(style.outlineWidth),
          outlineStyle: style.outlineStyle,
          fontSize: parseFloat(style.fontSize),
          textTransform: style.textTransform,
        };
      });
      expect(linkStyle.outlineWidth).toBeGreaterThanOrEqual(3);
      expect(linkStyle.outlineStyle).not.toBe("none");
      expect(linkStyle.fontSize).toBeGreaterThanOrEqual(12);
      expect(linkStyle.textTransform).toBe("none");

      const share = card.getByRole("button", { name: viewport.name === "phone" ? "Share" : "Copy link" });
      await expect(share).toBeVisible();
      const shareStyle = await share.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      expect(shareStyle).toBeGreaterThanOrEqual(12);
      await share.click();
      if (viewport.name === "phone") {
        await expect.poll(() => page.evaluate(() => window.__shared.map((item) => item.url))).toEqual([
          `http://127.0.0.1:5173/runs?activity=${run.id}`,
        ]);
        expect(await page.evaluate(() => window.__copied)).toEqual([]);
      } else {
        await expect(card.getByRole("button", { name: "Copied" })).toBeVisible();
        await expect.poll(() => page.evaluate(() => window.__copied)).toEqual([
          `http://127.0.0.1:5173/runs?activity=${run.id}`,
        ]);
        expect(await page.evaluate(() => window.__shared)).toEqual([]);
      }

      await page.getByRole("button", { name: "Close" }).click();
      await plainRuns(page);
      await expect(page.locator(".detail.open")).toHaveCount(0);
      await page.goForward();
      await expect(card.locator("h2")).toHaveText(title);
      await expect.poll(() => new URL(page.url()).searchParams.get("activity")).toBe(String(run.id));

      await page.reload();
      await ready(page);
      await expect(map).toHaveAttribute("data-map", "ready", { timeout: 30_000 });
      await expectFramed(page, run);
      await expect(page.locator(".detail.open").getByRole("link", { name: "View on Strava" })).toHaveAttribute(
        "href",
        `https://www.strava.com/activities/${run.stravaId}`,
      );

      await page.goBack();
      await plainRuns(page);
      await expect(page.locator(".detail.open")).toHaveCount(0);
      await expect(page).toHaveTitle("Runs · Vishnu Rengaraj");

      await page.goto(`/runs?run=${humboldt.id}`);
      await ready(page);
      await expect(map).toHaveAttribute("data-map", "ready", { timeout: 30_000 });
      await expect.poll(() => new URL(page.url()).searchParams.get("activity")).toBe(String(humboldt.id));
      await expect(page.locator(".detail.open").getByRole("link", { name: "View on Strava" })).toHaveAttribute(
        "href",
        `https://www.strava.com/activities/${humboldt.stravaId}`,
      );
      await expectFramed(page, humboldt);
      await page.getByRole("button", { name: "Close" }).click();
      await plainRuns(page);
      await expect(page.locator(".detail.open")).toHaveCount(0);

      await page.goto("/runs?activity=not-a-real-run");
      await ready(page);
      await expect(map).toHaveAttribute("data-map", "ready", { timeout: 30_000 });
      await plainRuns(page);
      await expect(page.locator(".detail.open")).toHaveCount(0);
      await expect(map).toHaveAttribute("data-city", "la");
      await expect(map).toHaveAttribute("data-highlight", "");
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
