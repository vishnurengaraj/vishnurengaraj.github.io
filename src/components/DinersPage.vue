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
const peekId = ref(null);
const panelOpen = ref(route.query.list === "open");
const motionOn = ref(false);
let peekTimer = 0;

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

function stageWidth() {
  return pageEl.value?.querySelector(".stage")?.clientWidth || window.innerWidth;
}

function listWidth() {
  if (isPhone()) return panelOpen.value ? Math.min(360, window.innerWidth - 48) : 0;
  if (!panelOpen.value) return 48;
  return Math.min(520, Math.max(380, window.innerWidth * 0.36));
}

function drawerWidth() {
  if (isPhone() || !detailOpen.value) return 0;
  const left = listWidth();
  const gap = panelOpen.value ? 72 : 88;
  return Math.max(0, Math.min(440, stageWidth() - left - gap));
}

function mapPadding() {
  const phone = isPhone();
  const overlay = phone ? 16 : listWidth() + drawerWidth() + 24;
  const left = phone ? 16 : Math.min(Math.round(overlay), Math.round(stageWidth() * 0.62));
  const right = phone ? 18 : 72;
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

function paintPins() {
  pageEl.value?.querySelectorAll(".pin").forEach((pin) => {
    const id = pin.dataset.id;
    pin.classList.toggle("sel", id === selectedId.value);
    pin.classList.toggle("peek", !detailOpen.value && id === peekId.value);
  });
  for (const [id, marker] of Object.entries(markers)) {
    const selected = id === selectedId.value;
    const peeked = !detailOpen.value && id === peekId.value;
    marker.setZIndexOffset(selected ? 800 : peeked ? 500 : 0);
  }
}

function applyInitialPanel() {
  const query = route.query.list;
  if (query === "open") panelOpen.value = true;
  else panelOpen.value = false;
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

function peek(place) {
  if (!place || isPhone() || detailOpen.value) return;
  window.clearTimeout(peekTimer);
  peekId.value = place.id;
  shown.value = place;
}

function unpeek(place) {
  if (isPhone()) return;
  window.clearTimeout(peekTimer);
  peekTimer = window.setTimeout(() => {
    if (detailOpen.value) return;
    if (place && peekId.value !== place.id) return;
    peekId.value = null;
  }, 80);
}

function openDetail(place) {
  window.clearTimeout(peekTimer);
  peekId.value = null;
  selectedId.value = place.id;
  shown.value = place;
  detailOpen.value = true;
  nextTick(paintPins);
}

function closeDetail() {
  window.clearTimeout(peekTimer);
  selectedId.value = null;
  peekId.value = null;
  detailOpen.value = false;
  paintPins();
  if (!isPhone()) {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => fitMap(true), 40);
  }
}

function select(place) {
  if (isPhone()) {
    setPanel(false);
    openDetail(place);
    const zoom = map ? Math.max(map.getZoom(), 14) : 14;
    map?.flyTo([place.lat, place.lng], zoom, { duration: prefersReduced() ? 0 : 0.6 });
    return;
  }
  openDetail(place);
  fitMap(true);
}

function onKey(event) {
  if (event.key === "Escape" && detailOpen.value) {
    event.preventDefault();
    closeDetail();
  }
}

function onResize() {
  if (isPhone()) peekId.value = null;
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    map?.invalidateSize();
    if (!isPhone()) fitMap(false);
  }, 150);
}

function onCardKey(event, place) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    select(place);
  }
}

watch([selectedId, peekId, detailOpen], () => nextTick(paintPins));

watch(shown, () => {
  nextTick(() => {
    const el = pageEl.value?.querySelector(".detail");
    if (el) el.scrollTop = 0;
  });
});

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
    const marker = leaflet.marker([place.lat, place.lng], { icon, riseOnHover: true, keyboard: true }).addTo(map);
    marker.getElement()?.setAttribute("aria-label", place.name);
    marker.on("mouseover", () => peek(place));
    marker.on("focus", () => peek(place));
    marker.on("mouseout", (event) => {
      const next = event.originalEvent?.relatedTarget;
      const iconEl = marker.getElement();
      if (next instanceof Node && iconEl?.contains(next)) return;
      unpeek(place);
    });
    marker.on("blur", () => unpeek(place));
    marker.on("click", () => select(place));
    markers[place.id] = marker;
  }
  map.on("click", (event) => {
    const target = event.originalEvent?.target;
    if (target instanceof Element && target.closest(".leaflet-marker-icon, .leaflet-control")) return;
    if (isPhone()) return;
    if (detailOpen.value) closeDetail();
    else peekId.value = null;
  });
  map.invalidateSize();
  const deep = route.query.d;
  const deepPlace = typeof deep === "string" ? DINERS.find((item) => item.id === deep) : null;
  if (deepPlace) {
    openDetail(deepPlace);
    fitMap(false);
  } else {
    fitMap(false);
  }
  window.addEventListener("keydown", onKey);
  window.addEventListener("resize", onResize);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    motionOn.value = true;
  }));
});

onUnmounted(() => {
  window.clearTimeout(resizeTimer);
  window.clearTimeout(peekTimer);
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
              :class="{ sel: selectedId === place.id, peek: peekId === place.id && !detailOpen }"
              tabindex="0"
              @click="select(place)"
              @keydown="onCardKey($event, place)"
              @mouseenter="peek(place)"
              @mouseleave="unpeek(place)"
              @focus="peek(place)"
              @blur="unpeek(place)"
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
      <aside
        class="detail"
        :class="{ open: detailOpen, peek: Boolean(peekId) && !detailOpen }"
        :aria-hidden="detailOpen ? 'false' : 'true'"
        :inert="detailOpen ? undefined : true"
        aria-label="Diner details"
      >
      <button class="close" type="button" aria-label="Close" @click="closeDetail">×</button>
      <div v-if="shown" class="drawer-card">
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
    </main>
    <div class="scrim" :class="{ open: detailOpen }" @click="closeDetail"></div>

    <footer class="foot">
      <span>⛰ Scores from Sunday visits, logged in the Google Sheet after each meal.</span>
      <span class="muted">Map tiles © Esri · OpenStreetMap</span>
    </footer>
  </div>
</template>
