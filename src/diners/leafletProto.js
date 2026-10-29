import { DINERS } from "../data/diners.js";
import { GEM_ANCHOR_X, GEM_ANCHOR_Y, GEM_H, GEM_W, gemMarkup } from "./protoPins.js";

const TILES = {
  base: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
  labels: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
};

function readIso(pageEl) {
  const cs = getComputedStyle(pageEl);
  const num = (name, fallback) => {
    const value = parseFloat(cs.getPropertyValue(name));
    return Number.isFinite(value) ? value : fallback;
  };
  return {
    zoomOut: num("--iso-zoom-out", 0.4),
  };
}

function padWithPinRoom(padding, variant) {
  const phone = window.matchMedia("(max-width: 640px)").matches;
  const right = variant === "a" && phone ? 110 : variant === "a" ? 36 : 12;
  const top = phone ? 12 : 20;
  return {
    paddingTopLeft: [padding.paddingTopLeft[0], padding.paddingTopLeft[1] + top],
    paddingBottomRight: [padding.paddingBottomRight[0] + right, padding.paddingBottomRight[1] + 8],
  };
}

/**
 * Variant A tilts the ArcGIS leaflet map and stands pins up in a sibling layer
 * (leaflet's own marker pane is flattened by overflow:hidden).
 * Variant C keeps the flat camera and uses the same sculpted pin artwork.
 */
export async function mountLeafletProto(mapEl, { variant, pageEl, handlers }) {
  const leaflet = await import("leaflet");
  const tilted = variant === "a";
  let clip = null;
  let pinsLayer = null;
  let viewport = null;
  const hosts = {};
  let disposed = false;

  if (tilted) {
    const mapwrap = mapEl.parentElement;
    clip = document.createElement("div");
    clip.className = "iso-clip";
    viewport = document.createElement("div");
    viewport.className = "iso-viewport";
    const tilt = document.createElement("div");
    tilt.className = "iso-tilt";
    pinsLayer = document.createElement("div");
    pinsLayer.className = "iso-pins";
    mapwrap.insertBefore(clip, mapEl);
    clip.appendChild(viewport);
    viewport.appendChild(tilt);
    tilt.appendChild(mapEl);
    tilt.appendChild(pinsLayer);
  }

  const map = leaflet
    .map(mapEl, {
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: !tilted,
      dragging: !tilted,
      touchZoom: !tilted,
      doubleClickZoom: !tilted,
      boxZoom: !tilted,
      zoomSnap: tilted ? 0 : 1,
      zoomDelta: tilted ? 0.5 : 1,
    })
    .setView([33.89, -118.4], 12);

  leaflet.tileLayer(TILES.base, { maxZoom: 16 }).addTo(map);
  leaflet
    .tileLayer(TILES.labels, { maxZoom: 16, pane: "shadowPane" })
    .addTo(map);
  leaflet.control.zoom({ position: "bottomright" }).addTo(map);

  if (tilted) {
    const controls = mapEl.querySelector(".leaflet-control-container");
    const mapwrap = clip.parentElement;
    if (controls && mapwrap) mapwrap.appendChild(controls);
  }

  const cleanups = [];

  if (tilted) {
    for (const place of DINERS) {
      const host = document.createElement("div");
      host.className = "iso-pin";
      host.innerHTML = gemMarkup(place, { labelled: true });
      const gem = host.querySelector(".gem");
      const onClick = (event) => {
        event.stopPropagation();
        handlers.onClick(place);
      };
      const onEnter = () => handlers.onHover(place);
      const onLeave = () => handlers.onLeave();
      gem.addEventListener("click", onClick);
      gem.addEventListener("mouseenter", onEnter);
      gem.addEventListener("mouseleave", onLeave);
      pinsLayer.appendChild(host);
      hosts[place.id] = host;
      cleanups.push(() => {
        gem.removeEventListener("click", onClick);
        gem.removeEventListener("mouseenter", onEnter);
        gem.removeEventListener("mouseleave", onLeave);
      });
    }
  } else {
    for (const place of DINERS) {
      const icon = leaflet.divIcon({
        className: "mk mk-gem",
        iconSize: [GEM_W, GEM_H],
        iconAnchor: [GEM_ANCHOR_X, GEM_ANCHOR_Y],
        html: gemMarkup(place),
      });
      const marker = leaflet.marker([place.lat, place.lng], { icon, riseOnHover: true }).addTo(map);
      marker.getElement()?.setAttribute("aria-label", `${place.name}, ${place.weighted.toFixed(1)}`);
      marker.on("mouseover", () => handlers.onHover(place));
      marker.on("mouseout", (event) => {
        const next = event.originalEvent?.relatedTarget;
        const el = marker.getElement();
        if (next instanceof Node && el && (next === el || el.contains(next))) return;
        handlers.onLeave();
      });
      marker.on("click", () => handlers.onClick(place));
      hosts[place.id] = marker;
    }
  }

  let calibrateDrag = () => {};

  function syncPins() {
    if (!tilted) return;
    for (const place of DINERS) {
      const host = hosts[place.id];
      if (!host) continue;
      const pt = map.latLngToContainerPoint([place.lat, place.lng]);
      host.style.left = `${pt.x}px`;
      host.style.top = `${pt.y}px`;
    }
  }

  if (tilted) {
    map.on("move zoom viewreset resize", syncPins);
    let dragging = false;
    let moved = false;
    let lastX = 0;
    let lastY = 0;
    // Maps a screen delta to the panBy that moves the map with the pointer.
    // Measured from the live CSS tilt, because perspective makes the closed-form guess drift.
    let panFromScreen = (dx, dy) => ({ x: -dx, y: -dy });

    calibrateDrag = () => {
      const size = map.getSize();
      const latlng = map.containerPointToLatLng(leaflet.point(size.x / 2, size.y / 2));
      const probe = document.createElement("div");
      probe.className = "iso-pin";
      probe.innerHTML = `<div class="gem" style="width:2px;height:2px"></div>`;
      pinsLayer.appendChild(probe);
      const spot = () => {
        const pt = map.latLngToContainerPoint(latlng);
        probe.style.left = `${pt.x}px`;
        probe.style.top = `${pt.y}px`;
        const rect = probe.getBoundingClientRect();
        return { x: rect.x, y: rect.y };
      };
      const origin = spot();
      map.panBy([48, 0], { animate: false });
      const afterX = spot();
      map.panBy([-48, 0], { animate: false });
      const mid = spot();
      map.panBy([0, 48], { animate: false });
      const afterY = spot();
      map.panBy([0, -48], { animate: false });
      probe.remove();
      const sx = (afterX.x - origin.x) / 48;
      const sy = (afterX.y - origin.y) / 48;
      const tx = (afterY.x - mid.x) / 48;
      const ty = (afterY.y - mid.y) / 48;
      const det = sx * ty - tx * sy;
      if (!Number.isFinite(det) || Math.abs(det) < 0.05) return;
      panFromScreen = (dx, dy) => ({
        x: (ty * dx - tx * dy) / det,
        y: (-sy * dx + sx * dy) / det,
      });
    }

    const onPointerDown = (event) => {
      if (event.button !== 0) return;
      if (event.target.closest(".gem, .leaflet-control, .proto-banner")) return;
      dragging = true;
      moved = false;
      lastX = event.clientX;
      lastY = event.clientY;
      viewport.classList.add("is-dragging");
      viewport.setPointerCapture?.(event.pointerId);
    };
    const onPointerMove = (event) => {
      if (!dragging) return;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      if (!moved && dx * dx + dy * dy < 9) return;
      moved = true;
      lastX = event.clientX;
      lastY = event.clientY;
      const pan = panFromScreen(dx, dy);
      map.panBy([pan.x, pan.y], { animate: false });
    };
    const onPointerUp = () => {
      dragging = false;
      viewport.classList.remove("is-dragging");
    };
    const onWheel = (event) => {
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const pan = panFromScreen(event.clientX - (rect.left + rect.width / 2), event.clientY - (rect.top + rect.height / 2));
      const size = map.getSize();
      const pt = leaflet.point(size.x / 2 - pan.x, size.y / 2 - pan.y);
      const latlng = map.containerPointToLatLng(pt);
      const px = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaMode === 2 ? event.deltaY * 400 : event.deltaY;
      const amount = Math.max(-1.2, Math.min(1.2, -px / 180));
      const next = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), map.getZoom() + amount));
      map.setZoomAround(latlng, next);
    };

    viewport.addEventListener("pointerdown", onPointerDown);
    viewport.addEventListener("pointermove", onPointerMove);
    viewport.addEventListener("pointerup", onPointerUp);
    viewport.addEventListener("pointercancel", onPointerUp);
    viewport.addEventListener("wheel", onWheel, { passive: false });
    cleanups.push(() => {
      viewport.removeEventListener("pointerdown", onPointerDown);
      viewport.removeEventListener("pointermove", onPointerMove);
      viewport.removeEventListener("pointerup", onPointerUp);
      viewport.removeEventListener("pointercancel", onPointerUp);
      viewport.removeEventListener("wheel", onWheel);
    });
  }

  function signalReady() {
    const started = Date.now();
    const tick = () => {
      if (disposed) return;
      const loading = mapEl.querySelector(".leaflet-tile-loading");
      const tiles = mapEl.querySelectorAll(".leaflet-tile-loaded").length;
      if ((!loading && tiles > 0) || Date.now() - started > 7000) {
        window.__dinersProtoReady = variant;
        return;
      }
      window.setTimeout(tick, 80);
    };
    window.setTimeout(tick, 40);
  }

  map.invalidateSize();

  return {
    invalidateSize() {
      map.invalidateSize();
      syncPins();
    },
    fit({ animate, padding, maxZoom }) {
      const pad = padWithPinRoom(padding, variant);
      const bounds = leaflet.latLngBounds(DINERS.map((place) => [place.lat, place.lng]));
      if (tilted) {
        const zoomOut = readIso(pageEl).zoomOut;
        map.once("moveend", () => {
          if (disposed) return;
          map.setZoom(map.getZoom() - zoomOut, { animate: false });
          syncPins();
          calibrateDrag();
          signalReady();
        });
      }
      map.fitBounds(bounds, {
        paddingTopLeft: pad.paddingTopLeft,
        paddingBottomRight: pad.paddingBottomRight,
        maxZoom,
        animate: tilted ? false : Boolean(animate),
      });
      syncPins();
      if (!tilted) signalReady();
    },
    focus(place, { padding, reduced }) {
      const zoom = Math.max(map.getZoom(), 14);
      const size = map.getSize();
      const viewX = (padding.paddingTopLeft[0] + size.x - padding.paddingBottomRight[0]) / 2;
      const viewY = (padding.paddingTopLeft[1] + size.y - padding.paddingBottomRight[1]) / 2;
      const shift = leaflet.point(size.x / 2 - viewX, size.y / 2 - viewY);
      const center = map.unproject(map.project([place.lat, place.lng], zoom).add(shift), zoom);
      map.flyTo(center, zoom, { duration: reduced ? 0 : 0.6 });
    },
    phoneFocus(place, { reduced }) {
      const zoom = Math.max(map.getZoom(), 14);
      map.flyTo([place.lat, place.lng], zoom, { duration: reduced ? 0 : 0.6 });
    },
    paint(selectedId, hoverId) {
      for (const [id, host] of Object.entries(hosts)) {
        const rank = id === selectedId ? 8 : id === hoverId ? 4 : 1;
        if (tilted) host.style.zIndex = String(rank);
        else host.setZIndexOffset(rank * 100);
      }
    },
    getZoom() {
      return map.getZoom();
    },
    destroy() {
      disposed = true;
      for (const cleanup of cleanups) cleanup();
      map.remove();
      if (clip) {
        const mapwrap = clip.parentElement;
        if (mapwrap && mapEl) mapwrap.insertBefore(mapEl, clip);
        clip.remove();
      }
    },
  };
}
