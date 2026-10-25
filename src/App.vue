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
import DinersPage from "./components/DinersPage.vue";
import { skills } from "./data/content.js";
import { dockKey, scrollKey } from "./scroll.js";

const ORIGIN = "https://vishnu.rengaraj.com";
const route = useRoute();
const router = useRouter();
const scroller = ref(null);
const ready = ref(false);
const titleLocked = ref(false);
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
  const style = getComputedStyle(nav);
  const stickyTop = Number.parseFloat(style.top) || 0;
  const padTop = Number.parseFloat(style.paddingTop) || 0;
  /* The gold up control needs a little more air under the pinned pill
     than a section heading does. Every in-page target is read with the
     bar pinned, so the gap does not depend on whether it has stuck yet. */
  const gap = targetId === "about" ? 20 : 12;
  let cover = stickyTop + padTop + inner.offsetHeight;
  const shell = nav.classList.contains("is-open") ? nav.querySelector("#nav-tab-slot .tablist-shell") : null;
  if (shell) {
    const shellBottom = shell.getBoundingClientRect().bottom - rootTop;
    if (shellBottom > cover) cover = shellBottom;
  }
  return cover + gap;
}

function anchorFor(id) {
  if (id === "about") {
    return (
      document.querySelector(".home-return") ||
      document.getElementById("about-heading") ||
      document.getElementById("about")
    );
  }
  return document.getElementById(`${id}-heading`) || document.getElementById(id);
}

function syncTitleLock() {
  const on = window.matchMedia("(max-width: 900px) and (orientation: portrait)").matches;
  titleLocked.value = on;
  scroller.value?.classList.toggle("is-title-lock", on);
}

let followNative = false;
let followTimer = 0;
let scrollGen = 0;

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
  const jumpTitle = titleLocked.value && root.scrollTop <= 32;
  /* "instant", not "auto": auto defers to the CSS smooth scroll on .prlx,
     so reduced-motion jumps were still animating. */
  const mode = behavior === "smooth" || (!behavior && !prefersReduced() && !jumpTitle) ? "smooth" : "instant";
  const gen = ++scrollGen;
  /* The page can grow while a smooth scroll is in flight. Re-measure
     so the heading still meets the bar, or the end when it cannot. */
  const pinLanding = () => {
    if (gen !== scrollGen) return;
    const end = Math.max(0, root.scrollHeight - root.clientHeight);
    if (id !== "top" && Math.abs(root.scrollTop - top) <= 600) {
      const anchor = anchorFor(id);
      if (anchor && root.scrollTop < end - 2) {
        const anchorTop = anchor.getBoundingClientRect().top - root.getBoundingClientRect().top;
        const clearance = barClearance(id);
        if (anchorTop > clearance + 8) {
          const next = Math.min(end, root.scrollTop + (anchorTop - clearance));
          if (next > root.scrollTop + 2) {
            root.style.scrollBehavior = "auto";
            drivingScroll = true;
            root.scrollTop = next;
            root.style.scrollBehavior = "";
          }
        }
      }
    }
    const endNow = Math.max(0, root.scrollHeight - root.clientHeight);
    if (endNow - root.scrollTop <= 32 && endNow - root.scrollTop > 1) {
      root.style.scrollBehavior = "auto";
      drivingScroll = true;
      root.scrollTop = endNow;
      root.style.scrollBehavior = "";
    }
    updateDock();
    applySpy();
  };
  const landed = () => {
    endNativeScroll();
    pinLanding();
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
    if (mode !== "smooth") {
      /* An instant jump (reduced motion, or leaving the locked title)
         is not a finger. Mark it as ours so the title lock does not
         pull it back to the top. */
      drivingScroll = true;
      lastScrollY = top;
    }
    root.scrollTo({ top, behavior: mode });
    if (mode === "smooth") {
      root.addEventListener(
        "scrollend",
        () => {
          landed();
          window.setTimeout(pinLanding, 450);
        },
        { once: true },
      );
      window.setTimeout(pinLanding, 1600);
    } else landed();
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
let routeFromTween = false;
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
  if (route.name === "diners") return;
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
  if (route.name === "diners") return;
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

let navQuietUntil = 0;

function go(id) {
  /* Learn more and the up control stay no-ops for the whole sunrise,
     even after the page has left the title. Cancelling there used to
     snap back to the top. The up control also quiets nav taps, because
     the bar slides under a finger that is still coming down. */
  if (id === "home") navQuietUntil = performance.now() + 320;
  if (animating && (id === "home" || id === "about")) return;
  cancelTween();
  if (id === "home") {
    activeSection.value = null;
    const y = scroller.value?.scrollTop || 0;
    if (!prefersReduced() && y > 2) {
      if (route.path !== "/") {
        routeFromTween = true;
        router.push("/");
      }
      playUp();
      return;
    }
    if (route.path !== "/") router.push("/");
    else scrollToEl("top", "auto");
    return;
  }
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
  /* The up tween slides the bar under a finger that is still tapping.
     Ignore nav clicks until that motion is underway, and for a short
     beat after the up control itself was pressed. */
  if (animating || performance.now() < navQuietUntil) {
    event.preventDefault();
    return;
  }
  event.preventDefault();
  go(id);
}

provide(scrollKey, go);

const dockState = reactive({ docked: false, open: false, joined: false, hold: 0 });
provide(dockKey, dockState);

let closeDockTimer = 0;

function measureTabHold() {
  const shell = document.querySelector("#resume-tab-slot .tablist-shell");
  if (!shell) return;
  const height = Math.ceil(shell.getBoundingClientRect().height);
  if (height > 0) dockState.hold = height;
}

/* The row is out of flow and a same-height placeholder keeps the
   document from growing or shrinking, so docking does not move
   scrollTop. Do not snap scroll position here: a correction also
   aborts the page's own smooth scrolls and fast wheels. */
function setDock(next) {
  if (next) {
    if (dockState.docked && dockState.open) return;
    if (!dockState.docked) measureTabHold();
    window.clearTimeout(closeDockTimer);
    if (prefersReduced()) {
      dockState.docked = true;
      dockState.open = true;
      dockState.joined = true;
      return;
    }
    if (!dockState.docked) {
      dockState.docked = true;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!dockState.docked) return;
          dockState.open = true;
          dockState.joined = true;
        });
      });
    } else {
      dockState.open = true;
      dockState.joined = true;
    }
    return;
  }
  if (!dockState.docked || !dockState.open) return;
  if (prefersReduced()) {
    dockState.open = false;
    dockState.joined = false;
    dockState.docked = false;
    return;
  }
  dockState.open = false;
  window.clearTimeout(closeDockTimer);
  closeDockTimer = window.setTimeout(() => {
    if (!dockState.open) {
      dockState.joined = false;
      dockState.docked = false;
    }
  }, 320);
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
  const headingTop = heading ? heading.getBoundingClientRect().top : sentTop;
  /* The heading is in view under the pill, so the tabs belong inline
     beneath it. Hysteresis only applies while that heading is still
     up under the bar, or the row would cover the title. */
  const headingClear = headingTop >= barBottom - 2;
  const limit = dockState.docked && !headingClear ? barEdge + headingH + 40 : barBottom + 1;
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
  const el = anchorFor("about");
  if (!root || !el) return 0;
  return Math.max(
    0,
    el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - barClearance("about"),
  );
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
  curveDir = 0;
  if (!animating) return;
  animating = false;
  const root = scroller.value;
  root?.classList.remove("is-intro");
  if (root) root.style.scrollBehavior = "";
  suppressUntil = performance.now() + 400;
  releaseSpyLock();
}

/* The sunrise is one curve from curveFrom at t=0 to curveTo at
   INTRO_MS. Reversing flips direction on that same curve, so the page
   keeps its position and speed and returns to the end it left. */
let curveFrom = 0;
let curveTo = 0;
let curveElapsed = 0;
let curveDir = 1;
let curveClock = 0;
let curveOnFrom = null;
let curveOnTo = null;

function scrollDirection() {
  const toward = curveDir > 0 ? curveTo - curveFrom : curveFrom - curveTo;
  return toward >= 0 ? 1 : -1;
}

function reverseTween() {
  if (!animating) return;
  curveDir *= -1;
  curveClock = performance.now();
  tweenDir = scrollDirection();
}

function finishCurve(atTo) {
  const root = scroller.value;
  animating = false;
  root?.classList.remove("is-intro");
  drivingScroll = false;
  tweenDir = 0;
  curveDir = 0;
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  if (root) {
    const y = atTo ? curveTo : curveFrom;
    root.style.scrollBehavior = "auto";
    if (Math.abs(root.scrollTop - y) > 0.5) {
      drivingScroll = true;
      root.scrollTop = y;
    }
    root.style.scrollBehavior = "";
    lastScrollY = root.scrollTop;
    lastProgrammatic = root.scrollTop;
  }
  const done = atTo ? curveOnTo : curveOnFrom;
  curveOnTo = null;
  curveOnFrom = null;
  done?.();
  queueAnchor();
}

function tweenBetween(from, to, onFrom, onTo) {
  const root = scroller.value;
  if (!root) return;
  if (Math.abs(to - from) < 1) {
    tweenDir = 0;
    onTo?.();
    return;
  }
  if (raf) cancelAnimationFrame(raf);
  animating = true;
  root.classList.add("is-intro");
  curveFrom = from;
  curveTo = to;
  curveElapsed = 0;
  curveDir = 1;
  curveOnFrom = onFrom;
  curveOnTo = onTo;
  tweenDir = to >= from ? 1 : -1;
  lastProgrammatic = from;
  root.style.scrollBehavior = "auto";
  curveClock = performance.now();
  const frame = (now) => {
    if (!animating) return;
    const dt = Math.min(34, Math.max(0, now - curveClock));
    curveClock = now;
    curveElapsed += curveDir * dt;
    if (curveDir > 0 && curveElapsed >= curveDurationEdge()) {
      finishCurve(true);
      return;
    }
    if (curveDir < 0 && curveElapsed <= 0) {
      finishCurve(false);
      return;
    }
    const p = Math.min(1, Math.max(0, curveElapsed / INTRO_MS));
    const next = curveFrom + (curveTo - curveFrom) * easeInOut(p);
    lastProgrammatic = next;
    tweenDir = scrollDirection();
    if (root.scrollTop !== next) {
      drivingScroll = true;
      root.scrollTop = next;
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
}

function curveDurationEdge() {
  return INTRO_MS - 0.5;
}

function playDown() {
  if (!canAuto()) return;
  endNativeScroll();
  armedDown = false;
  measureStatic();
  const dest = cachedAbout || aboutAnchor();
  const root = scroller.value;
  tweenBetween(
    root ? root.scrollTop : 0,
    dest,
    () => {
      armedDown = true;
      wasInReturn = false;
      document.getElementById("top")?.focus({ preventScroll: true });
    },
    () => {
      armedUp = true;
      wasInReturn = true;
      measureStatic();
      document.getElementById("about")?.focus({ preventScroll: true });
    },
  );
}

function playUp() {
  if (!canAuto()) return;
  endNativeScroll();
  armedUp = false;
  const root = scroller.value;
  tweenBetween(
    root ? root.scrollTop : 0,
    0,
    () => {
      armedUp = true;
      wasInReturn = true;
      measureStatic();
      document.getElementById("about")?.focus({ preventScroll: true });
    },
    () => {
      armedDown = true;
      wasInReturn = false;
      document.getElementById("top")?.focus({ preventScroll: true });
    },
  );
}

function sameDirection(delta) {
  return (delta > 0 && tweenDir > 0) || (delta < 0 && tweenDir < 0);
}

let gestureUntil = 0;

function armGesture(ms) {
  gestureUntil = performance.now() + ms;
}

function clampTitleLock(root) {
  if (!titleLocked.value || animating || drivingScroll || followNative) return false;
  /* Find-in-page and other programmatic jumps land where they were
     sent. Only a recent finger or wheel is pulled back to an end. */
  if (performance.now() >= gestureUntil) return false;
  const about = cachedAbout || aboutAnchor();
  if (!about) return false;
  const y = root.scrollTop;
  if (y > 1 && y < about - 1) {
    const dest = lastScrollY >= about - 1 ? about : 0;
    root.style.scrollBehavior = "auto";
    drivingScroll = true;
    root.scrollTop = dest;
    lastScrollY = dest;
    return true;
  }
  return false;
}

function onIntroWheel(event) {
  if (event.deltaY) armGesture(500);
  if (titleLocked.value) {
    const root = scroller.value;
    if (!root) return;
    const about = cachedAbout || aboutAnchor();
    const y = root.scrollTop;
    if (y < about - 1 || (event.deltaY < 0 && y <= about + 2)) {
      event.preventDefault();
    }
    return;
  }
  if (prefersReduced()) return;
  const dy = event.deltaY;
  if (!dy) return;
  if (animating) {
    event.preventDefault();
    if (!sameDirection(dy)) reverseTween();
    return;
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
    queueAnchor();
    return;
  }
  if (animating) {
    const delta = y - lastProgrammatic;
    if (titleLocked.value) {
      drivingScroll = true;
      root.scrollTop = lastProgrammatic;
      return;
    }
    if (performance.now() < scrollFightUntil) {
      drivingScroll = true;
      root.scrollTop = lastProgrammatic;
      return;
    }
    if ((tweenDir > 0 && delta < -36) || (tweenDir < 0 && delta > 36)) {
      reverseTween();
      drivingScroll = true;
      root.scrollTop = lastProgrammatic;
      return;
    } else if (Math.abs(delta) > 1) {
      drivingScroll = true;
      root.scrollTop = lastProgrammatic;
      return;
    }
    syncParallax(root);
    scheduleChrome();
    return;
  }
  if (clampTitleLock(root)) return;
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
  queueAnchor();
}

function onTouchStart(event) {
  const target = event.target;
  touchIgnored = !!target.closest?.("a, button, input, textarea, select");
  touchStartY = event.touches[0]?.clientY ?? 0;
  touchStartScroll = scroller.value?.scrollTop ?? 0;
}

function onTouchEnd() {
  /* A tap on a button or link is not a drag. Arming here let the title
     lock pull the page back after a reduced-motion Learn more jump. */
  if (!touchIgnored) armGesture(1200);
}

function onTouchMove(event) {
  armGesture(800);
  const y = event.touches[0]?.clientY ?? touchStartY;
  const dy = touchStartY - y;
  const root = scroller.value;
  const about = cachedAbout || aboutAnchor();
  if (titleLocked.value && root) {
    const block = animating || touchStartScroll < about - 1 || (dy < -8 && touchStartScroll <= about + 2);
    if (block && !(touchIgnored && Math.abs(dy) < 12)) event.preventDefault();
    return;
  }
  /* A finger on the title must not drag the page into a half sunrise.
     The button (and, on a desktop, the wheel) plays the full tween. */
  if (!touchIgnored && touchStartScroll <= 32 && dy > 8) {
    event.preventDefault();
    return;
  }
  if (prefersReduced() || touchIgnored) return;
  if (animating) {
    if (Math.abs(dy) > 8) event.preventDefault();
    if (Math.abs(dy) > 28 && !sameDirection(dy)) reverseTween();
    return;
  }
  if (!canAuto()) return;
  if (dy < -12 && armedUp && touchStartScroll > 48 && touchStartScroll <= about + 80) {
    event.preventDefault();
    playUp();
  }
}

function onIntroKey(event) {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const down = event.key === "ArrowDown" || event.key === "PageDown" || (event.key === " " && !event.shiftKey);
  const up = event.key === "ArrowUp" || event.key === "PageUp" || (event.key === " " && event.shiftKey);
  if (!down && !up) return;
  if (titleLocked.value) {
    const root = scroller.value;
    const about = cachedAbout || aboutAnchor();
    const y = root?.scrollTop ?? 0;
    const typing = document.activeElement;
    const typingTag = typing?.tagName;
    if (typingTag === "INPUT" || typingTag === "TEXTAREA" || typingTag === "SELECT" || typing?.isContentEditable) return;
    if (event.key === " " && (typingTag === "BUTTON" || typingTag === "A")) return;
    if (y < about - 1 || (up && y <= about + 8)) event.preventDefault();
    return;
  }
  if (prefersReduced()) return;
  const active = document.activeElement;
  const tag = active?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || active?.isContentEditable) return;
  if (event.key === " " && (tag === "BUTTON" || tag === "A")) return;
  if (animating) {
    event.preventDefault();
    if ((down && tweenDir < 0) || (up && tweenDir > 0)) reverseTween();
    return;
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

/* Tabbing from Learn more into the nav (or Shift+Tab back up to the
   title) moves focus across the sunrise. The browser's own scroll to
   the focused element used to leave the page part way, with the sky
   bands showing. Finish the trip instead, and keep focus where it is. */
function onFocusIn(event) {
  const root = scroller.value;
  const target = event.target;
  if (!root || !target || animating || target === root) return;
  const about = cachedAbout || aboutAnchor();
  if (!about) return;
  requestAnimationFrame(() => {
    if (animating) return;
    /* Use the element that is focused now. WebKit delivers the title
       button's focus event after Tab has already moved to the nav, and
       acting on the stale target rewound the trip. */
    const current = document.activeElement;
    if (!current || current === root || !root.contains(current)) return;
    const y = root.scrollTop;
    const inTitle = !!current.closest?.("#top");
    let dest = null;
    if (inTitle && y > 2 && y < about + 2) dest = 0;
    else if (!inTitle && y < about - 2) dest = about;
    if (dest === null) return;
    endNativeScroll();
    if (prefersReduced()) {
      root.style.scrollBehavior = "auto";
      drivingScroll = true;
      root.scrollTop = dest;
      lastScrollY = dest;
      root.style.scrollBehavior = "";
      armedDown = dest === 0;
      armedUp = dest !== 0;
      return;
    }
    scrollFightUntil = performance.now() + 700;
    if (dest === about) {
      armedDown = false;
      tweenBetween(
        y,
        about,
        () => {
          armedDown = true;
          wasInReturn = false;
        },
        () => {
          armedUp = true;
          wasInReturn = true;
          measureStatic();
        },
      );
    } else {
      armedUp = false;
      tweenBetween(
        y,
        0,
        () => {
          armedUp = true;
          wasInReturn = true;
        },
        () => {
          armedDown = true;
          wasInReturn = false;
        },
      );
    }
  });
}

function onScrollbarPointerDown(event) {
  if (titleLocked.value) return;
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

/* The scroller has overflow-anchor: none, and Safari has no scroll
   anchoring at all, so a rotation or window resize kept the raw
   scrollTop and dropped the reader into another section. Remember what
   is at the top of the view while idle and put it back after a resize. */
/* WebKit scrolls a focused nav link on its own for a few frames. That
   used to look like a wheel the other way and rewind a focus tween. */
let scrollFightUntil = 0;
let scrollAnchor = null;
let anchorTimer = 0;
let anchorPending = false;
let lastWidth = 0;

function rememberAnchor() {
  const root = scroller.value;
  if (!root || animating) return;
  const y = root.scrollTop;
  const about = cachedAbout || aboutAnchor();
  if (y <= 2) {
    scrollAnchor = { kind: "top" };
    return;
  }
  if (about && Math.abs(y - about) <= 2) {
    scrollAnchor = { kind: "about" };
    return;
  }
  const rootTop = root.getBoundingClientRect().top;
  let best = null;
  let bestTop = Infinity;
  for (const el of root.querySelectorAll("main h2, main h3, main .card, main .timeline li, .site-footer")) {
    const r = el.getBoundingClientRect();
    if (!r.height) continue;
    const t = r.top - rootTop;
    if (t >= 0 && t < bestTop) {
      best = el;
      bestTop = t;
    }
  }
  scrollAnchor = best ? { kind: "el", el: best, top: bestTop } : null;
}

function queueAnchor() {
  window.clearTimeout(anchorTimer);
  anchorPending = true;
  anchorTimer = window.setTimeout(() => {
    anchorPending = false;
    rememberAnchor();
  }, 160);
}

function restoreAnchor() {
  const root = scroller.value;
  const a = scrollAnchor;
  if (!root || !a) return;
  let dest = null;
  if (a.kind === "top") dest = 0;
  else if (a.kind === "about") dest = cachedAbout || aboutAnchor();
  else if (a.el?.isConnected) {
    const r = a.el.getBoundingClientRect();
    if (r.height) dest = root.scrollTop + (r.top - root.getBoundingClientRect().top) - a.top;
  }
  if (dest === null) return;
  const max = Math.max(0, root.scrollHeight - root.clientHeight);
  dest = Math.min(max, Math.max(0, Math.round(dest)));
  if (Math.abs(root.scrollTop - dest) < 1) return;
  root.style.scrollBehavior = "auto";
  drivingScroll = true;
  root.scrollTop = dest;
  lastScrollY = dest;
  lastProgrammatic = dest;
  root.style.scrollBehavior = "";
}

function onResize() {
  const oldAbout = cachedAbout;
  measureStatic();
  syncTitleLock();
  if (animating) {
    /* The sunrise was aimed at the old About position. Re-aim it. */
    const nextAbout = cachedAbout;
    if (oldAbout && nextAbout && oldAbout !== nextAbout) {
      if (Math.abs(curveTo - oldAbout) < 2) curveTo = nextAbout;
      if (Math.abs(curveFrom - oldAbout) < 2) curveFrom = nextAbout;
    }
  } else if (window.innerWidth !== lastWidth && !anchorPending) {
    /* Width changes only (rotation, window resize). A height-only change
       such as a browser bar, or one during a scroll, keeps its place. */
    restoreAnchor();
  }
  lastWidth = window.innerWidth;
  updateDock();
}

let shellStarted = false;

async function startShell() {
  if (shellStarted || route.name === "diners") return;
  const queued = document.documentElement.dataset.queuedScroll || "";
  if (queued) delete document.documentElement.dataset.queuedScroll;
  await nextTick();
  if (shellStarted || route.name === "diners") return;
  const root = scroller.value;
  if (!root) return;
  shellStarted = true;
  ready.value = true;
  if (route.name !== "home") {
    lastKey = "";
    syncScroll("instant");
  } else lastKey = "home::top";
  measureStatic();
  syncTitleLock();
  lastScrollY = root.scrollTop;
  lastWidth = window.innerWidth;
  syncParallax(root);
  queueAnchor();
  root.addEventListener("wheel", onIntroWheel, { passive: false });
  root.addEventListener("scroll", onIntroScroll, { passive: true });
  root.addEventListener("pointerdown", onScrollbarPointerDown);
  root.addEventListener("pointerup", onScrollbarPointerUp);
  root.addEventListener("pointercancel", onScrollbarPointerUp);
  root.addEventListener("focusin", onFocusIn);
  root.addEventListener("touchstart", onTouchStart, { passive: true });
  root.addEventListener("touchmove", onTouchMove, { passive: false });
  root.addEventListener("touchend", onTouchEnd, { passive: true });
  root.addEventListener("touchcancel", onTouchEnd, { passive: true });
  window.addEventListener("keydown", onIntroKey);
  window.addEventListener("resize", onResize);
  updateDock();
  if (queued === "about" || queued === "home") go(queued);
  spyObserver = new IntersectionObserver(onSpy, {
    root,
    rootMargin: "-8% 0px -42% 0px",
    threshold: 0,
  });
  for (const id of sectionIds) {
    const el = document.getElementById(id);
    if (el) spyObserver.observe(el);
  }
}

function stopShell() {
  if (!shellStarted) return;
  shellStarted = false;
  const root = scroller.value;
  window.clearTimeout(spySettle);
  window.clearTimeout(closeDockTimer);
  window.clearTimeout(followTimer);
  if (chromeFrame) cancelAnimationFrame(chromeFrame);
  chromeFrame = 0;
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  animating = false;
  spyObserver?.disconnect();
  spyObserver = undefined;
  root?.removeEventListener("wheel", onIntroWheel);
  root?.removeEventListener("scroll", onIntroScroll);
  root?.removeEventListener("pointerdown", onScrollbarPointerDown);
  root?.removeEventListener("pointerup", onScrollbarPointerUp);
  root?.removeEventListener("pointercancel", onScrollbarPointerUp);
  root?.removeEventListener("focusin", onFocusIn);
  root?.removeEventListener("touchstart", onTouchStart);
  root?.removeEventListener("touchmove", onTouchMove);
  root?.removeEventListener("touchend", onTouchEnd);
  root?.removeEventListener("touchcancel", onTouchEnd);
  window.removeEventListener("keydown", onIntroKey);
  window.removeEventListener("resize", onResize);
  ready.value = false;
}

onMounted(() => {
  document.documentElement.classList.add("vue-ready");
  startShell();
});

onUnmounted(() => {
  stopShell();
});

watch(
  () => route.name,
  (name, prev) => {
    if (name === "diners") {
      lastKey = "diners";
      stopShell();
    } else if (prev === "diners") startShell();
  },
);

watch(
  () => route.fullPath,
  () => {
    if (route.name === "diners") return;
    if (route.name === "resume") resumePath = route.path;
    if (!ready.value || !scroller.value) return;
    if (urlFromSpy || routeFromTween) {
      urlFromSpy = false;
      routeFromTween = false;
      lastKey = `${route.name}:${route.params.tab || ""}:${targetForRoute()}`;
      return;
    }
    syncScroll();
  },
);
</script>

<template>
  <DinersPage v-if="route.name === 'diners'" />
  <template v-else>
  <a class="skip" href="/about" @click="onNav($event, 'about')">Skip to content</a>
  <div class="prlx" ref="scroller">
    <Hero />
    <div class="mountain-bg sky-grad" aria-hidden="true"></div>
    <Stars />
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
      <nav class="section-nav" :class="{ 'is-docked': dockState.docked, 'is-open': dockState.open, 'is-joined': dockState.joined }" aria-label="Sections">
        <div class="nav-cluster">
          <div class="nav-inner">
            <a href="/about" :aria-current="activeSection === 'about' ? 'page' : undefined" @click="onNav($event, 'about')">About</a>
            <a href="/projects" :aria-current="activeSection === 'projects' ? 'page' : undefined" @click="onNav($event, 'projects')">Projects</a>
            <a href="/resume" :aria-current="activeSection === 'resume' ? 'page' : undefined" @click="onNav($event, 'resume')">Resume</a>
            <a href="/skills" :aria-current="activeSection === 'skills' ? 'page' : undefined" @click="onNav($event, 'skills')">Skills</a>
          </div>
          <div class="nav-dock-clip">
            <div id="nav-tab-slot" class="nav-dock"></div>
          </div>
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
</template>
