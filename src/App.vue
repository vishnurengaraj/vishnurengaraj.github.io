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

function scrollToEl(id) {
  const root = scroller.value;
  if (!root || typeof document === "undefined") return;
  if (id === "top") {
    root.scrollTo({ top: 0, behavior: prefersReduced() ? "auto" : "smooth" });
    document.getElementById("top")?.focus({ preventScroll: true });
    return;
  }
  const el = document.getElementById(id);
  if (!el) return;
  const nav = root.querySelector(".section-nav");
  const navH = nav ? nav.getBoundingClientRect().height : 0;
  const top =
    el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - navH - 4;
  root.scrollTo({
    top: Math.max(0, top),
    behavior: prefersReduced() ? "auto" : "smooth",
  });
  el.focus({ preventScroll: true });
}

function targetForRoute() {
  if (route.name === "about") return "about";
  if (route.name === "projects") return "projects";
  if (route.name === "resume") return "resume";
  if (route.name === "skills") return "skills";
  return "top";
}

let lastKey = "";
function syncScroll() {
  const key = `${route.name}:${route.params.tab || ""}:${targetForRoute()}`;
  if (key === lastKey) return;
  const sameResume =
    route.name === "resume" &&
    lastKey.startsWith("resume:") &&
    typeof window !== "undefined" &&
    !window.matchMedia("(max-width: 719px)").matches;
  lastKey = key;
  if (sameResume) return;
  const target = targetForRoute();
  markScrollTarget(target);
  scrollToEl(target);
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
  /* The footer is shorter than a desktop viewport, so Skills can sit in
     view at the end of the scroll without its heading ever reaching the
     top spy band. Treat that as the section the reader is on. */
  const atEnd = root.scrollTop + root.clientHeight >= root.scrollHeight - 2;
  if (atEnd && onScreen) return true;
  return top < Math.min(root.clientHeight * 0.42, 280) && onScreen;
}

function spyPick() {
  let next = null;
  for (const id of sectionIds) {
    if (spySeen.has(id)) next = id;
  }
  if (!next && passedSection) next = passedSection;
  if (skillsInView()) next = "skills";
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

function setDock(next) {
  if (prefersReduced()) {
    window.clearTimeout(closeDockTimer);
    dockState.docked = next;
    dockState.open = next;
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
    if (!dockState.open) dockState.docked = false;
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
  /* Stay docked only while the resume section still owns the screen.
     Once the Skills heading is in view, the tabs go back inline. */
  setDock(sentTop <= barBottom + 1 && resumeBottom > barBottom + 24 && !skillsInView());
}

let armedDown = true;
let armedUp = false;
let wasInReturn = false;
let animating = false;
let raf = 0;
let suppressUntil = 0;
let touchStartY = 0;
let touchStartScroll = 0;
let touchIgnored = false;

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

function inReturnZone() {
  const root = scroller.value;
  if (!root) return false;
  const y = root.scrollTop;
  return y > 48 && y <= aboutAnchor() + 80;
}

function canAuto() {
  return !animating && performance.now() > suppressUntil && !prefersReduced();
}

function cancelTween() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
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
    done?.();
    return;
  }
  animating = true;
  root.style.scrollBehavior = "auto";
  const t0 = performance.now();
  const frame = (now) => {
    if (!animating) return;
    const p = Math.min(1, (now - t0) / INTRO_MS);
    root.scrollTop = start + dist * easeInOut(p);
    if (p < 1) {
      raf = requestAnimationFrame(frame);
      return;
    }
    animating = false;
    raf = 0;
    root.style.scrollBehavior = "";
    done?.();
  };
  raf = requestAnimationFrame(frame);
}

function playDown() {
  if (!canAuto()) return;
  armedDown = false;
  tweenTo(aboutAnchor(), () => {
    armedUp = true;
    wasInReturn = true;
    document.getElementById("about")?.focus({ preventScroll: true });
  });
}

function playUp() {
  if (!canAuto()) return;
  armedUp = false;
  tweenTo(0, () => {
    armedDown = true;
    wasInReturn = false;
    document.getElementById("top")?.focus({ preventScroll: true });
  });
}

function onIntroWheel(event) {
  if (prefersReduced()) return;
  if (animating) {
    cancelTween();
    return;
  }
  if (!canAuto()) return;
  if (event.deltaY > 0) {
    if (!armedDown || !inTitleZone()) return;
    event.preventDefault();
    playDown();
    return;
  }
  if (event.deltaY < 0 && armedUp && inReturnZone()) {
    event.preventDefault();
    playUp();
  }
}

let parallaxY = -1;
function syncParallax(root) {
  const dpr = window.devicePixelRatio || 1;
  const y = Math.round(root.scrollTop * dpr) / dpr;
  if (y === parallaxY) return;
  parallaxY = y;
  root.style.setProperty("--scroll", `${y}px`);
}

function onIntroScroll() {
  const root = scroller.value;
  if (!root) return;
  syncParallax(root);
  updateDock();
  if (!spyLock) applySpy();
  const y = root.scrollTop;
  if (y <= 2 && !animating) {
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
  if (!animating) {
    const zone = inReturnZone();
    if (zone && !wasInReturn) armedUp = true;
    if (!zone && y > aboutAnchor() + 120) armedUp = false;
    wasInReturn = zone;
    if (spyLock) {
      window.clearTimeout(spySettle);
      spySettle = window.setTimeout(releaseSpyLock, 700);
    }
  }
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
    if (Math.abs(dy) > 8) cancelTween();
    return;
  }
  if (!canAuto()) return;
  if (dy > 12 && armedDown && touchStartScroll <= 32) {
    event.preventDefault();
    playDown();
    return;
  }
  if (dy < -12 && armedUp && touchStartScroll > 48 && touchStartScroll <= aboutAnchor() + 80) {
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
    cancelTween();
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

onMounted(async () => {
  await nextTick();
  ready.value = true;
  if (route.name !== "home") syncScroll();
  else lastKey = "home::top";
  const root = scroller.value;
  if (!root) return;
  syncParallax(root);
  root.addEventListener("wheel", onIntroWheel, { passive: false });
  root.addEventListener("scroll", onIntroScroll, { passive: true });
  root.addEventListener("touchstart", onTouchStart, { passive: true });
  root.addEventListener("touchmove", onTouchMove, { passive: false });
  window.addEventListener("keydown", onIntroKey);
  window.addEventListener("resize", updateDock);
  updateDock();
  spyObserver = new IntersectionObserver(onSpy, {
    root,
    rootMargin: "-12% 0px -70% 0px",
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
  root?.removeEventListener("touchstart", onTouchStart);
  root?.removeEventListener("touchmove", onTouchMove);
  window.removeEventListener("keydown", onIntroKey);
  window.removeEventListener("resize", updateDock);
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
    <div class="mountain-bg l1-bg" aria-hidden="true"></div>
    <div class="mountain-bg l2-bg" aria-hidden="true"></div>
    <div class="mountain-bg l3-bg" aria-hidden="true"></div>
    <div class="mountain-bg l4-bg" aria-hidden="true"></div>
    <div class="mountain-bg l5-bg" aria-hidden="true"></div>
    <div class="mountain-bg l6-bg" aria-hidden="true"></div>
    <div class="mountain-bg l7-bg" aria-hidden="true"></div>
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
      <nav class="section-nav" :class="{ 'is-docked': dockState.docked, 'is-open': dockState.open }" aria-label="Sections">
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
