<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useHead } from "@unhead/vue";
import manifest from "../data/runs/manifest.json";
import { occlusionPadding } from "../runs/frame.js";
import { formatDate, formatDistance, formatElev, formatPace } from "../runs/format.js";
import { REGION_ZOOM, nearestCity } from "../runs/globe.js";
import { resolvePick } from "../runs/pick.js";
import { activitySharePath, plainRunsBehind, stravaActivityUrl } from "../runs/share.js";
import "../styles/runs.css";

const route = useRoute();
const router = useRouter();
const pageEl = ref(null);
const mapEl = ref(null);
const activeCity = ref(manifest.defaultCity);
const panel = ref(false);
const selected = ref(null);
const choices = ref([]);
const motionOn = ref(false);
const loadError = ref("");
const regionsOpen = ref(false);
const copyStatus = ref("");
const shareKind = ref("copy");

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
const stravaHref = computed(() => stravaActivityUrl(selected.value));
const shareButtonLabel = computed(() => copyStatus.value || (shareKind.value === "share" ? "Share" : "Copy link"));
const headTitle = computed(() =>
  panel.value && selected.value?.title ? `${selected.value.title} · Runs · Vishnu Rengaraj` : "Runs · Vishnu Rengaraj",
);
const headDescription = computed(() => {
  if (!panel.value || !selected.value) {
    return "A heatmap of Vishnu Rengaraj’s runs and hikes, from Los Angeles to the places he has traveled. Brighter color means more activity on that ground.";
  }
  const run = selected.value;
  return [run.title, formatDate(run.date), formatDistance(run.distanceM), formatPace(run.distanceM, run.movingS)]
    .filter(Boolean)
    .join(" · ");
});
const ogDescription = computed(() =>
  panel.value && selected.value
    ? headDescription.value
    : "A heatmap of Vishnu Rengaraj’s runs and hikes. Brighter color means more activity on that ground.",
);

useHead({
  title: headTitle,
  meta: [
    { name: "description", content: headDescription },
    { property: "og:title", content: headTitle },
    { property: "og:description", content: ogDescription },
  ],
});

let mapApi = null;
let mountGen = 0;
let cityGen = 0;
let openToken = 0;
let alive = true;
let swayBlocked = false;
let pageNode = null;
let resizeTimer = 0;
let choiceAt = null;
let mapReady = false;
let navToken = 0;
let urlChain = Promise.resolve();
let copyTimer = 0;

function queryValue(key) {
  const raw = route.query[key];
  return Array.isArray(raw) ? raw[0] : raw;
}

function isPhone() {
  return window.matchMedia("(max-width: 640px)").matches;
}

/* Top controls, the open drawer, and any corner chrome that still sticks into
   the visible map. Layout size, not the drawer's slide transform. */
function framePadding() {
  const map = mapEl.value;
  const root = pageEl.value;
  if (!map || !root) return occlusionPadding({ width: 0, height: 0 });
  const mapBox = map.getBoundingClientRect();
  let top = 0;
  let right = 0;
  let bottom = 0;
  let left = 0;
  for (const el of root.querySelectorAll(".globe-btn, .run-index, .regions-toggle")) {
    const box = el.getBoundingClientRect();
    top = Math.max(top, box.bottom - mapBox.top);
  }
  const drawer = root.querySelector(".detail.open");
  if (drawer) {
    if (isPhone()) bottom = Math.max(bottom, drawer.offsetHeight);
    else right = Math.max(right, drawer.offsetWidth + (parseFloat(getComputedStyle(drawer).right) || 0));
  }
  const visibleBottom = mapBox.bottom - bottom;
  const visibleRight = mapBox.right - right;
  for (const el of root.querySelectorAll(".map-key, .maplibregl-ctrl-bottom-right, .maplibregl-ctrl-bottom-left")) {
    const box = el.getBoundingClientRect();
    if (box.top >= visibleBottom - 1 || box.left >= visibleRight - 1) continue;
    bottom = Math.max(bottom, mapBox.bottom - box.top);
  }
  return occlusionPadding({
    width: mapBox.width,
    height: mapBox.height,
    top,
    right,
    bottom,
    left,
  });
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

function activityIdFromRoute() {
  const activity = queryValue("activity");
  if (activity) return String(activity);
  const run = queryValue("run");
  if (run) return String(run);
  return "";
}

function withoutActivity(query) {
  const next = {};
  for (const [key, value] of Object.entries(query)) {
    if (key === "activity" || key === "run") continue;
    if (value == null || value === "") continue;
    next[key] = value;
  }
  return next;
}

function enqueueUrl(task) {
  const run = urlChain.then(task, task);
  urlChain = run.then(
    () => {},
    () => {},
  );
  return run;
}

function initialCity() {
  const requested = activityIdFromRoute();
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

function publishActivity(id) {
  const token = navToken;
  return enqueueUrl(async () => {
    if (token !== navToken) return;
    if (!panel.value || String(selected.value?.id) !== String(id)) return;
    const current = activityIdFromRoute();
    if (current === id && String(queryValue("activity") || "") === id) return;
    const query = { ...withoutActivity(route.query), activity: id };
    try {
      if (current) await router.replace({ name: "runs", query });
      else await router.push({ name: "runs", query });
    } catch {
      /* A newer navigation already won. */
    }
  });
}

function clearActivityUrl() {
  navToken += 1;
  const token = navToken;
  return enqueueUrl(async () => {
    if (token !== navToken || panel.value) return;
    if (!queryValue("activity") && !queryValue("run")) return;
    try {
      if (plainRunsBehind(window.history.state?.back)) router.back();
      else await router.replace({ name: "runs", query: withoutActivity(route.query) });
    } catch {
      /* The address was already plain. */
    }
  });
}

function clearUnknownActivity() {
  return enqueueUrl(async () => {
    const id = activityIdFromRoute();
    if (!id || byId.has(id)) return;
    if (!queryValue("activity") && !queryValue("run")) return;
    await router.replace({ name: "runs", query: withoutActivity(route.query) });
  });
}

function syncShareKind() {
  const phone = window.matchMedia("(max-width: 640px)").matches;
  shareKind.value = phone && typeof navigator.share === "function" ? "share" : "copy";
}

function absoluteActivityUrl(id) {
  return new URL(activitySharePath(id), window.location.origin).href;
}

async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* The clipboard can reject the write. Try the selection fallback. */
  }
  try {
    const input = document.createElement("textarea");
    input.value = text;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.left = "-9999px";
    document.body.appendChild(input);
    input.select();
    const ok = document.execCommand("copy");
    input.remove();
    return ok;
  } catch {
    return false;
  }
}

function showCopyStatus(text) {
  copyStatus.value = text;
  window.clearTimeout(copyTimer);
  copyTimer = window.setTimeout(() => {
    if (copyStatus.value === text) copyStatus.value = "";
  }, 2000);
}

async function shareActivity() {
  const run = selected.value;
  if (!run?.id) return;
  const url = absoluteActivityUrl(run.id);
  syncShareKind();
  if (shareKind.value === "share") {
    try {
      await navigator.share({ title: run.title || "Run", url });
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }
  const ok = await copyText(url);
  if (!alive) return;
  showCopyStatus(ok ? "Copied" : "Copy failed");
}

async function openRun(id, _lngLat, { skipUrl = false } = {}) {
  const summary = byId.get(id);
  if (!summary) return;
  const token = ++openToken;
  closeRegions();
  window.clearTimeout(copyTimer);
  copyStatus.value = "";
  if (summary.city) activeCity.value = summary.city;
  selected.value = { ...summary, companions: [], photos: [] };
  panel.value = true;
  mapApi?.highlight(id);
  mapApi?.armFrame();
  if (!skipUrl) publishActivity(id);
  let detail = null;
  try {
    const res = await fetch(`/media/runs/activities/${encodeURIComponent(id)}.json`);
    if (res.ok) detail = await res.json();
  } catch {
    detail = null;
  }
  if (!alive || token !== openToken) return;
  if (detail) {
    selected.value = {
      ...summary,
      ...detail,
      stravaId: detail.stravaId || summary.stravaId || null,
    };
  }
  await nextTick();
  if (!alive || token !== openToken || !panel.value) return;
  mapApi?.frameRoute(id, framePadding(), prefersReduced());
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

function closePanel({ restore = true, skipUrl = false } = {}) {
  openToken += 1;
  panel.value = false;
  mapApi?.highlight(null);
  mapApi?.releaseFrame();
  window.clearTimeout(copyTimer);
  copyStatus.value = "";
  const el = runOpener;
  runOpener = null;
  if (restore) requestAnimationFrame(() => focusEl(el));
  if (!skipUrl) clearActivityUrl();
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
  syncShareKind();
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    mapApi?.resize();
    if (panel.value && selected.value?.id) {
      mapApi.frameRoute(selected.value.id, framePadding(), prefersReduced());
    }
  }, 150);
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
  mapReady = true;
  const deep = activityIdFromRoute();
  if (deep && byId.has(deep)) await openRun(deep);
  else if (deep) clearUnknownActivity();
  if (swayBlocked || panel.value) created.stopIdleSway();
  else created.startIdleSway();
}

watch(
  () => activityIdFromRoute(),
  (id) => {
    if (!mapReady) return;
    if (id && byId.has(id)) {
      if (!panel.value || String(selected.value?.id) !== id) openRun(id, null, { skipUrl: true });
      return;
    }
    if (id) {
      if (panel.value) closePanel({ restore: false, skipUrl: true });
      clearUnknownActivity();
      return;
    }
    if (panel.value) closePanel({ restore: true, skipUrl: true });
  },
);

onMounted(() => {
  syncShareKind();
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
  navToken += 1;
  window.clearTimeout(resizeTimer);
  window.clearTimeout(copyTimer);
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
            <div class="run-actions">
              <a v-if="stravaHref" class="strava-link" :href="stravaHref" target="_blank" rel="noopener">
                View on Strava<span class="sr-only"> (opens in a new tab)</span>
              </a>
              <button type="button" class="share-btn" @click="shareActivity">{{ shareButtonLabel }}</button>
              <span class="sr-only" role="status" aria-live="polite">{{ copyStatus }}</span>
            </div>
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
