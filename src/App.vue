<script setup>
import { nextTick, onMounted, onUnmounted, provide, ref, watch } from "vue";
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
import { scrollKey } from "./scroll.js";

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

const sectionIds = ["about", "projects", "resume"];
const activeSection = ref(sectionIds.includes(route.name) ? route.name : null);
const spySeen = new Set();
let resumePath = route.name === "resume" ? route.path : "/resume";
let spyLock = null;
let resumeAbove = false;
let urlFromSpy = false;
let spySettle = 0;
let spyObserver;

function spyPick() {
  let next = null;
  for (const id of sectionIds) {
    if (spySeen.has(id)) next = id;
  }
  if (!next && resumeAbove) next = "resume";
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
    section === "about" || section === "projects" ? `/${section}` : section === "resume" ? resumePath : "/";
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

function onSpy(entries) {
  for (const entry of entries) {
    if (entry.isIntersecting) spySeen.add(entry.target.id);
    else spySeen.delete(entry.target.id);
    if (entry.target.id === "resume" && entry.rootBounds) {
      const { top, bottom } = entry.boundingClientRect;
      resumeAbove = bottom <= entry.rootBounds.top + 1 && top < entry.rootBounds.top;
    }
  }
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

function go(id) {
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

let armed = true;
let animating = false;
let settleTimer = 0;
let touchStartY = 0;
let touchStartScroll = 0;
let touchIgnored = false;

function inTitleZone() {
  const root = scroller.value;
  return !!root && root.scrollTop <= 32;
}

function playIntro() {
  if (prefersReduced() || animating) return;
  animating = true;
  armed = false;
  go("about");
}

function stopIntro() {
  const root = scroller.value;
  if (!root || !animating) return;
  animating = false;
  const top = root.scrollTop;
  root.scrollTo({ top, behavior: "auto" });
  releaseSpyLock();
}

function onIntroWheel(event) {
  if (prefersReduced()) return;
  if (event.deltaY < 0) {
    stopIntro();
    return;
  }
  if (animating) {
    event.preventDefault();
    return;
  }
  if (!armed || !inTitleZone()) return;
  event.preventDefault();
  playIntro();
}

function onIntroScroll() {
  const root = scroller.value;
  if (!root) return;
  if (root.scrollTop <= 2) {
    armed = true;
    animating = false;
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
  if (animating) {
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(() => {
      animating = false;
    }, 160);
    return;
  }
  if (spyLock) {
    window.clearTimeout(spySettle);
    spySettle = window.setTimeout(releaseSpyLock, 700);
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
  if (dy < 10) {
    if (dy < -10) stopIntro();
    return;
  }
  if (animating) {
    event.preventDefault();
    return;
  }
  if (!armed || touchStartScroll > 32) return;
  event.preventDefault();
  playIntro();
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
  if (up) {
    stopIntro();
    return;
  }
  if (animating) {
    event.preventDefault();
    return;
  }
  if (!armed || !inTitleZone()) return;
  event.preventDefault();
  playIntro();
}

onMounted(async () => {
  await nextTick();
  ready.value = true;
  if (route.name !== "home") syncScroll();
  else lastKey = "home::top";
  const root = scroller.value;
  if (!root) return;
  root.addEventListener("wheel", onIntroWheel, { passive: false });
  root.addEventListener("scroll", onIntroScroll, { passive: true });
  root.addEventListener("touchstart", onTouchStart, { passive: true });
  root.addEventListener("touchmove", onTouchMove, { passive: false });
  window.addEventListener("keydown", onIntroKey);
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
  window.clearTimeout(settleTimer);
  window.clearTimeout(spySettle);
  spyObserver?.disconnect();
  root?.removeEventListener("wheel", onIntroWheel);
  root?.removeEventListener("scroll", onIntroScroll);
  root?.removeEventListener("touchstart", onTouchStart);
  root?.removeEventListener("touchmove", onTouchMove);
  window.removeEventListener("keydown", onIntroKey);
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
      <nav class="section-nav" aria-label="Sections">
        <div class="center-col nav-inner measure">
          <a href="/about" :aria-current="activeSection === 'about' ? 'page' : undefined" @click="onNav($event, 'about')">About</a>
          <a href="/projects" :aria-current="activeSection === 'projects' ? 'page' : undefined" @click="onNav($event, 'projects')">Projects</a>
          <a href="/resume" :aria-current="activeSection === 'resume' ? 'page' : undefined" @click="onNav($event, 'resume')">Resume</a>
        </div>
      </nav>
      <div class="center-col measure">
        <AboutSection />
        <ProjectsSection />
        <ResumeSection />
      </div>
      <SiteFooter />
    </main>
  </div>
</template>
