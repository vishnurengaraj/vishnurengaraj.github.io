/**
 * Accessibility and design fixes for /, /runs, and /diners.
 * Chromium only (see playwright.config.js). Runs keyboard coverage
 * also lives in runs.spec.js so WebKit executes it.
 */
import { expect, test } from "@playwright/test";

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "phone", width: 390, height: 844 },
];

async function ready(page) {
  await page.waitForFunction(() => document.documentElement.classList.contains("vue-ready"));
}

test.describe("personal site", () => {
  for (const viewport of VIEWPORTS) {
    test(`${viewport.name} hero focus ring and tab stay on screen`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/");
      await ready(page);

      await expect(page.locator(".skip")).toHaveAttribute("href", "#about");
      const weight = await page.locator("#about-heading").evaluate((el) => Number(getComputedStyle(el).fontWeight));
      expect(weight).toBeLessThanOrEqual(700);

      let sawAbout = false;
      let sawProjects = false;
      let sawMore = false;
      let sawHeroRing = false;
      for (let i = 0; i < 20; i++) {
        await page.keyboard.press("Tab");
        const box = await page.waitForFunction(() => {
          const el = document.activeElement;
          const root = document.querySelector(".prlx");
          if (!el || !root || el === document.body) return null;
          const rect = el.getBoundingClientRect();
          const rootRect = root.getBoundingClientRect();
          const onScreen = rect.width > 0 && rect.bottom > rootRect.top + 1 && rect.top < rootRect.bottom - 1;
          if (!onScreen) return null;
          const style = getComputedStyle(el);
          const text = (el.innerText || el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim();
          return {
            text,
            outline: style.outlineColor,
            width: parseFloat(style.outlineWidth) || 0,
          };
        }, null, { timeout: 4000 });
        const info = await box.jsonValue();
        if (info.text.startsWith("Email")) {
          expect(info.width).toBeGreaterThanOrEqual(2);
          expect(info.outline).toBe("rgb(255, 176, 32)");
          sawHeroRing = true;
        }
        if (info.text === "About") sawAbout = true;
        if (info.text === "Projects") sawProjects = true;
        if (info.text === "More") sawMore = true;
        if (sawHeroRing && sawAbout && sawProjects && sawMore) break;
      }
      expect(sawHeroRing).toBe(true);
      expect(sawAbout).toBe(true);
      expect(sawProjects).toBe(true);
      expect(sawMore).toBe(true);
    });
  }

  test("typewriter runs once and the learn control does not loop", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await ready(page);
    await expect
      .poll(async () => page.locator(".subtitle").evaluate((el) => el.textContent), { timeout: 8000 })
      .toBe("Mechanical Engineer");
    await expect(page.locator(".caret")).toHaveCount(0);
    const motion = await page.locator(".learn").evaluate((el) => {
      const style = getComputedStyle(el);
      return { name: style.animationName, count: style.animationIterationCount };
    });
    expect(motion.name).toContain("learn-enter");
    expect(motion.name).not.toContain("learn-hint");
    expect(motion.count).not.toBe("infinite");

    const navMotion = await page.locator(".nav-subs").evaluate((el) => getComputedStyle(el).transitionProperty);
    expect(navMotion).not.toMatch(/width|padding|margin/);
    expect(navMotion).toMatch(/opacity|transform/);
  });

  test("about copy drops the greeting, the chips, and the company blurbs", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/resume/experience");
    await ready(page);
    await expect(page.locator(".lead")).not.toContainText("Hey there");
    const repeats = await page.evaluate(
      () => (document.body.textContent.match(/design novel test equipment/gi) || []).length,
    );
    expect(repeats).toBe(1);
    const experience = page.locator("#experience");
    await expect(experience).not.toContainText("revolutionize space technology");
    await expect(experience).not.toContainText("leading provider of enterprise-class");
    await expect(experience).not.toContainText("infinitely scalable clean energy");
    await expect(experience).toContainText("Satellite Deployment Mechanism Qualification");
    const chip = await page.locator(".cat").first().evaluate((el) => getComputedStyle(el).textTransform);
    expect(chip).toBe("none");
    const stripe = await page.locator(".skills").evaluate((el) => parseFloat(getComputedStyle(el).borderLeftWidth));
    expect(stripe).toBeLessThanOrEqual(1);
    const coursework = await page.locator(".coursework").evaluate((el) => parseFloat(getComputedStyle(el).borderLeftWidth));
    expect(coursework).toBeLessThanOrEqual(1);
  });
});

test.describe("diners", () => {
  for (const viewport of VIEWPORTS) {
    test(`${viewport.name} list and drawer meet the type and motion rules`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/diners?list=open");
      await page.waitForSelector(".diners");

      const description = await page.locator('meta[name="description"]').getAttribute("content");
      expect(description).toBeTruthy();
      expect(description).not.toMatch(/https?:\/\/|vishnu\.rengaraj\.com/);

      const cert = page.locator(".cert-pill").first();
      await expect(cert).toBeVisible();
      const certSize = await cert.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      expect(certSize).toBeGreaterThanOrEqual(11);
      const certMotion = await cert.evaluate((el) => getComputedStyle(el).animationName);
      expect(certMotion).toBe("none");

      await expect(page.locator(".score small")).toHaveCount(0);
      await expect(page.getByText("SCORE", { exact: true })).toHaveCount(0);

      const levels = await page.locator("h1, h2, h3, h4, h5, h6").evaluateAll((els) =>
        els.filter((el) => getComputedStyle(el).display !== "none").map((el) => Number(el.tagName.slice(1))),
      );
      let previous = 0;
      for (const level of levels) {
        expect(level).toBeLessThanOrEqual(previous + 1);
        previous = level;
      }

      const card = page.locator(".cards .card").first();
      await card.focus();
      await page.keyboard.press("Enter");
      const drawer = page.locator(".detail.open");
      await expect(drawer).toBeVisible();
      await expect(drawer.locator(".big")).not.toContainText("weighted score");
      await expect(drawer.locator(".big")).not.toContainText("out of 10");
      const nums = await drawer.locator(".big b").evaluate((el) => getComputedStyle(el).fontVariantNumeric);
      expect(nums).toContain("tabular-nums");
      const credit = drawer.locator(".credit");
      await expect(credit).toBeVisible();
      const contrast = await credit.evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(contrast).not.toBe("rgba(0, 0, 0, 0)");

      await page.keyboard.press("Escape");
      await expect(drawer).toBeHidden();
      if (viewport.width >= 641) await expect(card).toBeFocused();

      const rail = await page.locator(".rail-lbl").evaluate((el) => getComputedStyle(el).textTransform);
      expect(rail).toBe("none");
      const panelMotion = await page.locator(".panel").evaluate((el) => getComputedStyle(el).transitionProperty);
      expect(panelMotion).not.toMatch(/width|left/);
    });
  }
});
