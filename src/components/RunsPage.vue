<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useHead } from "@unhead/vue";
import manifest from "../data/runs/manifest.json";
import { occlusionPadding } from "../runs/frame.js";
import { formatDate, formatDistance, formatElev, formatPace } from "../runs/format.js";
import { REGION_ZOOM, WORLD_CENTER, WORLD_ZOOM, nearestCity } from "../runs/globe.js";
import { LAYER_LABELS, LAYER_LEGENDS, LAYER_MODES, layerMode, rampGradient } from "../runs/layers.js";
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
const photoIndex = ref(-1);
const photoDrag = ref({ x: 0, y: 0 });
const photoDragging = ref(false);
const photoClosing = ref(false);
/* Phone gets the speed dial; wider screens show the four tools as a row. */
const phone = ref(false);

const byId = new Map(manifest.runs.map((run) => [run.id, run]));
const cityById = new Map(manifest.cities.map((city) => [city.id, city]));

const activeLabel = computed(() => cityById.get(activeCity.value)?.label || "Regions");
const activeCount = computed(() => cityById.get(activeCity.value)?.count || 0);
const chooserLabel = ref("Runs here");
const fromList = ref(false);
let listOpener = null;
let runOpener = null;
let photoOpener = null;
let photoPointer = null;
let photoAnims = [];
let photoGen = 0;
const photos = computed(() => (Array.isArray(selected.value?.photos) ? selected.value.photos : []));
/* The manifest knows the photo count before the detail file lands, so the strip
   can hold its height and the sheet does not jump when the photos arrive. */
const photoSlots = computed(() => Number(byId.get(selected.value?.id)?.photos) || 0);
const photoOpen = computed(() => photoIndex.value >= 0 && photoIndex.value < photos.value.length);
const photoSlides = computed(() => {
  if (!photoOpen.value) return [];
  return [-1, 0, 1]
    .map((delta) => {
      const index = photoIndex.value + delta;
      const photo = photos.value[index];
      if (!photo) return null;
      return { index, photo, delta };
    })
    .filter(Boolean);
});
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

function syncPhone() {
  phone.value = isPhone();
  if (!phone.value) fabOpen.value = false;
}

/* The phone FAB rests this far above an open sheet. Matches the transform on
   .fab in runs.css. */
const FAB_GAP = 16;

/* Top controls, the open drawer, and any chrome that still sticks into the
   visible map. Layout size, not the drawer's slide transform. */
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
  if (isPhone()) {
    /* The FAB sits FAB_GAP above the sheet's visible top. Measure where it is
       headed, not where its transition has got to. */
    const head = drawer?.querySelector(".sheet-head");
    const visible = drawer ? (sheetPeek.value && head ? head.offsetHeight : drawer.offsetHeight) : 0;
    const fab = root.querySelector(".fab-main");
    bottom = visible + (fab ? FAB_GAP + fab.offsetHeight : 0);
    /* Zoom and compass sit in the top-right corner on phones. A portrait screen
       has height to spare, so clear them sideways only when they reach below
       the title row. */
    const nav = root.querySelector(".maplibregl-ctrl-bottom-right .maplibregl-ctrl-group");
    if (nav) {
      const box = nav.getBoundingClientRect();
      if (box.bottom - mapBox.top > top) right = Math.max(right, mapBox.right - box.left);
    }
    return occlusionPadding({ width: mapBox.width, height: mapBox.height, top, right, bottom, left });
  }
  if (drawer) right = Math.max(right, drawer.offsetWidth + (parseFloat(getComputedStyle(drawer).right) || 0));
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
    if (key === "activity" || key === "run" || key === "photo") continue;
    if (value == null || value === "") continue;
    next[key] = value;
  }
  return next;
}

function photoFromQuery() {
  const raw = Number(queryValue("photo"));
  if (!Number.isInteger(raw) || raw < 1) return -1;
  return raw - 1;
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

function publishActivity(id, { keepPhoto = false } = {}) {
  const token = navToken;
  return enqueueUrl(async () => {
    if (token !== navToken) return;
    if (!panel.value || String(selected.value?.id) !== String(id)) return;
    const current = activityIdFromRoute();
    const activityMatches = current === id && String(queryValue("activity") || "") === id;
    const photoOk = keepPhoto || !queryValue("photo");
    if (activityMatches && photoOk) return;
    const query = { ...withoutActivity(route.query), activity: id };
    if (keepPhoto && queryValue("photo")) query.photo = queryValue("photo");
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

async function openRun(id, _lngLat, { skipUrl = false, fromRoute = false } = {}) {
  const summary = byId.get(id);
  if (!summary) return;
  const token = ++openToken;
  const requested = fromRoute ? photoFromQuery() : -1;
  const fromChooser = runOpener?.closest?.("#run-chooser");
  closeChoices({ restore: false });
  if (fromChooser) runOpener = pageEl.value?.querySelector(".run-index") || null;
  layersOpen.value = false;
  fabOpen.value = false;
  sheetPeek.value = false;
  closeRegions();
  stopPhotoAnims();
  photoIndex.value = -1;
  photoOpener = null;
  photoPointer = null;
  photoDragging.value = false;
  photoDrag.value = { x: 0, y: 0 };
  window.clearTimeout(copyTimer);
  copyStatus.value = "";
  if (summary.city) activeCity.value = summary.city;
  selected.value = { ...summary, companions: [], photos: [] };
  panel.value = true;
  nextTick(syncPeekVar);
  mapApi?.highlight(id);
  mapApi?.armFrame();
  if (!skipUrl) publishActivity(id, { keepPhoto: fromRoute });
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
  if (requested >= 0 && requested < photos.value.length) {
    photoIndex.value = requested;
    await nextTick();
    focusEl(pageEl.value?.querySelector(".lightbox-close"));
  } else if (fromRoute && queryValue("photo")) {
    writePhotoQuery(-1);
  }
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
  runOpener = (phone.value && pageEl.value?.querySelector(".fab-main")) || event?.currentTarget || null;
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

function photoThumb(index) {
  return pageEl.value?.querySelector(`.photo-strip button[data-index="${index}"]`);
}

function writePhotoQuery(index) {
  const next = index < 0 ? "" : String(index + 1);
  if ((queryValue("photo") || "") === next) return;
  const query = { ...route.query };
  if (next) query.photo = next;
  else delete query.photo;
  router.replace({ name: "runs", query }).catch(() => {});
}

function slideStyle(delta) {
  const x = `calc(${delta * 100}% + ${photoDrag.value.x}px)`;
  const y = `${Math.max(0, photoDrag.value.y)}px`;
  return { transform: `translate3d(${x}, ${y}, 0)` };
}

function lightboxStyle() {
  const y = photoDrag.value.y;
  if (y <= 0) return undefined;
  return { "--backdrop": String(Math.max(0.35, 1 - y / 360)) };
}

/* Shared-element motion for the gallery. The tapped thumbnail grows into the
   full-screen photo, and closing shrinks the photo on screen back onto its own
   thumbnail, which is hidden ("lifted") while the gallery is up. */
const PHOTO_IN = { duration: 320, easing: "cubic-bezier(0.2, 0, 0, 1)" };
const PHOTO_OUT = { duration: 280, easing: "cubic-bezier(0.3, 0, 0.1, 1)" };

function stopPhotoAnims() {
  for (const anim of photoAnims) anim.cancel();
  photoAnims = [];
  photoClosing.value = false;
}

function lightboxEl() {
  return pageEl.value?.querySelector(".lightbox");
}

function currentPhotoImg() {
  return lightboxEl()?.querySelector(".lightbox-slide.current img");
}

/* Where thumbnail `index` sits on screen, scrolled into the strip first.
   Null when it is off screen (a peeked sheet, a scrolled card), so the
   gallery fades instead of flying to nowhere. */
function thumbRect(index) {
  const thumb = photoThumb(index);
  const img = thumb?.querySelector("img");
  if (!img) return null;
  const strip = thumb.parentElement;
  if (strip) {
    const box = strip.getBoundingClientRect();
    const at = thumb.getBoundingClientRect();
    if (at.left < box.left) strip.scrollLeft -= box.left - at.left + 8;
    else if (at.right > box.right) strip.scrollLeft += at.right - box.right + 8;
  }
  const rect = img.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  if (rect.bottom <= 0 || rect.top >= window.innerHeight || rect.right <= 0 || rect.left >= window.innerWidth) return null;
  return rect;
}

function rectTransform(to, from) {
  const sx = to.width / from.width;
  const sy = to.height / from.height;
  return {
    transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${sx}, ${sy})`,
    borderRadius: `${12 / Math.max(0.01, Math.min(sx, sy))}px`,
  };
}

function animatePhotoIn(from) {
  stopPhotoAnims();
  const root = lightboxEl();
  if (!root || prefersReduced() || typeof root.animate !== "function") return;
  const backdrop = root.querySelector(".lightbox-backdrop");
  if (backdrop) photoAnims.push(backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: "ease-out" }));
  for (const el of root.querySelectorAll(".lightbox-bar, .lightbox-nav")) {
    photoAnims.push(el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, delay: 140, easing: "ease-out", fill: "backwards" }));
  }
  const img = currentPhotoImg();
  if (!img) return;
  const base = img.getBoundingClientRect();
  if (from && base.width && base.height) {
    photoAnims.push(img.animate([rectTransform(from, base), { transform: "none", borderRadius: "0px" }], PHOTO_IN));
  } else {
    photoAnims.push(img.animate([{ opacity: 0, transform: "scale(0.94)" }, { opacity: 1, transform: "none" }], PHOTO_IN));
  }
}

async function animatePhotoOut(index) {
  stopPhotoAnims();
  const root = lightboxEl();
  if (!root || prefersReduced() || typeof root.animate !== "function") return;
  photoClosing.value = true;
  const backdrop = root.querySelector(".lightbox-backdrop");
  const anims = [];
  if (backdrop) {
    const from = getComputedStyle(backdrop).opacity;
    anims.push(backdrop.animate([{ opacity: from }, { opacity: 0 }], { ...PHOTO_OUT, easing: "ease-out", fill: "forwards" }));
  }
  for (const el of root.querySelectorAll(".lightbox-bar, .lightbox-nav")) {
    anims.push(el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: "ease-out", fill: "forwards" }));
  }
  const img = currentPhotoImg();
  if (img) {
    const base = img.getBoundingClientRect();
    const to = thumbRect(index);
    if (to && base.width && base.height) {
      anims.push(img.animate([{ transform: "none", borderRadius: "0px" }, rectTransform(to, base)], { ...PHOTO_OUT, fill: "forwards" }));
    } else {
      anims.push(img.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(0.94)" }], { duration: 200, easing: "ease-out", fill: "forwards" }));
    }
  }
  photoAnims = anims;
  await Promise.all(anims.map((anim) => anim.finished)).catch(() => {});
}

async function openPhoto(index, event) {
  if (index < 0 || index >= photos.value.length) return;
  photoGen += 1;
  photoOpener = event?.currentTarget || photoThumb(index);
  const from = thumbRect(index);
  photoIndex.value = index;
  photoDrag.value = { x: 0, y: 0 };
  writePhotoQuery(index);
  await nextTick();
  animatePhotoIn(from);
  focusEl(pageEl.value?.querySelector(".lightbox-close"));
}

async function closePhoto({ fromUrl = false } = {}) {
  if (photoIndex.value < 0 || photoClosing.value) return;
  const index = photoIndex.value;
  const gen = ++photoGen;
  photoPointer = null;
  photoDragging.value = false;
  if (!fromUrl) writePhotoQuery(-1);
  await animatePhotoOut(index);
  if (gen !== photoGen) return;
  for (const anim of photoAnims) anim.cancel();
  photoAnims = [];
  photoClosing.value = false;
  const back = photoThumb(index) || photoOpener;
  photoIndex.value = -1;
  photoOpener = null;
  photoDrag.value = { x: 0, y: 0 };
  await nextTick();
  focusEl(back);
}

function stepPhoto(delta) {
  if (photoClosing.value) return;
  const next = photoIndex.value + delta;
  if (next < 0 || next >= photos.value.length) return;
  photoIndex.value = next;
  photoDrag.value = { x: 0, y: 0 };
  writePhotoQuery(next);
}

function trapPhotoFocus(event) {
  const root = pageEl.value?.querySelector(".lightbox");
  if (!root) return;
  const items = [...root.querySelectorAll("button")].filter((el) => !el.disabled && el.getClientRects().length > 0);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  if (event.shiftKey && (active === first || !root.contains(active))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || !root.contains(active))) {
    event.preventDefault();
    first.focus();
  }
}

function onPhotoDown(event) {
  if (photoClosing.value) return;
  if (event.button != null && event.button !== 0) return;
  photoPointer = { id: event.pointerId, x: event.clientX, y: event.clientY, axis: "" };
  photoDragging.value = true;
  event.currentTarget.setPointerCapture?.(event.pointerId);
}

function onPhotoMove(event) {
  if (!photoPointer || event.pointerId !== photoPointer.id) return;
  const dx = event.clientX - photoPointer.x;
  const dy = event.clientY - photoPointer.y;
  if (!photoPointer.axis && Math.hypot(dx, dy) > 6) {
    photoPointer.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
  }
  if (photoPointer.axis === "x") photoDrag.value = { x: dx, y: 0 };
  else if (photoPointer.axis === "y" && isPhone()) photoDrag.value = { x: 0, y: Math.max(0, dy) };
}

function onPhotoUp(event) {
  if (!photoPointer || event.pointerId !== photoPointer.id) return;
  const { x, y } = photoDrag.value;
  const axis = photoPointer.axis;
  photoPointer = null;
  photoDragging.value = false;
  if (axis === "y" && isPhone() && y > 72) {
    /* Keep the dragged offset: the photo flies home from where the finger left it. */
    closePhoto();
    return;
  }
  if (axis === "x" && x <= -56) stepPhoto(1);
  else if (axis === "x" && x >= 56) stepPhoto(-1);
  photoDrag.value = { x: 0, y: 0 };
}

function closePanel({ restore = true, skipUrl = false } = {}) {
  openToken += 1;
  panel.value = false;
  photoGen += 1;
  stopPhotoAnims();
  photoIndex.value = -1;
  photoOpener = null;
  photoPointer = null;
  photoDragging.value = false;
  photoDrag.value = { x: 0, y: 0 };
  mapApi?.highlight(null);
  mapApi?.releaseFrame();
  window.clearTimeout(copyTimer);
  copyStatus.value = "";
  const el = runOpener;
  runOpener = null;
  if (restore) requestAnimationFrame(() => focusEl(el));
  if (!skipUrl) clearActivityUrl();
}

/* Collapsing or expanding the sheet always refits the route to the map area
   left above it, even after a pan or zoom. */
const SHEET_REFIT_MS = 400;

function refitOpenRun() {
  if (!panel.value || !selected.value?.id || !mapApi) return;
  nextTick(() => {
    if (!panel.value || !selected.value?.id || !mapApi) return;
    syncPeekVar();
    mapApi.armFrame();
    mapApi.frameRoute(selected.value.id, framePadding(), prefersReduced(), SHEET_REFIT_MS);
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

/* The chevron button is the main control. Dragging the head still works, and
   the head sets touch-action: none so the drag never turns into the browser's
   pull-to-refresh. */
let sheetGesture = null;

function onSheetDown(event) {
  if (!isPhone() || !panel.value) return;
  if (event.target.closest(".close, .sheet-toggle, a, .share-btn")) return;
  sheetGesture = {
    y: event.clientY,
    peek: sheetPeek.value,
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
  pageEl.value?.style.setProperty("--sheet-visible", `${full - next}px`);
}

function onSheetUp(event) {
  if (!sheetGesture) return;
  const dy = event.clientY - sheetGesture.y;
  const wasPeek = sheetGesture.peek;
  sheetGesture = null;
  sheetDrag.value = false;
  const detail = pageEl.value?.querySelector(".detail");
  detail?.style.removeProperty("--drag");
  syncPeekVar();
  if (Math.abs(dy) < 8) {
    if (wasPeek) {
      sheetPeek.value = false;
      refitOpenRun();
    }
    return;
  }
  sheetPeek.value = dy > 0;
  refitOpenRun();
}

function toggleSheet() {
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
  if (photoOpen.value) {
    if (event.key === "Escape") {
      event.preventDefault();
      closePhoto();
      return;
    }
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      stepPhoto(event.key === "ArrowRight" ? 1 : -1);
      return;
    }
    if (event.key === "Tab") trapPhotoFocus(event);
  }
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
  if (fabOpen.value && phone.value) {
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
  syncPhone();
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
  if (deep) await openRun(deepId, null, { fromRoute: true });
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

/* --sheet-visible drives the FAB. Every way the sheet opens, peeks, closes, or
   leaves phone layout comes through these, so the FAB never keeps a stale height. */
watch([panel, sheetPeek, phone], () => nextTick(syncPeekVar));

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
  () => queryValue("photo"),
  () => {
    if (!panel.value || !photos.value.length) return;
    const index = photoFromQuery();
    if (index < 0) {
      if (photoIndex.value >= 0) closePhoto({ fromUrl: true });
      return;
    }
    if (index >= photos.value.length || index === photoIndex.value) return;
    photoIndex.value = index;
    nextTick(() => focusEl(pageEl.value?.querySelector(".lightbox-close")));
  },
);

watch(
  () => activityIdFromRoute(),
  (id) => {
    if (!mapReady) return;
    if (id && byId.has(id)) {
      if (!panel.value || String(selected.value?.id) !== id) openRun(id, null, { skipUrl: true, fromRoute: true });
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
  syncPhone();
  /* A map page has nothing to scroll. Without this, a downward drag on the
     run sheet can trigger the phone browser's pull-to-refresh. */
  document.documentElement.classList.add("runs-lock");
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
  document.documentElement.classList.remove("runs-lock");
  stopPhotoAnims();
  mapApi?.destroy();
  mapApi = null;
});
</script>

<template>
  <div ref="pageEl" class="runs" :class="{ 'no-anim': !motionOn, 'panel-open': panel, 'sheet-dragging': sheetDrag }">
    <div class="stage" :inert="photoOpen ? true : undefined">
      <div id="runs-map" ref="mapEl" tabindex="-1" role="region" aria-label="Map of runs"></div>
      <p v-if="manifest.sample" class="sample-tag">Sample routes</p>
      <div class="fab" :class="{ open: fabOpen, rail: !phone, popover: regionsOpen || layersOpen }">
        <div class="fab-row">
          <div id="fab-menu" class="fab-menu" :inert="phone && !fabOpen ? true : undefined">
            <div id="fab-actions" class="fab-actions">
              <button class="fab-action fab-globe" type="button" aria-label="Globe" style="--i: 3" @click="frameWorld">
                <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                  <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8" />
                  <path d="M3.5 12h17M12 3.5c2.4 2.4 3.6 5.2 3.6 8.5s-1.2 6.1-3.6 8.5c-2.4-2.4-3.6-5.2-3.6-8.5S9.6 5.9 12 3.5Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
                </svg>
                <span class="fab-tip" aria-hidden="true">Globe</span>
              </button>
              <button class="fab-action fab-dice" type="button" aria-label="Random run" style="--i: 2" @click="openRandom">
                <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                  <rect x="4" y="4" width="16" height="16" rx="3.5" fill="none" stroke="currentColor" stroke-width="1.8" />
                  <circle cx="8.6" cy="8.6" r="1.45" fill="currentColor" />
                  <circle cx="12" cy="12" r="1.45" fill="currentColor" />
                  <circle cx="15.4" cy="15.4" r="1.45" fill="currentColor" />
                </svg>
                <span class="fab-tip" aria-hidden="true">Random run</span>
              </button>
              <div class="fab-item">
                <button
                  class="fab-action fab-areas"
                  type="button"
                  style="--i: 1"
                  :aria-expanded="regionsOpen ? 'true' : 'false'"
                  aria-controls="region-list"
                  :aria-label="`Areas, ${activeLabel} selected`"
                  @click="toggleRegions"
                >
                  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
                    <circle cx="12" cy="10" r="2.4" fill="none" stroke="currentColor" stroke-width="1.8" />
                  </svg>
                  <span class="fab-tip" aria-hidden="true">Areas · {{ activeLabel }}</span>
                </button>
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
              </div>
              <div class="fab-item">
                <button
                  class="fab-action fab-layers"
                  type="button"
                  style="--i: 0"
                  :aria-expanded="layersOpen ? 'true' : 'false'"
                  aria-controls="layer-picker"
                  aria-label="Map layers"
                  @click="toggleLayers"
                >
                  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                    <path d="M12 3.5 3.5 8 12 12.5 20.5 8 12 3.5Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
                    <path d="m3.5 12 8.5 4.5 8.5-4.5M3.5 16l8.5 4.5 8.5-4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
                  </svg>
                  <span class="fab-tip" aria-hidden="true">Layers</span>
                </button>
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
                    <span class="layer-swatch" :style="{ backgroundImage: rampGradient(id) }" aria-hidden="true"></span>
                    {{ LAYER_LABELS[id] }}
                  </button>
                </div>
              </div>
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
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
              <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
          </button>
        </div>
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
          <span class="heat-swatch" :style="{ backgroundImage: rampGradient(layer) }" aria-hidden="true"></span>
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
          <span class="sheet-handle" aria-hidden="true"></span>
          <button
            class="sheet-toggle"
            type="button"
            :aria-expanded="sheetPeek ? 'false' : 'true'"
            :aria-label="sheetPeek ? 'Expand run details' : 'Collapse run details'"
            @click="toggleSheet"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="m6.5 9.5 5.5 5.5 5.5-5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
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
              <button
                v-for="(photo, index) in photos"
                :key="photo.src"
                type="button"
                class="photo-thumb"
                :class="{ lifted: photoOpen && index === photoIndex }"
                :data-index="index"
                :aria-label="`Photo ${index + 1} of ${photos.length}`"
                @click="openPhoto(index, $event)"
              >
                <img
                  :src="photo.src"
                  :width="photo.w || undefined"
                  :height="photo.h || undefined"
                  alt=""
                  loading="lazy"
                />
              </button>
            </div>
            <div v-else-if="photoSlots > 0" class="photo-strip photo-strip-wait" aria-hidden="true"></div>
          </div>
        </div>
      </aside>
    </div>
    <div class="scrim" :class="{ open: panel }" :inert="photoOpen ? true : undefined" @click="closePanel"></div>
    <div
      v-if="photoOpen"
      class="lightbox"
      :class="{ 'is-dragging': photoDragging, closing: photoClosing }"
      role="dialog"
      aria-modal="true"
      :aria-label="`Photo ${photoIndex + 1} of ${photos.length}`"
      :style="lightboxStyle()"
    >
      <div class="lightbox-backdrop" aria-hidden="true"></div>
      <div class="lightbox-bar">
        <p class="lightbox-count">{{ photoIndex + 1 }} / {{ photos.length }}</p>
        <button class="lightbox-close" type="button" aria-label="Close photos" @click="closePhoto()">×</button>
      </div>
      <div
        class="lightbox-stage"
        @pointerdown="onPhotoDown"
        @pointermove="onPhotoMove"
        @pointerup="onPhotoUp"
        @pointercancel="onPhotoUp"
      >
        <div v-for="slide in photoSlides" :key="slide.index" class="lightbox-slide" :class="{ current: slide.delta === 0 }" :style="slideStyle(slide.delta)">
          <img
            :src="slide.photo.src"
            :alt="slide.delta === 0 ? `${selected.title}, photo ${slide.index + 1} of ${photos.length}` : ''"
            :width="slide.photo.w || undefined"
            :height="slide.photo.h || undefined"
            draggable="false"
          />
        </div>
      </div>
      <button class="lightbox-nav prev" type="button" aria-label="Previous photo" :disabled="photoIndex === 0" @click="stepPhoto(-1)">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path d="M14.5 6.5 9 12l5.5 5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <button
        class="lightbox-nav next"
        type="button"
        aria-label="Next photo"
        :disabled="photoIndex >= photos.length - 1"
        @click="stepPhoto(1)"
      >
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path d="M9.5 6.5 15 12l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </div>
  </div>
</template>
