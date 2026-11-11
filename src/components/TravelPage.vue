<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useHead } from "@unhead/vue";
import data from "../data/travel/trips.json";
import { occlusionPadding } from "../runs/frame.js";
import { costRows, formatRange, formatScore, formatUsd, hasTotals, sortTrips, totalFor, tripBySlug } from "../travel/trips.js";
import "../styles/travel.css";

const route = useRoute();
const router = useRouter();
const pageEl = ref(null);
const mapEl = ref(null);
const listOpen = ref(false);
const motionOn = ref(false);
const loadError = ref("");
const copyStatus = ref("");
const announce = ref("");

const allTrips = data.trips;
const windowIds = data.windows.map((w) => w.id);
const rankedCount = allTrips.length;
const windowPriced = (id) => data.windows.find((w) => w.id === id)?.priced !== false;
const sortKey = ref("weighted");
const sortOptions = [
  { id: "weighted", label: "Weighted" },
  ...data.weights.categories.map((cat) => ({ id: cat.key, label: cat.label })),
  { id: "name", label: "Name" },
];
const trips = computed(() => sortTrips(allTrips, sortKey.value));

function queryValue(key) {
  const raw = route.query[key];
  return Array.isArray(raw) ? raw[0] : raw;
}

function windowFromRoute() {
  const raw = String(queryValue("dates") || "");
  return windowIds.includes(raw) ? raw : data.defaultWindow;
}

const windowId = ref(windowFromRoute());
const selectedSlug = ref(tripBySlug(trips.value, String(queryValue("dest") || ""))?.slug || "");
const selected = computed(() => tripBySlug(trips.value, selectedSlug.value));
const windowLabel = computed(() => data.windows.find((w) => w.id === windowId.value)?.label || "");
const rows = computed(() => (selected.value ? costRows(selected.value, windowId.value) : []));
const selectedIndex = computed(() => trips.value.findIndex((t) => t.slug === selectedSlug.value));
const prevTrip = computed(() => (selectedIndex.value > 0 ? trips.value[selectedIndex.value - 1] : null));
const nextTrip = computed(() =>
  selectedIndex.value >= 0 && selectedIndex.value < trips.value.length - 1 ? trips.value[selectedIndex.value + 1] : null,
);
const isDrive = computed(() => !!selected.value?.drive);
const priced = computed(() => !!(selected.value && hasTotals(selected.value, windowId.value)));

function rankLabel(trip) {
  return `#${trip.rank}`;
}

function alsoRan(trip) {
  return Number(trip.rank) > 10;
}

const headTitle = computed(() =>
  selected.value ? `${selected.value.name} · January trips · Vishnu Rengaraj` : "January trips · Vishnu Rengaraj",
);
const headDescription = computed(() => {
  if (!selected.value) {
    return "January 2027 trip options, ranked for mild weather and priced for 2 people and 7 nights. Prices as of Nov 11, 2026.";
  }
  const t = selected.value;
  return `${rankLabel(t)}: ${t.name}. ${formatRange(totalFor(t, windowId.value))} for 2 people, 7 nights (${windowLabel.value}). Prices as of Nov 11, 2026.`;
});

useHead({
  title: headTitle,
  meta: [
    { name: "description", content: headDescription },
    { name: "robots", content: "noindex" },
    { property: "og:title", content: headTitle },
    { property: "og:description", content: headDescription },
  ],
});

let mapApi = null;
let alive = true;
let resizeTimer = 0;
let copyTimer = 0;
let opener = null;
/* A pin is 34×44 and hangs above its point, so the overview keeps that much room inside the edges. */
const PIN_ROOM = 28;

function isPhone() {
  return window.matchMedia("(max-width: 640px)").matches;
}

/** The map fills the page (CSS inset 0). The ranking sheet and cards sit on
 *  top of it. Do not shrink the canvas: a short canvas left a band of empty
 *  page under the globe. */
function layoutMap() {
  const el = mapEl.value;
  if (!el) return;
  el.style.top = "";
  el.style.bottom = "";
  el.style.height = "";
}

function prefersReduced() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function focusEl(el) {
  if (el && typeof el.focus === "function") el.focus({ preventScroll: true });
}

/** Map padding: whatever chrome covers the map right now. Layout boxes, not slide transforms. */
function framePadding(extra = 0) {
  const map = mapEl.value;
  const root = pageEl.value;
  if (!map || !root) return occlusionPadding({ width: 0, height: 0 });
  const box = map.getBoundingClientRect();
  let top = 0;
  let right = 0;
  let bottom = 0;
  let left = 0;
  const top_ = root.querySelector(".topbar");
  const board = root.querySelector(".board");
  const card = root.querySelector(".trip-card.open");
  if (isPhone()) {
    if (top_) top = top_.getBoundingClientRect().bottom - box.top;
    if (card) bottom = card.offsetHeight;
    else if (board) bottom = box.bottom - board.getBoundingClientRect().top;
  } else {
    if (board) left = board.getBoundingClientRect().right - box.left;
    if (card) right = card.offsetWidth + 12;
  }
  return occlusionPadding({
    width: box.width,
    height: box.height,
    top: top + extra,
    right: right + extra,
    bottom: bottom + extra,
    left: left + extra,
  });
}

function syncUrl() {
  const query = {};
  for (const [key, value] of Object.entries(route.query)) {
    if (key === "dest" || key === "dates") continue;
    if (value != null && value !== "") query[key] = value;
  }
  if (selectedSlug.value) query.dest = selectedSlug.value;
  if (windowId.value !== data.defaultWindow) query.dates = windowId.value;
  const same =
    String(queryValue("dest") || "") === (query.dest || "") && String(queryValue("dates") || "") === (query.dates || "");
  if (same) return;
  router.replace({ name: "travel", query }).catch(() => {});
}

/* Keyboard picks (Enter/Space give a click with detail 0) jump instead of flying.
   Someone arrowing through the list to compare should not sit through flights. */
function viaKeyboard(event) {
  return event?.detail === 0;
}

async function pick(slug, { from = null, fly = true, instant = false } = {}) {
  const trip = tripBySlug(trips.value, slug);
  if (!trip) return;
  if (from) opener = from;
  selectedSlug.value = trip.slug;
  copyStatus.value = "";
  announce.value = `${rankLabel(trip)}, ${trip.name}, ${formatRange(totalFor(trip, windowId.value))}`;
  if (isPhone()) listOpen.value = false;
  syncUrl();
  mapApi?.select(trip.slug);
  await nextTick();
  const body = pageEl.value?.querySelector(".trip-card .card-body");
  if (body) body.scrollTop = 0;
  if (fly) mapApi?.flyTo(trip.slug, framePadding(), { instant });
  if (isPhone()) focusEl(pageEl.value?.querySelector(".trip-card .close"));
}

function closeCard({ restore = true } = {}) {
  if (!selectedSlug.value) return;
  const slug = selectedSlug.value;
  selectedSlug.value = "";
  announce.value = "";
  syncUrl();
  mapApi?.select("");
  nextTick(() => mapApi?.frameAll(framePadding(PIN_ROOM)));
  const el = opener || pageEl.value?.querySelector(`.rank-list [data-slug="${slug}"]`);
  opener = null;
  if (restore) requestAnimationFrame(() => focusEl(el));
}

function setWindow(id) {
  if (!windowIds.includes(id)) return;
  windowId.value = id;
  syncUrl();
}

function onListKey(event) {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Home" && event.key !== "End") return;
  const buttons = [...(pageEl.value?.querySelectorAll(".rank-list button") || [])];
  const at = buttons.indexOf(document.activeElement);
  if (at < 0) return;
  event.preventDefault();
  let next = at;
  if (event.key === "ArrowDown") next = Math.min(buttons.length - 1, at + 1);
  if (event.key === "ArrowUp") next = Math.max(0, at - 1);
  if (event.key === "Home") next = 0;
  if (event.key === "End") next = buttons.length - 1;
  focusEl(buttons[next]);
}

function toggleList() {
  listOpen.value = !listOpen.value;
  if (listOpen.value) nextTick(() => focusEl(pageEl.value?.querySelector(".rank-list button")));
}

async function copyLink() {
  if (!selected.value) return;
  const url = new URL(`/travel?dest=${encodeURIComponent(selected.value.slug)}`, window.location.origin).href;
  let ok = false;
  try {
    await navigator.clipboard.writeText(url);
    ok = true;
  } catch {
    ok = false;
  }
  if (!alive) return;
  copyStatus.value = ok ? "Copied" : "Copy failed";
  window.clearTimeout(copyTimer);
  copyTimer = window.setTimeout(() => {
    copyStatus.value = "";
  }, 2000);
}

function onKey(event) {
  if (event.key !== "Escape") return;
  if (selectedSlug.value) {
    event.preventDefault();
    closeCard();
    return;
  }
  if (listOpen.value && isPhone()) {
    event.preventDefault();
    listOpen.value = false;
    focusEl(pageEl.value?.querySelector(".list-toggle"));
  }
}

function onResize() {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    layoutMap();
    mapApi?.resize();
    if (selectedSlug.value) mapApi?.flyTo(selectedSlug.value, framePadding());
    else mapApi?.frameAll(framePadding(PIN_ROOM), { animate: false });
  }, 150);
}

function linkLabel(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "") + (u.pathname.length > 1 ? u.pathname.replace(/\/$/, "") : "");
  } catch {
    return url;
  }
}

async function startMap() {
  const { mountTravelMap, AMERICAS_CENTER, AMERICAS_ZOOM } = await import("../travel/map.js");
  if (!alive || !mapEl.value) return;
  try {
    mapApi = await mountTravelMap(mapEl.value, {
      trips: allTrips,
      home: data.home,
      center: AMERICAS_CENTER,
      zoom: AMERICAS_ZOOM,
      onPick: (slug) => pick(slug, { from: mapEl.value }),
    });
  } catch (error) {
    if (!alive) return;
    loadError.value = "Map didn’t load. The list still works.";
    console.warn(error);
    return;
  }
  if (!alive) {
    mapApi?.destroy();
    mapApi = null;
    return;
  }
  layoutMap();
  mapApi.resize();
  mapApi.frameAll(framePadding(PIN_ROOM), { animate: false });
  if (selectedSlug.value) {
    mapApi.select(selectedSlug.value);
    await nextTick();
    mapApi.flyTo(selectedSlug.value, framePadding());
  }
}

watch(
  () => [queryValue("dest"), queryValue("dates")],
  ([dest, dates]) => {
    const want = windowIds.includes(String(dates || "")) ? String(dates) : data.defaultWindow;
    if (want !== windowId.value) windowId.value = want;
    const slug = tripBySlug(trips.value, String(dest || ""))?.slug || "";
    if (slug === selectedSlug.value) return;
    if (slug) pick(slug);
    else closeCard({ restore: false });
  },
);

onMounted(() => {
  window.addEventListener("keydown", onKey);
  window.addEventListener("resize", onResize);
  if (queryValue("dest") && !selectedSlug.value) syncUrl();
  startMap();
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      motionOn.value = true;
    }),
  );
});

onUnmounted(() => {
  alive = false;
  window.clearTimeout(resizeTimer);
  window.clearTimeout(copyTimer);
  window.removeEventListener("keydown", onKey);
  window.removeEventListener("resize", onResize);
  mapApi?.destroy();
  mapApi = null;
});
</script>

<template>
  <div
    ref="pageEl"
    class="travel"
    :class="{ 'no-anim': !motionOn, 'card-open': !!selected, 'list-open': listOpen }"
  >
    <div id="travel-map" ref="mapEl" tabindex="-1" role="region" aria-label="Map of trip options"></div>
    <p v-if="loadError" class="map-error" role="status">{{ loadError }}</p>

    <div class="side">
      <header class="topbar">
        <h1>January trips</h1>
        <p class="sub">
          {{ rankedCount }} trip options, scored for 2 people and 7 nights
        </p>
        <fieldset class="dates">
          <legend class="sr-only">Travel dates</legend>
          <label v-for="w in data.windows" :key="w.id" :class="{ on: windowId === w.id }">
            <input
              type="radio"
              name="travel-dates"
              :value="w.id"
              :checked="windowId === w.id"
              @change="setWindow(w.id)"
            />
            <span>{{ w.label }}</span>
          </label>
        </fieldset>
      </header>

      <section class="board" aria-labelledby="rank-heading">
        <button
          class="list-toggle"
          type="button"
          :aria-expanded="listOpen ? 'true' : 'false'"
          aria-controls="rank-list"
          @click="toggleList"
        >
          <span>Ranking</span>
          <span class="list-chev" aria-hidden="true"></span>
        </button>
        <h2 id="rank-heading" class="board-heading">Ranking · {{ windowLabel }}</h2>
        <p class="list-weights">{{ data.weightLegend }}</p>
        <div class="sort">
          <label for="travel-sort">Sort</label>
          <select id="travel-sort" v-model="sortKey">
            <option v-for="opt in sortOptions" :key="opt.id" :value="opt.id">{{ opt.label }}</option>
          </select>
        </div>
        <p v-if="!windowPriced(windowId)" class="window-note">{{ data.missingWindowNote }}</p>
        <ol id="rank-list" class="rank-list" @keydown="onListKey">
          <li v-for="trip in trips" :key="trip.slug">
            <button
              type="button"
              :data-slug="trip.slug"
              :aria-current="selectedSlug === trip.slug ? 'true' : undefined"
              :class="{ on: selectedSlug === trip.slug }"
              @click="pick(trip.slug, { from: $event.currentTarget, instant: viaKeyboard($event) })"
            >
              <span class="rank-badge" :class="{ also: alsoRan(trip) }" aria-hidden="true">{{ trip.rank }}</span>
              <span class="rank-text">
                <span class="rank-name">
                  <span class="sr-only">{{ rankLabel(trip) }}: </span>{{ trip.name }}
                </span>
                <span class="rank-meta">
                  <span class="rank-score" :aria-label="`Score ${formatScore(trip.scores.weighted)}`">{{ formatScore(trip.scores.weighted) }}</span>
                  <span class="rank-cost">{{ formatRange(totalFor(trip, windowId)) }}</span>
                  <span v-if="trip.drive" class="rank-tag">drive</span>
                  <span v-if="trip.advisoryLevel >= 3" class="rank-tag warn">Level 3 advisory</span>
                </span>
              </span>
            </button>
          </li>
        </ol>
        <footer class="board-foot">
          <p class="asof">
            Prices as of Nov 11, 2026; estimates labeled.
            <a :href="data.sheetUrl" target="_blank" rel="noopener">Open the Sheet<span class="sr-only"> (opens in a new tab)</span></a>
          </p>
          <details class="method">
            <summary>How these were priced</summary>
            <p>{{ data.notes }}</p>
            <p>{{ data.howToRead }}</p>
            <p>{{ data.asOfDetail }}</p>
          </details>
        </footer>
      </section>
    </div>

    <p class="sr-only" role="status" aria-live="polite">{{ announce }}</p>

    <aside
      class="trip-card"
      :class="{ open: !!selected }"
      :aria-hidden="selected ? 'false' : 'true'"
      :inert="selected ? undefined : true"
      :aria-label="selected ? `${rankLabel(selected)}: ${selected.name}` : 'Trip'"
    >
      <button v-show="selected" class="close" type="button" aria-label="Close" @click="closeCard()">×</button>
      <div v-if="selected" class="card-body">
        <p class="eyebrow">
          <span class="rank-badge big" :class="{ also: alsoRan(selected) }" aria-hidden="true">{{ selected.rank }}</span>
          {{ `Ranked #${selected.rank} of ${rankedCount}` }}<template v-if="selected.tag"> · {{ selected.tag }}</template>
        </p>
        <h2 class="card-title">{{ selected.name }}</h2>
        <p v-if="selected.plan" class="plan">{{ selected.plan }}</p>

        <div class="score-row">
          <div class="score" :aria-label="`Weighted score ${formatScore(selected.scores.weighted)}`">{{ formatScore(selected.scores.weighted) }}</div>
          <ul class="score-chips">
            <li v-for="cat in data.weights.categories" :key="cat.key">
              <span class="chip-val">{{ selected.scores[cat.key] }}</span>
              <span class="chip-lbl">{{ cat.label }}</span>
            </li>
          </ul>
        </div>

        <p v-if="selected.advisoryLevel >= 3" class="advisory" role="note">
          <strong>Travel advisory</strong>
          {{ selected.downsides }}
        </p>

        <div class="cost">
          <p class="cost-total">{{ formatRange(totalFor(selected, windowId)) }}</p>
          <p class="cost-sub">Total for 2, 7 nights · {{ windowLabel }} · estimate</p>
          <p v-if="!priced" class="cost-note">{{ data.missingWindowNote }}</p>
        </div>

        <table v-if="priced" class="breakdown">
          <caption class="sr-only">Cost breakdown, {{ windowLabel }}</caption>
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col">Low</th>
              <th scope="col">High</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.key">
              <th scope="row">
                {{ row.label }}
                <span class="row-note">{{ row.note }}</span>
              </th>
              <td>{{ row.low == null ? "—" : formatUsd(row.low) }}</td>
              <td>{{ formatUsd(row.high) }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              <td>{{ formatUsd(totalFor(selected, windowId).low) }}</td>
              <td>{{ formatUsd(totalFor(selected, windowId).high) }}</td>
            </tr>
          </tfoot>
        </table>
        <p class="pay-note">{{ data.paymentNote }}</p>
        <p v-if="selected.cardPoints" class="card-points">{{ selected.cardPoints }}</p>

        <dl class="facts">
          <div>
            <dt>January weather</dt>
            <dd>{{ selected.weather }}</dd>
          </div>
          <div>
            <dt>{{ isDrive ? "Drive from LA" : "From LAX" }}</dt>
            <dd>{{ selected.laxFlight }}</dd>
          </div>
          <div>
            <dt>From DTW</dt>
            <dd>{{ selected.dtwFlight }}</dd>
          </div>
        </dl>

        <h3>Why this place</h3>
        <p>{{ selected.why }}</p>
        <h3>What a week looks like</h3>
        <p>{{ selected.week }}</p>

        <section class="safety" aria-labelledby="safety-heading">
          <h3 id="safety-heading">Safety</h3>
          <dl>
            <div>
              <dt>Advisory</dt>
              <dd>{{ selected.safety.advisory }}</dd>
            </div>
            <div v-if="selected.safety.consensus">
              <dt>Traveler consensus</dt>
              <dd>{{ selected.safety.consensus }}</dd>
            </div>
            <div v-if="selected.safety.risks">
              <dt>Top risks</dt>
              <dd>{{ selected.safety.risks }}</dd>
            </div>
            <div v-if="selected.safety.stay">
              <dt>Where to stay</dt>
              <dd>{{ selected.safety.stay }}</dd>
            </div>
          </dl>
          <p v-if="!selected.safety.researched" class="safety-note">{{ data.safetyHowToRead }}</p>
        </section>

        <section class="sources" aria-labelledby="src-heading">
          <h3 id="src-heading">Sources</h3>
          <ul>
            <li v-for="src in selected.sources" :key="src.key">
              <span class="src-title">{{ src.title }}</span>
              <template v-for="url in src.links" :key="url">
                <a :href="url" target="_blank" rel="noopener noreferrer">{{ linkLabel(url) }}<span class="sr-only"> (opens in a new tab)</span></a>
              </template>
            </li>
          </ul>
        </section>

        <div class="card-actions">
          <button type="button" class="pill" @click="copyLink">{{ copyStatus || "Copy link" }}</button>
          <span class="sr-only" role="status" aria-live="polite">{{ copyStatus }}</span>
        </div>
        <nav class="card-step" aria-label="Other trips">
          <button v-if="prevTrip" type="button" class="pill" @click="pick(prevTrip.slug, { instant: viaKeyboard($event) })">
            <span aria-hidden="true">←</span> {{ prevTrip.short }}
          </button>
          <span v-else></span>
          <button v-if="nextTrip" type="button" class="pill" @click="pick(nextTrip.slug, { instant: viaKeyboard($event) })">
            {{ nextTrip.short }} <span aria-hidden="true">→</span>
          </button>
        </nav>
        <p class="asof card-asof">
          Prices as of Nov 11, 2026; estimates labeled.
          <a :href="data.sheetUrl" target="_blank" rel="noopener">Open the Sheet<span class="sr-only"> (opens in a new tab)</span></a>
        </p>
      </div>
    </aside>
    <div class="scrim" :class="{ open: !!selected }" @click="closeCard()"></div>
  </div>
</template>
