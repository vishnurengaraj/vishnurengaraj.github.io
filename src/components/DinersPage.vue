<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useHead } from "@unhead/vue";
import { DINERS, WEIGHTS, appleMapsUrl, mapsUrl, photoPlaceholder, rankOf } from "../data/diners.js";
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
const hoverId = ref(null);
const detailOpen = ref(false);
const panelOpen = ref(route.query.list === "open");
const motionOn = ref(false);
const shuffling = ref(false);
const frontIndex = ref(0);
const slots = reactive([
  { place: null, role: "tucked" },
  { place: null, role: "tucked" },
]);

const SHUFFLE_MS = 680;

const weightLegend = [
  ["Taste", WEIGHTS.taste],
  ["Price", WEIGHTS.price],
  ["Atmosphere", WEIGHTS.atmosphere],
  ["Service", WEIGHTS.service],
]
  .map(([label, share]) => `${label} ${Math.round(share * 100)}%`)
  .join(" · ");

const cardOut = computed(() => slots.some((layer) => layer.role !== "tucked"));

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

let mapApi = null;
let mountGen = 0;
let alive = true;
let resizeTimer = 0;
let hoverTimer = 0;
let shuffleTimer = 0;

function mapPadding() {
  const phone = isPhone();
  if (phone) {
    return {
      paddingTopLeft: [16, 72],
      paddingBottomRight: [18, 36],
    };
  }
  const stageWidth = pageEl.value?.querySelector(".stage")?.clientWidth || window.innerWidth;
  const vw = window.innerWidth;
  let left = panelOpen.value ? Math.min(520, Math.max(380, vw * 0.36)) : 48;
  if (detailOpen.value) {
    const gutter = Math.max(72, vw * 0.12);
    const drawer = Math.min(480, Math.max(0, stageWidth - left - gutter));
    left += drawer;
  }
  const padLeft = Math.round(Math.min(left + 36, stageWidth - 96));
  const padRight = Math.max(24, Math.min(170, stageWidth - padLeft - 72));
  return {
    paddingTopLeft: [padLeft, 52],
    paddingBottomRight: [padRight, 64],
  };
}

function invalidateMap() {
  mapApi?.invalidateSize();
}

function fitMap(animate) {
  mapApi?.fit({
    animate: Boolean(animate) && !prefersReduced(),
    padding: mapPadding(),
    maxZoom: 14,
  });
}

function focusPlace(place) {
  mapApi?.focus(place, { padding: mapPadding(), reduced: prefersReduced() });
}

function paintPins() {
  pageEl.value?.querySelectorAll(".drop").forEach((pin) => {
    pin.classList.toggle("sel", pin.dataset.id === selectedId.value);
    pin.classList.toggle("hot", pin.dataset.id === hoverId.value);
  });
  mapApi?.paint(selectedId.value, hoverId.value);
}

function applyInitialPanel() {
  panelOpen.value = route.query.list === "open";
}

function canPeek() {
  return !isPhone();
}

function setPanel(isOpen) {
  panelOpen.value = isOpen;
  const list = isOpen ? "open" : "closed";
  if (route.query.list !== list) {
    router.replace({ path: "/diners", query: { ...route.query, list } });
  }
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    invalidateMap();
    if (!isPhone()) fitMap(true);
  }, 280);
}

function scrollLayer(index) {
  const body = pageEl.value?.querySelectorAll(".detail-body")[index];
  if (body) body.scrollTop = 0;
}

function finishOpen(index, place) {
  selectedId.value = place.id;
  detailOpen.value = true;
  nextTick(() => {
    scrollLayer(index);
    paintPins();
    if (!isPhone()) focusPlace(place);
  });
}

function openDetail(place) {
  window.clearTimeout(hoverTimer);
  if (shuffling.value) return;
  if (!isPhone() && detailOpen.value) {
    const front = slots[frontIndex.value];
    if (front.place?.id === place.id) return;
    shuffleTo(place);
    return;
  }
  hoverId.value = null;
  const index = frontIndex.value;
  const other = slots[1 - index];
  if (other.role !== "tucked") other.role = "tucked";
  slots[index].place = place;
  slots[index].role = "open";
  finishOpen(index, place);
}

function closeDetail() {
  window.clearTimeout(shuffleTimer);
  shuffling.value = false;
  hoverId.value = null;
  selectedId.value = null;
  detailOpen.value = false;
  for (const layer of slots) {
    if (layer.role !== "tucked") layer.role = "tucked";
  }
  paintPins();
  if (isPhone()) return;
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => fitMap(true), 320);
}

function shuffleTo(place) {
  if (isPhone() || shuffling.value) return;
  const from = frontIndex.value;
  const to = 1 - from;
  shuffling.value = true;
  slots[to].place = place;

  const commit = () => {
    if (!shuffling.value) return;
    slots[from].role = "tucked";
    slots[from].place = null;
    slots[to].role = "open";
    frontIndex.value = to;
    shuffling.value = false;
    hoverId.value = null;
    finishOpen(to, place);
  };

  if (prefersReduced()) {
    commit();
    return;
  }

  const run = () => {
    if (!shuffling.value) return;
    slots[from].role = "leaving";
    slots[to].role = "arriving";
    shuffleTimer = window.setTimeout(commit, SHUFFLE_MS);
  };

  if (slots[to].role === "behind") {
    run();
    return;
  }

  slots[to].role = "behind";
  nextTick(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => run());
    });
  });
}

function select(place) {
  if (isPhone()) {
    setPanel(false);
    openDetail(place);
    mapApi?.phoneFocus(place, { reduced: prefersReduced() });
    return;
  }
  openDetail(place);
}

function setHover(place) {
  if (!place || !canPeek() || shuffling.value) return;
  window.clearTimeout(hoverTimer);
  hoverId.value = place.id;
  if (detailOpen.value) {
    const front = slots[frontIndex.value];
    const back = slots[1 - frontIndex.value];
    if (front.place?.id === place.id) {
      if (back.role === "behind") back.role = "tucked";
      return;
    }
    back.place = place;
    back.role = "behind";
    return;
  }
  const front = slots[frontIndex.value];
  front.place = place;
  front.role = "peek";
}

function clearHover() {
  if (!canPeek() || shuffling.value) return;
  window.clearTimeout(hoverTimer);
  hoverTimer = window.setTimeout(() => {
    hoverId.value = null;
    if (detailOpen.value) {
      const back = slots[1 - frontIndex.value];
      if (back.role === "behind") back.role = "tucked";
      return;
    }
    const front = slots[frontIndex.value];
    if (front.role === "peek") front.role = "tucked";
  }, 220);
}

function holdHover() {
  window.clearTimeout(hoverTimer);
}

function openPeeked(place) {
  if (place) select(place);
}

function onKey(event) {
  if (event.key !== "Escape") return;
  if (detailOpen.value || shuffling.value) {
    event.preventDefault();
    closeDetail();
    return;
  }
  const front = slots[frontIndex.value];
  if (front.role === "peek") {
    event.preventDefault();
    window.clearTimeout(hoverTimer);
    hoverId.value = null;
    front.role = "tucked";
  }
}

function onResize() {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    invalidateMap();
    if (!isPhone()) fitMap(false);
  }, 150);
}

function onCardKey(event, place) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    select(place);
  }
}

watch([selectedId, hoverId], () => nextTick(paintPins));

function markerHandlers() {
  return {
    onHover(place) {
      setHover(place);
    },
    onLeave() {
      clearHover();
    },
    onClick(place) {
      if (isPhone()) openDetail(place);
      else select(place);
    },
  };
}

async function startMap() {
  const gen = ++mountGen;
  const { mountDinerMap } = await import("../diners/map.js");
  if (!alive || gen !== mountGen) return;
  const el = mapEl.value;
  if (!el) return;
  const created = await mountDinerMap(el, { handlers: markerHandlers() });
  if (!alive || gen !== mountGen) {
    created?.destroy();
    return;
  }
  mapApi = created;
  const deep = route.query.d;
  const deepPlace = typeof deep === "string" ? DINERS.find((item) => item.id === deep) : undefined;
  if (!deepPlace || isPhone()) fitMap(false);
  if (deepPlace) openDetail(deepPlace);
}

onMounted(() => {
  applyInitialPanel();
  startMap();
  window.addEventListener("keydown", onKey);
  window.addEventListener("resize", onResize);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    motionOn.value = true;
  }));
});

onUnmounted(() => {
  alive = false;
  mountGen += 1;
  window.clearTimeout(resizeTimer);
  window.clearTimeout(hoverTimer);
  window.clearTimeout(shuffleTimer);
  window.removeEventListener("keydown", onKey);
  window.removeEventListener("resize", onResize);
  mapApi?.destroy();
  mapApi = null;
});
</script>

<template>
  <div
    ref="pageEl"
    class="diners"
    :class="{ 'no-anim': !motionOn, 'force-open': forceOpen }"
  >
    <h1 class="sr-only">Diners</h1>

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
          <p class="list-weights"><strong>Weighted</strong> = {{ weightLegend }}</p>
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
              :class="{ sel: selectedId === place.id, hot: hoverId === place.id && selectedId !== place.id }"
              tabindex="0"
              @click="select(place)"
              @keydown="onCardKey($event, place)"
              @mouseenter="setHover(place)"
              @mouseleave="clearHover"
              @focus="setHover(place)"
              @blur="clearHover"
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
        v-for="(layer, index) in slots"
        :key="index"
        class="detail"
        :class="layer.role"
        :aria-hidden="layer.role === 'open' || layer.role === 'peek' || layer.role === 'behind' ? 'false' : 'true'"
        :inert="layer.role === 'peek' || layer.role === 'behind' || layer.role === 'open' ? undefined : true"
        :aria-label="layer.place ? layer.place.name : 'Diner'"
        @mouseenter="holdHover"
        @mouseleave="clearHover"
      >
        <button
          v-if="layer.place && (layer.role === 'peek' || layer.role === 'behind')"
          class="peek-hit"
          type="button"
          tabindex="-1"
          :aria-label="`Show ${layer.place.name}`"
          @click.stop="openPeeked(layer.place)"
        ></button>
        <button
          v-show="layer.role === 'open' || layer.role === 'leaving'"
          class="close"
          type="button"
          aria-label="Close"
          @click="closeDetail"
        >×</button>
        <div class="detail-body" :inert="layer.role === 'open' ? undefined : true">
          <div v-if="layer.place">
            <div
              class="ph"
              :style="photoSrc(layer.place) ? undefined : { backgroundImage: photoPlaceholder(layer.place) }"
            >
              <img
                v-if="photoSrc(layer.place)"
                :src="photoSrc(layer.place)"
                :alt="layer.place.name"
                @error="onPhotoError(layer.place.id)"
              />
              <span v-if="!photoSrc(layer.place)" class="demo">PHOTO COMING SOON</span>
              <span v-else-if="layer.place.photoCredit" class="credit">{{ layer.place.photoCredit }}</span>
              <span v-if="layer.place.certified" class="cert-banner">Certified</span>
            </div>
            <div class="d-in">
              <h2>{{ layer.place.name }}</h2>
              <div class="hood">{{ layer.place.hood }} · Rank #{{ rankOf(layer.place) }} of {{ DINERS.length }}</div>
              <div class="big">
                <b>{{ layer.place.weighted.toFixed(2) }}</b>
                <span>weighted score<br>visited · out of 10</span>
              </div>
              <div v-for="[label, key] in bars" :key="key" class="bar">
                <div class="lbl">
                  <span>{{ label }}<em>{{ Math.round(WEIGHTS[key] * 100) }}%</em></span>
                  <b>{{ layer.place[key] }}</b>
                </div>
                <div class="tr"><div class="fi" :style="{ width: barWidth(layer.place, key) }"></div></div>
              </div>
              <p v-if="layer.place.note" class="note">{{ layer.place.note }}</p>
              <div class="meta">
                <template v-if="layer.place.order"><b>Ordered:</b> {{ layer.place.order }}<br></template>
                <template v-if="layer.place.cost"><b>Spend:</b> {{ layer.place.cost }}<br></template>
                {{ layer.place.addr }}
              </div>
              <div class="btns">
                <a class="btn" :href="mapsUrl(layer.place)" target="_blank" rel="noopener">Open in Google Maps</a>
                <a class="btn btn-secondary" :href="appleMapsUrl(layer.place)" target="_blank" rel="noopener">Open in Apple Maps</a>
              </div>
            </div>
          </div>
        </div>
      </aside>
      <div class="seam-shadow" :class="{ on: cardOut }" aria-hidden="true"></div>
    </main>
    <div class="scrim" :class="{ open: detailOpen }" @click="closeDetail"></div>
  </div>
</template>
