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
      await expect(chooser).toBeHidden();
      await expect(card.locator("h2")).not.toBeEmpty();
      const labelSize = await card.locator(".stats span").first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      expect(labelSize).toBeGreaterThanOrEqual(12);
      const labelCase = await card.locator(".stats span").first().evaluate((el) => getComputedStyle(el).textTransform);
      expect(labelCase).toBe("none");
      const border = await card.evaluate((el) => getComputedStyle(el).borderLeftWidth);
      expect(parseFloat(border)).toBe(0);

      await page.keyboard.press("Escape");
      await expect(card).toBeHidden();
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
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/runs");
    await ready(page);
    const map = page.locator("#runs-map");
    await expect(map).toHaveAttribute("data-map", "ready", { timeout: 30_000 });
    await expect
      .poll(async () => {
        const intro = await map.getAttribute("data-intro");
        if (intro !== "done" && intro !== "skipped") return 0;
        return Number(await map.getAttribute("data-zoom"));
      }, { timeout: 25_000 })
      .toBeGreaterThan(10);
    await expect(map).toHaveAttribute("data-city", "la");

    const client = await page.context().newCDPSession(page);
    const humboldtAt = [-124, 40.32];
    const tokyoAt = [139.76, 35.7];

    async function frame() {
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    }

    /* Pitch eases only after the fingers lift, and the globe matrix updates
       a frame later. Both move the projected points without a zoom change. */
    async function waitForCamera() {
      await page.evaluate(() => {
        window.__runsCamKey = "";
        window.__runsCamAt = 0;
      });
      await page.waitForFunction(
        ({ humboldtAt, tokyoAt }) => {
          const el = document.querySelector("#runs-map");
          const api = el?._runsMap;
          if (!api) return false;
          const humboldt = api.project(humboldtAt);
          const tokyo = api.project(tokyoAt);
          const key = [
            el.dataset.zoom,
            el.dataset.lng,
            el.dataset.lat,
            humboldt.x.toFixed(1),
            humboldt.y.toFixed(1),
            tokyo.x.toFixed(1),
            tokyo.y.toFixed(1),
          ].join("|");
          const now = performance.now();
          if (key !== window.__runsCamKey) {
            window.__runsCamKey = key;
            window.__runsCamAt = now;
            return false;
          }
          return now - window.__runsCamAt >= 200;
        },
        { humboldtAt, tokyoAt },
        { timeout: 8000 },
      );
    }

    async function pinchOut() {
      let left = { x: 40, y: 250, id: 1 };
      let right = { x: 350, y: 620, id: 2 };
      await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [left, right] });
      let lowest = Infinity;
      for (let i = 1; i <= 14; i++) {
        left = { x: 40 + i * 9, y: 250 + i * 10, id: 1 };
        right = { x: 350 - i * 9, y: 620 - i * 10, id: 2 };
        await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [left, right] });
        await frame();
        lowest = Math.min(lowest, Number(await map.getAttribute("data-zoom")));
      }
      const during = Number(await map.getAttribute("data-zoom"));
      await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await waitForCamera();
      const after = Number(await map.getAttribute("data-zoom"));
      return { lowest, during, after };
    }

    async function worldInView() {
      const box = await map.boundingBox();
      const points = await map.evaluate(
        (el, at) => [el._runsMap.project(at[0]), el._runsMap.project(at[1])],
        [humboldtAt, tokyoAt],
      );
      return points.every(
        (point) => point.x > 0 && point.y > 0 && point.x < box.width && point.y < box.height,
      );
    }

    let zoom = Number(await map.getAttribute("data-zoom"));
    let framed = false;
    for (let n = 0; n < 10 && !framed; n++) {
      const step = await pinchOut();
      expect(step.after).toBeLessThan(zoom - 0.8);
      expect(step.after).toBeLessThanOrEqual(step.lowest + 0.35);
      zoom = step.after;
      framed = zoom < 2.5 && (await worldInView());
    }
    expect(zoom).toBeLessThan(2.5);
    await expect(page.locator(".detail.open")).toHaveCount(0);
    const placed = await map.evaluate((el) => {
      const point = el._runsMap.project([Number(el.dataset.lng), Number(el.dataset.lat)]);
      return { dx: point.x - el.clientWidth / 2, dy: point.y - el.clientHeight / 2 };
    });
    expect(Math.abs(placed.dx)).toBeLessThan(24);
    expect(Math.abs(placed.dy)).toBeLessThan(24);
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

function northUp(bearing) {
  const wrapped = ((Number(bearing) % 360) + 360) % 360;
  return Math.min(wrapped, 360 - wrapped);
}

function sampleCoords(geometry) {
  const all = [];
  const visit = (coords) => {
    if (!coords) return;
    if (typeof coords[0] === "number") {
      all.push([coords[0], coords[1]]);
      return;
    }
    for (const child of coords) visit(child);
  };
  visit(geometry?.coordinates);
  if (!all.length) return [];
  let west = all[0];
  let east = all[0];
  let south = all[0];
  let north = all[0];
  for (const point of all) {
    if (point[0] < west[0]) west = point;
    if (point[0] > east[0]) east = point;
    if (point[1] < south[1]) south = point;
    if (point[1] > north[1]) north = point;
  }
  const step = Math.max(1, Math.floor(all.length / 60));
  const sample = [west, east, south, north];
  for (let i = 0; i < all.length; i += step) sample.push(all[i]);
  return sample;
}

async function routeSample(page, run) {
  const lines = await (await page.request.get(`/media/runs/cities/${run.city}.lines.geojson`)).json();
  const feature = lines.features.find((item) => String(item.properties.id) === String(run.id));
  expect(feature).toBeTruthy();
  return sampleCoords(feature.geometry);
}

/** Whole route inside the map area the drawer and top controls do not cover. Pitch is flat and north is up. */
async function expectRouteInView(page, run) {
  const map = page.locator("#runs-map");
  const card = page.locator(".detail.open");
  await expect(card.locator("h2")).toHaveText(run.title);
  await expect(map).toHaveAttribute("data-highlight", String(run.id));
  const sample = await routeSample(page, run);
  await expect
    .poll(async () => {
      const pitch = Number(await map.getAttribute("data-pitch"));
      const bearing = northUp(await map.getAttribute("data-bearing"));
      if (!(pitch < 1) || !(bearing < 1.5)) return `pose ${pitch} ${bearing}`;
      return map.evaluate((el, coords) => {
        const mapRect = el.getBoundingClientRect();
        const phone = window.matchMedia("(max-width: 640px)").matches;
        let top = 0;
        for (const node of document.querySelectorAll(".globe-btn, .run-index, .regions-toggle")) {
          top = Math.max(top, node.getBoundingClientRect().bottom - mapRect.top);
        }
        const drawer = document.querySelector(".detail.open");
        let bottom = mapRect.height;
        let right = mapRect.width;
        if (drawer) {
          const box = drawer.getBoundingClientRect();
          if (phone) bottom = box.top - mapRect.top;
          else right = box.left - mapRect.left;
        }
        const legend = document.querySelector(".map-key");
        if (legend) {
          const box = legend.getBoundingClientRect();
          const legendTop = box.top - mapRect.top;
          if (legendTop < bottom - 1 && box.left - mapRect.left < right - 1) bottom = Math.min(bottom, legendTop);
        }
        const slack = 4;
        let outside = 0;
        let worst = null;
        for (const lngLat of coords) {
          const point = el._runsMap.project(lngLat);
          const bad =
            point.x < slack ||
            point.y < top + slack ||
            point.x > right - slack ||
            point.y > bottom - slack;
          if (bad) {
            outside += 1;
            worst = { x: Math.round(point.x), y: Math.round(point.y), top, right, bottom };
          }
        }
        return outside === 0 ? "ok" : `outside ${outside} ${JSON.stringify(worst)}`;
      }, sample);
    }, { timeout: 15000 })
    .toBe("ok");
}

async function expectFramed(page, run) {
  await expectRouteInView(page, run);
}

async function expectGlobeCentered(page) {
  const map = page.locator("#runs-map");
  await expect.poll(async () => Number(await map.getAttribute("data-zoom"))).toBeLessThan(3);
  await expect.poll(async () => Number(await map.getAttribute("data-pitch"))).toBeLessThan(1);
  await expect(map).toHaveAttribute("data-pad", "0,0,0,0");
  const placed = await map.evaluate((el) => {
    const point = el._runsMap.project([Number(el.dataset.lng), Number(el.dataset.lat)]);
    return { dx: point.x - el.clientWidth / 2, dy: point.y - el.clientHeight / 2 };
  });
  expect(Math.abs(placed.dx)).toBeLessThan(24);
  expect(Math.abs(placed.dy)).toBeLessThan(24);
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

test.describe("open run frames the whole route", () => {
  test.describe.configure({ timeout: 120_000 });

  for (const viewport of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "phone", width: 390, height: 844 },
  ]) {
    test(`${viewport.name} fits a route from the map, the list, and a shared url, then recenters the globe`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/runs");
      await ready(page);
      const map = page.locator("#runs-map");
      await expect(map).toHaveAttribute("data-map", "ready", { timeout: 30_000 });

      if (viewport.name === "phone") {
        const zoomOut = page.locator(".maplibregl-ctrl-zoom-out");
        for (let i = 0; i < 14; i++) {
          const zoom = Number(await map.getAttribute("data-zoom"));
          if (zoom < 3) break;
          await zoomOut.click();
          await expect
            .poll(async () => Number(await map.getAttribute("data-zoom")), { timeout: 8000 })
            .toBeLessThan(zoom - 0.4);
        }
      } else {
        await page.getByRole("button", { name: "Globe" }).click();
      }
      await expectGlobeCentered(page);

      const manifest = await (await page.request.get("/media/runs/manifest.json")).json();
      const sonoma = manifest.runs.find((run) => run.title === "Lake Sonoma Marathon");
      const tiny = manifest.runs.find((run) => run.title === "Zion Sunset Overlook");
      expect(sonoma.city).toBe("sonoma");
      expect(tiny.distanceM).toBeLessThan(3000);

      await page.goto(`/runs?activity=${sonoma.id}`);
      await ready(page);
      await expect(map).toHaveAttribute("data-map", "ready", { timeout: 30_000 });
      await expectRouteInView(page, sonoma);
      await expect.poll(async () => Number(await map.getAttribute("data-zoom"))).toBeLessThan(14.75);
      await expect.poll(async () => Number(await map.getAttribute("data-zoom"))).toBeGreaterThan(9);
      const openPad = (await map.getAttribute("data-pad")).split(",").map(Number);
      if (viewport.name === "phone") expect(openPad[2]).toBeGreaterThan(160);
      else expect(openPad[1]).toBeGreaterThan(280);
      await expect(page.locator(".detail.open").getByRole("link", { name: "View on Strava" })).toHaveAttribute(
        "href",
        `https://www.strava.com/activities/${sonoma.stravaId}`,
      );

      const beforeClose = await map.evaluate((el, lngLat) => el._runsMap.project(lngLat), sonoma.mid);
      await page.getByRole("button", { name: "Close" }).click();
      await expect(page.locator(".detail.open")).toHaveCount(0);
      await expect(map).toHaveAttribute("data-highlight", "");
      await expect(map).toHaveAttribute("data-pad", "0,0,0,0");
      const afterClose = await map.evaluate((el, lngLat) => el._runsMap.project(lngLat), sonoma.mid);
      expect(Math.hypot(afterClose.x - beforeClose.x, afterClose.y - beforeClose.y)).toBeLessThan(8);

      await page.getByRole("button", { name: "Globe" }).click();
      await expectGlobeCentered(page);

      await page.getByRole("button", { name: /Regions, / }).click();
      await page.getByRole("radio", { name: "Sonoma", exact: true }).click();
      await expect(map).toHaveAttribute("data-city", "sonoma");
      await page.getByRole("button", { name: /^Runs in Sonoma \(/ }).click();
      await page.locator("#run-chooser").getByRole("option", { name: /Lake Sonoma Marathon/ }).click();
      await expectRouteInView(page, sonoma);
      await page.keyboard.press("Escape");
      await expect(page.locator(".detail.open")).toHaveCount(0);
      await page.keyboard.press("Escape");
      await expect(page.locator("#run-chooser")).toHaveCount(0);

      await page.getByRole("button", { name: /Regions, / }).click();
      await page.getByRole("radio", { name: "Sonoma", exact: true }).click();
      await expect
        .poll(async () => map.evaluate((el, lngLat) => el._runsMap.hitIds(lngLat), sonoma.mid), { timeout: 15000 })
        .toContain(String(sonoma.id));
      await clickLngLat(page, map, sonoma.mid);
      await expectRouteInView(page, sonoma);
      await page.getByRole("button", { name: "Close" }).click();
      await expect(map).toHaveAttribute("data-pad", "0,0,0,0");

      await page.goto(`/runs?activity=${tiny.id}`);
      await ready(page);
      await expect(map).toHaveAttribute("data-map", "ready", { timeout: 30_000 });
      await expectRouteInView(page, tiny);
      const tinyZoom = Number(await map.getAttribute("data-zoom"));
      expect(tinyZoom).toBeLessThanOrEqual(15.05);
      expect(tinyZoom).toBeGreaterThan(14.5);
    });
  }
});

test.describe("globe arrival", () => {
  test.describe.configure({ timeout: 120_000 });

  for (const viewport of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "phone", width: 390, height: 844 },
  ]) {
    test(`${viewport.name} starts on a flat globe and settles on tilted LA once`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/runs");
      await ready(page);
      const recorded = recordArrival(page);
      const map = page.locator("#runs-map");
      await expect(map).toHaveAttribute("data-map", "ready", { timeout: 30_000 });
      const samples = await recorded;
      const playAt = samples.findIndex((sample) => sample.intro === "playing");
      const holdAt = samples.findIndex(
        (sample, index) =>
          index < playAt &&
          sample.intro === "globe" &&
          /^(ready|failed|timeout)$/.test(sample.warm) &&
          sample.zoom < 3 &&
          sample.pitch < 1 &&
          !sample.hidden &&
          sample.tiles > 0,
      );
      expect(holdAt, JSON.stringify(samples.filter((sample) => sample.intro === "globe").slice(-4))).toBeGreaterThanOrEqual(0);
      const playing = samples.filter((sample) => sample.intro === "playing");
      expect(playing.length).toBeGreaterThanOrEqual(3);
      const approach = approachSample(playing);
      expect(approach, JSON.stringify(playing.slice(0, 12))).toBeTruthy();
      expect(approach.lng).toBeLessThan(-112);
      expect(approach.pitch).toBeGreaterThan(8);
      expect(approach.pitch).toBeLessThan(50);
      const turned = playing.find((sample) => sample.lng < -112);
      expect(turned.zoom).toBeLessThan(8);
      const leaned = playing.find((sample) => sample.pitch > 20);
      expect(leaned.zoom).toBeGreaterThan(4);
      expect(leaned.zoom).toBeLessThan(11);
      for (let i = 1; i < playing.length; i++) {
        expect(playing[i].zoom).toBeGreaterThan(playing[i - 1].zoom - 0.45);
      }
      await expect(map).toHaveAttribute("data-pad", "0,0,0,0");
      await expect.poll(async () => Number(await map.getAttribute("data-runs"))).toBeGreaterThan(100);
      const placed = await map.evaluate((el) => {
        const point = el._runsMap.project([Number(el.dataset.lng), Number(el.dataset.lat)]);
        return { dx: point.x - el.clientWidth / 2, dy: point.y - el.clientHeight / 2 };
      });
      expect(Math.abs(placed.dx)).toBeLessThan(24);
      expect(Math.abs(placed.dy)).toBeLessThan(24);
      await expect(map).toHaveAttribute("data-city", "la");
      const zoom = Number(await map.getAttribute("data-zoom"));
      const pitch = Number(await map.getAttribute("data-pitch"));
      const bearing = Math.abs(Number(await map.getAttribute("data-bearing")));
      expect(zoom).toBeGreaterThan(11);
      expect(pitch).toBeGreaterThan(45);
      expect(pitch).toBeLessThan(70);
      expect(bearing).toBeGreaterThan(10);
      expect(bearing).toBeLessThan(30);
      const settledAt = Date.now();
      await expect
        .poll(
          async () => {
            const pitchNow = Number(await map.getAttribute("data-pitch"));
            const zoomNow = Number(await map.getAttribute("data-zoom"));
            if (Math.abs(pitchNow - pitch) > 0.4 || Math.abs(zoomNow - zoom) > 0.05) return "moved";
            return Date.now() - settledAt > 1000 ? "steady" : "waiting";
          },
          { timeout: 4000, intervals: [150] },
        )
        .toBe("steady");
      await expect(map).toHaveAttribute("data-intro", "done");
    });

    test(`${viewport.name} drops the arrival on a drag or a region choice and does not resume`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/runs");
      await ready(page);
      const map = page.locator("#runs-map");
      const held = await page.evaluate(
        () =>
          new Promise((resolve) => {
            const map = document.querySelector("#runs-map");
            const started = performance.now();
            const id = window.setInterval(() => {
              const warm = map.dataset.warm || "";
              const hidden = map.querySelector("canvas")?.style.visibility === "hidden";
              const zoom = Number(map.dataset.zoom);
              const pitch = Number(map.dataset.pitch);
              if (
                map.dataset.intro === "globe" &&
                /^(ready|failed|timeout)$/.test(warm) &&
                !hidden &&
                zoom < 3 &&
                pitch < 1
              ) {
                window.clearInterval(id);
                resolve("holding");
                return;
              }
              if (performance.now() - started > 20000) {
                window.clearInterval(id);
                resolve(map.dataset.intro || "timeout");
              }
            }, 20);
          }),
      );
      expect(held).toBe("holding");
      const box = await map.boundingBox();
      await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.45);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.6, { steps: 8 });
      await page.mouse.up();
      await expect(map).toHaveAttribute("data-intro", "done");
      const droppedZoom = Number(await map.getAttribute("data-zoom"));
      const droppedAt = Date.now();
      await expect
        .poll(
          async () => {
            const zoomNow = Number(await map.getAttribute("data-zoom"));
            if (zoomNow > droppedZoom + 0.6) return "flew";
            return Date.now() - droppedAt > 1200 ? "held" : "waiting";
          },
          { timeout: 4000, intervals: [150] },
        )
        .toBe("held");

      await page.goto("/runs");
      await ready(page);
      await expect(map).toHaveAttribute("data-map", "ready", { timeout: 30_000 });
      await expect(map).toHaveAttribute("data-intro", "globe");
      await page.getByRole("button", { name: /Regions, / }).click();
      const sf = page.getByRole("radio", { name: "SF", exact: true });
      await sf.scrollIntoViewIfNeeded();
      await sf.click();
      await expect(map).toHaveAttribute("data-city", "sf", { timeout: 15_000 });
      await expect.poll(async () => Number(await map.getAttribute("data-lng")), { timeout: 15_000 }).toBeLessThan(-120);
      await expect(map).toHaveAttribute("data-intro", "done");
      const sfZoom = Number(await map.getAttribute("data-zoom"));
      const sfAt = Date.now();
      await expect
        .poll(
          async () => {
            const city = await map.getAttribute("data-city");
            const lng = Number(await map.getAttribute("data-lng"));
            const zoomNow = Number(await map.getAttribute("data-zoom"));
            if (city !== "sf" || lng >= -120 || zoomNow < sfZoom - 0.4) return "left";
            return Date.now() - sfAt > 1200 ? "held" : "waiting";
          },
          { timeout: 5000, intervals: [150] },
        )
        .toBe("held");
    });
  }

  test("a shared activity and a legacy run link skip the globe", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const manifest = await (await page.request.get("/media/runs/manifest.json")).json();
    const sonoma = manifest.runs.find((run) => run.title === "Lake Sonoma Marathon");
    await page.goto(`/runs?activity=${sonoma.id}`);
    await ready(page);
    const map = page.locator("#runs-map");
    await expect(map).toHaveAttribute("data-map", "ready", { timeout: 30_000 });
    await expect(map).toHaveAttribute("data-intro", "skipped");
    await expect(map).toHaveAttribute("data-warm", "skipped");
    await expectRouteInView(page, sonoma);
    expect(Number(await map.getAttribute("data-zoom"))).toBeGreaterThan(8);

    const humboldt = manifest.runs.find((run) => run.title.includes("Humboldt"));
    await page.goto(`/runs?run=${humboldt.id}`);
    await ready(page);
    await expect(map).toHaveAttribute("data-map", "ready", { timeout: 30_000 });
    await expect(map).toHaveAttribute("data-intro", "skipped");
    await expectRouteInView(page, humboldt);
    await expect(page.locator(".detail.open h2")).toHaveText(humboldt.title);
  });

  test("reduced motion opens on tilted LA with no flight", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/runs");
    await ready(page);
    const map = page.locator("#runs-map");
    await expect(map).toHaveAttribute("data-map", "ready", { timeout: 30_000 });
    await expect(map).toHaveAttribute("data-intro", "skipped");
    await expect(map).toHaveAttribute("data-warm", "skipped");
    await expect(map).toHaveAttribute("data-city", "la");
    expect(Number(await map.getAttribute("data-zoom"))).toBeGreaterThan(10);
    expect(Number(await map.getAttribute("data-pitch"))).toBeGreaterThan(45);
    const openedAt = Date.now();
    await expect
      .poll(
        async () => {
          const zoomNow = Number(await map.getAttribute("data-zoom"));
          const intro = await map.getAttribute("data-intro");
          if (zoomNow <= 10 || intro !== "skipped") return "flew";
          return Date.now() - openedAt > 700 ? "held" : "waiting";
        },
        { timeout: 3000, intervals: [100] },
      )
      .toBe("held");
  });

  test("a failed tile load still leaves the globe and finishes the flight", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/runs");
    await ready(page);
    const map = page.locator("#runs-map");
    /* Abort only after the style has loaded. Aborting planet tiles from the
       first request can stop the style load itself, which is a different failure. */
    await expect(map).toHaveAttribute("data-globe", "shown", { timeout: 30_000 });
    await page.route(/\/planet\/[^?]+\.pbf(\?|$)/, (route) => route.abort());
    await expect(map).toHaveAttribute("data-intro", "done", { timeout: 30_000 });
    const hidden = await map.evaluate((el) => el.querySelector("canvas")?.style.visibility || "");
    expect(hidden).not.toBe("hidden");
    expect(Number(await map.getAttribute("data-zoom"))).toBeGreaterThan(10);
  });

  for (const viewport of [
    { name: "desktop", width: 1440, height: 900, bound: 4500 },
    { name: "phone", width: 390, height: 844, bound: 4000 },
  ]) {
    test(`${viewport.name} shows the globe before the LA tiles finish`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
      const page = await context.newPage();
      await page.addInitScript(() => {
        window.__nav = performance.now();
        window.__hid = false;
      });
      await page.goto("http://127.0.0.1:5173/runs", { waitUntil: "commit" });
      await page.evaluate(() => {
        const watch = () => {
          const map = document.querySelector("#runs-map");
          if (!map) {
            requestAnimationFrame(watch);
            return;
          }
          const note = () => {
            const canvas = map.querySelector("canvas");
            if (canvas && canvas.style.visibility === "hidden") window.__hid = true;
          };
          note();
          new MutationObserver(note).observe(map, { attributes: true, subtree: true, attributeFilter: ["style"] });
        };
        watch();
      });
      await page.waitForFunction(() => document.querySelector("#runs-map")?.dataset.globe === "shown", null, {
        timeout: 15000,
      });
      const elapsed = await page.evaluate(() => performance.now() - window.__nav);
      const hidden = await page.evaluate(() => window.__hid);
      expect(hidden).toBe(false);
      expect(elapsed).toBeLessThan(viewport.bound);
      const map = page.locator("#runs-map");
      expect(Number(await map.getAttribute("data-zoom"))).toBeLessThan(3);
      expect(Number(await map.getAttribute("data-pitch"))).toBeLessThan(1);
      await context.close();
    });
  }

  test("dice, escape, and a region during preload leave a visible map", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/runs");
    await ready(page);
    const manifest = await (await page.request.get("/media/runs/manifest.json")).json();
    await page.getByRole("button", { name: "Open a random activity" }).click();
    const map = page.locator("#runs-map");
    await expect(map).toHaveAttribute("data-map", "ready", { timeout: 30_000 });
    const hidden = await map.evaluate((el) => el.querySelector("canvas")?.style.visibility || "");
    expect(hidden).not.toBe("hidden");
    await expect(map).toHaveAttribute("data-intro", "done");
    await expect.poll(() => new URL(page.url()).searchParams.get("activity")).toBeTruthy();
    const id = new URL(page.url()).searchParams.get("activity");
    const run = manifest.runs.find((item) => String(item.id) === id);
    await expectRouteInView(page, run);
    const openedAt = Date.now();
    await expect
      .poll(
        async () => {
          const intro = await map.getAttribute("data-intro");
          const pitch = Number(await map.getAttribute("data-pitch"));
          const vis = await map.evaluate((el) => el.querySelector("canvas")?.style.visibility || "");
          if (intro !== "done" || pitch > 1.5 || vis === "hidden") return "snapped";
          return Date.now() - openedAt > 1200 ? "held" : "waiting";
        },
        { timeout: 5000, intervals: [150] },
      )
      .toBe("held");

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/runs");
    await ready(page);
    await expect(map).toHaveAttribute("data-intro", "globe");
    await page.getByRole("button", { name: "Globe" }).focus();
    await page.keyboard.press("Escape");
    await expect(map).toHaveAttribute("data-intro", "done");
    const escapeHidden = await map.evaluate((el) => el.querySelector("canvas")?.style.visibility || "");
    expect(escapeHidden).not.toBe("hidden");
    const escapeZoom = Number(await map.getAttribute("data-zoom"));
    expect(escapeZoom).toBeLessThan(3);
    const escapeAt = Date.now();
    await expect
      .poll(
        async () => {
          const zoomNow = Number(await map.getAttribute("data-zoom"));
          if (zoomNow > escapeZoom + 0.6) return "flew";
          return Date.now() - escapeAt > 1000 ? "held" : "waiting";
        },
        { timeout: 4000, intervals: [100] },
      )
      .toBe("held");

    await page.goto("/runs");
    await ready(page);
    await expect(map).toHaveAttribute("data-map", "ready", { timeout: 30_000 });
    await expect(map).toHaveAttribute("data-intro", "globe");
    await page.getByRole("button", { name: /Regions, / }).click();
    const sf = page.getByRole("radio", { name: "SF", exact: true });
    await sf.scrollIntoViewIfNeeded();
    await sf.click();
    await expect(map).toHaveAttribute("data-city", "sf", { timeout: 15_000 });
    const regionHidden = await map.evaluate((el) => el.querySelector("canvas")?.style.visibility || "");
    expect(regionHidden).not.toBe("hidden");
    await expect.poll(async () => Number(await map.getAttribute("data-lng")), { timeout: 15_000 }).toBeLessThan(-120);
    const sfZoom = Number(await map.getAttribute("data-zoom"));
    const sfAt = Date.now();
    await expect
      .poll(
        async () => {
          const zoomNow = Number(await map.getAttribute("data-zoom"));
          const lng = Number(await map.getAttribute("data-lng"));
          const vis = await map.evaluate((el) => el.querySelector("canvas")?.style.visibility || "");
          if (vis === "hidden" || lng >= -120 || zoomNow < sfZoom - 0.5) return "snapped";
          return Date.now() - sfAt > 1000 ? "held" : "waiting";
        },
        { timeout: 4000, intervals: [100] },
      )
      .toBe("held");
  });
});

/* A stalled frame can skip zoom 4.5–8.5 entirely. The sample inside that
   band is preferred. If one frame jumps over it, the landing sample must
   already be on LA with the pitch higher than the frame before the jump. */
function approachSample(playing) {
  const inside = playing.find((sample) => sample.zoom > 4.5 && sample.zoom < 8.5);
  if (inside) return inside;
  for (let i = 1; i < playing.length; i++) {
    const prev = playing[i - 1];
    const next = playing[i];
    if (prev.zoom <= 4.5 && next.zoom >= 8.5 && next.lng < -112 && next.pitch > prev.pitch && next.pitch < 55) {
      return next;
    }
  }
  return undefined;
}

function recordArrival(page) {
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        const map = document.querySelector("#runs-map");
        const samples = [];
        const started = performance.now();
        const push = () => {
          const liveZoom = map._runsMap?.getZoom?.();
          const sample = {
            intro: map.dataset.intro || "",
            warm: map.dataset.warm || "",
            zoom: typeof liveZoom === "number" ? liveZoom : Number(map.dataset.zoom),
            lng: Number(map.dataset.lng),
            pitch: Number(map.dataset.pitch),
            tiles: Number(map.dataset.warmTiles || 0),
            hidden: map.querySelector("canvas")?.style.visibility === "hidden",
          };
          const prev = samples[samples.length - 1];
          if (
            prev &&
            prev.intro === sample.intro &&
            prev.warm === sample.warm &&
            prev.zoom === sample.zoom &&
            prev.lng === sample.lng &&
            prev.pitch === sample.pitch
          ) {
            return;
          }
          samples.push(sample);
        };
        push();
        const observer = new MutationObserver(push);
        observer.observe(map, { attributes: true });
        const frame = () => {
          push();
          if (!stopped) requestAnimationFrame(frame);
        };
        let stopped = false;
        requestAnimationFrame(frame);
        const id = window.setInterval(() => {
          push();
          const last = samples[samples.length - 1];
          const sawHold = samples.some(
            (sample) =>
              sample.intro === "globe" &&
              /^(ready|failed|timeout)$/.test(sample.warm) &&
              sample.zoom < 3 &&
              sample.pitch < 1 &&
              !sample.hidden,
          );
          if ((last.intro === "done" && sawHold) || performance.now() - started > 24000) {
            stopped = true;
            window.clearInterval(id);
            observer.disconnect();
            resolve(samples);
          }
        }, 40);
      }),
  );
}

function boxesOverlap(a, b) {
  return a.x < b.x + b.width - 1 && a.x + a.width > b.x + 1 && a.y < b.y + b.height - 1 && a.y + a.height > b.y + 1;
}

test.describe("random activity", () => {
  test.describe.configure({ timeout: 120_000 });

  for (const viewport of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "phone", width: 390, height: 844 },
  ]) {
    test(`${viewport.name} dice opens a different run from the full set and returns focus`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/runs");
      await ready(page);
      const map = page.locator("#runs-map");
      await expect(map).toHaveAttribute("data-map", "ready", { timeout: 30_000 });
      const manifest = await (await page.request.get("/media/runs/manifest.json")).json();
      const dice = page.getByRole("button", { name: "Open a random activity" });
      await expect(dice).toBeVisible();
      await expect(dice).toHaveAttribute("title", "Open a random activity");
      await expect(dice.locator("svg")).toHaveAttribute("aria-hidden", "true");
      const diceBox = await dice.boundingBox();
      expect(diceBox.width).toBeGreaterThanOrEqual(44);
      expect(diceBox.height).toBeGreaterThanOrEqual(44);
      const globe = await page.getByRole("button", { name: "Globe" }).boundingBox();
      const regions = await page.getByRole("button", { name: /Regions, / }).boundingBox();
      const index = await page.getByRole("button", { name: /^Runs in / }).boundingBox();
      const zoomIn = await page.locator(".maplibregl-ctrl-zoom-in").boundingBox();
      for (const other of [globe, regions, index, zoomIn]) {
        expect(boxesOverlap(diceBox, other)).toBe(false);
      }

      await page.getByRole("button", { name: "Globe" }).focus();
      await page.keyboard.press("Tab");
      await expect(dice).toBeFocused();
      const focusRing = await dice.evaluate((el) => {
        const style = getComputedStyle(el);
        return { width: parseFloat(style.outlineWidth), style: style.outlineStyle };
      });
      expect(focusRing.width).toBeGreaterThanOrEqual(3);
      expect(focusRing.style).not.toBe("none");
      await page.keyboard.press("Enter");
      const card = page.locator(".detail.open");
      await expect(card).toBeVisible();
      await expect.poll(() => new URL(page.url()).searchParams.get("activity")).toBeTruthy();
      const firstId = new URL(page.url()).searchParams.get("activity");
      const first = manifest.runs.find((run) => String(run.id) === firstId);
      expect(first).toBeTruthy();
      await expectRouteInView(page, first);
      await expect(card.getByRole("button", { name: "Close" })).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(card).toHaveCount(0);
      await expect(dice).toBeFocused();

      await dice.click();
      await expect.poll(() => new URL(page.url()).searchParams.get("activity")).not.toBe(firstId);
      const secondId = new URL(page.url()).searchParams.get("activity");
      const second = manifest.runs.find((run) => String(run.id) === secondId);
      expect(second).toBeTruthy();
      await expectRouteInView(page, second);
      await expect(map).toHaveAttribute("data-highlight", secondId);
    });

    test(`${viewport.name} dice during the arrival cancels it and keeps that run`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/runs");
      await ready(page);
      const map = page.locator("#runs-map");
      await expect(map).toHaveAttribute("data-map", "ready", { timeout: 30_000 });
      await expect(map).toHaveAttribute("data-intro", "globe");
      const manifest = await (await page.request.get("/media/runs/manifest.json")).json();
      await page.getByRole("button", { name: "Open a random activity" }).click();
      await expect(map).toHaveAttribute("data-intro", "done");
      await expect.poll(() => new URL(page.url()).searchParams.get("activity")).toBeTruthy();
      const id = new URL(page.url()).searchParams.get("activity");
      const run = manifest.runs.find((item) => String(item.id) === id);
      await expectRouteInView(page, run);
      const openedAt = Date.now();
      await expect
        .poll(
          async () => {
            const intro = await map.getAttribute("data-intro");
            const pitch = Number(await map.getAttribute("data-pitch"));
            const urlId = new URL(page.url()).searchParams.get("activity");
            if (intro !== "done" || urlId !== id || pitch > 1.5) return "snapped";
            return Date.now() - openedAt > 1200 ? "held" : "waiting";
          },
          { timeout: 5000, intervals: [150] },
        )
        .toBe("held");
    });
  }
});

test.describe("run sheet and layers", () => {
  test.describe.configure({ timeout: 120_000 });

  test("the run list closes when a run opens and stays closed", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/runs");
    await ready(page);
    await page.getByRole("button", { name: /^Runs in LA \(/ }).click();
    const chooser = page.locator("#run-chooser");
    await expect(chooser).toBeVisible();
    await expect(chooser).toContainText("Runs in LA");
    await chooser.getByRole("option").first().click();
    await expect(page.locator(".detail.open")).toBeVisible();
    await expect(chooser).toHaveCount(0);
    await page.getByRole("button", { name: "Close" }).click();
    await expect(page.locator(".detail.open")).toHaveCount(0);
    await expect(chooser).toHaveCount(0);
  });

  test("a shared run and the dice do not leave the list open", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 900 });
    const manifest = await (await page.request.get("/media/runs/manifest.json")).json();
    const run = manifest.runs.find((item) => item.title === "Lake Sonoma Marathon");
    await page.goto(`/runs?activity=${run.id}`);
    await ready(page);
    await expect(page.locator(".detail.open")).toBeVisible();
    await expect(page.locator("#run-chooser")).toHaveCount(0);
    await page.getByRole("button", { name: "Close" }).click();
    await page.getByRole("button", { name: "Open a random activity" }).click();
    await expect(page.locator(".detail.open")).toBeVisible();
    await expect(page.locator("#run-chooser")).toHaveCount(0);
  });

  test("the phone sheet peeks and refits the route", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    const manifest = await (await page.request.get("/media/runs/manifest.json")).json();
    const run = manifest.runs.find((item) => item.city === "la" && item.distanceM > 8000);
    await page.goto(`/runs?activity=${run.id}`);
    await ready(page);
    const map = page.locator("#runs-map");
    const card = page.locator(".detail.open");
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute("data-sheet", "full");
    const openPad = () => map.getAttribute("data-pad").then((value) => Number(value.split(",")[2]));
    const fullPad = await openPad();
    expect(fullPad).toBeGreaterThan(160);
    const motion = await card.evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(motion === "0s" || motion === "0ms").toBe(true);
    await card.getByRole("button", { name: "Collapse run details" }).click();
    await expect(card).toHaveAttribute("data-sheet", "peek");
    await expect(card.locator("h2")).toBeVisible();
    const statsBelow = await card.locator(".stats").evaluate((el) => el.getBoundingClientRect().top >= window.innerHeight - 1);
    expect(statsBelow).toBe(true);
    const peekPad = await openPad();
    expect(peekPad).toBeLessThan(fullPad - 40);
    await card.getByRole("button", { name: "Expand run details" }).click();
    await expect(card).toHaveAttribute("data-sheet", "full");
    await expect.poll(openPad).toBeGreaterThan(peekPad + 40);
    await expect(card.getByRole("button", { name: "Close" })).toBeVisible();
  });

  test("layer choice colors routes and stays in the url", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/runs?layer=recency");
    await ready(page);
    const map = page.locator("#runs-map");
    await expect(map).toHaveAttribute("data-map", "ready", { timeout: 30_000 });
    await expect(map).toHaveAttribute("data-layer", "recency");
    await expect(page.locator(".heat-key")).toContainText("Older to newer");
    await page.getByRole("button", { name: "Map layers" }).click();
    await page.getByRole("option", { name: "Pace" }).click();
    await expect(map).toHaveAttribute("data-layer", "pace");
    await expect.poll(() => new URL(page.url()).searchParams.get("layer")).toBe("pace");
    await expect(page.locator(".heat-key")).toContainText("Slower to faster");
    await page.getByRole("button", { name: "Map layers" }).click();
    await page.getByRole("option", { name: "Elevation" }).click();
    await expect(map).toHaveAttribute("data-layer", "elevation");
    const manifest = await (await page.request.get("/media/runs/manifest.json")).json();
    const run = manifest.runs.find((item) => item.city === "la");
    await page.goto(`/runs?activity=${run.id}&layer=distance`);
    await ready(page);
    await expect(map).toHaveAttribute("data-layer", "distance", { timeout: 30_000 });
    await expect(page.locator(".detail.open h2")).toHaveText(run.title);
    await expect(page.locator(".heat-key")).toContainText("Shorter to longer");
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
