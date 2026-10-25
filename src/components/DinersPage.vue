<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useHead } from "@unhead/vue";
import { DINERS, WEIGHTS, appleMapsUrl, mapsUrl, photoPlaceholder, rankOf } from "../data/diners.js";
import "leaflet/dist/leaflet.css";
import "../styles/diners.css";

useHead({
  title: "Diners · Vishnu Rengaraj",
  meta: [
    {
      name: "description",
      content: "South Bay Sunday breakfast rankings — vishnu.rengaraj.com/diners",
    },
    { property: "og:title", content: "Diners · Vishnu Rengaraj" },
    {
      property: "og:description",
      content: "South Bay Sunday breakfast rankings — vishnu.rengaraj.com/diners",
    },
  ],
});

const route = useRoute();
const router = useRouter();
const mapEl = ref(null);
const pageEl = ref(null);
const sortKey = ref("weighted");
const selectedId = ref(null);
const shown = ref(null);
const detailOpen = ref(false);
const panelOpen = ref(route.query.list !== "closed");
const motionOn = ref(false);

const forceOpen = computed(() => route.query.list === "open");
const sorted = computed(() => {
  const key = sortKey.value;
  return [...DINERS].sort((a, b) => (key === "name" ? a.name.localeCompare(b.name) : b[key] - a[key]));
});

const photoMissing = reactive({});

function photoSrc(place) {
  if (!place?.photo || photoMissing[place.id]) return "";
  return place.photo;
}

function onPhotoError(id) {
  photoMissing[id] = true;
}

const bars = [
  ["Taste", "taste"],
  ["Price / value", "price"],
  ["Atmosphere", "atmosphere"],
  ["Service", "service"],
];

function barWidth(place, key) {
  return `${place[key] * 10}%`;
}

function isPhone() {
  return window.matchMedia("(max-width: 640px)").matches;
}

function prefersReduced() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

let map;
let leafletApi;
let markers = {};
let resizeTimer = 0;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Lift or drop a label when two diners sit on the same short stretch of coast. */
function markerClass(place) {
  const neighbor = DINERS.find((other) => {
    if (other.id === place.id) return false;
    return Math.abs(other.lat - place.lat) < 0.01 && Math.abs(other.lng - place.lng) < 0.02;
  });
  if (!neighbor) return "mk";
  return neighbor.lat < place.lat ? "mk above" : "mk below";
}

function mapPadding() {
  const phone = isPhone();
  let left = phone ? 16 : 84;
  if (!phone) {
    const mapRect = mapEl.value?.getBoundingClientRect();
    const panelRect = pageEl.value?.querySelector("#panel")?.getBoundingClientRect();
    if (mapRect && panelRect) left = Math.max(64, Math.round(panelRect.right - mapRect.left) + 40);
  }
  const right = !phone && detailOpen.value ? 448 : phone ? 18 : 150;
  return {
    paddingTopLeft: [left, phone ? 72 : 52],
    paddingBottomRight: [right, phone ? 36 : 64],
  };
}

function fitMap(animate) {
  if (!map || !leafletApi) return;
  const pad = mapPadding();
  map.fitBounds(leafletApi.latLngBounds(DINERS.map((place) => [place.lat, place.lng])), {
    paddingTopLeft: pad.paddingTopLeft,
    paddingBottomRight: pad.paddingBottomRight,
    maxZoom: 14,
    animate: Boolean(animate) && !prefersReduced(),
  });
}

function focusPlace(place) {
  if (!map || !leafletApi) return;
  const zoom = Math.max(map.getZoom(), 14);
  const pad = mapPadding();
  const size = map.getSize();
  const viewX = (pad.paddingTopLeft[0] + size.x - pad.paddingBottomRight[0]) / 2;
  const viewY = (pad.paddingTopLeft[1] + size.y - pad.paddingBottomRight[1]) / 2;
  const shift = leafletApi.point(size.x / 2 - viewX, size.y / 2 - viewY);
  const center = map.unproject(map.project([place.lat, place.lng], zoom).add(shift), zoom);
  map.flyTo(center, zoom, { duration: prefersReduced() ? 0 : 0.6 });
}

function paintPins() {
  pageEl.value?.querySelectorAll(".pin").forEach((pin) => {
    pin.classList.toggle("sel", pin.dataset.id === selectedId.value);
  });
  for (const [id, marker] of Object.entries(markers)) {
    marker.setZIndexOffset(id === selectedId.value ? 800 : 0);
  }
}

function applyInitialPanel() {
  const query = route.query.list;
  if (query === "open") panelOpen.value = true;
  else if (query === "closed") panelOpen.value = false;
  else panelOpen.value = !isPhone();
}

function setPanel(isOpen) {
  panelOpen.value = isOpen;
  const list = isOpen ? "open" : "closed";
  if (route.query.list !== list) {
    router.replace({ path: "/diners", query: { ...route.query, list } });
  }
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    map?.invalidateSize();
    if (!isPhone()) fitMap(true);
  }, 280);
}

function openDetail(place) {
  selectedId.value = place.id;
  shown.value = place;
  detailOpen.value = true;
  nextTick(paintPins);
}

function closeDetail() {
  selectedId.value = null;
  detailOpen.value = false;
  paintPins();
}

function select(place) {
  if (isPhone()) setPanel(false);
  openDetail(place);
  if (isPhone()) {
    const zoom = map ? Math.max(map.getZoom(), 14) : 14;
    map?.flyTo([place.lat, place.lng], zoom, { duration: prefersReduced() ? 0 : 0.6 });
    return;
  }
  focusPlace(place);
}

function onKey(event) {
  if (event.key === "Escape" && detailOpen.value) {
    event.preventDefault();
    closeDetail();
  }
}

function onResize() {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    map?.invalidateSize();
    if (!isPhone()) fitMap(false);
  }, 150);
}

function onCardKey(event, place) {
  if (event.key === "Enter") select(place);
}

watch(selectedId, () => nextTick(paintPins));

onMounted(async () => {
  applyInitialPanel();
  const leaflet = await import("leaflet");
  leafletApi = leaflet;
  await nextTick();
  const el = mapEl.value;
  if (!el) return;
  map = leaflet.map(el, { zoomControl: false, scrollWheelZoom: true }).setView([33.89, -118.4], 12);
  map.attributionControl?.setPosition("bottomright");
  leaflet
    .tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "Tiles &copy; Esri, HERE, Garmin, &copy; OpenStreetMap contributors",
        maxZoom: 16,
      },
    )
    .addTo(map);
  leaflet
    .tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 16, pane: "shadowPane" },
    )
    .addTo(map);
  leaflet.control.zoom({ position: "bottomright" }).addTo(map);
  for (const place of DINERS) {
    const icon = leaflet.divIcon({
      className: markerClass(place),
      iconSize: [44, 44],
      iconAnchor: [22, 44],
      html: `<div class="pin${rankOf(place) === 1 ? "" : " mid"}" data-id="${place.id}"><span>${place.weighted.toFixed(1)}</span></div><div class="mk-name">${escapeHtml(place.name)}</div>`,
    });
    const marker = leaflet.marker([place.lat, place.lng], { icon, riseOnHover: true }).addTo(map);
    marker.getElement()?.setAttribute("aria-label", place.name);
    marker.on("click", () => {
      openDetail(place);
      if (!isPhone()) focusPlace(place);
    });
    markers[place.id] = marker;
  }
  map.invalidateSize();
  fitMap(false);
  const deep = route.query.d;
  if (typeof deep === "string") {
    const place = DINERS.find((item) => item.id === deep);
    if (place) openDetail(place);
  }
  window.addEventListener("keydown", onKey);
  window.addEventListener("resize", onResize);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    motionOn.value = true;
  }));
});

onUnmounted(() => {
  window.clearTimeout(resizeTimer);
  window.removeEventListener("keydown", onKey);
  window.removeEventListener("resize", onResize);
  map?.remove();
  map = null;
  markers = {};
});
</script>

<template>
  <div
    ref="pageEl"
    class="diners"
    :class="{ 'no-anim': !motionOn, 'force-open': forceOpen }"
  >
    <header class="top">
      <div class="brand">
        <a class="crumb" href="/">vishnu.rengaraj.com<span>/diners</span></a>
        <h1>Diners <span class="badge">{{ DINERS.length }} visits</span></h1>
        <p class="sub">South Bay Sunday breakfast</p>
      </div>
      <div class="legend-top">
        <strong>Weighted</strong> = Taste 40% · Price 30% · Atmosphere 15% · Service 15%
      </div>
    </header>

    <main class="stage">
      <aside id="panel" class="panel" :class="{ open: panelOpen }" aria-label="Restaurant list">
        <button
          id="rail"
          class="rail"
          type="button"
          :aria-expanded="panelOpen ? 'true' : 'false'"
          aria-controls="panel-body"
          title="Show list"
          @click="setPanel(true)"
        >
          <span class="chev" aria-hidden="true">›</span>
          <span class="rail-lbl">List</span>
          <span class="rail-count">{{ DINERS.length }}</span>
        </button>
        <div id="panel-body" class="panel-body">
          <div class="panel-head">
            <div>
              <div class="ph-title">Ranked list</div>
              <div class="ph-sub">{{ DINERS.length }} visits · ranked by weighted score</div>
            </div>
            <button class="collapse" type="button" aria-label="Collapse list" title="Collapse list" @click="setPanel(false)">
              ‹
            </button>
          </div>
          <div class="sort">
            <label for="diner-sort">Sort</label>
            <select id="diner-sort" v-model="sortKey">
              <option value="weighted">Weighted score</option>
              <option value="taste">Taste</option>
              <option value="price">Price / value</option>
              <option value="atmosphere">Atmosphere</option>
              <option value="service">Service</option>
              <option value="name">Name</option>
            </select>
          </div>
          <ol class="cards">
            <li
              v-for="place in sorted"
              :key="place.id"
              class="card"
              :class="{ sel: selectedId === place.id }"
              tabindex="0"
              @click="select(place)"
              @keydown="onCardKey($event, place)"
            >
              <div
                class="thumb"
                :style="photoSrc(place) ? undefined : { backgroundImage: photoPlaceholder(place) }"
              >
                <img
                  v-if="photoSrc(place)"
                  :src="photoSrc(place)"
                  alt=""
                  @error="onPhotoError(place.id)"
                />
                <span class="rank">#{{ rankOf(place) }}</span>
                <span v-if="place.certified" class="cert-pill">Certified</span>
              </div>
              <div>
                <h3>{{ place.name }}</h3>
                <div class="hood">{{ place.hood }}</div>
                <div class="mini">
                  <span><b>{{ place.taste }}</b>T</span>
                  <span><b>{{ place.price }}</b>P</span>
                  <span><b>{{ place.atmosphere }}</b>A</span>
                  <span><b>{{ place.service }}</b>S</span>
                </div>
              </div>
              <div class="score">{{ place.weighted.toFixed(2) }}<small>SCORE</small></div>
            </li>
          </ol>
        </div>
      </aside>
      <section class="mapwrap">
        <div id="diners-map" ref="mapEl" role="region" aria-label="Map of visited diners"></div>
        <button class="fab" type="button" aria-label="Open list" @click="setPanel(true)">
          ☰ List <span>{{ DINERS.length }}</span>
        </button>
      </section>
    </main>

    <aside class="detail" :class="{ open: detailOpen }" :aria-hidden="detailOpen ? 'false' : 'true'" :inert="detailOpen ? undefined : true">
      <button class="close" type="button" aria-label="Close" @click="closeDetail">×</button>
      <div v-if="shown">
        <div
          class="ph"
          :style="photoSrc(shown) ? undefined : { backgroundImage: photoPlaceholder(shown) }"
        >
          <img
            v-if="photoSrc(shown)"
            :src="photoSrc(shown)"
            :alt="shown.name"
            @error="onPhotoError(shown.id)"
          />
          <span v-if="!photoSrc(shown)" class="demo">PHOTO COMING SOON</span>
          <span v-else-if="shown.photoCredit" class="credit">{{ shown.photoCredit }}</span>
          <span v-if="shown.certified" class="cert-banner">Certified</span>
        </div>
        <div class="d-in">
          <h2>{{ shown.name }}</h2>
          <div class="hood">{{ shown.hood }} · Rank #{{ rankOf(shown) }} of {{ DINERS.length }}</div>
          <div class="big">
            <b>{{ shown.weighted.toFixed(2) }}</b>
            <span>weighted score<br>visited · out of 10</span>
          </div>
          <div v-for="[label, key] in bars" :key="key" class="bar">
            <div class="lbl">
              <span>{{ label }}<em>{{ Math.round(WEIGHTS[key] * 100) }}%</em></span>
              <b>{{ shown[key] }}</b>
            </div>
            <div class="tr"><div class="fi" :style="{ width: barWidth(shown, key) }"></div></div>
          </div>
          <p v-if="shown.note" class="note">{{ shown.note }}</p>
          <div class="meta">
            <template v-if="shown.order"><b>Ordered:</b> {{ shown.order }}<br></template>
            <template v-if="shown.cost"><b>Spend:</b> {{ shown.cost }}<br></template>
            {{ shown.addr }}
          </div>
          <div class="btns">
            <a class="btn" :href="mapsUrl(shown)" target="_blank" rel="noopener">Open in Google Maps</a>
            <a class="btn btn-secondary" :href="appleMapsUrl(shown)" target="_blank" rel="noopener">Open in Apple Maps</a>
          </div>
        </div>
      </div>
    </aside>
    <div class="scrim" :class="{ open: detailOpen }" @click="closeDetail"></div>

    <footer class="foot">
      <span>⛰ Scores from Sunday visits, logged in the Google Sheet after each meal.</span>
      <span class="muted">Map tiles © Esri · OpenStreetMap</span>
    </footer>
  </div>
</template>
