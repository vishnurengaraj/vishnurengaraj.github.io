import { maplibregl, openGlobeMap } from "../runs/basemap.js";
import { DROP_FILL, DROP_GOLD, DROP_WHITE } from "../diners/pins.js";
import { arc } from "./trips.js";

/** Below this zoom the pins are close enough to touch, so nudged pairs spread apart. */
const NEAR_ZOOM = 4.2;
const FLY_MS = 1600;
const DEST_ZOOM = 6.2;

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
}

function pinElement(trip, index) {
  const el = document.createElement("div");
  el.className = `trip-pin${trip.rank === "1" ? " top" : ""}${trip.rank === "HM" ? " hm" : ""}${
    trip.advisoryLevel >= 3 ? " warn" : ""
  }`;
  el.dataset.slug = trip.slug;
  el.style.setProperty("--nx", `${trip.nudge?.[0] || 0}px`);
  el.style.setProperty("--ny", `${trip.nudge?.[1] || 0}px`);
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

function emptyLine() {
  return { type: "FeatureCollection", features: [] };
}

export async function mountTravelMap(mapEl, { trips, home, center, zoom, onPick }) {
  const map = await openGlobeMap(mapEl, {
    center,
    zoom,
    minZoom: 0.8,
    maxZoom: 14,
    maxPitch: 0,
    dragRotate: false,
    pitchWithRotate: false,
    renderWorldCopies: false,
  });
  map.touchZoomRotate.disableRotation();
  let disposed = false;

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
    const marker = new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat(trip.center).addTo(map);
    markers.set(trip.slug, { marker, el });
  });

  function syncNear() {
    mapEl.classList.toggle("pins-near", map.getZoom() < NEAR_ZOOM);
    mapEl.dataset.zoom = map.getZoom().toFixed(3);
    const c = map.getCenter();
    mapEl.dataset.lng = c.lng.toFixed(4);
    mapEl.dataset.lat = c.lat.toFixed(4);
  }
  map.on("move", syncNear);
  map.on("moveend", () => {
    syncNear();
    mapEl.dataset.moving = "false";
  });
  map.on("movestart", () => {
    mapEl.dataset.moving = "true";
  });
  syncNear();
  mapEl.dataset.map = "ready";

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
      map.flyTo({
        center: trip.center,
        zoom: DEST_ZOOM,
        padding,
        duration: instant || reducedMotion() ? 0 : FLY_MS,
        essential: true,
      });
    },
    frameAll(padding, { animate = true } = {}) {
      if (disposed) return;
      const bounds = new maplibregl.LngLatBounds();
      for (const trip of trips) bounds.extend(trip.center);
      bounds.extend(home.center);
      const camera = map.cameraForBounds(bounds, { padding });
      if (!camera) return;
      map.flyTo({
        ...camera,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        duration: animate && !reducedMotion() ? FLY_MS : 0,
        essential: true,
      });
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
      for (const { marker } of markers.values()) marker.remove();
      map.remove();
    },
    get selected() {
      return selected;
    },
  };
}
