/**
 * Layout gates for the main site.
 *
 * Run: npm test
 * Requires the dev server (Playwright starts it, or reuses one on :5173).
 */
import { expect, test } from "@playwright/test";

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "phone", width: 390, height: 844 },
];

async function ready(page) {
  await page.waitForFunction(() => document.documentElement.classList.contains("vue-ready"));
}

/** Pixels of scrollport still showing past the footer's bottom edge.
    A route jump can snap scroll for a moment; keep asking until it sticks. */
async function spaceBelowFooter(page) {
  return page.evaluate(async () => {
    const root = document.querySelector(".prlx");
    const footer = document.querySelector(".site-footer");
    if (!root || !footer) return null;
    const max = root.scrollHeight - root.clientHeight;
    const previous = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    const start = performance.now();
    do {
      root.scrollTop = max;
      await new Promise((resolve) => requestAnimationFrame(resolve));
      if (Math.abs(root.scrollTop - max) < 2) break;
    } while (performance.now() - start < 3000);
    root.style.scrollBehavior = previous;
    return Math.round(root.getBoundingClientRect().bottom - footer.getBoundingClientRect().bottom);
  });
}

test.describe("resume jump UI", () => {
  test("section jumps live only in the sticky bar", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/resume");
    await ready(page);
    await expect(page.locator("#resume-heading")).toBeVisible();

    const stray = await page.evaluate(() => {
      const nav = document.querySelector(".section-nav");
      return [...document.querySelectorAll(".tablist")].filter((row) => !nav?.contains(row)).length;
    });
    expect(stray).toBe(0);
    await expect(page.locator("#resume .tablist, #resume-tab-slot")).toHaveCount(0);

    await page.goto("/resume/experience");
    await ready(page);
    await expect(page.locator(".section-nav.is-open .tablist")).toBeVisible();
    const labels = await page.locator(".section-nav .tablist a").allTextContents();
    expect(labels.map((label) => label.trim())).toEqual([
      "Skills",
      "Experience",
      "Education",
      "Clubs",
      "Awards",
    ]);
    await expect(page.locator("#resume .tablist, #resume-tab-slot")).toHaveCount(0);
  });
});

test.describe("footer ends the page", () => {
  for (const viewport of VIEWPORTS) {
    for (const path of ["/", "/resume"]) {
      test(`${viewport.name} ${path} has no empty band under the footer`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(path);
        await ready(page);
        const gap = await spaceBelowFooter(page);
        expect(gap).not.toBeNull();
        expect(gap).toBeGreaterThanOrEqual(-2);
        expect(gap).toBeLessThanOrEqual(16);
      });
    }
  }

  test("diners fills the viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/diners");
    await page.waitForSelector(".diners");
    const gap = await page.evaluate(() => {
      const root = document.querySelector(".diners");
      return Math.round(window.innerHeight - root.getBoundingClientRect().bottom);
    });
    expect(gap).toBeLessThanOrEqual(2);
    await expect(page.locator(".scroll-tail")).toHaveCount(0);
  });
});
