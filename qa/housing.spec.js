/**
 * /housing: ranked shortlist + map. Chromium at phone and desktop sizes.
 * Run: npx playwright test qa/housing.spec.js --project=chromium
 */
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const data = JSON.parse(readFileSync(new URL("../src/data/housing/housing.json", import.meta.url), "utf8"));
const hiddenStatus = new Set(["rejected", "stale", "off_market"]);
const open = data.listings.filter((l) => !hiddenStatus.has(l.status));
const hidden = data.listings.filter((l) => hiddenStatus.has(l.status));
const mentions = data.listings.filter((l) => l.honorable_mention);
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
      if (vp.width <= 640) {
        await expect(page.locator(".head-toggle")).toBeVisible();
        await expect(page.locator(".head-line .count")).toContainText("open");
        await expect(page.locator(".criteria").first()).toBeHidden();
        await expect(page.locator(".crumbs")).toBeHidden();
        await page.locator(".head-toggle").click();
        await expect(page.locator(".head-toggle")).toHaveAttribute("aria-expanded", "true");
      }
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


    test("honorable mentions stay visible, including rejected ones", async ({ page }) => {
      test.skip(!mentions.length, "no honorable mentions in this build");
      await page.goto("/housing");
      await openList(page, vp.width);
      const section = page.locator("#mention-list");
      await expect(section).toBeVisible();
      await expect(page.locator("#hm-heading")).toHaveText("Honorable mentions");
      await expect(section.locator("button")).toHaveCount(mentions.length);
      const hiddenHm = mentions.filter((l) => hiddenStatus.has(l.status));
      const openIds = new Set(open.map((l) => l.id));
      // Rejected mentions are not in the main shortlist by default.
      for (const row of hiddenHm) {
        await expect(page.locator(`#rank-list button[data-id="${row.id}"]`)).toHaveCount(0);
        const item = section.locator(`button[data-id="${row.id}"]`);
        await expect(item).toBeVisible();
        if (row.honorable_mention_reason) await expect(item).toContainText(row.honorable_mention_reason);
      }
      for (const row of mentions) {
        await expect(section.locator(`button[data-id="${row.id}"]`)).toBeVisible();
        await expect(page.locator(`.home-pin.hm[data-id="${row.id}"]`)).toHaveCount(1);
      }
      // Opening a rejected mention does not dump the rest of the rejected list into the shortlist.
      if (hiddenHm[0]) {
        const row = section.locator(`button[data-id="${hiddenHm[0].id}"]`);
        await row.scrollIntoViewIfNeeded();
        await row.click();
        const card = page.locator(".home-card.open");
        await expect(card).toBeVisible();
        await expect(card.locator(".card-title")).toHaveText(hiddenHm[0].address);
        await expect(card.locator(".card-reason")).toContainText(hiddenHm[0].honorable_mention_reason);
        if (vp.width > 640) {
          await expect(page.locator("#rank-list button")).toHaveCount(open.length);
        }
      }
    });

    test("expanded card shows beach access, score breakdown, and drive distances", async ({ page }) => {
      const first = open[0];
      await page.goto(`/housing?id=${encodeURIComponent(first.id)}`);
      const card = page.locator(".home-card.open");
      await expect(card).toBeVisible();
      if (first.nearest_beach_access) {
        await expect(card.locator(".facts .access")).toContainText(String(first.nearest_beach_access).slice(0, 12));
      }
      if (first.score_breakdown) {
        await expect(card.locator(".breakdown")).toBeVisible();
        await expect(card.locator(".breakdown")).toContainText("Rush-hour drive");
      }
      if (first.drive_min_to_spacex_rush != null) {
        await expect(card.locator(".facts")).toContainText("rush hour");
      }
      if (first.walk_km_to_beach != null) {
        await expect(card.locator(".facts")).toContainText("km");
      }
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

    test("list cards show a thumbnail and the expanded card has a photo gallery", async ({ page }) => {
      const withPhotos = open.find((l) => Array.isArray(l.photos) && l.photos.length);
      test.skip(!withPhotos, "no photos in this build");
      await page.goto("/housing");
      await openList(page, vp.width);
      const row = page.locator(`#rank-list button[data-id="${withPhotos.id}"]`);
      await expect(row.locator(".list-thumb img")).toBeVisible();
      await expect(row.locator(".list-thumb img")).toHaveAttribute("src", /\/media\/housing\//);
      await row.scrollIntoViewIfNeeded();
      await row.click();
      const card = page.locator(".home-card.open");
      await expect(card.locator(".photo-strip .photo-thumb")).toHaveCount(withPhotos.photos.length);
      await card.locator(".photo-thumb").first().click();
      await expect(page.locator(".lightbox")).toBeVisible();
      await expect(page.locator(".lightbox-count")).toContainText("1 /");
      await page.locator(".lightbox-close").click();
      await expect(page.locator(".lightbox")).toHaveCount(0);
    });

    test("walk and drive times link out to Google Maps", async ({ page }) => {
      const first = open[0];
      await page.goto(`/housing?id=${encodeURIComponent(first.id)}`);
      const card = page.locator(".home-card.open");
      const walk = card.locator(".facts a.map-link").first();
      const drive = card.locator(".facts a.map-link").nth(1);
      await expect(walk).toHaveAttribute("target", "_blank");
      await expect(walk).toHaveAttribute("rel", "noopener");
      await expect(walk).toHaveAttribute("href", /google\.com\/maps\/dir\//);
      await expect(walk).toHaveAttribute("href", /travelmode=walking/);
      await expect(drive).toHaveAttribute("href", /travelmode=driving/);
      await expect(drive).toHaveAttribute("href", /SpaceX/);
      await expect(drive).toHaveAttribute("rel", "noopener");
    });

    test("prev and next buttons show ranks, not wrapping addresses", async ({ page }) => {
      const ranked = open.filter((l) => l.rank != null);
      test.skip(ranked.length < 2, "need two ranked listings");
      await page.goto(`/housing?id=${encodeURIComponent(ranked[0].id)}`);
      const card = page.locator(".home-card.open");
      const next = card.locator(".card-step button").last();
      await expect(next).toHaveText(/#\d+\s*→/);
      await expect(next).not.toHaveText(ranked[1].address);
      await expect(next).toHaveAttribute("aria-label", new RegExp(ranked[1].address.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      await next.click();
      const prev = card.locator(".card-step button").first();
      await expect(prev).toHaveText(/←\s*#\d+/);
      await expect(prev).toHaveAttribute("aria-label", new RegExp(ranked[0].address.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    });

    test("off-market listings are hidden, unranked, and not honorable mentions", async ({ page }) => {
      const offMarket = data.listings.filter((l) => l.status === "off_market");
      test.skip(!offMarket.length, "no off-market listings in this build");
      await page.goto("/housing");
      await openList(page, vp.width);
      for (const row of offMarket) {
        await expect(page.locator(`#rank-list button[data-id="${row.id}"]`)).toHaveCount(0);
        await expect(page.locator(`#mention-list button[data-id="${row.id}"]`)).toHaveCount(0);
        await expect(page.locator(`.home-pin[data-id="${row.id}"]`)).toHaveCount(0);
      }
      await page.locator(".reject-toggle input").check();
      for (const row of offMarket) {
        const item = page.locator(`#rank-list button[data-id="${row.id}"]`);
        await expect(item).toBeVisible();
        await expect(item).toHaveClass(/dimmed/);
        await expect(item.locator(".rank-badge")).toHaveClass(/unranked/);
        await expect(item).toContainText("Off market");
        await expect(item).not.toHaveClass(/hm/);
        await expect(page.locator(`#mention-list button[data-id="${row.id}"]`)).toHaveCount(0);
      }
    });

    test("phone expanded card leaves the selected pin visible above it", async ({ page }) => {
      test.skip(vp.width > 640, "phone layout only");
      const first = open[0];
      await page.goto(`/housing?id=${encodeURIComponent(first.id)}`);
      const card = page.locator(".home-card.open");
      await expect(card).toBeVisible();
      const cardBox = await card.boundingBox();
      expect(cardBox).toBeTruthy();
      expect(cardBox.height).toBeLessThanOrEqual(vp.height * 0.67);
      expect(cardBox.height).toBeGreaterThanOrEqual(vp.height * 0.45);
      await page.waitForSelector("#housing-map[data-map='ready']", { timeout: 20_000 });
      const pin = page.locator(`.home-pin.sel[data-id="${first.id}"]`);
      await expect(pin).toBeVisible({ timeout: 15_000 });
      await expect
        .poll(
          async () => {
            const pinBox = await pin.boundingBox();
            const cardNow = await card.boundingBox();
            if (!pinBox || !cardNow) return false;
            return pinBox.y >= 8 && pinBox.y + pinBox.height <= cardNow.y + 12;
          },
          { timeout: 8_000 },
        )
        .toBe(true);
    });
  });
}
