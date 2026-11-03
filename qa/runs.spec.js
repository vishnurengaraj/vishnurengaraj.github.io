/**
 * /runs. Chromium, phone and desktop — the same browser the rest of qa/ uses.
 *
 * Run: npm test
 */
import { expect, test } from "@playwright/test";

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
  test.describe.configure({ timeout: 90_000 });

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
      await expect(page.locator(".sample-tag")).toHaveText("Sample routes");
      await expect(page.locator(".chips button")).toHaveText(["LA", "SF", "NYC"]);
      await expect(page.getByRole("radio", { name: "LA" })).toHaveAttribute("aria-checked", "true");

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
      const sf = manifest.cities.find((city) => city.id === "sf");
      const la = manifest.cities.find((city) => city.id === "la");
      expect(sf.count).not.toBe(la.count);

      await page.getByRole("radio", { name: "SF" }).click();
      await expect(map).toHaveAttribute("data-city", "sf");
      await expect(map).toHaveAttribute("data-runs", String(sf.count));
      await expect.poll(async () => Number(await map.getAttribute("data-lng"))).toBeLessThan(-122);
      await expect(page.getByRole("radio", { name: "SF" })).toHaveAttribute("aria-checked", "true");

      await page.getByRole("radio", { name: "LA" }).click();
      await expect(map).toHaveAttribute("data-city", "la");
      await expect(map).toHaveAttribute("data-runs", String(la.count));
      await expect.poll(async () => Number(await map.getAttribute("data-lng"))).toBeGreaterThan(-119);

      await zoomTo(page, 15);
      const probe = manifest.probes.overlap;
      const point = await map.evaluate((el, lngLat) => el._runsMap.project(lngLat), [probe.lng, probe.lat]);
      const box = await map.boundingBox();
      expect(point.x).toBeGreaterThan(8);
      expect(point.y).toBeGreaterThan(8);
      expect(point.x).toBeLessThan(box.width - 8);
      expect(point.y).toBeLessThan(box.height - 8);
      await page.mouse.click(box.x + point.x, box.y + point.y);

      const chooser = page.locator(".chooser");
      await expect(chooser).toBeVisible();
      expect(await chooser.getByRole("option").count()).toBeGreaterThan(1);
      const title = (await chooser.locator(".chooser-title").first().innerText()).trim();
      await chooser.getByRole("option").first().click();

      const card = page.locator(".detail.open");
      await expect(card).toBeVisible();
      await expect(card.locator("h2")).toHaveText(title);
      await expect(card.locator(".run-distance")).toContainText("mi");
      await expect(card.locator(".run-pace")).toContainText("/mi");
      await expect(card.locator(".run-date")).toContainText(/\d{4}/);
      await expect(card.locator(".run-elev")).toContainText("ft");
      await expect(card.locator(".run-companions")).toHaveCount(0);
      await expect(card.locator(".sample-line")).toHaveText("Sample route");

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

  test("deep link opens the run that has a photo", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/runs?run=sample-la-hermosa");
    await ready(page);
    const card = page.locator(".detail.open");
    await expect(card.locator("h2")).toHaveText("Hermosa out and back", { timeout: 30_000 });
    await expect(card.locator(".run-distance")).toContainText("mi");
    await expect(card.locator(".run-pace")).toContainText("/mi");
    await expect(card.locator(".photo-strip img")).toHaveAttribute("alt", "Sample photo");
    await expect(page.locator(".section-nav")).toHaveCount(0);
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
