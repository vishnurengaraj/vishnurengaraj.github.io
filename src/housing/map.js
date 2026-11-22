import { maplibregl, openGlobeMap } from "../runs/basemap.js";
import { DROP_FILL, DROP_GOLD, DROP_WHITE } from "../diners/pins.js";
import { daysOnMarket, freshnessColor, freshnessInk, isHiddenStatus, isHonorable } from "./format.js";

const CLUSTER_PX = 40;
const NAME_HIDE_ZOOM = 13.2;
const FLY_ZOOM = 15.2;
const FLY_MS = 900;

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
}

function pinElement(listing, index, maxAge) {
  const el = document.createElement("div");
  const hidden = isHiddenStatus(listing.status);
  const unranked = listing.rank == null;
  const hm = isHonorable(listing);
  el.className = `home-pin${listing.rank === 1 ? " top" : ""}${hidden && !hm ? " dimmed" : ""}${unranked ? " unranked" : ""}${hm ? " hm" : ""}`;
  el.dataset.id = listing.id;
  el.style.setProperty("--i", String(index));
  const fill = freshnessColor(daysOnMarket(listing), maxAge);
  if (fill) {
    el.style.color = fill;
    el.style.setProperty("--pin-ink", freshnessInk(fill));
  }
  el.setAttribute("aria-hidden", "true");
  const rankLabel = unranked ? "" : escapeHtml(String(listing.rank));
  el.innerHTML = `<div class="pin-body">
    <svg class="pin-shape" viewBox="0 0 34 44" width="34" height="44" aria-hidden="true">
      <path class="pin-ring" d="${DROP_GOLD}"/>
      <path d="${DROP_WHITE}" fill="#fff"/>
      <path class="pin-fill" d="${DROP_FILL}"/>
      ${hm ? `<path class="pin-hm" d="${DROP_GOLD}" fill="none"/>` : ""}
    </svg>
    <span class="pin-rank">${rankLabel}</span>
    <span class="pin-name">${escapeHtml(listing.address)}</span>
  </div>`;
  return el;
}

function clusterElement(count) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "home-cluster";
  el.setAttribute("aria-label", `${count} listings`);
  el.innerHTML = `<span class="cluster-count">${escapeHtml(String(count))}</span>`;
  return el;
}

function landmarkElement(place) {
  const el = document.createElement("div");
  el.className = `home-mark ${place.id}`;
  el.dataset.id = place.id;
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = `<div class="mark-body"><span class="mark-dot"></span><span class="mark-name">${escapeHtml(place.label)}</span></div>`;
  return el;
}

function clusterVisible(map, items) {
  const visible = [];
  for (const listing of items) {
    const p = map.project([listing.lng, listing.lat]);
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    visible.push({ listing, x: p.x, y: p.y });
  }
  const used = new Set();
  const groups = [];
  for (let i = 0; i < visible.length; i++) {
    if (used.has(i)) continue;
    const group = [visible[i]];
    used.add(i);
    let grew = true;
    while (grew) {
      grew = false;
      for (let j = 0; j < visible.length; j++) {
        if (used.has(j)) continue;
        const b = visible[j];
        if (group.some((a) => Math.hypot(a.x - b.x, a.y - b.y) < CLUSTER_PX)) {
          group.push(b);
          used.add(j);
          grew = true;
        }
      }
    }
    groups.push(group);
  }
  return groups;
}

export async function mountHousingMap(mapEl, { listings, landmarks, onPick, maxAge = 14 }) {
  const map = await openGlobeMap(
    mapEl,
    {
      center: [-118.39, 33.87],
      zoom: 11.6,
      minZoom: 10,
      maxZoom: 17,
      maxPitch: 0,
      dragRotate: false,
      pitchWithRotate: false,
    },
    { projection: "mercator" },
  );
  map.touchZoomRotate.disableRotation();
  map.dragRotate.disable();
  let disposed = false;
  let lastPadding = { top: 40, right: 40, bottom: 40, left: 40 };
  let visibleIds = new Set(listings.map((l) => l.id));
  let selected = "";

  const markers = new Map();
  listings.forEach((listing, index) => {
    const el = pinElement(listing, index, maxAge);
    el.addEventListener("click", (event) => {
      event.stopPropagation();
      onPick?.(listing.id);
    });
    const marker = new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat([listing.lng, listing.lat]).addTo(map);
    markers.set(listing.id, { marker, el, listing });
  });

  const landmarkMarkers = [];
  for (const place of [landmarks?.beach, landmarks?.spacex].filter(Boolean)) {
    const el = landmarkElement(place);
    const marker = new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat([place.lng, place.lat]).addTo(map);
    landmarkMarkers.push({ marker, el, place });
  }

  const clusterMarkers = [];
  function clearClusters() {
    for (const { marker } of clusterMarkers) marker.remove();
    clusterMarkers.length = 0;
  }

  function zoomToCluster(members) {
    if (disposed || !members.length) return;
    if (members.length === 1) {
      onPick?.(members[0].id);
      return;
    }
    const bounds = new maplibregl.LngLatBounds();
    for (const listing of members) bounds.extend([listing.lng, listing.lat]);
    map.fitBounds(bounds, {
      padding: { top: 80, right: 80, bottom: 80, left: 80, ...lastPadding },
      maxZoom: 16,
      duration: reducedMotion() ? 0 : 700,
      essential: true,
    });
  }

  function syncMarkers() {
    if (disposed) return;
    mapEl.classList.toggle("pins-near", map.getZoom() < NAME_HIDE_ZOOM);
    const active = listings.filter((l) => visibleIds.has(l.id));
    const always = active.filter((l) => isHonorable(l));
    const clusterable = active.filter((l) => !isHonorable(l));
    const groups = map.getZoom() < 14.2 ? clusterVisible(map, clusterable) : clusterable.map((listing) => [{ listing }]);
    const shown = new Set(always.map((l) => l.id));
    clearClusters();
    for (const group of groups) {
      if (group.length === 1) {
        shown.add(group[0].listing.id);
        continue;
      }
      const members = group.map((item) => item.listing);
      const el = clusterElement(members.length);
      el.addEventListener("click", (event) => {
        event.stopPropagation();
        zoomToCluster(members);
      });
      const lng = members.reduce((s, l) => s + l.lng, 0) / members.length;
      const lat = members.reduce((s, l) => s + l.lat, 0) / members.length;
      const marker = new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([lng, lat]).addTo(map);
      clusterMarkers.push({ marker, el });
    }
    for (const [id, { el }] of markers) {
      const on = shown.has(id);
      el.hidden = !on;
      el.style.display = on ? "" : "none";
      el.classList.toggle("sel", id === selected);
    }
  }

  map.on("move", syncMarkers);
  map.on("moveend", syncMarkers);
  syncMarkers();
  mapEl.dataset.map = "ready";

  function select(id) {
    selected = id || "";
    mapEl.dataset.selected = selected;
    for (const [key, { el }] of markers) el.classList.toggle("sel", key === selected);
  }

  function visibleListings() {
    return listings.filter((l) => visibleIds.has(l.id));
  }

  return {
    select,
    setVisible(ids) {
      visibleIds = new Set(ids);
      syncMarkers();
    },
    flyTo(id, padding, { instant = false } = {}) {
      if (disposed) return;
      const listing = listings.find((l) => l.id === id);
      if (!listing) return;
      lastPadding = padding || lastPadding;
      map.flyTo({
        center: [listing.lng, listing.lat],
        zoom: Math.max(map.getZoom(), FLY_ZOOM),
        padding,
        bearing: 0,
        pitch: 0,
        duration: instant || reducedMotion() ? 0 : FLY_MS,
        essential: true,
      });
    },
    frameAll(padding, { animate = true } = {}) {
      if (disposed) return;
      lastPadding = padding || lastPadding;
      const bounds = new maplibregl.LngLatBounds();
      let count = 0;
      for (const listing of visibleListings()) {
        bounds.extend([listing.lng, listing.lat]);
        count += 1;
      }
      for (const place of [landmarks?.beach, landmarks?.spacex].filter(Boolean)) {
        bounds.extend([place.lng, place.lat]);
        count += 1;
      }
      if (!count) return;
      const opts = { padding, maxZoom: 13.4, essential: true, duration: animate && !reducedMotion() ? FLY_MS : 0 };
      map.fitBounds(bounds, opts);
    },
    resize() {
      map.resize();
    },
    destroy() {
      disposed = true;
      clearClusters();
      for (const { marker } of markers.values()) marker.remove();
      for (const { marker } of landmarkMarkers) marker.remove();
      map.remove();
    },
  };
}
