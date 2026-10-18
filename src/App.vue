<script setup>
import { nextTick, onMounted, provide, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useHead } from "@unhead/vue";
import monoBold from "@fontsource/roboto-mono/files/roboto-mono-latin-700-normal.woff2?url";
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
  if (route.name === "resume") {
    const narrow =
      typeof window !== "undefined" && window.matchMedia("(max-width: 719px)").matches;
    const tab = route.params.tab;
    if (narrow && tab) return `panel-${tab}`;
    return "resume";
  }
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
  scrollToEl(targetForRoute());
}

function go(id) {
  if (id === "resume" && route.name === "resume") {
    scrollToEl("resume");
    return;
  }
  const path = id === "top" ? "/" : `/${id}`;
  if (route.path === path) {
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

onMounted(async () => {
  await nextTick();
  ready.value = true;
  if (route.name !== "home") syncScroll();
  else lastKey = "home::top";
});

watch(
  () => route.fullPath,
  () => {
    if (!ready.value) return;
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
    <main class="sheet">
      <nav class="section-nav" aria-label="Sections">
        <div class="center-col nav-inner">
          <a href="/about" :aria-current="route.name === 'about' ? 'page' : undefined" @click="onNav($event, 'about')">About</a>
          <a href="/projects" :aria-current="route.name === 'projects' ? 'page' : undefined" @click="onNav($event, 'projects')">Projects</a>
          <a href="/resume" :aria-current="route.name === 'resume' ? 'page' : undefined" @click="onNav($event, 'resume')">Resume</a>
        </div>
      </nav>
      <div class="center-col measure">
        <AboutSection />
        <ProjectsSection />
        <ResumeSection />
        <SiteFooter />
      </div>
    </main>
  </div>
</template>
