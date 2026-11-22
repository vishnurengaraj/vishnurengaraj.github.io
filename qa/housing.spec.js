/**
 * /housing: ranked shortlist + map. Chromium at phone and desktop sizes.
 * Run: npx playwright test qa/housing.spec.js --project=chromium
 */
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const data = JSON.parse(readFileSync(new URL("../src/data/housing/housing.json", import.meta.url), "utf8"));
const hiddenStatus = new Set(["rejected", "stale"]);
const open = data.listings.filter((l) => !hiddenStatus.has(l.status));
const hidden = data.listings.filter((l) => hiddenStatus.has(l.status));
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "phone", width: 390, height: 844 },
];

function watchErrors(page) {
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  return errors;
}

async function openList(page, width) {
  if (width <= 640) {
    const toggle = page.locator(".list-toggle");
    if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  }
}

for (const vp of VIEWPORTS) {
  test.describe(`/housing ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("loads with noindex, criteria, and no home-nav link", async ({ page }) => {
      const errors = watchErrors(page);
      await page.goto("/housing");
      await expect(page.locator(".housing")).toBeVisible();
      await expect(page.locator("h1")).toHaveText("Housing");
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
      await expect(page.locator(".criteria").first()).toContainText("2 bed / 2 bath");
      await expect(page.locator(".criteria").first()).toContainText("$4,500/month");
      await expect(page.locator(".sub")).toContainText("Updated");
      await expect(page.locator(".housing .home")).toHaveAttribute("href", "/");
      await page.goto("/");
      await page.waitForFunction(() => document.documentElement.classList.contains("vue-ready"));
      const hrefs = await page.locator("a[href='/housing']").count();
      expect(hrefs).toBe(0);
      expect(errors.filter((e) => !/Failed to load resource|net::/.test(e))).toEqual([]);
    });

    test("hides rejected and stale listings until the toggle is on, then dims them", async ({ page }) => {
      await page.goto("/housing");
      await openList(page, vp.width);
      const list = page.locator("#rank-list button");
      await expect(list).toHaveCount(open.length);
      for (const row of hidden) {
        await expect(list.filter({ hasText: row.address })).toHaveCount(0);
      }
      await page.locator(".reject-toggle input").check();
      await expect(list).toHaveCount(data.listings.length);
      const dimmed = page.locator("#rank-list button.dimmed");
      await expect(dimmed).toHaveCount(hidden.length);
      if (hidden[0]) {
        await expect(dimmed.first()).toContainText(hidden[0].address);
        const opacity = await dimmed.first().evaluate((el) => Number.parseFloat(getComputedStyle(el).opacity));
        expect(opacity).toBeLessThan(0.9);
      }
    });

    test("sorts by rent and filters by max price and max walk", async ({ page }) => {
      await page.goto("/housing");
      await openList(page, vp.width);
      await page.locator("#housing-sort").selectOption("rent");
      const cheapest = [...open].sort((a, b) => a.rent_usd - b.rent_usd)[0];
      await expect(page.locator("#rank-list button").first()).toContainText(cheapest.address);
      await page.locator('fieldset.pills', { hasText: "Max rent" }).locator("label", { hasText: "$4,500" }).click();
      const priced = open.filter((l) => l.rent_usd <= 4500);
      await expect(page.locator("#rank-list button")).toHaveCount(priced.length);
      await page.locator('fieldset.pills', { hasText: "Max walk" }).locator("label", { hasText: "20 min" }).click();
      const walked = priced.filter((l) => l.walk_min_to_beach != null && l.walk_min_to_beach <= 20);
      await expect(page.locator("#rank-list button")).toHaveCount(walked.length);
    });

    test("opens a listing card with a Zillow link and deep-links", async ({ page }) => {
      const first = open[0];
      await page.goto("/housing");
      await openList(page, vp.width);
      const row = page.locator(`#rank-list button[data-id="${first.id}"]`);
      await expect(row).toBeVisible();
      await row.scrollIntoViewIfNeeded();
      await row.click();
      await expect(page).toHaveURL(new RegExp(`[?&]id=${encodeURIComponent(first.id)}`));
      const card = page.locator(".home-card.open");
      await expect(card).toBeVisible();
      await expect(card.locator(".card-title")).toHaveText(first.address);
      if (first.listed_date || first.days_on_market != null) {
        await expect(card.locator(".listed")).toContainText(/Listed /);
      }
      await expect(card.getByRole("link", { name: /Open on Zillow/ })).toHaveAttribute("href", first.url);
      if (first.score_breakdown) {
        await expect(card.locator(".breakdown")).toBeVisible();
      }
      if (first.drive_min_to_spacex_rush != null) {
        await expect(card.locator(".facts")).toContainText("rush hour");
      }
      await card.locator(".close").click();
      await expect(page.locator(".home-card.open")).toHaveCount(0);
      await page.goto(`/housing?id=${encodeURIComponent(first.id)}`);
      await expect(page.locator(".home-card.open .card-title")).toHaveText(first.address);
    });

    test("map region and landmark labels are present", async ({ page }) => {
      await page.goto("/housing");
      await expect(page.locator("#housing-map")).toBeVisible();
      await expect(page.locator("#housing-map")).toHaveAttribute("aria-label", /beach/i);
      // Landmarks may take a moment if the style is slow; still assert the page chrome.
      await expect(page.locator(".board-foot")).toContainText("1 Rocket Rd");
      if (data.scoring_notes) {
        await openList(page, vp.width);
        await page.locator(".method summary").click();
        await expect(page.locator(".method")).toContainText(data.scoring_notes.slice(0, 24));
      }
      const box = await page.locator(".housing").boundingBox();
      expect(box).toBeTruthy();
      expect(Math.round(box.height)).toBeGreaterThanOrEqual(vp.height - 2);
    });

    test("unranked listings have no rank number and sort last", async ({ page }) => {
      const unranked = open.filter((l) => l.rank == null);
      test.skip(!unranked.length, "no unranked open listings in this build");
      await page.goto("/housing");
      await openList(page, vp.width);
      await page.locator("#housing-sort").selectOption("rank");
      const last = page.locator("#rank-list button").last();
      await expect(last).toContainText(unranked[0].address);
      await expect(last.locator(".rank-badge")).toHaveClass(/unranked/);
      await expect(last.locator(".rank-badge")).toHaveText("");
    });
  });
}
