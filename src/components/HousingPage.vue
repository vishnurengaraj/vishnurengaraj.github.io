<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useHead } from "@unhead/vue";
import data from "../data/housing/housing.json";
import { occlusionPadding } from "../runs/frame.js";
import {
  STATUS_LABELS,
  STATUSES,
  breakdownRows,
  criteriaPlaces,
  criteriaSummary,
  daysOnMarket,
  factBadge,
  filterListings,
  formatBeachAccess,
  honorableMentions,
  isHonorable,
  formatBedsBaths,
  formatKm,
  formatListedAgo,
  formatMins,
  formatPoints,
  formatRent,
  formatSeen,
  formatSqft,
  formatType,
  formatUpdatedAt,
  isHiddenStatus,
  sortListings,
} from "../housing/format.js";
import "../styles/housing.css";

const route = useRoute();
const router = useRouter();
const pageEl = ref(null);
const mapEl = ref(null);
const listOpen = ref(false);
const motionOn = ref(false);
const loadError = ref("");
const announce = ref("");

const allListings = data.listings;
const openCount = allListings.filter((l) => !isHiddenStatus(l.status)).length;
const hiddenCount = allListings.length - openCount;
const maxAge = Number(data.criteria?.max_listing_age_days) || 14;
const sortKey = ref("rank");
const sortOptions = [
  { id: "rank", label: "Rank" },
  { id: "score", label: "Score" },
  { id: "rent", label: "Rent" },
  { id: "walk", label: "Walk to beach" },
  { id: "drive", label: "Drive to SpaceX" },
];
const rentCaps = [
  { id: "any", label: "Any", value: null },
  { id: "3500", label: "$3,500", value: 3500 },
  { id: "4000", label: "$4,000", value: 4000 },
  { id: "4500", label: "$4,500", value: 4500 },
];
const walkCaps = [
  { id: "any", label: "Any", value: null },
  { id: "10", label: "10 min", value: 10 },
  { id: "15", label: "15 min", value: 15 },
  { id: "20", label: "20 min", value: 20 },
];
const statusOptions = [
  { id: "all", label: "All open" },
  ...STATUSES.filter((s) => s !== "rejected").map((id) => ({ id, label: STATUS_LABELS[id] })),
];

const maxRent = ref(null);
const maxWalk = ref(null);
const statusFilter = ref("all");
const showHidden = ref(false);

const visible = computed(() =>
  sortListings(
    filterListings(allListings, {
      maxRent: maxRent.value,
      maxWalk: maxWalk.value,
      status: statusFilter.value,
      showHidden: showHidden.value,
    }),
    sortKey.value,
  ),
);
const mentions = computed(() => honorableMentions(allListings));

function queryValue(key) {
  const raw = route.query[key];
  return Array.isArray(raw) ? raw[0] : raw;
}

function listingById(id) {
  if (!id) return null;
  return allListings.find((l) => l.id === id) || null;
}

const selectedId = ref(listingById(String(queryValue("id") || ""))?.id || "");
const selected = computed(() => listingById(selectedId.value));
const selectedIndex = computed(() => visible.value.findIndex((l) => l.id === selectedId.value));
const prevListing = computed(() => (selectedIndex.value > 0 ? visible.value[selectedIndex.value - 1] : null));
const nextListing = computed(() =>
  selectedIndex.value >= 0 && selectedIndex.value < visible.value.length - 1 ? visible.value[selectedIndex.value + 1] : null,
);

if (selected.value && isHiddenStatus(selected.value.status) && !isHonorable(selected.value)) showHidden.value = true;

const asOf = computed(() => formatUpdatedAt(data.updated_at));
const criteriaLines = computed(() => criteriaSummary(data.criteria));
const criteriaWhere = computed(() => criteriaPlaces(data.criteria));
const fixtureBuild = data.source === "fixture";

function listedAgo(listing) {
  return formatListedAgo(daysOnMarket(listing));
}

function walkLine(listing) {
  const mins = formatMins(listing.walk_min_to_beach);
  const km = formatKm(listing.walk_km_to_beach);
  return km ? `${mins} · ${km}` : mins;
}

function driveLine(listing) {
  const mins = formatMins(listing.drive_min_to_spacex);
  const rush =
    listing.drive_min_to_spacex_rush != null
      ? ` (${formatMins(listing.drive_min_to_spacex_rush)} rush hour)`
      : "";
  const km = formatKm(listing.drive_km_to_spacex);
  return km ? `${mins}${rush} · ${km}` : `${mins}${rush}`;
}

const headTitle = computed(() =>
  selected.value
    ? `${selected.value.address}, ${selected.value.city} · Housing · Vishnu Rengaraj`
    : "Housing · Vishnu Rengaraj",
);
const headDescription = computed(() => {
  if (selected.value) {
    const l = selected.value;
    return `${l.address}, ${l.city}. ${formatRent(l.rent_usd)}/mo, ${formatBedsBaths(l.beds, l.baths)}, ${formatMins(l.walk_min_to_beach)} walk to the beach.`;
  }
  return `Rental shortlist: ${openCount} places, scored against a $4,500 budget, a 20-minute walk to the ocean, and a 20-minute drive to SpaceX.`;
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
let opener = null;
const PIN_ROOM = 28;

function isPhone() {
  return window.matchMedia("(max-width: 640px)").matches;
}

function prefersReduced() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function focusEl(el) {
  if (el && typeof el.focus === "function") el.focus({ preventScroll: true });
}

function framePadding(extra = 0) {
  const map = mapEl.value;
  const root = pageEl.value;
  if (!map || !root) return occlusionPadding({ width: 0, height: 0 });
  const box = map.getBoundingClientRect();
  let top = 0;
  let right = 0;
  let bottom = 0;
  let left = 0;
  const topbar = root.querySelector(".topbar");
  const board = root.querySelector(".board");
  const card = root.querySelector(".home-card.open");
  if (isPhone()) {
    if (topbar) top = topbar.getBoundingClientRect().bottom - box.top;
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
    if (key === "id") continue;
    if (value != null && value !== "") query[key] = value;
  }
  if (selectedId.value) query.id = selectedId.value;
  if (String(queryValue("id") || "") === (query.id || "")) return;
  router.replace({ name: "housing", query }).catch(() => {});
}

function viaKeyboard(event) {
  return event?.detail === 0;
}

async function pick(id, { from = null, fly = true, instant = false } = {}) {
  const listing = listingById(id);
  if (!listing) return;
  if (isHiddenStatus(listing.status) && !isHonorable(listing)) showHidden.value = true;
  if (from) opener = from;
  selectedId.value = listing.id;
  announce.value = `${listing.address}, ${listing.city}, ${formatRent(listing.rent_usd)} a month`;
  if (isPhone()) listOpen.value = false;
  syncUrl();
  mapApi?.select(listing.id);
  await nextTick();
  const body = pageEl.value?.querySelector(".home-card .card-body");
  if (body) body.scrollTop = 0;
  if (fly) mapApi?.flyTo(listing.id, framePadding(), { instant });
  if (isPhone()) focusEl(pageEl.value?.querySelector(".home-card .close"));
}

function closeCard({ restore = true } = {}) {
  if (!selectedId.value) return;
  const id = selectedId.value;
  selectedId.value = "";
  announce.value = "";
  syncUrl();
  mapApi?.select("");
  nextTick(() => mapApi?.frameAll(framePadding(PIN_ROOM)));
  const el = opener || pageEl.value?.querySelector(`.rank-list [data-id="${CSS.escape(id)}"]`);
  opener = null;
  if (restore) requestAnimationFrame(() => focusEl(el));
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

function onKey(event) {
  if (event.key !== "Escape") return;
  if (selectedId.value) {
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
    mapApi?.resize();
    if (selectedId.value) mapApi?.flyTo(selectedId.value, framePadding());
    else mapApi?.frameAll(framePadding(PIN_ROOM), { animate: false });
  }, 150);
}

function syncMapVisible() {
  const ids = new Set(visible.value.map((l) => l.id));
  for (const listing of mentions.value) ids.add(listing.id);
  mapApi?.setVisible([...ids]);
}

async function startMap() {
  const { mountHousingMap } = await import("../housing/map.js");
  if (!alive || !mapEl.value) return;
  try {
    mapApi = await mountHousingMap(mapEl.value, {
      listings: allListings,
      landmarks: data.landmarks,
      maxAge,
      onPick: (id) => pick(id, { from: mapEl.value }),
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
  mapApi.resize();
  syncMapVisible();
  mapApi.frameAll(framePadding(PIN_ROOM), { animate: false });
  if (selectedId.value) {
    mapApi.select(selectedId.value);
    await nextTick();
    mapApi.flyTo(selectedId.value, framePadding());
  }
}

watch(visible, () => {
  syncMapVisible();
  if (selectedId.value && !visible.value.some((l) => l.id === selectedId.value)) closeCard({ restore: false });
});

watch(
  () => queryValue("id"),
  (id) => {
    const want = listingById(String(id || ""))?.id || "";
    if (want === selectedId.value) return;
    if (want) pick(want, { instant: true });
    else closeCard({ restore: false });
  },
);

onMounted(() => {
  motionOn.value = !prefersReduced();
  window.addEventListener("keydown", onKey);
  window.addEventListener("resize", onResize);
  startMap();
});

onUnmounted(() => {
  alive = false;
  window.removeEventListener("keydown", onKey);
  window.removeEventListener("resize", onResize);
  window.clearTimeout(resizeTimer);
  mapApi?.destroy();
  mapApi = null;
});
</script>

<template>
  <div
    ref="pageEl"
    class="housing"
    :class="{ 'no-anim': !motionOn, 'card-open': !!selected, 'list-open': listOpen }"
  >
    <div id="housing-map" ref="mapEl" tabindex="-1" role="region" aria-label="Map of rental listings, the beach, and SpaceX"></div>
    <p v-if="loadError" class="map-error" role="status">{{ loadError }}</p>

    <div class="side">
      <header class="topbar">
        <p class="crumbs">
          <a class="home" href="/">rengaraj.com</a>
          <span aria-hidden="true">/</span>
          <span>housing</span>
        </p>
        <h1>Housing</h1>
        <p class="sub">
          {{ openCount }} open
          <template v-if="hiddenCount"> · {{ hiddenCount }} rejected or stale</template>
          <template v-if="asOf"> · Updated {{ asOf }}</template>
        </p>
        <p v-if="fixtureBuild" class="fixture-note">Showing sample fixture data, not the live shortlist.</p>
        <p class="criteria">{{ criteriaLines.join(" · ") }}</p>
        <p v-if="criteriaWhere" class="criteria where">{{ criteriaWhere }}</p>
      </header>

      <section class="board" aria-labelledby="rank-heading">
        <button
          class="list-toggle"
          type="button"
          :aria-expanded="listOpen ? 'true' : 'false'"
          aria-controls="rank-list"
          @click="toggleList"
        >
          <span>Shortlist</span>
          <span class="list-chev" aria-hidden="true"></span>
        </button>
        <h2 id="rank-heading" class="board-heading">Shortlist</h2>

        <div class="filters">
          <fieldset class="pills">
            <legend>Max rent</legend>
            <label v-for="opt in rentCaps" :key="opt.id" :class="{ on: maxRent === opt.value }">
              <input type="radio" name="housing-rent" :checked="maxRent === opt.value" @change="maxRent = opt.value" />
              <span>{{ opt.label }}</span>
            </label>
          </fieldset>
          <fieldset class="pills">
            <legend>Max walk to beach</legend>
            <label v-for="opt in walkCaps" :key="opt.id" :class="{ on: maxWalk === opt.value }">
              <input type="radio" name="housing-walk" :checked="maxWalk === opt.value" @change="maxWalk = opt.value" />
              <span>{{ opt.label }}</span>
            </label>
          </fieldset>
          <div class="sort-row">
            <label class="sort">
              <span>Status</span>
              <select v-model="statusFilter" id="housing-status">
                <option v-for="opt in statusOptions" :key="opt.id" :value="opt.id">{{ opt.label }}</option>
              </select>
            </label>
            <label class="sort">
              <span>Sort</span>
              <select v-model="sortKey" id="housing-sort">
                <option v-for="opt in sortOptions" :key="opt.id" :value="opt.id">{{ opt.label }}</option>
              </select>
            </label>
          </div>
          <label class="reject-toggle">
            <input type="checkbox" v-model="showHidden" />
            <span>Show rejected and stale ({{ hiddenCount }})</span>
          </label>
        </div>

        <ol id="rank-list" class="rank-list" @keydown="onListKey">
          <li v-for="listing in visible" :key="listing.id">
            <button
              type="button"
              :data-id="listing.id"
              :aria-current="selectedId === listing.id ? 'true' : undefined"
              :class="{ on: selectedId === listing.id, dimmed: isHiddenStatus(listing.status) }"
              @click="pick(listing.id, { from: $event.currentTarget, instant: viaKeyboard($event) })"
            >
              <span class="rank-badge" :class="{ dimmed: isHiddenStatus(listing.status), unranked: listing.rank == null }" aria-hidden="true">{{ listing.rank == null ? "" : listing.rank }}</span>
              <span class="rank-text">
                <span class="rank-name">
                  <span v-if="listing.rank != null" class="sr-only">Rank {{ listing.rank }}: </span>{{ listing.address }}
                </span>
                <span class="rank-meta">
                  <span class="rank-score" :aria-label="`Score ${listing.score}`">{{ listing.score }}</span>
                  <span class="rank-cost">{{ formatRent(listing.rent_usd) }}</span>
                  <span class="rank-tag">{{ formatMins(listing.walk_min_to_beach) }} walk</span>
                  <span v-if="listedAgo(listing)" class="rank-tag">{{ listedAgo(listing) }}</span>
                  <span v-if="isHiddenStatus(listing.status)" class="rank-tag warn">{{ STATUS_LABELS[listing.status] || listing.status }}</span>
                </span>
              </span>
            </button>
          </li>
        </ol>
        <section v-if="mentions.length" class="mentions" aria-labelledby="hm-heading">
          <h2 id="hm-heading" class="board-heading">Honorable mentions</h2>
          <ol id="mention-list" class="rank-list mention-list">
            <li v-for="listing in mentions" :key="'hm-' + listing.id">
              <button
                type="button"
                :data-id="listing.id"
                data-mention="true"
                :aria-current="selectedId === listing.id ? 'true' : undefined"
                :class="{ on: selectedId === listing.id, hm: true }"
                @click="pick(listing.id, { from: $event.currentTarget, instant: viaKeyboard($event) })"
              >
                <span class="rank-badge hm" :class="{ unranked: listing.rank == null }" aria-hidden="true">{{ listing.rank == null ? "" : listing.rank }}</span>
                <span class="rank-text">
                  <span class="rank-name">
                    <span class="sr-only">Honorable mention: </span>{{ listing.address }}
                  </span>
                  <span class="rank-meta">
                    <span class="rank-score" :aria-label="`Score ${listing.score}`">{{ listing.score }}</span>
                    <span class="rank-cost">{{ formatRent(listing.rent_usd) }}</span>
                    <span class="rank-tag">{{ formatMins(listing.walk_min_to_beach) }} walk</span>
                    <span v-if="isHiddenStatus(listing.status)" class="rank-tag warn">{{ STATUS_LABELS[listing.status] || listing.status }}</span>
                  </span>
                  <span v-if="listing.honorable_mention_reason" class="mention-reason">{{ listing.honorable_mention_reason }}</span>
                </span>
              </button>
            </li>
          </ol>
        </section>
        <p v-if="!visible.length" class="empty">No listings match these filters.</p>
        <footer class="board-foot">
          <p class="legend-label">Pin color is days on the market</p>
          <div class="fresh-legend" aria-hidden="true">
            <span>0–1 days</span>
            <span class="fresh-bar"></span>
            <span>{{ maxAge }}+ days</span>
          </div>
          <p class="asof">
            Pins are numbered by rank. The pier marks the coast; walk times are to the nearest sand, not the pier.
            Drive times are to 1 Rocket Rd, Hawthorne.
          </p>
          <details v-if="data.scoring_notes" class="method">
            <summary>How these are scored</summary>
            <p>{{ data.scoring_notes }}</p>
          </details>
        </footer>
      </section>
    </div>

    <p class="sr-only" role="status" aria-live="polite">{{ announce }}</p>

    <aside
      class="home-card"
      :class="{ open: !!selected }"
      :aria-hidden="selected ? 'false' : 'true'"
      :inert="selected ? undefined : true"
      :aria-label="selected ? `${selected.address}, ${selected.city}` : 'Listing'"
    >
      <button v-show="selected" class="close" type="button" aria-label="Close" @click="closeCard()">×</button>
      <div v-if="selected" class="card-body">
        <p class="eyebrow">
          <span class="rank-badge big" :class="{ dimmed: isHiddenStatus(selected.status), unranked: selected.rank == null }" aria-hidden="true">{{ selected.rank == null ? "" : selected.rank }}</span>
          <template v-if="selected.rank != null">Ranked #{{ selected.rank }} of {{ allListings.length }}</template>
          <template v-else>Unranked</template>
          <template v-if="isHiddenStatus(selected.status)"> · {{ STATUS_LABELS[selected.status] || selected.status }}</template>
          <template v-if="isHonorable(selected)"> · Honorable mention</template>
        </p>
        <h2 class="card-title">{{ selected.address }}</h2>
        <p class="plan">{{ selected.city }} · {{ formatType(selected.type) }}</p>
        <p v-if="listedAgo(selected)" class="listed">{{ listedAgo(selected) }}</p>
        <p v-if="isHonorable(selected) && selected.honorable_mention_reason" class="mention-reason card-reason">{{ selected.honorable_mention_reason }}</p>
        <p class="cost-total">{{ formatRent(selected.rent_usd) }}<span class="per">/mo</span></p>
        <p class="score-line"><span class="num">{{ selected.score }}</span> score · {{ formatBedsBaths(selected.beds, selected.baths) }}<template v-if="selected.sqft"> · {{ formatSqft(selected.sqft) }}</template></p>

        <dl class="facts">
          <div :class="{ span: !!formatBeachAccess(selected.nearest_beach_access) }">
            <dt>Walk to beach</dt>
            <dd>
              {{ walkLine(selected) }}
              <span v-if="formatBeachAccess(selected.nearest_beach_access)" class="access">{{ formatBeachAccess(selected.nearest_beach_access) }}</span>
            </dd>
          </div>
          <div>
            <dt>Drive to SpaceX</dt>
            <dd>{{ driveLine(selected) }}</dd>
          </div>
          <div>
            <dt>Cats</dt>
            <dd><span class="badge" :class="factBadge(selected.cats_ok).kind">{{ factBadge(selected.cats_ok).label }}</span></dd>
          </div>
          <div>
            <dt>Garage</dt>
            <dd><span class="badge" :class="factBadge(selected.garage).kind">{{ factBadge(selected.garage).label }}</span></dd>
          </div>
          <div class="span">
            <dt>Parking</dt>
            <dd><span class="badge" :class="factBadge(selected.parking).kind">{{ factBadge(selected.parking).label }}</span></dd>
          </div>
          <div class="span">
            <dt>Yard</dt>
            <dd><span class="badge" :class="factBadge(selected.yard).kind">{{ factBadge(selected.yard).label }}</span></dd>
          </div>
        </dl>

        <section v-if="breakdownRows(selected.score_breakdown).length" class="breakdown" aria-labelledby="score-parts">
          <h3 id="score-parts">Score</h3>
          <dl>
            <div v-for="row in breakdownRows(selected.score_breakdown)" :key="row.key">
              <dt>{{ row.label }}</dt>
              <dd>{{ formatPoints(row.value) }}</dd>
            </div>
          </dl>
        </section>

        <p v-if="selected.notes" class="notes">{{ selected.notes }}</p>
        <p v-if="selected.first_seen" class="seen">First seen {{ formatSeen(selected.first_seen) }}</p>

        <div class="card-actions">
          <a class="pill primary" :href="selected.url" target="_blank" rel="noopener noreferrer">
            Open on Zillow<span class="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
        <nav class="card-step" aria-label="Other listings">
          <button v-if="prevListing" type="button" class="pill" @click="pick(prevListing.id, { instant: viaKeyboard($event) })">
            <span aria-hidden="true">←</span> {{ prevListing.address }}
          </button>
          <span v-else></span>
          <button v-if="nextListing" type="button" class="pill" @click="pick(nextListing.id, { instant: viaKeyboard($event) })">
            {{ nextListing.address }} <span aria-hidden="true">→</span>
          </button>
        </nav>
      </div>
    </aside>
    <div class="scrim" :class="{ open: !!selected }" @click="closeCard()"></div>
  </div>
</template>
