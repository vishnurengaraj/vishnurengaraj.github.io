<script setup>
import { computed, nextTick, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useHead } from "@unhead/vue";
import data from "../data/training/training.json";
import { createModel, fmtDate } from "../training/view.js";
import WeekTab from "./training/WeekTab.vue";
import CalendarTab from "./training/CalendarTab.vue";
import RoadTab from "./training/RoadTab.vue";
import "../styles/training.css";

const route = useRoute();
const router = useRouter();
const m = createModel(data);

/* ?tab= deep links. "This week" is the default and drops the query. */
const TABS = [
  { id: "week", label: "This week" },
  { id: "calendar", label: "Calendar" },
  { id: "road", label: "Road to Cool" },
];
const tabIds = TABS.map((t) => t.id);
function tabFromRoute() {
  const raw = route.query.tab;
  const v = String(Array.isArray(raw) ? raw[0] : raw || "");
  return tabIds.includes(v) ? v : "week";
}
const tab = ref(tabFromRoute());
watch(
  () => route.query.tab,
  () => {
    tab.value = tabFromRoute();
  },
);
const scroller = ref(null);
const tabEls = ref([]);

function select(id, { focus = false } = {}) {
  if (tab.value === id) return;
  tab.value = id;
  const query = { ...route.query };
  if (id === "week") delete query.tab;
  else query.tab = id;
  router.replace({ path: "/training", query });
  nextTick(() => {
    if (scroller.value) scroller.value.scrollTop = 0;
    if (focus) tabEls.value[tabIds.indexOf(id)]?.focus();
  });
}
function onTabKey(e) {
  const i = tabIds.indexOf(tab.value);
  let next = null;
  if (e.key === "ArrowRight") next = (i + 1) % tabIds.length;
  else if (e.key === "ArrowLeft") next = (i - 1 + tabIds.length) % tabIds.length;
  else if (e.key === "Home") next = 0;
  else if (e.key === "End") next = tabIds.length - 1;
  if (next == null) return;
  e.preventDefault();
  select(tabIds[next], { focus: true });
}

const tabLabel = computed(() => TABS.find((t) => t.id === tab.value).label);
const headTitle = computed(() => `Training: ${tabLabel.value} · Vishnu Rengaraj`);
const headDescription = `Training for the ${m.race.name}, ${fmtDate(m.race.date)}, 2027. Weekly targets, logged runs, and the course profile.`;
useHead({
  title: headTitle,
  meta: [
    { name: "description", content: headDescription },
    { name: "robots", content: "noindex" },
    { property: "og:title", content: headTitle },
    { property: "og:description", content: headDescription },
  ],
});
</script>

<template>
  <div ref="scroller" class="training">
    <header class="topbar">
      <a class="home" href="/">rengaraj.com</a>
      <span class="crumbs" aria-hidden="true">/</span>
      <span class="crumbs">training</span>
      <span class="asof num">Data as of {{ fmtDate(m.asOf) }}</span>
    </header>
    <main class="wrap">
      <div class="page-head">
        <div>
          <h1>{{ m.race.name }}</h1>
          <p class="sub">
            {{ fmtDate(m.race.date) }}, 2027 · {{ m.race.place }} · {{ m.race.miles }} mi. Weekly targets lead. Days are suggestions that can move.
          </p>
        </div>
        <p v-show="tab !== 'road'" class="count-inline"><b class="num">{{ m.daysToRace }}</b><span>days to the start</span></p>
      </div>
      <div class="tabs" role="tablist" aria-label="Training views" @keydown="onTabKey">
        <button
          v-for="t in TABS"
          :id="`tab-${t.id}`"
          :key="t.id"
          ref="tabEls"
          type="button"
          role="tab"
          class="tab"
          :data-tab="t.id"
          :aria-selected="tab === t.id ? 'true' : 'false'"
          :aria-controls="`panel-${t.id}`"
          :tabindex="tab === t.id ? 0 : -1"
          @click="select(t.id)"
        >
          {{ t.label }}
        </button>
      </div>
      <section v-show="tab === 'week'" id="panel-week" role="tabpanel" aria-labelledby="tab-week" class="panel-tab">
        <WeekTab :m="m" @go="select" />
      </section>
      <section v-show="tab === 'calendar'" id="panel-calendar" role="tabpanel" aria-labelledby="tab-calendar" class="panel-tab">
        <CalendarTab :m="m" />
      </section>
      <section v-show="tab === 'road'" id="panel-road" role="tabpanel" aria-labelledby="tab-road" class="panel-tab">
        <RoadTab :m="m" />
      </section>
    </main>
    <footer class="foot">
      <p>
        Plan from the Health And Fitness training page. Runs from Strava, with Garmin-only runs from the /runs pairing list. Readiness, HRV, and sleep
        from Garmin. Data as of {{ fmtDate(m.asOf) }}.
      </p>
      <p><a href="/runs">Runs</a> · <a href="/">rengaraj.com</a></p>
    </footer>
  </div>
</template>
