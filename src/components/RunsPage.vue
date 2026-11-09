<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";
import { useRoute } from "vue-router";
import { useHead } from "@unhead/vue";
import manifest from "../data/runs/manifest.json";
import { formatDate, formatDistance, formatElev, formatPace } from "../runs/format.js";
import { REGION_ZOOM, nearestCity } from "../runs/globe.js";
import { resolvePick } from "../runs/pick.js";
import "../styles/runs.css";

useHead({
  title: "Runs · Vishnu Rengaraj",
  meta: [
    {
      name: "description",
      content:
        "A heatmap of Vishnu Rengaraj’s runs and hikes, from Los Angeles to the places he has traveled. Brighter color means more activity on that ground.",
    },
    { property: "og:title", content: "Runs · Vishnu Rengaraj" },
    {
      property: "og:description",
      content:
        "A heatmap of Vishnu Rengaraj’s runs and hikes. Brighter color means more activity on that ground.",
    },
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
const regionsOpen = ref(false);

const byId = new Map(manifest.runs.map((run) => [run.id, run]));
const cityById = new Map(manifest.cities.map((city) => [city.id, city]));

const activeLabel = computed(() => cityById.get(activeCity.value)?.label || "Regions");
const activeCount = computed(() => cityById.get(activeCity.value)?.count || 0);
const chooserLabel = ref("Runs here");
const fromList = ref(false);
let listOpener = null;
let runOpener = null;
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

function closeRegions() {
  regionsOpen.value = false;
}

function pickRegion(id) {
  closeRegions();
  selectCity(id);
}

function runsInCity(id) {
  return manifest.runs
    .filter((run) => run.city === id)
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || a.title.localeCompare(b.title));
}

function focusEl(el) {
  if (!el || typeof el.focus !== "function") return;
  el.focus({ preventScroll: true });
}

function closeChoices({ restore = true } = {}) {
  choices.value = [];
  fromList.value = false;
  const el = listOpener;
  listOpener = null;
  if (restore) requestAnimationFrame(() => focusEl(el));
}

function selectCity(id, { fly = true } = {}) {
  const city = cityById.get(id);
  if (!city || !mapApi) return;
  activeCity.value = id;
  closeChoices({ restore: false });
  if (fly) mapApi.flyCity(city, prefersReduced());
}

async function loadLines() {
  const gen = ++cityGen;
  loadError.value = "";
  try {
    const parts = await Promise.all(
      manifest.cities.map(async (city) => {
        const res = await fetch(`/media/runs/cities/${city.id}.lines.geojson`);
        if (!res.ok) throw new Error(`lines ${res.status}`);
        const data = await res.json();
        return (data.features || []).map((feature) => ({
          ...feature,
          properties: { ...(feature.properties || {}), city: city.id },
        }));
      }),
    );
    if (!alive || gen !== cityGen || !mapApi) return;
    mapApi.setLines({ type: "FeatureCollection", features: parts.flat() }, activeCity.value);
    mapApi.setRegions(manifest.cities);
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
  closeRegions();
  if (summary.city) activeCity.value = summary.city;
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

function choose(run, event) {
  runOpener = event?.currentTarget || null;
  openRun(run.id, choiceAt);
  nextTick(() => {
    if (!panel.value) return;
    focusEl(pageEl.value?.querySelector(".detail.open .close"));
  });
}

function toggleCityList(event) {
  if (fromList.value && choices.value.length) {
    closeChoices();
    return;
  }
  listOpener = event.currentTarget;
  fromList.value = true;
  chooserLabel.value = `Runs in ${activeLabel.value}`;
  choiceAt = cityById.get(activeCity.value)?.center || null;
  choices.value = runsInCity(activeCity.value);
  nextTick(() => focusEl(pageEl.value?.querySelector("#run-chooser button")));
}

function toggleRegions() {
  regionsOpen.value = !regionsOpen.value;
}

function frameWorld() {
  if (!mapApi) return;
  closeRegions();
  closeChoices({ restore: false });
  closePanel({ restore: false });
  mapApi.frameWorld(prefersReduced());
}

function onView(center, zoom) {
  if (zoom < REGION_ZOOM) return;
  const city = nearestCity(manifest.cities, center);
  if (city) activeCity.value = city.id;
}

function onPick(runs, lngLat) {
  closeRegions();
  const items = runs
    .map((run) => byId.get(run.id))
    .filter(Boolean)
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || a.title.localeCompare(b.title));
  const decision = resolvePick(
    items.map((run) => run.id),
    mapApi?.getZoom?.() ?? 0,
  );
  if (decision.action === "zoom") {
    closeChoices({ restore: false });
    mapApi.zoomToward(lngLat);
    return;
  }
  if (decision.action === "choose") {
    fromList.value = false;
    chooserLabel.value = "Runs here";
    listOpener = mapEl.value;
    choices.value = items;
    choiceAt = lngLat;
    return;
  }
  closeChoices({ restore: false });
  runOpener = mapEl.value;
  if (decision.action === "open") openRun(decision.ids[0], lngLat);
}

function closePanel({ restore = true } = {}) {
  openToken += 1;
  panel.value = false;
  mapApi?.highlight(null);
  const el = runOpener;
  runOpener = null;
  if (restore) requestAnimationFrame(() => focusEl(el));
}

function onKey(event) {
  if (event.key !== "Escape") return;
  if (regionsOpen.value) {
    event.preventDefault();
    closeRegions();
    focusEl(pageEl.value?.querySelector(".regions-toggle"));
    return;
  }
  if (panel.value) {
    event.preventDefault();
    closePanel();
    return;
  }
  if (choices.value.length) {
    event.preventDefault();
    closeChoices();
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
      onView,
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
  await loadLines();
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
    <div class="stage">
      <div id="runs-map" ref="mapEl" tabindex="-1" role="region" aria-label="Map of runs"></div>
      <p v-if="manifest.sample" class="sample-tag">Sample routes</p>
      <button class="globe-btn" type="button" @click="frameWorld">Globe</button>
      <button
        class="run-index"
        type="button"
        :aria-expanded="fromList && choices.length ? 'true' : 'false'"
        aria-controls="run-chooser"
        @click="toggleCityList"
      >
        Runs in {{ activeLabel }} ({{ activeCount }})
      </button>
      <div class="map-key">
        <h1>Runs</h1>
        <p class="heat-key">
          <span class="heat-swatch" aria-hidden="true"></span>
          Low to high activity density
        </p>
      </div>
      <div class="regions" :class="{ open: regionsOpen }">
        <button
          class="regions-toggle"
          type="button"
          :aria-expanded="regionsOpen ? 'true' : 'false'"
          aria-controls="region-list"
          :aria-label="`Regions, ${activeLabel} selected`"
          @click="toggleRegions"
        >
          <span class="regions-name">{{ activeLabel }}</span>
          <span class="regions-chev" aria-hidden="true"></span>
        </button>
        <div v-if="regionsOpen" id="region-list" class="chips" role="radiogroup" aria-label="Regions">
          <button
            v-for="city in manifest.cities"
            :key="city.id"
            type="button"
            role="radio"
            :aria-checked="activeCity === city.id ? 'true' : 'false'"
            :class="{ on: activeCity === city.id }"
            :title="`${city.name} · ${city.count} runs`"
            @click="pickRegion(city.id)"
          >
            {{ city.label }}
          </button>
        </div>
      </div>
      <p v-if="loadError" class="map-error" role="status">{{ loadError }}</p>
      <div v-if="choices.length" id="run-chooser" class="chooser" role="listbox" :aria-label="chooserLabel">
        <p class="chooser-label">{{ chooserLabel }}</p>
        <button
          v-for="run in choices"
          :key="run.id"
          type="button"
          role="option"
          @click="choose(run, $event)"
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
            <p v-if="selected.type" class="run-type">{{ selected.type }}</p>
            <h2>{{ selected.title }}</h2>
            <p v-if="selected.date" class="run-date">{{ formatDate(selected.date) }}</p>
            <div class="stats">
              <div>
                <b class="run-distance">{{ formatDistance(selected.distanceM) }}</b>
                <span>Distance</span>
              </div>
              <div v-if="formatPace(selected.distanceM, selected.movingS)">
                <b class="run-pace">{{ formatPace(selected.distanceM, selected.movingS) }}</b>
                <span>Pace</span>
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
