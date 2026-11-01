<script setup>
import { computed, nextTick, onMounted, onUnmounted, provide, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useHead } from "@unhead/vue";
import monoBold from "@fontsource/roboto-mono/files/roboto-mono-latin-700-normal.woff2?url";
import headingBlack from "./fonts/roboto-900-headings.woff2?url";
import Stars from "./components/Stars.vue";
import Hero from "./components/Hero.vue";
import Headlamps from "./components/Headlamps.vue";
import AboutSection from "./components/AboutSection.vue";
import ProjectsSection from "./components/ProjectsSection.vue";
import ResumeSection from "./components/ResumeSection.vue";
import SiteFooter from "./components/SiteFooter.vue";
import DinersPage from "./components/DinersPage.vue";
import TitleProto from "./components/TitleProto.vue";
import { RESUME_PARTS, dockKey, resumeJumpKey, resumePartKey, scrollKey } from "./scroll.js";
import {
  LAYER_IDS,
  PRODUCTION_VARIANT,
  PROTO_STORAGE_KEY,
  bandsFor,
  ratesFor,
  readTitleVariant,
  variantById,
} from "./title-proto.js";

const ORIGIN = "https://vishnu.rengaraj.com";
const route = useRoute();
const router = useRouter();
const scroller = ref(null);
const ready = ref(false);
const titleLocked = ref(false);
const titleVariant = ref(PRODUCTION_VARIANT);
const protoReady = ref(false);
const protoPanel = ref(null);
let protoHold = false;
const titleMeta = computed(() => variantById(titleVariant.value) || variantById(PRODUCTION_VARIANT));
const titleDense = computed(() => titleMeta.value.dense);
const sunriseBands = computed(() => bandsFor(titleDense.value));
const sunriseFill = computed(() => sunriseBands.value[0]?.style?.backgroundColor || "#221445");
const titleRateVars = computed(() => {
  const rates = ratesFor(titleMeta.value.rates);
  const style = {};
  for (const id of LAYER_IDS) style[`--rate-${id}`] = String(rates[id]);
  return style;
});
// Painted width in title.css:
//   max(100vw * --ridge-overscan, (100dvh - --ridge-top) / --ridge-show * --aspect)
//   --ridge-overscan: 1.08; --ridge-show: 0.5;
//   --ridge-top: clamp(132px, 7vh + 360px, 62vh)
// vh stands in for dvh here; they match on desktop, and the narrow slots
// below cover phones. Keep in sync with widthsFor() in scripts/render-ridge-layers.mjs.
function ridgeSizes(masterW, masterH) {
  const aspect = Math.round((masterW / masterH) * 10000) / 10000;
  const scale = (aspect * 2).toFixed(4);
  const painted = `max(108vw, calc((100vh - clamp(132px, 7vh + 360px, 62vh)) * ${scale}))`;
  // Portrait widths through 820px use the shorter phone frame in title.css,
  // so they stay on the narrow slot. Landscape under 800px does too.
  return `(max-width: 360px) 900px, (max-width: 820px) and (orientation: portrait) 1500px, (max-width: 800px) 1500px, ${painted}`;
}

function ridgeWidths(master) {
  const widths = [960, 1600, 2400, 3200];
  if (master >= 4200) widths.push(4200);
  if (master >= 4800) widths.push(4800);
  else if (master > 4200) widths.push(master);
  return widths;
}

function layerSrcset(id, widths, ext) {
  return widths.map((n) => `/media/layers/${id}-${n}.${ext} ${n}w`).join(", ");
}

const ridgeLayers = [
  ["l1", 14058, 4277],
  ["l2", 4686, 1689],
  ["l3", 4686, 1692],
  ["l4", 4686, 1704],
  ["l5", 4685, 1704],
  ["l6", 4685, 1707],
  ["l7", 4685, 2019],
].map(([id, w, h]) => {
  const widths = ridgeWidths(w);
  const narrow = widths.filter((n) => n <= 3200);
  return {
    id,
    w,
    h,
    sizes: ridgeSizes(w, h),
    fallback: `/media/layers/${id}-1600.webp`,
    srcAvif: layerSrcset(id, widths, "avif"),
    srcWebp: layerSrcset(id, widths, "webp"),
    srcAvifNarrow: layerSrcset(id, narrow, "avif"),
    srcWebpNarrow: layerSrcset(id, narrow, "webp"),
  };
});

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

function barClearance(targetId, extraGap = 0) {
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
  const gap = (targetId === "about" ? 20 : 12) + extraGap;
  let cover = stickyTop + padTop + inner.offsetHeight;
  const shell = nav.classList.contains("is-open") ? nav.querySelector("#nav-tab-slot .tablist-shell") : null;
  if (shell) {
    const bottom = shell.getBoundingClientRect().bottom - rootTop;
    if (bottom > cover) cover = bottom;
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

function scrollToEl(id, behavior, extraGap = 0, focusLanding = true) {
  const root = scroller.value;
  if (!root || typeof document === "undefined") return;
  const started = performance.now();
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
      if (anchor) {
        const anchorTop = anchor.getBoundingClientRect().top - root.getBoundingClientRect().top;
        const clearance = barClearance(id, extraGap);
        const delta = anchorTop - clearance;
        const atEnd = root.scrollTop >= end - 2;
        /* Positive: the page grew and the heading sits too low.
           Negative: it slipped under the sticky bar. Don't push the
           last heading under the bar just to reach the end. */
        if ((!atEnd && delta > 8) || delta < -2) {
          const nextTop = Math.min(end, Math.max(0, root.scrollTop + delta));
          if (Math.abs(nextTop - root.scrollTop) > 2) {
            root.style.scrollBehavior = "auto";
            drivingScroll = true;
            root.scrollTop = nextTop;
            root.style.scrollBehavior = "";
          }
        }
      }
    }
    updateDock();
    if (resumePartLocked) {
      let arrived = id === "top";
      if (!arrived) {
        const nextPart = resumePartFromScroll();
        const near =
          Math.abs(root.scrollTop - top) <= 48 ||
          root.scrollTop >= root.scrollHeight - root.clientHeight - 2;
        const timedOut = performance.now() - started > 1400;
        arrived = near || timedOut || nextPart === resumePartLockTarget;
      }
      if (arrived) resumePartLocked = false;
    }
    if (!resumePartLocked) applyResumePart();
    applySpy();
  };
  const landed = () => {
    if (gen !== scrollGen) return;
    endNativeScroll();
    pinLanding();
    finishResumeLeave();
  };
  beginNativeScroll();
  if (id === "top") {
    root.scrollTo({ top: 0, behavior: mode });
    if (focusLanding) document.getElementById("top")?.focus({ preventScroll: true });
    if (mode === "smooth") root.addEventListener("scrollend", landed, { once: true });
    else landed();
    return;
  }
  const el = anchorFor(id);
  if (!el) {
    resumePartLocked = false;
    return;
  }
  let top = Math.max(
    0,
    el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - barClearance(id, extraGap),
  );
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
  if (focusLanding) document.getElementById(id)?.focus({ preventScroll: true });
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

function resumePartFromRoute() {
  const tab = route.params.tab;
  return RESUME_PARTS.includes(tab) ? tab : null;
}

function syncScroll(behavior) {
  const part = resumePartFromRoute();
  const key = `${route.name}:${part || ""}:${targetForRoute()}`;
  if (key === lastKey) return;
  lastKey = key;
  pinGen += 1;
  const target = targetForRoute();
  /* /resume/education opens on Education. /resume is the heading.
     Hold that part so the sections we pass do not take the URL. */
  if (part) {
    beginResumeLock(part);
    markScrollTarget("resume");
    scrollToEl(part, behavior);
    if (behavior === "instant") settleRoute(part, pinGen);
    return;
  }
  if (target === "resume") beginResumeLock(null);
  else resumePartLocked = false;
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
    /* At the end of a long page the heading may already be on screen.
       Still re-pin when it has slipped under the bar. */
    if (atEnd && top < root.clientHeight * 0.75 && top >= clearance - 2) {
      updateDock();
      if (!resumePartLocked) applyResumePart();
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
const resumePart = ref(resumePartFromRoute());
const spySeen = new Set();
let resumePath = route.name === "resume" ? route.path : "/resume";
let spyLock = null;
/* Set while a jump to one resume part is in flight. The value is that
   part, or null when the jump is to the Resume heading. */
let resumePartLocked = false;
let resumePartLockTarget = null;
let passedSection = null;
let urlFromSpy = false;
let resumePartUrl = "";
let routeFromTween = false;
let spySettle = 0;
let spyObserver;

/* The skills card sits in normal flow under the resume tabs and scrolls
   away with the page. Skills stays highlighted only while that card is in
   the band under the nav. Farther down a panel, Resume takes over. */
function skillsInView() {
  const root = scroller.value;
  const mark = document.getElementById("skills");
  const card = document.querySelector("#resume .skills");
  if (!root || !mark || !card) return false;
  const heading = document.getElementById("resume-heading");
  if (heading && visibleBelowBars(heading)) return false;
  const top = mark.getBoundingClientRect().top - root.getBoundingClientRect().top;
  const bottom = top + card.offsetHeight;
  const clearance = barClearance("skills");
  return top < root.clientHeight * 0.45 && bottom > clearance + 8;
}

function spyPick() {
  let next = null;
  for (const id of sectionIds) {
    if (id === "skills") continue;
    if (spySeen.has(id)) next = id;
  }
  if (!next && passedSection && passedSection !== "skills") next = passedSection;
  /* The card can sit in the spy band while the Resume heading is still
     the landmark. skillsInView waits until that heading has cleared. */
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

function queryValue(key) {
  const raw = route.query[key];
  return Array.isArray(raw) ? raw[0] : raw;
}

function shellTo(path) {
  if (queryValue("proto") !== "1") return path;
  const query = { proto: "1" };
  const title = queryValue("title");
  if (typeof title === "string" && title !== "" && title !== PRODUCTION_VARIANT) query.title = title;
  return { path, query };
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
  router.replace(shellTo(path));
}

function releaseSpyLock() {
  if (!spyLock || resumePartLocked) return;
  const wanted = spyLock === "top" ? null : spyLock;
  const next = spyPick();
  spyLock = null;
  if (next === wanted || activeSection.value === next) return;
  activeSection.value = next;
  syncSpyUrl(next);
}

function applySpy() {
  if (route.name === "diners" || resumePartLocked) return;
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

/* A jump to Awards passes Experience on the way. Hold the part the
   reader asked for so the bar and the URL do not flicker through the
   sections in between. A wheel or drag takes over. */
function beginResumeLock(target) {
  resumePartLocked = true;
  resumePartLockTarget = target;
  resumePart.value = target;
}

function resumePartFromScroll() {
  const root = scroller.value;
  if (!root) return null;
  const clearance = barClearance("resume");
  const rootTop = root.getBoundingClientRect().top;
  const atEnd = root.scrollTop >= root.scrollHeight - root.clientHeight - 2;
  let current = null;
  for (const id of RESUME_PARTS) {
    const el = document.getElementById(`${id}-heading`) || document.getElementById(id);
    if (!el) continue;
    const top = el.getBoundingClientRect().top - rootTop;
    if (top <= clearance + 24) current = id;
    else if (atEnd && top < root.clientHeight) current = id;
  }
  return current;
}

function publishResumePart(next) {
  if (skillsInView()) return;
  const main = spyLock && spyLock !== "top" ? spyLock : spyPick();
  if (main !== "resume") return;
  const path = next ? `/resume/${next}` : "/resume";
  resumePath = path;
  if (route.path === path || resumePartUrl === path) return;
  /* The section spy publishes this path when Resume is taking over
     from About, Projects, or Skills. Publishing here too would start
     a second navigation and scroll again. */
  if (activeSection.value !== "resume") return;
  resumePartUrl = path;
  urlFromSpy = true;
  router.replace(shellTo(path));
}

function applyResumePart() {
  if (route.name === "diners") return;
  const next = resumePartFromScroll();
  if (resumePartLocked) {
    if (next !== resumePartLockTarget) return;
    resumePartLocked = false;
  }
  if (resumePart.value !== next) resumePart.value = next;
  publishResumePart(next);
}

function jumpResumePart(id) {
  if (!RESUME_PARTS.includes(id)) return;
  if (animating || performance.now() < navQuietUntil) return;
  cancelResumeLeave();
  cancelTween();
  const path = `/resume/${id}`;
  beginResumeLock(id);
  if (route.path === path) {
    markScrollTarget("resume");
    scrollToEl(id);
    return;
  }
  router.push(shellTo(path));
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
  protoHold = false;
  cancelResumeLeave();
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
        router.push(shellTo("/"));
      }
      playUp();
      return;
    }
    if (route.path !== "/") router.push(shellTo("/"));
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
    beginResumeLock(null);
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
  router.push(shellTo(path));
}

function onResumeNav(event) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
  if (animating || performance.now() < navQuietUntil) {
    event.preventDefault();
    return;
  }
  /* The end-cap is the way out. Anywhere else, Resume still jumps to the section. */
  if (dockState.open || dockState.docked) {
    event.preventDefault();
    leaveResumeMode();
    return;
  }
  onNav(event, "resume");
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
provide(resumePartKey, resumePart);
provide(resumeJumpKey, jumpResumePart);

const dockState = reactive({ docked: false, open: false, joined: false, hold: 0 });
provide(dockKey, dockState);

/* Matches the pill morph. A little longer than the 400ms ease so the
   tabs are fully collapsed before they move back inline. */
const NAV_MORPH_MS = 480;
/* Extra air under the pill when the end-cap sends you back, so the
   heading sits just below the bar instead of under About. */
const RESUME_BACK_GAP = 24;
let resumeLeaveUntil = 0;
let resumeLeaveAt = 0;
let closeDockTimer = 0;

function measureTabHold() {
  const shell = document.querySelector("#resume-tab-slot .tablist-shell");
  if (!shell) return;
  const height = Math.ceil(shell.getBoundingClientRect().height);
  if (height > 0) dockState.hold = height;
}

/* Pin each label's max-width to its own text. Otherwise max-width
   animates from a loose rem and the pill dips, then overshoots. */
function pinLabelWidths() {
  if (dockState.docked || dockState.open) return;
  const links = [...document.querySelectorAll(".section-nav a.nav-link:not(.nav-resume)")];
  if (!links.length) return;
  for (const link of links) link.style.transition = "none";
  for (const link of links) link.style.removeProperty("--label-max");
  const widths = links.map((link) => link.getBoundingClientRect().width);
  for (let i = 0; i < links.length; i++) {
    if (widths[i] > 1) links[i].style.setProperty("--label-max", `${Math.ceil(widths[i])}px`);
  }
  void links[0].offsetWidth;
  for (const link of links) link.style.transition = "";
}

/* Measure a copy. Toggling transition on the live tab, then opening in
   the same frame, makes WebKit skip the ease and flash every label. */
function pinTabWidths() {
  const inner = document.querySelector(".nav-inner");
  const buttons = [...document.querySelectorAll("#nav-tab-slot a")];
  if (!inner || !buttons.length) return false;
  const pad = "12px";
  let sum = 0;
  for (const button of buttons) {
    const probe = button.cloneNode(true);
    probe.style.transition = "none";
    probe.style.maxWidth = "none";
    probe.style.paddingLeft = pad;
    probe.style.paddingRight = pad;
    probe.style.transform = "none";
    probe.style.position = "absolute";
    probe.style.visibility = "hidden";
    probe.style.pointerEvents = "none";
    button.parentElement.appendChild(probe);
    const w = probe.getBoundingClientRect().width;
    probe.remove();
    if (w > 1) {
      button.style.setProperty("--tab-max", `${Math.ceil(w)}px`);
      sum += Math.ceil(w);
    }
  }
  const subs = document.querySelector("#nav-tab-slot");
  if (subs && sum > 0) subs.style.setProperty("--subs-max", `${sum}px`);
  return true;
}

/* --tab-max is set while max-width is still 0, then the row opens on the
   next frame so the ease runs from zero instead of the measured width. */
function scheduleOpen(tries = 0) {
  if (!dockState.docked || dockState.open) return;
  requestAnimationFrame(() => {
    if (!dockState.docked || dockState.open) return;
    if (!pinTabWidths() && tries < 8) {
      scheduleOpen(tries + 1);
      return;
    }
    requestAnimationFrame(() => {
      if (!dockState.docked || dockState.open) return;
      dockState.open = true;
      dockState.joined = true;
    });
  });
}

/* The in-page slot has already dropped clear of the bar. Holding the
   section labels in the sticky pill past that point stacks two bars. */
function slotClearOfBar() {
  const sent = document.getElementById("resume-tabs-sentinel");
  const bar = scroller.value?.querySelector(".nav-inner");
  if (!sent || !bar) return true;
  return sent.getBoundingClientRect().top > bar.getBoundingClientRect().bottom + 28;
}

function releaseDockNow() {
  window.clearTimeout(closeDockTimer);
  dockState.open = false;
  dockState.joined = false;
  dockState.docked = false;
  nextTick(pinLabelWidths);
}

/* Tabs move into the fixed-height pill. A same-height placeholder keeps
   the resume section from growing or shrinking, so docking does not move
   scrollTop. Do not snap scroll position here: a correction also
   aborts the page's own smooth scrolls and fast wheels. */
function setDock(next) {
  if (next) {
    if (dockState.docked && dockState.open) return;
    window.clearTimeout(closeDockTimer);
    if (prefersReduced()) {
      if (!dockState.docked) measureTabHold();
      dockState.docked = true;
      dockState.open = true;
      dockState.joined = true;
      return;
    }
    if (!dockState.docked) measureTabHold();
    pinLabelWidths();
    dockState.docked = true;
    scheduleOpen();
    return;
  }
  if (!dockState.docked) return;
  /* Tuck the section names back behind Resume, then return them to the
     page. If the slot has already cleared the bar, skip the tuck so the
     two pills cannot both stay stuck. */
  if (!dockState.open) {
    if (!prefersReduced() && !slotClearOfBar()) return;
    releaseDockNow();
    return;
  }
  if (prefersReduced() || slotClearOfBar()) {
    releaseDockNow();
    return;
  }
  dockState.open = false;
  dockState.joined = false;
  window.clearTimeout(closeDockTimer);
  closeDockTimer = window.setTimeout(() => {
    if (!dockState.open) releaseDockNow();
  }, 420);
}

function cancelResumeLeave() {
  if (!resumeLeaveUntil) return;
  resumeLeaveUntil = 0;
  resumeLeaveAt = 0;
  scrollGen += 1;
  endNativeScroll();
  window.clearTimeout(closeDockTimer);
  const root = scroller.value;
  if (root) {
    const y = root.scrollTop;
    root.style.scrollBehavior = "auto";
    drivingScroll = true;
    root.scrollTop = y;
    root.style.scrollBehavior = "";
    lastScrollY = y;
  }
  updateDock();
}

/* The chevron and the Resume corner leave the morph and stop a little
   above the Resume heading. The section stays Resume — this is not a
   trip back to About. The section pill goes back on the page first, so
   it travels with the heading instead of staying stuck in the bar. */
function leaveResumeMode() {
  cancelTween();
  beginResumeLock(null);
  activeSection.value = "resume";
  if (route.name === "resume") resumePath = route.path;
  markScrollTarget("resume");
  const path = resumePath || "/resume";
  if (route.name !== "resume" && route.path !== path) {
    urlFromSpy = true;
    router.replace(shellTo(path));
  }
  resumeLeaveAt = performance.now();
  resumeLeaveUntil = resumeLeaveAt + 5000;
  releaseDockNow();
  scrollToEl("resume", undefined, RESUME_BACK_GAP);
  window.setTimeout(() => {
    if (resumeLeaveUntil) finishResumeLeave();
  }, 5000);
}

function finishResumeLeave() {
  if (!resumeLeaveUntil) return;
  const started = resumeLeaveAt;
  resumeLeaveUntil = 0;
  resumeLeaveAt = 0;
  const wait = prefersReduced() ? 0 : Math.max(0, NAV_MORPH_MS - (performance.now() - started));
  window.clearTimeout(closeDockTimer);
  closeDockTimer = window.setTimeout(() => {
    if (!dockState.open) {
      dockState.joined = false;
      dockState.docked = false;
    }
    updateDock();
  }, wait);
}

function updateDock() {
  if (resumeLeaveUntil && performance.now() < resumeLeaveUntil) return;
  const root = scroller.value;
  const resume = document.getElementById("resume");
  const bar = root?.querySelector(".nav-inner");
  if (!root || !resume || !bar) return;
  const barRect = bar.getBoundingClientRect();
  const resumeBottom = resume.getBoundingClientRect().bottom;
  const owns = resumeBottom > barRect.bottom + 24;
  /* Give the section pill back as soon as its slot is visible again.
     Waiting until the Resume heading was on screen left both bars stuck. */
  const sent = document.getElementById("resume-tabs-sentinel");
  if (!sent) return;
  const sentTop = sent.getBoundingClientRect().top;
  const limit = dockState.docked ? barRect.bottom + 8 : barRect.bottom + 1;
  setDock(owns && sentTop <= limit);
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
  if (resumeLeaveUntil) cancelResumeLeave();
  if (event.deltaY && !animating) resumePartLocked = false;
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

/* is-title-scroll / is-title-off hold the headlamp beams. See title.css. */
function syncTitleMotion(root) {
  const y = root.scrollTop;
  const limit = heroLimit || root.clientHeight || 0;
  const off = limit > 0 && y > limit;
  const scrolling = !off && y > 2;
  if (root.classList.contains("is-title-off") !== off) root.classList.toggle("is-title-off", off);
  if (root.classList.contains("is-title-scroll") !== scrolling) root.classList.toggle("is-title-scroll", scrolling);
}

function publishProto() {
  const panel = protoPanel.value;
  const root = scroller.value;
  if (!panel || !root) return;
  const rates = ratesFor(titleMeta.value.rates);
  const about = cachedAbout || aboutAnchor() || 1;
  const limit = heroLimit || root.clientHeight || 0;
  const y = root.scrollTop;
  const applied = prefersReduced() ? 0 : limit && y > limit ? limit : y;
  panel.setReadout({
    lead: Math.round(-applied * rates.l1),
    rate: rates.l1,
    far: rates.l7,
    progress: Math.min(1, Math.max(0, y / about)),
  });
}

function scrubTo(progress) {
  const root = scroller.value;
  if (!root) return;
  cancelTween();
  scrollGen += 1;
  endNativeScroll();
  protoHold = progress > 0.02 && progress < 0.98;
  const about = cachedAbout || aboutAnchor() || 1;
  const max = Math.max(0, root.scrollHeight - root.clientHeight);
  const y = Math.round(Math.min(max, Math.max(0, progress * about)));
  root.style.scrollBehavior = "auto";
  drivingScroll = true;
  root.scrollTop = y;
  lastScrollY = y;
  lastProgrammatic = y;
  root.style.scrollBehavior = "";
  syncParallax(root);
}

function onProtoScrub(at) {
  const root = scroller.value;
  if (!root) return;
  if (at === "mid") {
    measureStatic();
    const about = cachedAbout || aboutAnchor();
    const sun = root.querySelector(".sunrise");
    if (!sun || !about) return;
    /* Meet parks the first color edge at 42% so the ridges and the bars
       share the frame. The geometric middle of the sunrise is later,
       after the short phone ridges have already left. */
    const y = sun.offsetTop - root.clientHeight * 0.42;
    scrubTo(y / about);
    return;
  }
  scrubTo(at);
}

function setTitleVariant(id) {
  const next = variantById(id);
  if (!next) return;
  const root = scroller.value;
  const about = cachedAbout || aboutAnchor() || 1;
  const progress = root ? root.scrollTop / about : 0;
  titleVariant.value = next.id;
  try {
    sessionStorage.setItem(PROTO_STORAGE_KEY, next.id);
  } catch {
    /* Private mode can reject the write. The URL still carries the pick. */
  }
  const query = { ...route.query };
  if (next.id === PRODUCTION_VARIANT) delete query.title;
  else query.title = next.id;
  router.replace({ query });
  nextTick(() => {
    measureStatic();
    if (progress > 0.01) scrubTo(progress);
    else publishProto();
  });
}

function syncParallax(root) {
  syncTitleMotion(root);
  if (prefersReduced()) {
    parallaxHeld = true;
    root.classList.remove("is-parallax");
    if (parallaxY !== "0") {
      parallaxY = "0";
      root.style.setProperty("--scroll", "0px");
    }
    publishProto();
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
    publishProto();
    return;
  }
  parallaxHeld = false;
  root.classList.add("is-parallax");
  const next = String(Math.round(y));
  if (next !== parallaxY) {
    parallaxY = next;
    root.style.setProperty("--scroll", `${next}px`);
  }
  publishProto();
}

function scheduleChrome() {
  if (chromeFrame) return;
  chromeFrame = requestAnimationFrame(() => {
    chromeFrame = 0;
    updateDock();
    if (!resumePartLocked) applyResumePart();
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
  if (!followNative) resumePartLocked = false;
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
  if (resumeLeaveUntil) cancelResumeLeave();
  armGesture(800);
  const y = event.touches[0]?.clientY ?? touchStartY;
  const dy = touchStartY - y;
  if (Math.abs(dy) > 10 && !animating) resumePartLocked = false;
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
  if (resumeLeaveUntil) cancelResumeLeave();
  if (!animating) resumePartLocked = false;
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
  pinLabelWidths();
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
  pinLabelWidths();
  document.fonts?.ready?.then(() => {
    if (!dockState.open) pinLabelWidths();
  });
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

function protoRequested() {
  const proto = route.query.proto;
  return proto === "1" || (Array.isArray(proto) && proto.includes("1"));
}

onMounted(() => {
  document.documentElement.classList.add("vue-ready");
  const protoOn = protoRequested();
  let at = "";
  if (protoOn) {
    let stored = "";
    try {
      stored = sessionStorage.getItem(PROTO_STORAGE_KEY) || "";
    } catch {
      stored = "";
    }
    const queryTitle = Array.isArray(route.query.title) ? route.query.title[0] : route.query.title;
    titleVariant.value = readTitleVariant(queryTitle, stored);
    if (variantById(queryTitle)) {
      try {
        sessionStorage.setItem(PROTO_STORAGE_KEY, titleVariant.value);
      } catch {
        /* The query string is enough for this visit. */
      }
    }
    protoReady.value = true;
    at = Array.isArray(route.query.at) ? route.query.at[0] : route.query.at || "";
  }
  startShell().then(() => {
    if (!protoOn) return;
    if (typeof at === "string" && at !== "") {
      if (at === "mid") onProtoScrub("mid");
      else {
        const n = Number(at);
        if (Number.isFinite(n)) scrubTo(Math.min(1, Math.max(0, n)));
      }
    } else publishProto();
    document.documentElement.dataset.titleProto = "ready";
  });
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
    if (protoHold || urlFromSpy || routeFromTween) {
      urlFromSpy = false;
      routeFromTween = false;
      resumePartUrl = "";
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
  <TitleProto
    v-if="protoReady"
    ref="protoPanel"
    :variant="titleVariant"
    @pick="setTitleVariant"
    @scrub="onProtoScrub"
  />
  <div
    class="prlx"
    :class="{ 'is-title-classic': !titleDense }"
    :style="titleRateVars"
    :data-title-variant="titleVariant"
    ref="scroller"
  >
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
        <source
          media="(min-width: 821px), (min-width: 801px) and (orientation: landscape)"
          type="image/avif"
          :srcset="layer.srcAvif"
          :sizes="layer.sizes"
        />
        <source
          media="(min-width: 821px), (min-width: 801px) and (orientation: landscape)"
          type="image/webp"
          :srcset="layer.srcWebp"
          :sizes="layer.sizes"
        />
        <source type="image/avif" :srcset="layer.srcAvifNarrow" :sizes="layer.sizes" />
        <source type="image/webp" :srcset="layer.srcWebpNarrow" :sizes="layer.sizes" />
        <img
          :src="layer.fallback"
          :srcset="layer.srcWebpNarrow"
          :sizes="layer.sizes"
          alt=""
          decoding="async"
          :width="layer.w"
          :height="layer.h"
        />
      </picture>
      <Headlamps v-if="layer.id === 'l6'" />
    </div>
    <div class="ridge-ground" aria-hidden="true"></div>
    <div class="sunrise" aria-hidden="true" :data-band-count="sunriseBands.length" :style="{ backgroundColor: sunriseFill }">
      <div
        v-for="band in sunriseBands"
        :key="band.id"
        class="band"
        :class="band.className"
        :style="band.style"
      ></div>
    </div>
    <main class="sheet">
      <nav class="section-nav" :class="{ 'is-docked': dockState.docked, 'is-open': dockState.open, 'is-joined': dockState.joined }" aria-label="Sections">
        <div class="nav-cluster">
          <div class="nav-inner">
            <a
              class="nav-link"
              href="/about"
              :aria-current="activeSection === 'about' ? 'page' : undefined"
              :aria-hidden="dockState.open ? 'true' : undefined"
              :tabindex="dockState.open ? -1 : undefined"
              @click="onNav($event, 'about')"
            >About</a>
            <a
              class="nav-link"
              href="/projects"
              :aria-current="activeSection === 'projects' ? 'page' : undefined"
              :aria-hidden="dockState.open ? 'true' : undefined"
              :tabindex="dockState.open ? -1 : undefined"
              @click="onNav($event, 'projects')"
            >Projects</a>
            <a
              class="nav-link nav-resume"
              :href="route.name === 'resume' ? route.path : '/resume'"
              :aria-current="activeSection === 'resume' ? 'page' : undefined"
              :aria-expanded="dockState.open ? 'true' : undefined"
              :aria-label="dockState.open ? 'Resume, back to main nav' : undefined"
              @click="onResumeNav($event)"
            >
              <span class="nav-back" aria-hidden="true">
                <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M10 3 5 8l5 5" />
                </svg>
              </span>
              <span class="nav-label">Resume</span>
            </a>
            <a
              class="nav-link"
              href="/skills"
              :aria-current="activeSection === 'skills' ? 'page' : undefined"
              :aria-hidden="dockState.open ? 'true' : undefined"
              :tabindex="dockState.open ? -1 : undefined"
              @click="onNav($event, 'skills')"
            >Skills</a>
            <span class="nav-divider" aria-hidden="true"></span>
            <div id="nav-tab-slot" class="nav-subs" :inert="dockState.open ? undefined : true"></div>
          </div>
        </div>
      </nav>
      <div class="center-col measure">
        <AboutSection />
        <ProjectsSection />
        <ResumeSection />
      </div>
      <SiteFooter />
      <div class="scroll-tail" aria-hidden="true"></div>
    </main>
  </div>
  </template>
</template>
