<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRoute } from "vue-router";
import { useHead } from "@unhead/vue";
import manifest from "../data/runs/manifest.json";
import { formatDate, formatDistance, formatElev, formatPace } from "../runs/format.js";
import "../styles/runs.css";

useHead({
  title: "Runs · Vishnu Rengaraj",
  meta: [
    { name: "description", content: "Runs — vishnu.rengaraj.com/runs" },
    { property: "og:title", content: "Runs · Vishnu Rengaraj" },
    { property: "og:description", content: "Runs — vishnu.rengaraj.com/runs" },
  ],
});

const route = useRoute();
const pageEl = ref(null);
const mapEl = ref(null);
const activeCity = ref(manifest.defaultCity);
const panel = ref(false);
const selected = ref(null);
const choices = ref([]);
const motionOn = ref(false);
const loadError = ref("");

const byId = new Map(manifest.runs.map((run) => [run.id, run]));
const cityById = new Map(manifest.cities.map((city) => [city.id, city]));

const photos = computed(() => (Array.isArray(selected.value?.photos) ? selected.value.photos : []));
const companions = computed(() =>
  Array.isArray(selected.value?.companions) ? selected.value.companions.filter(Boolean) : [],
);

let mapApi = null;
let mountGen = 0;
let cityGen = 0;
let openToken = 0;
let alive = true;
let swayBlocked = false;
let pageNode = null;
let resizeTimer = 0;
let choiceAt = null;

function queryValue(key) {
  const raw = route.query[key];
  return Array.isArray(raw) ? raw[0] : raw;
}

function isPhone() {
  return window.matchMedia("(max-width: 640px)").matches;
}

function prefersReduced() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function dismissSway(event) {
  if (event?.type === "keydown") {
    const key = event.key;
    const dismisses =
      key === "Enter" ||
      key === " " ||
      key === "Escape" ||
      key === "+" ||
      key === "-" ||
      key === "=" ||
      key.startsWith("Arrow");
    if (!dismisses) return;
  }
  swayBlocked = true;
  mapApi?.stopIdleSway();
}

function initialCity() {
  const requested = queryValue("run");
  if (requested && byId.get(requested)) return byId.get(requested).city;
  const city = queryValue("city");
  if (city && cityById.has(city)) return city;
  return manifest.defaultCity;
}

async function selectCity(id, { fly = true } = {}) {
  const city = cityById.get(id);
  if (!city || !mapApi) return;
  const gen = ++cityGen;
  activeCity.value = id;
  choices.value = [];
  loadError.value = "";
  try {
    const [lines, heat] = await Promise.all([
      fetch(`/media/runs/cities/${id}.lines.geojson`).then((res) => {
        if (!res.ok) throw new Error(`lines ${res.status}`);
        return res.json();
      }),
      fetch(`/media/runs/cities/${id}.heat.geojson`).then((res) => {
        if (!res.ok) throw new Error(`heat ${res.status}`);
        return res.json();
      }),
    ]);
    if (!alive || gen !== cityGen) return;
    mapApi.setCity(id, lines, heat);
    if (fly) mapApi.flyCity(city, prefersReduced());
  } catch (error) {
    if (!alive || gen !== cityGen) return;
    loadError.value = "Couldn’t load this city.";
    console.warn(error);
  }
}

async function openRun(id, lngLat) {
  const summary = byId.get(id);
  if (!summary) return;
  const token = ++openToken;
  choices.value = [];
  if (summary.city !== activeCity.value) {
    await selectCity(summary.city, { fly: false });
    if (!alive || token !== openToken) return;
  }
  selected.value = { ...summary, companions: [], photos: [] };
  panel.value = true;
  mapApi?.highlight(id);
  const at = lngLat || summary.mid;
  mapApi?.focus(at, { reduced: prefersReduced(), phone: isPhone() });
  try {
    const res = await fetch(`/media/runs/activities/${encodeURIComponent(id)}.json`);
    if (!res.ok || !alive || token !== openToken) return;
    const detail = await res.json();
    if (!alive || token !== openToken) return;
    selected.value = { ...summary, ...detail };
  } catch {
    /* Distance and pace already came from the index. */
  }
}

function choose(run) {
  openRun(run.id, choiceAt);
}

function onPick(runs, lngLat) {
  const items = runs
    .map((run) => byId.get(run.id))
    .filter(Boolean)
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || a.title.localeCompare(b.title));
  if (items.length > 1) {
    choices.value = items;
    choiceAt = lngLat;
    return;
  }
  choices.value = [];
  if (items.length === 1) openRun(items[0].id, lngLat);
}

function closePanel() {
  openToken += 1;
  panel.value = false;
  mapApi?.highlight(null);
}

function onKey(event) {
  if (event.key !== "Escape") return;
  if (choices.value.length) {
    event.preventDefault();
    choices.value = [];
    return;
  }
  if (panel.value) {
    event.preventDefault();
    closePanel();
  }
}

function onResize() {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => mapApi?.resize(), 150);
}

async function startMap() {
  const gen = ++mountGen;
  const cityId = initialCity();
  const city = cityById.get(cityId) || manifest.cities[0];
  activeCity.value = city?.id || null;
  const { mountRunsMap } = await import("../runs/map.js");
  if (!alive || gen !== mountGen) return;
  const el = mapEl.value;
  if (!el || !city) return;
  let created;
  try {
    created = await mountRunsMap(el, {
      center: city.center,
      zoom: city.zoom,
      onPick,
    });
  } catch (error) {
    if (!alive || gen !== mountGen) return;
    loadError.value = "Map didn’t load.";
    console.warn(error);
    return;
  }
  if (!alive || gen !== mountGen) {
    created?.destroy();
    return;
  }
  mapApi = created;
  await selectCity(city.id, { fly: false });
  if (!alive || gen !== mountGen) return;
  const deep = queryValue("run");
  if (deep && byId.get(deep)) await openRun(deep);
  if (swayBlocked) created.stopIdleSway();
  else created.startIdleSway();
}

onMounted(() => {
  pageNode = pageEl.value;
  pageNode?.addEventListener("pointerdown", dismissSway, true);
  pageNode?.addEventListener("wheel", dismissSway, { capture: true, passive: true });
  pageNode?.addEventListener("keydown", dismissSway, true);
  window.addEventListener("keydown", onKey);
  window.addEventListener("resize", onResize);
  startMap();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    motionOn.value = true;
  }));
});

onUnmounted(() => {
  alive = false;
  mountGen += 1;
  cityGen += 1;
  openToken += 1;
  window.clearTimeout(resizeTimer);
  pageNode?.removeEventListener("pointerdown", dismissSway, true);
  pageNode?.removeEventListener("wheel", dismissSway, true);
  pageNode?.removeEventListener("keydown", dismissSway, true);
  window.removeEventListener("keydown", onKey);
  window.removeEventListener("resize", onResize);
  mapApi?.destroy();
  mapApi = null;
});
</script>

<template>
  <div ref="pageEl" class="runs" :class="{ 'no-anim': !motionOn, 'panel-open': panel }">
    <h1 class="sr-only">Runs</h1>
    <div class="stage">
      <div id="runs-map" ref="mapEl" role="region" aria-label="Map of runs"></div>
      <p v-if="manifest.sample" class="sample-tag">Sample routes</p>
      <div class="chips" role="radiogroup" aria-label="Cities">
        <button
          v-for="city in manifest.cities"
          :key="city.id"
          type="button"
          role="radio"
          :aria-checked="activeCity === city.id ? 'true' : 'false'"
          :class="{ on: activeCity === city.id }"
          :title="`${city.name} · ${city.count} runs`"
          @click="selectCity(city.id)"
        >
          {{ city.label }}
        </button>
      </div>
      <p v-if="loadError" class="map-error" role="status">{{ loadError }}</p>
      <div v-if="choices.length" class="chooser" role="listbox" aria-label="Runs here">
        <p class="chooser-label">Runs here</p>
        <button
          v-for="run in choices"
          :key="run.id"
          type="button"
          role="option"
          @click="choose(run)"
        >
          <span class="chooser-title">{{ run.title }}</span>
          <span class="chooser-meta">{{ formatDate(run.date) }} · {{ formatDistance(run.distanceM) }}</span>
        </button>
      </div>
      <aside
        class="detail"
        :class="{ open: panel }"
        :aria-hidden="panel ? 'false' : 'true'"
        :inert="panel ? undefined : true"
        :role="panel ? 'dialog' : undefined"
        :aria-label="selected ? selected.title : 'Run'"
      >
        <button v-show="panel" class="close" type="button" aria-label="Close" @click="closePanel">×</button>
        <div v-if="selected" class="detail-body">
          <div class="d-in">
            <p v-if="selected.sample" class="sample-line">Sample route</p>
            <h2>{{ selected.title }}</h2>
            <p v-if="selected.date" class="run-date">{{ formatDate(selected.date) }}</p>
            <div class="stats">
              <div>
                <b class="run-distance">{{ formatDistance(selected.distanceM) }}</b>
                <span>distance</span>
              </div>
              <div v-if="formatPace(selected.distanceM, selected.movingS)">
                <b class="run-pace">{{ formatPace(selected.distanceM, selected.movingS) }}</b>
                <span>pace</span>
              </div>
            </div>
            <p v-if="selected.elevM != null" class="run-elev">{{ formatElev(selected.elevM) }} elevation</p>
            <p v-if="companions.length" class="run-companions">With {{ companions.join(", ") }}</p>
            <div v-if="photos.length" class="photo-strip">
              <img
                v-for="photo in photos"
                :key="photo.src"
                :src="photo.src"
                :width="photo.w || undefined"
                :height="photo.h || undefined"
                :alt="photo.sample ? 'Sample photo' : selected.title"
              />
            </div>
          </div>
        </div>
      </aside>
    </div>
    <div class="scrim" :class="{ open: panel }" @click="closePanel"></div>
  </div>
</template>
