<script setup>
import { nextTick, onMounted, onUnmounted, provide, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useHead } from "@unhead/vue";
import monoBold from "@fontsource/roboto-mono/files/roboto-mono-latin-700-normal.woff2?url";
import headingBlack from "./fonts/roboto-900-headings.woff2?url";
import Stars from "./components/Stars.vue";
import Hero from "./components/Hero.vue";
import AboutSection from "./components/AboutSection.vue";
import ProjectsSection from "./components/ProjectsSection.vue";
import ResumeSection from "./components/ResumeSection.vue";
import SiteFooter from "./components/SiteFooter.vue";
import { skills } from "./data/content.js";
import { dockKey, scrollKey } from "./scroll.js";

const ORIGIN = "https://vishnu.rengaraj.com";
const route = useRoute();
const router = useRouter();
const scroller = ref(null);
const ready = ref(false);
const navBeside = ref(false);
const layerSizes = "(max-width: 360px) 900px, (max-width: 800px) 1500px, 1800px";
const layerWidths = [960, 1600, 2400, 3200];
const ridgeLayers = [
  ["l1", 14058, 4277],
  ["l2", 4686, 1689],
  ["l3", 4686, 1692],
  ["l4", 4686, 1704],
  ["l5", 4685, 1704],
  ["l6", 4685, 1707],
  ["l7", 4685, 2019],
].map(([id, w, h]) => ({
  id,
  w,
  h,
  fallback: `/media/layers/${id}-1600.webp`,
  srcAvif: layerWidths.map((n) => `/media/layers/${id}-${n}.avif ${n}w`).join(", "),
  srcWebp: layerWidths.map((n) => `/media/layers/${id}-${n}.webp ${n}w`).join(", "),
}));

useHead({
  link: [
    {
      rel: "canonical",
      href: () => ORIGIN + (route.path || "/"),
    },
    {
      rel: "preload",
      as: "font",
      type: "font/woff2",
      href: monoBold,
      crossorigin: "anonymous",
    },
    {
      rel: "preload",
      as: "font",
      type: "font/woff2",
      href: headingBlack,
      crossorigin: "anonymous",
    },
  ],
  meta: [
    {
      property: "og:url",
      content: () => ORIGIN + (route.path || "/"),
    },
  ],
});

function prefersReduced() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function barClearance(targetId) {
  const root = scroller.value;
  if (!root) return 0;
  const nav = root.querySelector(".section-nav");
  const inner = nav?.querySelector(".nav-inner");
  if (!nav || !inner) return 0;
  const rootTop = root.getBoundingClientRect().top;
  const stickyTop = Number.parseFloat(getComputedStyle(nav).top) || 0;
  const navTop = nav.getBoundingClientRect().top - rootTop;
  /* Before the bar sticks, its viewport bottom is its place in the
     document (below the title), not the space it covers once pinned. */
  if (navTop > stickyTop + 2) return stickyTop + inner.offsetHeight + 12;
  const shell = root.querySelector("#nav-tab-slot .tablist-shell");
  let bottom = inner.getBoundingClientRect().bottom;
  if (shell) bottom = Math.max(bottom, shell.getBoundingClientRect().bottom);
  return bottom - rootTop + 12;
}

function anchorFor(id) {
  return document.getElementById(`${id}-heading`) || document.getElementById(id);
}

let followNative = false;
let followTimer = 0;

function beginNativeScroll() {
  followNative = true;
  window.clearTimeout(followTimer);
  followTimer = window.setTimeout(() => {
    followNative = false;
  }, 2500);
}

function endNativeScroll() {
  followNative = false;
  window.clearTimeout(followTimer);
}

function scrollToEl(id, behavior) {
  const root = scroller.value;
  if (!root || typeof document === "undefined") return;
  const mode = behavior || (prefersReduced() ? "auto" : "smooth");
  const landed = () => {
    endNativeScroll();
    const end = Math.max(0, root.scrollHeight - root.clientHeight);
    if (end - root.scrollTop <= 32 && end - root.scrollTop > 1) {
      root.style.scrollBehavior = "auto";
      drivingScroll = true;
      root.scrollTop = end;
    }
    updateDock();
    applySpy();
  };
  beginNativeScroll();
  if (id === "top") {
    root.scrollTo({ top: 0, behavior: mode });
    document.getElementById("top")?.focus({ preventScroll: true });
    if (mode === "smooth") root.addEventListener("scrollend", landed, { once: true });
    else landed();
    return;
  }
  const el = anchorFor(id);
  if (!el) return;
  const max = Math.max(0, root.scrollHeight - root.clientHeight);
  let top = Math.max(
    0,
    el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - barClearance(id),
  );
  /* A target a few pixels short of the end never quite becomes the last
     section. Land on the end instead. */
  if (max - top <= 32) top = max;
  if (Math.abs(root.scrollTop - top) < 2) {
    landed();
  } else {
    root.scrollTo({ top, behavior: mode });
    if (mode === "smooth") root.addEventListener("scrollend", landed, { once: true });
    else landed();
  }
  document.getElementById(id)?.focus({ preventScroll: true });
}

function targetForRoute() {
  if (route.name === "about") return "about";
  if (route.name === "projects") return "projects";
  if (route.name === "resume") return "resume";
  if (route.name === "skills") return "skills";
  return "top";
}

let lastKey = "";
let pinGen = 0;

/* True when the element is on screen in the open area under the sticky
   nav or the docked tab row. */
function visibleBelowBars(el) {
  const root = scroller.value;
  if (!root || !el) return false;
  const top = el.getBoundingClientRect().top - root.getBoundingClientRect().top;
  const bottom = el.getBoundingClientRect().bottom - root.getBoundingClientRect().top;
  const clearance = barClearance("resume");
  return bottom > clearance + 1 && top < root.clientHeight - 1;
}

/* A tab click should move the page only when the heading has gone above
   or behind the bars and the in-page tab row is gone too. */
function resumeNeedsRealign() {
  const heading = document.getElementById("resume-heading");
  const tabs = document.querySelector("#resume-tab-slot .tablist-shell");
  return !visibleBelowBars(heading) && !visibleBelowBars(tabs);
}

function syncScroll(behavior) {
  const key = `${route.name}:${route.params.tab || ""}:${targetForRoute()}`;
  if (key === lastKey) return;
  const switchingTabs = route.name === "resume" && lastKey.startsWith("resume:");
  lastKey = key;
  pinGen += 1;
  if (switchingTabs) {
    if (resumeNeedsRealign()) {
      markScrollTarget("resume");
      scrollToEl("resume", behavior);
    }
    return;
  }
  const target = targetForRoute();
  markScrollTarget(target);
  scrollToEl(target, behavior);
  if (behavior === "instant") settleRoute(target, pinGen);
}

/* Images and the sticky bar settle a frame or two after first paint.
   Re-pin a direct load so the spy does not publish a section we only
   passed through. */
function settleRoute(id, gen) {
  if (!id || id === "top") return;
  const pin = () => {
    if (gen !== pinGen) return;
    const root = scroller.value;
    const el = anchorFor(id);
    if (!root || !el) return;
    const top = el.getBoundingClientRect().top - root.getBoundingClientRect().top;
    const clearance = barClearance(id);
    const max = root.scrollHeight - root.clientHeight;
    const atEnd = root.scrollTop >= max - 2;
    if (atEnd && top < root.clientHeight * 0.75) {
      updateDock();
      applySpy();
      return;
    }
    if (Math.abs(top - clearance) <= 2) return;
    scrollToEl(id, "instant");
  };
  requestAnimationFrame(() => requestAnimationFrame(pin));
  window.addEventListener("load", pin, { once: true });
}

const sectionIds = ["about", "projects", "resume", "skills"];
const activeSection = ref(sectionIds.includes(route.name) ? route.name : null);
const spySeen = new Set();
let resumePath = route.name === "resume" ? route.path : "/resume";
let spyLock = null;
let passedSection = null;
let urlFromSpy = false;
let spySettle = 0;
let spyObserver;

function skillsInView() {
  const root = scroller.value;
  const heading = document.getElementById("skills-heading");
  if (!root || !heading) return false;
  const top = heading.getBoundingClientRect().top - root.getBoundingClientRect().top;
  const onScreen = top < root.clientHeight - 8 && top > -heading.offsetHeight - 48;
  /* Within a few pixels of the end, Skills is the section on screen
     even when its heading never reaches the top spy band. */
  const atEnd = root.scrollTop + root.clientHeight >= root.scrollHeight - 32;
  if (atEnd) return true;
  return top < root.clientHeight * 0.55 && onScreen;
}

function spyPick() {
  let next = null;
  for (const id of sectionIds) {
    if (id === "skills") continue;
    if (spySeen.has(id)) next = id;
  }
  if (!next && passedSection && passedSection !== "skills") next = passedSection;
  /* Highlight and the resume dock share this test. The section can
     enter the spy band while its heading is still low on the screen. */
  if (skillsInView()) return "skills";
  if (!next && (spySeen.has("skills") || passedSection === "skills")) return "resume";
  return next;
}

function markScrollTarget(id) {
  if (id !== "top" && !sectionIds.includes(id)) return;
  const wanted = id === "top" ? null : id;
  activeSection.value = wanted;
  spyLock = spyPick() === wanted ? null : id === "top" ? "top" : id;
}

function syncSpyUrl(section) {
  if (route.name === "resume") resumePath = route.path;
  const path =
    section === "about" || section === "projects" || section === "skills"
      ? `/${section}`
      : section === "resume"
        ? resumePath
        : "/";
  if (route.path === path) return;
  urlFromSpy = true;
  router.replace(path);
}

function releaseSpyLock() {
  if (!spyLock) return;
  const wanted = spyLock === "top" ? null : spyLock;
  const next = spyPick();
  spyLock = null;
  if (next === wanted || activeSection.value === next) return;
  activeSection.value = next;
  syncSpyUrl(next);
}

function applySpy() {
  const next = spyPick();
  if (spyLock) {
    const wanted = spyLock === "top" ? null : spyLock;
    if (next === wanted) spyLock = null;
    else return;
  }
  if (activeSection.value === next) return;
  activeSection.value = next;
  syncSpyUrl(next);
}

function onSpy(entries) {
  for (const entry of entries) {
    if (entry.isIntersecting) spySeen.add(entry.target.id);
    else spySeen.delete(entry.target.id);
    if (entry.rootBounds && sectionIds.includes(entry.target.id)) {
      const { top, bottom } = entry.boundingClientRect;
      const above = bottom <= entry.rootBounds.top + 1 && top < entry.rootBounds.top;
      if (above) passedSection = entry.target.id;
      else if (passedSection === entry.target.id && top > entry.rootBounds.top) {
        const index = sectionIds.indexOf(entry.target.id);
        passedSection = index > 0 ? sectionIds[index - 1] : null;
      }
    }
  }
  applySpy();
}

function go(id) {
  cancelTween();
  if (id === "about" && inTitleZone() && !prefersReduced()) {
    playDown();
    return;
  }
  if (id === "top" || sectionIds.includes(id)) {
    activeSection.value = id === "top" ? null : id;
  }
  if (id === "resume" && route.name === "resume") {
    markScrollTarget("resume");
    scrollToEl("resume");
    return;
  }
  const path = id === "top" ? "/" : `/${id}`;
  if (route.path === path) {
    markScrollTarget(id);
    scrollToEl(id === "top" ? "top" : id);
    return;
  }
  router.push(path);
}

function onNav(event, id) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
  event.preventDefault();
  go(id);
}

provide(scrollKey, go);

const dockState = reactive({ docked: false, open: false });
provide(dockKey, dockState);

let closeDockTimer = 0;

function besideFits() {
  const root = scroller.value;
  if (!root) return false;
  const nav = root.querySelector(".section-nav");
  const inner = nav?.querySelector(".nav-inner");
  const shell = document.querySelector(".tablist-shell");
  if (!nav || !inner || !shell) return false;
  const links = [...inner.querySelectorAll("a")];
  const buttons = [...shell.querySelectorAll('[role="tab"]')];
  if (!links.length || !buttons.length) return false;
  const widthOf = (els) => els.reduce((sum, el) => sum + el.getBoundingClientRect().width, 0);
  const dockedShell = !!shell.closest("#nav-tab-slot");
  const main = widthOf(links) + 4 * (links.length - 1) + 8;
  const sub = widthOf(buttons) + 4 * (buttons.length - 1) + 68 - (dockedShell ? 0 : 36);
  const styles = getComputedStyle(nav);
  const available = nav.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight);
  return main + sub - 46 + 20 <= available;
}

function wantsBeside() {
  /* Desktop keeps the side-by-side bar. Measuring while a tab switch
     restacks the row was flipping 1024 and 1440 into the phone layout. */
  if (window.matchMedia("(min-width: 880px)").matches) return true;
  return besideFits();
}

function setDock(next) {
  if (next) navBeside.value = wantsBeside();
  if (prefersReduced()) {
    window.clearTimeout(closeDockTimer);
    dockState.docked = next;
    dockState.open = next;
    if (!next) navBeside.value = false;
    return;
  }
  if (next) {
    window.clearTimeout(closeDockTimer);
    if (!dockState.docked) {
      dockState.docked = true;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          dockState.open = true;
        });
      });
    } else {
      dockState.open = true;
    }
    return;
  }
  if (!dockState.open && !dockState.docked) return;
  dockState.open = false;
  window.clearTimeout(closeDockTimer);
  closeDockTimer = window.setTimeout(() => {
    if (!dockState.open) {
      dockState.docked = false;
      navBeside.value = false;
    }
  }, 260);
}

function updateDock() {
  const root = scroller.value;
  const sent = document.getElementById("resume-tabs-sentinel");
  const resume = document.getElementById("resume");
  const bar = root?.querySelector(".nav-inner");
  if (!root || !sent || !resume || !bar) return;
  const barBottom = bar.getBoundingClientRect().bottom;
  const sentTop = sent.getBoundingClientRect().top;
  const resumeBottom = resume.getBoundingClientRect().bottom;
  const heading = document.getElementById("resume-heading");
  const shell = root.querySelector("#nav-tab-slot .tablist-shell");
  const barEdge = shell ? Math.max(barBottom, shell.getBoundingClientRect().bottom) : barBottom;
  const headingH = heading ? heading.offsetHeight : 48;
  /* Once the tabs are docked, keep them while the heading is brought
     clear of the bar. The sentinel sits under that heading, including
     its margin, so a one-pixel test would undock and cover it again. */
  const limit = dockState.docked ? barEdge + headingH + 40 : barBottom + 1;
  /* Stay docked only while the resume section still owns the screen.
     Once the Skills heading is in view, the tabs go back inline. */
  setDock(sentTop <= limit && resumeBottom > barBottom + 24 && !skillsInView());
}

let armedDown = true;
let armedUp = false;
let wasInReturn = false;
let animating = false;
let tweenDir = 0;
let raf = 0;
let suppressUntil = 0;
let scrollbarArmed = null;
let touchStartY = 0;
let touchStartScroll = 0;
let touchIgnored = false;
let drivingScroll = false;
let lastProgrammatic = 0;
let lastScrollY = 0;
let cachedAbout = 0;
let heroLimit = 0;
let parallaxHeld = false;
let chromeFrame = 0;

/* Native smooth scroll of the title (about 2168px) measured at ~880ms.
   The cinematic tween is twice that, on cubic-bezier(0.42, 0, 0.58, 1). */
const INTRO_MS = 1760;

function easeInOut(x) {
  const cx = 1.26;
  const bx = -0.78;
  const ax = 0.52;
  const sampleX = (t) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t) => ((-2 * t + 3) * t) * t;
  const sampleDX = (t) => (3 * ax * t + 2 * bx) * t + cx;
  let t = x;
  for (let i = 0; i < 8; i++) {
    const dx = sampleDX(t);
    if (Math.abs(dx) < 1e-6) break;
    t = Math.min(1, Math.max(0, t - (sampleX(t) - x) / dx));
  }
  return sampleY(Math.min(1, Math.max(0, t)));
}

function inTitleZone() {
  const root = scroller.value;
  return !!root && root.scrollTop <= 32;
}

function aboutAnchor() {
  const root = scroller.value;
  const el = document.getElementById("about");
  if (!root || !el) return 0;
  const nav = root.querySelector(".section-nav");
  const navH = nav ? nav.getBoundingClientRect().height : 0;
  return Math.max(0, el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - navH - 4);
}

function measureStatic() {
  const root = scroller.value;
  if (!root) return;
  heroLimit = root.clientHeight;
  cachedAbout = aboutAnchor();
}

function inReturnZone() {
  const root = scroller.value;
  if (!root) return false;
  const y = root.scrollTop;
  const end = cachedAbout || aboutAnchor();
  return y > 48 && y <= end + 80;
}

function canAuto() {
  return !animating && performance.now() > suppressUntil && !prefersReduced();
}

function cancelTween() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  tweenDir = 0;
  if (!animating) return;
  animating = false;
  const root = scroller.value;
  if (root) root.style.scrollBehavior = "";
  suppressUntil = performance.now() + 400;
  releaseSpyLock();
}

function tweenTo(target, done) {
  const root = scroller.value;
  if (!root) return;
  const start = root.scrollTop;
  const dist = target - start;
  if (Math.abs(dist) < 1) {
    tweenDir = 0;
    done?.();
    return;
  }
  animating = true;
  root.style.scrollBehavior = "auto";
  const t0 = performance.now();
  const frame = (now) => {
    if (!animating) return;
    const p = Math.min(1, (now - t0) / INTRO_MS);
    const next = start + dist * easeInOut(p);
    lastProgrammatic = next;
    drivingScroll = true;
    root.scrollTop = next;
    if (p < 1) {
      raf = requestAnimationFrame(frame);
      return;
    }
    animating = false;
    tweenDir = 0;
    raf = 0;
    root.style.scrollBehavior = "";
    done?.();
  };
  raf = requestAnimationFrame(frame);
}

function playDown() {
  if (!canAuto()) return;
  endNativeScroll();
  armedDown = false;
  tweenDir = 1;
  measureStatic();
  tweenTo(cachedAbout || aboutAnchor(), () => {
    armedUp = true;
    wasInReturn = true;
    measureStatic();
    document.getElementById("about")?.focus({ preventScroll: true });
  });
}

function playUp() {
  if (!canAuto()) return;
  endNativeScroll();
  armedUp = false;
  tweenDir = -1;
  tweenTo(0, () => {
    armedDown = true;
    wasInReturn = false;
    document.getElementById("top")?.focus({ preventScroll: true });
  });
}

function sameDirection(delta) {
  return (delta > 0 && tweenDir > 0) || (delta < 0 && tweenDir < 0);
}

function onIntroWheel(event) {
  if (prefersReduced()) return;
  const dy = event.deltaY;
  if (!dy) return;
  if (animating) {
    if (sameDirection(dy)) {
      event.preventDefault();
      return;
    }
    cancelTween();
    suppressUntil = 0;
  }
  if (!canAuto()) return;
  if (dy > 0) {
    if (!armedDown || !inTitleZone()) return;
    event.preventDefault();
    playDown();
    return;
  }
  if (armedUp && inReturnZone()) {
    event.preventDefault();
    playUp();
  }
}

let parallaxY = "";
function syncParallax(root) {
  if (prefersReduced()) {
    parallaxHeld = true;
    root.classList.remove("is-parallax");
    if (parallaxY !== "0") {
      parallaxY = "0";
      root.style.setProperty("--scroll", "0px");
    }
    return;
  }
  const y = root.scrollTop;
  const limit = heroLimit || root.clientHeight;
  if (limit && y > limit) {
    if (!parallaxHeld) {
      parallaxHeld = true;
      root.classList.remove("is-parallax");
      const held = String(Math.round(limit));
      parallaxY = held;
      root.style.setProperty("--scroll", `${held}px`);
    }
    return;
  }
  parallaxHeld = false;
  root.classList.add("is-parallax");
  const next = String(Math.round(y));
  if (next === parallaxY) return;
  parallaxY = next;
  root.style.setProperty("--scroll", `${next}px`);
}

function scheduleChrome() {
  if (chromeFrame) return;
  chromeFrame = requestAnimationFrame(() => {
    chromeFrame = 0;
    updateDock();
    if (!spyLock) applySpy();
    const root = scroller.value;
    if (!root || animating) return;
    const y = root.scrollTop;
    if (y <= 2) {
      armedDown = true;
      armedUp = false;
      wasInReturn = false;
      window.clearTimeout(spySettle);
      if (spyLock) {
        spyLock = null;
        if (activeSection.value !== null) {
          activeSection.value = null;
          syncSpyUrl(null);
        }
      }
      return;
    }
    const zone = inReturnZone();
    if (zone && !wasInReturn) armedUp = true;
    if (!zone && y > (cachedAbout || 0) + 120) armedUp = false;
    wasInReturn = zone;
    if (spyLock) {
      window.clearTimeout(spySettle);
      spySettle = window.setTimeout(releaseSpyLock, 700);
    }
  });
}

function onIntroScroll() {
  const root = scroller.value;
  if (!root) return;
  const y = root.scrollTop;
  if (drivingScroll) {
    drivingScroll = false;
    lastScrollY = y;
    syncParallax(root);
    scheduleChrome();
    return;
  }
  if (animating) {
    const delta = y - lastProgrammatic;
    if ((tweenDir > 0 && delta < -36) || (tweenDir < 0 && delta > 36)) {
      cancelTween();
      lastScrollY = y;
    } else if (Math.abs(delta) > 1) {
      drivingScroll = true;
      root.scrollTop = lastProgrammatic;
      return;
    }
    syncParallax(root);
    scheduleChrome();
    return;
  }
  /* Scroll position alone is not a gesture. Route jumps, reload
     restoration, and find-in-page all move scrollTop without a wheel,
     touch, key, or scrollbar pointer. Those stay native. */
  if (scrollbarArmed && !prefersReduced() && !followNative) {
    const dir = scrollbarArmed;
    const movedDown = y > lastScrollY + 4;
    const movedUp = y < lastScrollY - 4;
    if ((dir === "down" && movedDown) || (dir === "up" && movedUp)) {
      scrollbarArmed = null;
      const back = lastScrollY;
      root.style.scrollBehavior = "auto";
      drivingScroll = true;
      root.scrollTop = back;
      lastScrollY = back;
      if (dir === "down") playDown();
      else playUp();
      return;
    }
  }
  lastScrollY = y;
  syncParallax(root);
  scheduleChrome();
}

function onTouchStart(event) {
  const target = event.target;
  touchIgnored = !!target.closest?.("a, button, input, textarea, select");
  touchStartY = event.touches[0]?.clientY ?? 0;
  touchStartScroll = scroller.value?.scrollTop ?? 0;
}

function onTouchMove(event) {
  if (prefersReduced() || touchIgnored) return;
  const y = event.touches[0]?.clientY ?? touchStartY;
  const dy = touchStartY - y;
  if (animating) {
    if (sameDirection(dy)) {
      if (Math.abs(dy) > 8) event.preventDefault();
      return;
    }
    if (Math.abs(dy) > 28) {
      cancelTween();
      suppressUntil = 0;
    }
    return;
  }
  if (!canAuto()) return;
  if (dy > 12 && armedDown && touchStartScroll <= 32) {
    event.preventDefault();
    playDown();
    return;
  }
  if (dy < -12 && armedUp && touchStartScroll > 48 && touchStartScroll <= (cachedAbout || aboutAnchor()) + 80) {
    event.preventDefault();
    playUp();
  }
}

function onIntroKey(event) {
  if (prefersReduced() || event.metaKey || event.ctrlKey || event.altKey) return;
  const down = event.key === "ArrowDown" || event.key === "PageDown" || (event.key === " " && !event.shiftKey);
  const up = event.key === "ArrowUp" || event.key === "PageUp" || (event.key === " " && event.shiftKey);
  if (!down && !up) return;
  const active = document.activeElement;
  const tag = active?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || active?.isContentEditable) return;
  if (event.key === " " && (tag === "BUTTON" || tag === "A")) return;
  if (animating) {
    if ((down && tweenDir > 0) || (up && tweenDir < 0)) {
      event.preventDefault();
      return;
    }
    cancelTween();
    suppressUntil = 0;
  }
  if (!canAuto()) return;
  if (down && armedDown && inTitleZone()) {
    event.preventDefault();
    playDown();
    return;
  }
  if (up && armedUp && inReturnZone()) {
    event.preventDefault();
    playUp();
  }
}

function onScrollbarPointerDown(event) {
  if (event.pointerType === "touch" || event.button !== 0) return;
  const root = scroller.value;
  if (!root) return;
  const rect = root.getBoundingClientRect();
  const gutter = Math.max(root.offsetWidth - root.clientWidth, 14);
  if (event.clientX < rect.right - gutter) return;
  if (inTitleZone()) scrollbarArmed = "down";
  else if (inReturnZone()) scrollbarArmed = "up";
}

function onScrollbarPointerUp() {
  scrollbarArmed = null;
}

function onResize() {
  measureStatic();
  if (dockState.docked) navBeside.value = wantsBeside();
  updateDock();
}

onMounted(async () => {
  await nextTick();
  ready.value = true;
  if (route.name !== "home") syncScroll("instant");
  else lastKey = "home::top";
  const root = scroller.value;
  if (!root) return;
  measureStatic();
  lastScrollY = root.scrollTop;
  syncParallax(root);
  root.addEventListener("wheel", onIntroWheel, { passive: false });
  root.addEventListener("scroll", onIntroScroll, { passive: true });
  root.addEventListener("pointerdown", onScrollbarPointerDown);
  root.addEventListener("pointerup", onScrollbarPointerUp);
  root.addEventListener("pointercancel", onScrollbarPointerUp);
  root.addEventListener("touchstart", onTouchStart, { passive: true });
  root.addEventListener("touchmove", onTouchMove, { passive: false });
  window.addEventListener("keydown", onIntroKey);
  window.addEventListener("resize", onResize);
  document.fonts?.ready.then(() => {
    if (dockState.docked) navBeside.value = wantsBeside();
  });
  updateDock();
  spyObserver = new IntersectionObserver(onSpy, {
    root,
    rootMargin: "-8% 0px -42% 0px",
    threshold: 0,
  });
  for (const id of sectionIds) {
    const el = document.getElementById(id);
    if (el) spyObserver.observe(el);
  }
});

onUnmounted(() => {
  const root = scroller.value;
  window.clearTimeout(spySettle);
  window.clearTimeout(closeDockTimer);
  if (raf) cancelAnimationFrame(raf);
  spyObserver?.disconnect();
  root?.removeEventListener("wheel", onIntroWheel);
  root?.removeEventListener("scroll", onIntroScroll);
  root?.removeEventListener("pointerdown", onScrollbarPointerDown);
  root?.removeEventListener("pointerup", onScrollbarPointerUp);
  root?.removeEventListener("pointercancel", onScrollbarPointerUp);
  root?.removeEventListener("touchstart", onTouchStart);
  root?.removeEventListener("touchmove", onTouchMove);
  window.removeEventListener("keydown", onIntroKey);
  window.removeEventListener("resize", onResize);
  window.clearTimeout(followTimer);
});

watch(
  () => route.fullPath,
  () => {
    if (route.name === "resume") resumePath = route.path;
    if (!ready.value) return;
    if (urlFromSpy) {
      urlFromSpy = false;
      lastKey = `${route.name}:${route.params.tab || ""}:${targetForRoute()}`;
      return;
    }
    syncScroll();
  },
);
</script>

<template>
  <ClientOnly>
    <Stars />
  </ClientOnly>
  <a class="skip" href="/about" @click="onNav($event, 'about')">Skip to content</a>
  <div class="prlx" ref="scroller">
    <Hero />
    <div class="mountain-bg sky-grad" aria-hidden="true"></div>
    <div
      v-for="layer in ridgeLayers"
      :key="layer.id"
      class="mountain-bg"
      :class="`${layer.id}-bg`"
      aria-hidden="true"
    >
      <picture>
        <source type="image/avif" :srcset="layer.srcAvif" :sizes="layerSizes" />
        <img
          :src="layer.fallback"
          :srcset="layer.srcWebp"
          :sizes="layerSizes"
          alt=""
          decoding="async"
          :width="layer.w"
          :height="layer.h"
        />
      </picture>
    </div>
    <div class="ridge-ground" aria-hidden="true"></div>
    <div class="sunrise" aria-hidden="true">
      <div class="band band-night"></div>
      <div class="band band-mauve"></div>
      <div class="band band-pink"></div>
      <div class="band band-coral"></div>
      <div class="band band-orange"></div>
      <div class="band band-gold"></div>
      <div class="band band-yellow"></div>
      <div class="band band-bright"></div>
      <div class="band band-white"></div>
    </div>
    <main class="sheet">
      <nav class="section-nav" :class="{ 'is-docked': dockState.docked, 'is-open': dockState.open, 'is-beside': navBeside }" aria-label="Sections">
        <div class="nav-cluster">
          <div class="nav-inner">
            <a href="/about" :aria-current="activeSection === 'about' ? 'page' : undefined" @click="onNav($event, 'about')">About</a>
            <a href="/projects" :aria-current="activeSection === 'projects' ? 'page' : undefined" @click="onNav($event, 'projects')">Projects</a>
            <a href="/resume" :aria-current="activeSection === 'resume' ? 'page' : undefined" @click="onNav($event, 'resume')">Resume</a>
            <a href="/skills" :aria-current="activeSection === 'skills' ? 'page' : undefined" @click="onNav($event, 'skills')">Skills</a>
          </div>
          <div id="nav-tab-slot" class="nav-dock"></div>
        </div>
      </nav>
      <div class="center-col measure">
        <AboutSection />
        <ProjectsSection />
        <ResumeSection />
        <section id="skills" class="section" aria-labelledby="skills-heading">
          <h2 id="skills-heading" class="section-title">Skills</h2>
          <ul class="skills">
            <li v-for="skill in skills" :key="skill">{{ skill }}</li>
          </ul>
        </section>
      </div>
      <SiteFooter />
    </main>
  </div>
</template>
