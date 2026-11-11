import { maplibregl, openGlobeMap } from "../runs/basemap.js";
import { DROP_FILL, DROP_GOLD, DROP_WHITE } from "../diners/pins.js";
import { arc } from "./trips.js";

/** Below this zoom the pins are close enough to touch, so clusters spread apart. */
const NEAR_ZOOM = 4.2;
const FLY_MS = 1600;
const DEST_ZOOM = 6.2;
const PIN_W = 34;
const PIN_H = 44;
const PIN_GAP = 4;

/** Shift longitudes into the tightest span so a worldwide set can be framed without cutting Asia or Hawaii. */
export function unwrapLng(lngs) {
  const sorted = [...lngs].sort((a, b) => a - b);
  if (!sorted.length) return (lng) => lng;
  let bestGap = sorted[0] + 360 - sorted[sorted.length - 1];
  let unwrapFrom = null;
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i] - sorted[i - 1];
    if (gap > bestGap) {
      bestGap = gap;
      unwrapFrom = sorted[i];
    }
  }
  return (lng) => (unwrapFrom != null && lng >= unwrapFrom ? lng - 360 : lng);
}

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
}

function isAlsoRan(trip) {
  return Number(trip.rank) > 10;
}

function pinElement(trip, index) {
  const el = document.createElement("div");
  el.className = `trip-pin${trip.rank === "1" ? " top" : ""}${isAlsoRan(trip) ? " also" : ""}${
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

/**
 * Spread overlapping pin bodies apart in screen space so every head stays
 * clickable at the worldwide overview. The marker stays on the true point.
 */
function spreadPins(map, trips, markers, padding) {
  const near = map.getZoom() < NEAR_ZOOM;
  const items = trips.map((trip) => {
    const lngLat = markers.get(trip.slug)?.marker.getLngLat();
    const p = map.project(lngLat || trip.center);
    return { trip, x: p.x, y: p.y, ox: p.x, oy: p.y };
  });

  if (near) {
    for (let iter = 0; iter < 50; iter++) {
      let moved = 0;
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const a = items[i];
          const b = items[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const overlapX = PIN_W + PIN_GAP - Math.abs(dx);
          const overlapY = PIN_H + PIN_GAP - Math.abs(dy);
          if (overlapX <= 0 || overlapY <= 0) continue;
          /* Push along the weaker overlap so a stack fans out instead of sliding as a block. */
          if (overlapX < overlapY) {
            const push = overlapX / 2 + 0.5;
            const dir = dx < 0 || (dx === 0 && a.ox <= b.ox) ? -1 : 1;
            a.x -= dir * push;
            b.x += dir * push;
          } else {
            const push = overlapY / 2 + 0.5;
            const dir = dy < 0 || (dy === 0 && a.oy <= b.oy) ? -1 : 1;
            a.y -= dir * push;
            b.y += dir * push;
          }
          moved++;
        }
      }
      if (!moved) break;
      const minX = PIN_W / 2 + 2;
      const maxX = map.getContainer().clientWidth - PIN_W / 2 - 2;
      const minY = PIN_H + 2;
      const maxY = map.getContainer().clientHeight - 2;
      for (const item of items) {
        item.x = Math.min(maxX, Math.max(minX, item.x));
        item.y = Math.min(maxY, Math.max(minY, item.y));
      }
    }
  }

  for (const item of items) {
    const nx = near ? Math.round(item.x - item.ox) : item.trip.nudge?.[0] || 0;
    const ny = near ? Math.round(item.y - item.oy) : item.trip.nudge?.[1] || 0;
    const el = markers.get(item.trip.slug)?.el;
    if (el) {
      el.style.setProperty("--nx", `${nx}px`);
      el.style.setProperty("--ny", `${ny}px`);
    }
  }
}

export async function mountTravelMap(mapEl, { trips, home, center, zoom, onPick }) {
  /* A 3D globe can only show a hemisphere, and these pins span about 260°.
     Start in mercator so the overview can show every destination. */
  const map = await openGlobeMap(
    mapEl,
    {
      center,
      zoom,
      minZoom: 0,
      maxZoom: 14,
      maxPitch: 0,
      dragRotate: false,
      pitchWithRotate: false,
      renderWorldCopies: true,
    },
    { projection: "mercator" },
  );
  map.touchZoomRotate.disableRotation();
  let disposed = false;
  let lastPadding = { top: 0, right: 0, bottom: 0, left: 0 };
  const unwrap = unwrapLng(trips.map((trip) => trip.center[0]).concat([home.center[0]]));
  const loc = (coords) => [unwrap(coords[0]), coords[1]];

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
      features: [{ type: "Feature", properties: { label: home.label }, geometry: { type: "Point", coordinates: loc(home.center) } }],
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
    const marker = new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat(loc(trip.center)).addTo(map);
    markers.set(trip.slug, { marker, el });
  });

  function syncNear() {
    mapEl.classList.toggle("pins-near", map.getZoom() < NEAR_ZOOM);
    mapEl.dataset.zoom = map.getZoom().toFixed(3);
    const c = map.getCenter();
    mapEl.dataset.lng = c.lng.toFixed(4);
    mapEl.dataset.lat = c.lat.toFixed(4);
    if (!disposed) spreadPins(map, trips, markers, lastPadding);
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
        ? { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: arc(loc(home.center), loc(trip.center)) } }
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
        center: loc(trip.center),
        zoom: DEST_ZOOM,
        padding,
        duration: instant || reducedMotion() ? 0 : FLY_MS,
        essential: true,
      });
    },
    frameAll(padding, { animate = true } = {}) {
      if (disposed) return;
      lastPadding = padding || lastPadding;
      const bounds = new maplibregl.LngLatBounds();
      for (const trip of trips) bounds.extend(loc(trip.center));
      bounds.extend(loc(home.center));
      /* A little latitude so the band of pins isn't tight to the poles of the view.
         Avoid extra longitude: on a phone the pins already span nearly the full width. */
      bounds.extend([bounds.getWest(), bounds.getSouth() - 4]);
      bounds.extend([bounds.getEast(), bounds.getNorth() + 4]);
      const camera = map.cameraForBounds(bounds, { padding, bearing: 0, pitch: 0 });
      if (!camera) return;
      const next = {
        center: camera.center,
        zoom: camera.zoom,
        bearing: 0,
        pitch: 0,
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
      for (const { marker } of markers.values()) marker.remove();
      map.remove();
    },
    get selected() {
      return selected;
    },
  };
}
