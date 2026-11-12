<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useHead } from "@unhead/vue";
import manifest from "../data/runs/manifest.json";
import { occlusionPadding } from "../runs/frame.js";
import { formatDate, formatDistance, formatElev, formatPace } from "../runs/format.js";
import { REGION_ZOOM, WORLD_CENTER, WORLD_ZOOM, nearestCity } from "../runs/globe.js";
import { LAYER_LABELS, LAYER_LEGENDS, LAYER_MODES, layerMode } from "../runs/layers.js";
import { resolvePick } from "../runs/pick.js";
import { pickRandomRun } from "../runs/random.js";
import { activitySharePath, plainRunsBehind, stravaActivityUrl } from "../runs/share.js";
import "../styles/runs.css";

const route = useRoute();
const router = useRouter();
const pageEl = ref(null);
const mapEl = ref(null);
const activeCity = ref(manifest.defaultCity);
const panel = ref(false);
const sheetPeek = ref(false);
const sheetDrag = ref(false);
const layer = ref("density");
const layersOpen = ref(false);
const fabOpen = ref(false);
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
let cameraHeld = false;
let pendingFrame = "";
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

layer.value = layerMode(queryValue("layer"));

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
  for (const el of root.querySelectorAll(".run-index")) {
    const box = el.getBoundingClientRect();
    top = Math.max(top, box.bottom - mapBox.top);
  }
  const drawer = root.querySelector(".detail.open");
  if (drawer) {
    if (isPhone()) {
      const head = drawer.querySelector(".sheet-head");
      const visible = sheetPeek.value && head ? head.offsetHeight : drawer.offsetHeight;
      bottom = Math.max(bottom, visible);
    } else right = Math.max(right, drawer.offsetWidth + (parseFloat(getComputedStyle(drawer).right) || 0));
  }
  const visibleBottom = mapBox.bottom - bottom;
  const visibleRight = mapBox.right - right;
  for (const el of root.querySelectorAll(".map-key, .fab, .maplibregl-ctrl-bottom-right, .maplibregl-ctrl-bottom-left")) {
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

function holdCamera(event) {
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
  cameraHeld = true;
  mapApi?.cancelArrival();
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
  const fromChooser = runOpener?.closest?.("#run-chooser");
  closeChoices({ restore: false });
  if (fromChooser) runOpener = pageEl.value?.querySelector(".run-index") || null;
  layersOpen.value = false;
  fabOpen.value = false;
  sheetPeek.value = false;
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
  syncPeekVar();
  if (!alive || token !== openToken || !panel.value) return;
  if (!mapApi) {
    pendingFrame = String(id);
    return;
  }
  pendingFrame = "";
  mapApi.frameRoute(id, framePadding(), prefersReduced());
}

function openRandom(event) {
  const run = pickRandomRun(manifest.runs, selected.value?.id);
  if (!run) return;
  fabOpen.value = false;
  runOpener = pageEl.value?.querySelector(".fab-main") || event?.currentTarget || null;
  openRun(run.id);
  nextTick(() => {
    if (!panel.value) return;
    focusEl(pageEl.value?.querySelector(".detail.open .close"));
  });
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

function toggleFab() {
  fabOpen.value = !fabOpen.value;
  if (!fabOpen.value) {
    regionsOpen.value = false;
    layersOpen.value = false;
  }
}

function toggleRegions() {
  regionsOpen.value = !regionsOpen.value;
  if (regionsOpen.value) layersOpen.value = false;
}

function toggleLayers() {
  layersOpen.value = !layersOpen.value;
  if (layersOpen.value) regionsOpen.value = false;
}

function frameWorld() {
  if (!mapApi) return;
  closeRegions();
  layersOpen.value = false;
  fabOpen.value = false;
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

function refitOpenRun() {
  if (!panel.value || !selected.value?.id || !mapApi) return;
  nextTick(() => {
    syncPeekVar();
    mapApi.frameRoute(selected.value.id, framePadding(), prefersReduced());
  });
}

function syncPeekVar() {
  const detail = pageEl.value?.querySelector(".detail");
  const head = detail?.querySelector(".sheet-head");
  if (!detail || !head) return;
  detail.style.setProperty("--peek", `${head.offsetHeight}px`);
  detail.style.setProperty("--sheet-hide", `${Math.max(0, detail.offsetHeight - head.offsetHeight)}px`);
  const page = pageEl.value;
  if (page && panel.value && isPhone()) {
    const visible = sheetPeek.value ? head.offsetHeight : detail.offsetHeight;
    page.style.setProperty("--sheet-visible", `${visible}px`);
  } else {
    page?.style.removeProperty("--sheet-visible");
  }
}

let sheetGesture = null;
let ignoreSheetClick = false;

function onSheetDown(event) {
  if (!isPhone() || !panel.value) return;
  if (event.target.closest(".close, a, .share-btn")) return;
  sheetGesture = {
    y: event.clientY,
    peek: sheetPeek.value,
    handle: Boolean(event.target.closest?.(".sheet-handle")),
  };
  sheetDrag.value = true;
  event.currentTarget.setPointerCapture?.(event.pointerId);
}

function onSheetMove(event) {
  if (!sheetGesture) return;
  const detail = pageEl.value?.querySelector(".detail");
  const head = detail?.querySelector(".sheet-head");
  if (!detail || !head) return;
  const dy = event.clientY - sheetGesture.y;
  const full = detail.offsetHeight;
  const peek = head.offsetHeight;
  const base = sheetGesture.peek ? full - peek : 0;
  const next = Math.min(full - peek, Math.max(0, base + dy));
  detail.style.setProperty("--drag", `${next}px`);
}

function onSheetUp(event) {
  if (!sheetGesture) return;
  const dy = event.clientY - sheetGesture.y;
  const wasPeek = sheetGesture.peek;
  const onHandle = sheetGesture.handle;
  sheetGesture = null;
  sheetDrag.value = false;
  const detail = pageEl.value?.querySelector(".detail");
  detail?.style.removeProperty("--drag");
  if (Math.abs(dy) < 8) {
    if (onHandle || wasPeek) {
      ignoreSheetClick = true;
      sheetPeek.value = !wasPeek;
      refitOpenRun();
    }
    return;
  }
  ignoreSheetClick = true;
  sheetPeek.value = dy > 0;
  refitOpenRun();
}

function toggleSheet() {
  if (ignoreSheetClick) {
    ignoreSheetClick = false;
    return;
  }
  if (!isPhone()) return;
  sheetPeek.value = !sheetPeek.value;
  refitOpenRun();
}

function chooseLayer(id) {
  const next = layerMode(id);
  layer.value = next;
  layersOpen.value = false;
  mapApi?.setLayer(next);
  const query = { ...route.query };
  if (next === "density") delete query.layer;
  else query.layer = next;
  router.replace({ name: "runs", query }).catch(() => {});
}

function onKey(event) {
  if (event.key !== "Escape") return;
  if (layersOpen.value) {
    event.preventDefault();
    layersOpen.value = false;
    focusEl(pageEl.value?.querySelector(".fab-layers"));
    return;
  }
  if (regionsOpen.value) {
    event.preventDefault();
    closeRegions();
    focusEl(pageEl.value?.querySelector(".fab-areas"));
    return;
  }
  if (fabOpen.value) {
    event.preventDefault();
    fabOpen.value = false;
    focusEl(pageEl.value?.querySelector(".fab-main"));
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
  if (!isPhone()) sheetPeek.value = false;
  syncPeekVar();
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
  const deepId = activityIdFromRoute();
  const deep = Boolean(deepId && byId.has(deepId));
  const skipIntro = prefersReduced() || deep || cameraHeld;
  const { mountRunsMap } = await import("../runs/map.js");
  if (!alive || gen !== mountGen) return;
  const el = mapEl.value;
  if (!el || !city) return;
  let created;
  try {
    created = await mountRunsMap(el, {
      center: skipIntro ? city.center : WORLD_CENTER,
      zoom: skipIntro ? city.zoom : WORLD_ZOOM,
      arrival: skipIntro ? null : { center: city.center, zoom: city.zoom },
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
  if (deep) await openRun(deepId);
  else if (deepId) clearUnknownActivity();
  if (!alive || gen !== mountGen) return;
  if (pendingFrame && panel.value && String(selected.value?.id) === pendingFrame) {
    created.highlight(pendingFrame);
    created.armFrame();
    created.frameRoute(pendingFrame, framePadding(), prefersReduced());
    pendingFrame = "";
  }
  if (cameraHeld || panel.value) created.cancelArrival();
  else created.beginArrival();
  created.setLayer(layer.value);
}

watch(
  () => queryValue("layer"),
  (value) => {
    const next = layerMode(value);
    if (next === layer.value) return;
    layer.value = next;
    mapApi?.setLayer(next);
  },
);

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
  pageNode?.addEventListener("pointerdown", holdCamera, true);
  pageNode?.addEventListener("wheel", holdCamera, { capture: true, passive: true });
  pageNode?.addEventListener("keydown", holdCamera, true);
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
  pageNode?.removeEventListener("pointerdown", holdCamera, true);
  pageNode?.removeEventListener("wheel", holdCamera, true);
  pageNode?.removeEventListener("keydown", holdCamera, true);
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
      <div class="fab" :class="{ open: fabOpen }">
        <div id="fab-menu" class="fab-menu" :inert="fabOpen ? undefined : true">
        <div v-show="regionsOpen" id="region-list" class="chips" role="radiogroup" aria-label="Regions">
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
        <div v-show="layersOpen" id="layer-picker" class="layer-picker" role="listbox" aria-label="Map layers">
          <button
            v-for="id in LAYER_MODES"
            :key="id"
            type="button"
            role="option"
            :aria-selected="layer === id ? 'true' : 'false'"
            :class="{ on: layer === id }"
            @click="chooseLayer(id)"
          >
            {{ LAYER_LABELS[id] }}
          </button>
        </div>
        <div id="fab-actions" class="fab-actions">
          <button class="fab-action" type="button" @click="frameWorld">Globe</button>
          <button class="fab-action" type="button" title="Random run" @click="openRandom">
            Random run
          </button>
          <button
            class="fab-action fab-areas"
            type="button"
            :aria-expanded="regionsOpen ? 'true' : 'false'"
            aria-controls="region-list"
            :aria-label="`Areas, ${activeLabel} selected`"
            @click="toggleRegions"
          >
            Areas
          </button>
          <button
            class="fab-action fab-layers"
            type="button"
            :aria-expanded="layersOpen ? 'true' : 'false'"
            aria-controls="layer-picker"
            aria-label="Map layers"
            @click="toggleLayers"
          >
            Layers
          </button>
        </div>
        </div>
        <button
          class="fab-main"
          type="button"
          aria-label="Map tools"
          :aria-expanded="fabOpen ? 'true' : 'false'"
          aria-controls="fab-menu"
          @click="toggleFab"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </button>
      </div>
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
          {{ LAYER_LEGENDS[layer] }}
        </p>
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
        :class="{ open: panel, peek: sheetPeek, 'sheet-drag': sheetDrag }"
        :data-sheet="sheetPeek ? 'peek' : 'full'"
        :aria-hidden="panel ? 'false' : 'true'"
        :inert="panel ? undefined : true"
        :role="panel ? 'dialog' : undefined"
        :aria-label="selected ? selected.title : 'Run'"
      >
        <div
          v-if="selected"
          class="sheet-head"
          @pointerdown="onSheetDown"
          @pointermove="onSheetMove"
          @pointerup="onSheetUp"
          @pointercancel="onSheetUp"
        >
          <button
            class="sheet-handle"
            type="button"
            :aria-expanded="sheetPeek ? 'false' : 'true'"
            :aria-label="sheetPeek ? 'Expand run details' : 'Collapse run details'"
            @click="toggleSheet"
          ></button>
          <button v-show="panel" class="close" type="button" aria-label="Close" @click="closePanel">×</button>
          <p v-if="selected.sample" class="sample-line">Sample route</p>
          <p v-if="selected.type" class="run-type">{{ selected.type }}</p>
          <h2>{{ selected.title }}</h2>
          <p v-if="selected.date" class="run-date">{{ formatDate(selected.date) }}</p>
        </div>
        <div v-if="selected" class="detail-body">
          <div class="d-in">
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
