import { maplibregl, openGlobeMap } from "../runs/basemap.js";
import { DROP_FILL, DROP_GOLD, DROP_WHITE } from "../diners/pins.js";
import { arc } from "./trips.js";

const FLY_MS = 1600;
const DEST_ZOOM = 6.2;
/** Nearby pins closer than this, in screen pixels, collapse into one badge. */
const CLUSTER_PX = 48;
const NAME_HIDE_ZOOM = 4.2;

/** Americas overview: Mexico and the US Southwest in the open map. Spin to see Europe or Asia. */
export const AMERICAS_CENTER = [-105, 25];
export const AMERICAS_ZOOM = 2.15;

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
}

function isAlsoRan(trip) {
  return Number(trip.rank) > 10;
}

function lngLatOf(coords) {
  if (!coords) return null;
  if (Array.isArray(coords)) return { lng: coords[0], lat: coords[1] };
  return { lng: coords.lng, lat: coords.lat };
}

export function angularDistance(a, b) {
  const from = lngLatOf(a);
  const to = lngLatOf(b);
  const r = Math.PI / 180;
  const dLat = (to.lat - from.lat) * r;
  const dLng = (to.lng - from.lng) * r;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(from.lat * r) * Math.cos(to.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * Math.asin(Math.min(1, Math.sqrt(x))) * (180 / Math.PI);
}

/** Keep pins off the far side and the foreshortened limb of the globe. */
export function maxFrontAngle(zoom) {
  return Math.min(88, Math.max(35, 110 - zoom * 18));
}

/** True when project/unproject of the point agree and it is well inside the visible cap. */
export function isFrontFacing(map, coords) {
  const want = lngLatOf(coords);
  if (!want || !Number.isFinite(want.lng) || !Number.isFinite(want.lat)) return false;
  const projection = map.getProjection?.();
  const type = typeof projection === "string" ? projection : projection?.type;
  if (type && type !== "globe") return true;
  if (angularDistance(map.getCenter(), want) > maxFrontAngle(map.getZoom())) return false;
  const point = map.project([want.lng, want.lat]);
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
  const back = map.unproject(point);
  const dLng = Math.abs(((back.lng - want.lng + 540) % 360) - 180);
  return dLng < 2 && Math.abs(back.lat - want.lat) < 2;
}

function pinElement(trip, index) {
  const el = document.createElement("div");
  el.className = `trip-pin${trip.rank === "1" ? " top" : ""}${isAlsoRan(trip) ? " also" : ""}${
    trip.advisoryLevel >= 3 ? " warn" : ""
  }`;
  el.dataset.slug = trip.slug;
  el.style.setProperty("--i", String(index));
  /* The ranking list is the keyboard path. Pins are pointer shortcuts to the same buttons. */
  el.setAttribute("aria-hidden", "true");
  el.setAttribute("aria-label", `${trip.rank} ${trip.short}`);
  el.innerHTML = `<div class="pin-body">
    <svg class="pin-shape" viewBox="0 0 34 44" width="34" height="44" aria-hidden="true">
      <path class="pin-ring" d="${DROP_GOLD}"/>
      <path d="${DROP_WHITE}" fill="#fff"/>
      <path class="pin-fill" d="${DROP_FILL}"/>
    </svg>
    <span class="pin-rank">${escapeHtml(trip.rank)}</span>
    <span class="pin-name">${escapeHtml(trip.short)}</span>
  </div>`;
  return el;
}

function clusterElement(count) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "trip-cluster";
  el.setAttribute("aria-label", `${count} destinations`);
  el.dataset.count = String(count);
  el.innerHTML = `<span class="cluster-count">${escapeHtml(String(count))}</span>`;
  return el;
}

function emptyLine() {
  return { type: "FeatureCollection", features: [] };
}

function sphericalCentroid(points) {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const coords of points) {
    const ll = lngLatOf(coords);
    const lat = (ll.lat * Math.PI) / 180;
    const lng = (ll.lng * Math.PI) / 180;
    x += Math.cos(lat) * Math.cos(lng);
    y += Math.cos(lat) * Math.sin(lng);
    z += Math.sin(lat);
  }
  const n = points.length || 1;
  x /= n;
  y /= n;
  z /= n;
  return [Math.atan2(y, x) * (180 / Math.PI), Math.atan2(z, Math.hypot(x, y)) * (180 / Math.PI)];
}

function clusterVisible(map, trips) {
  const visible = [];
  for (const trip of trips) {
    if (!isFrontFacing(map, trip.center)) continue;
    const p = map.project(trip.center);
    visible.push({ trip, x: p.x, y: p.y });
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

export async function mountTravelMap(mapEl, { trips, home, center, zoom, onPick, onCluster }) {
  const map = await openGlobeMap(
    mapEl,
    {
      center: center || AMERICAS_CENTER,
      zoom: zoom ?? AMERICAS_ZOOM,
      minZoom: 1,
      maxZoom: 14,
      maxPitch: 0,
      dragRotate: false,
      pitchWithRotate: false,
    },
    { projection: "globe" },
  );
  map.touchZoomRotate.disableRotation();
  let disposed = false;
  let lastPadding = { top: 0, right: 0, bottom: 0, left: 0 };

  map.addSource("trip-arc", { type: "geojson", data: emptyLine() });
  map.addLayer({
    id: "trip-arc-glow",
    type: "line",
    source: "trip-arc",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#ffb020", "line-width": 6, "line-opacity": 0.35, "line-blur": 1 },
  });
  map.addLayer({
    id: "trip-arc",
    type: "line",
    source: "trip-arc",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#2d1d7a", "line-width": 1.6, "line-dasharray": [2, 2] },
  });
  map.addSource("trip-home", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: [{ type: "Feature", properties: { label: home.label }, geometry: { type: "Point", coordinates: home.center } }],
    },
  });
  map.addLayer({
    id: "trip-home",
    type: "circle",
    source: "trip-home",
    paint: {
      "circle-radius": 4.5,
      "circle-color": "#ffb020",
      "circle-stroke-color": "#2d1d7a",
      "circle-stroke-width": 2,
    },
  });

  const markers = new Map();
  trips.forEach((trip, index) => {
    const el = pinElement(trip, index);
    el.addEventListener("click", (event) => {
      event.stopPropagation();
      onPick?.(trip.slug);
    });
    const marker = new maplibregl.Marker({ element: el, anchor: "bottom", pitchAlignment: "viewport", rotationAlignment: "viewport" })
      .setLngLat(trip.center)
      .addTo(map);
    markers.set(trip.slug, { marker, el, trip });
  });

  const clusterMarkers = [];

  function clearClusters() {
    for (const { marker } of clusterMarkers) marker.remove();
    clusterMarkers.length = 0;
  }

  function zoomToCluster(members) {
    if (disposed || !members.length) return;
    if (members.length === 1) {
      onPick?.(members[0].slug);
      return;
    }
    const bounds = new maplibregl.LngLatBounds();
    for (const trip of members) bounds.extend(trip.center);
    map.fitBounds(bounds, {
      padding: { top: 80, right: 80, bottom: 80, left: 80, ...lastPadding },
      maxZoom: DEST_ZOOM,
      duration: reducedMotion() ? 0 : 800,
      essential: true,
    });
    onCluster?.(members.map((trip) => trip.slug));
  }

  function syncMarkers() {
    if (disposed) return;
    mapEl.classList.toggle("pins-near", map.getZoom() < NAME_HIDE_ZOOM);
    mapEl.dataset.zoom = map.getZoom().toFixed(3);
    const c = map.getCenter();
    mapEl.dataset.lng = c.lng.toFixed(4);
    mapEl.dataset.lat = c.lat.toFixed(4);
    mapEl.dataset.projection = "globe";

    const groups = clusterVisible(map, trips);
    const shown = new Set();
    clearClusters();
    for (const group of groups) {
      if (group.length === 1) {
        shown.add(group[0].trip.slug);
        continue;
      }
      const members = group.map((item) => item.trip);
      const el = clusterElement(members.length);
      el.dataset.slugs = members.map((trip) => trip.slug).join(",");
      el.addEventListener("click", (event) => {
        event.stopPropagation();
        zoomToCluster(members);
      });
      const marker = new maplibregl.Marker({ element: el, anchor: "center", pitchAlignment: "viewport", rotationAlignment: "viewport" })
        .setLngLat(sphericalCentroid(members.map((trip) => trip.center)))
        .addTo(map);
      clusterMarkers.push({ marker, el });
    }
    for (const [slug, { el }] of markers) {
      const on = shown.has(slug);
      el.hidden = !on;
      el.style.display = on ? "" : "none";
    }
  }

  map.on("move", syncMarkers);
  map.on("moveend", () => {
    syncMarkers();
    mapEl.dataset.moving = "false";
  });
  map.on("movestart", () => {
    mapEl.dataset.moving = "true";
  });
  syncMarkers();
  mapEl.dataset.map = "ready";

  mapEl.__travel = {
    unproject(x, y) {
      const ll = map.unproject([x, y]);
      return { lng: ll.lng, lat: ll.lat };
    },
    project(lng, lat) {
      const p = map.project([lng, lat]);
      return { x: p.x, y: p.y };
    },
    jumpTo(opts) {
      map.jumpTo({ bearing: 0, pitch: 0, ...opts, essential: true });
    },
    getZoom: () => map.getZoom(),
    getCenter: () => {
      const c = map.getCenter();
      return { lng: c.lng, lat: c.lat };
    },
    isFront: (lng, lat) => isFrontFacing(map, [lng, lat]),
  };

  let selected = "";
  function select(slug) {
    selected = slug || "";
    mapEl.dataset.selected = selected;
    for (const [id, { el }] of markers) el.classList.toggle("sel", id === selected);
    const trip = trips.find((t) => t.slug === selected);
    map.getSource("trip-arc")?.setData(
      trip
        ? { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: arc(home.center, trip.center) } }
        : emptyLine(),
    );
  }

  return {
    select,
    flyTo(slug, padding, { instant = false } = {}) {
      if (disposed) return;
      const trip = trips.find((t) => t.slug === slug);
      if (!trip) return;
      lastPadding = padding || lastPadding;
      map.flyTo({
        center: trip.center,
        zoom: DEST_ZOOM,
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
      const next = {
        center: AMERICAS_CENTER,
        zoom: AMERICAS_ZOOM,
        bearing: 0,
        pitch: 0,
        padding,
        essential: true,
      };
      if (animate && !reducedMotion()) map.easeTo({ ...next, duration: FLY_MS });
      else map.jumpTo(next);
    },
    resize() {
      map.resize();
    },
    project(lngLat) {
      const p = map.project(lngLat);
      return { x: p.x, y: p.y };
    },
    getZoom() {
      return map.getZoom();
    },
    destroy() {
      disposed = true;
      mapEl.__travel = null;
      clearClusters();
      for (const { marker } of markers.values()) marker.remove();
      map.remove();
    },
    get selected() {
      return selected;
    },
  };
}
