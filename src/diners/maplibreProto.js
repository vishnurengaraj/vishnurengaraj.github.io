import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { DINERS } from "../data/diners.js";
import { gemMarkup } from "./protoPins.js";

const STYLE = "https://tiles.openfreemap.org/styles/positron";

function camera() {
  const phone = window.matchMedia("(max-width: 640px)").matches;
  return phone ? { pitch: 58, bearing: -16 } : { pitch: 64, bearing: -20 };
}

function trbl(padding) {
  return {
    top: padding.paddingTopLeft[1] + 36,
    left: padding.paddingTopLeft[0],
    bottom: padding.paddingBottomRight[1] + 12,
    right: padding.paddingBottomRight[0] + 8,
  };
}

function addBuildings(map) {
  if (!map.getSource("openmaptiles") || map.getLayer("diner-buildings")) return;
  if (map.getLayer("building")) map.setLayoutProperty("building", "visibility", "none");
  const layers = map.getStyle().layers || [];
  const index = layers.findIndex((layer) => layer.id === "building");
  const beforeId = index >= 0 ? layers[index + 1]?.id : undefined;
  map.addLayer(
    {
      id: "diner-buildings",
      type: "fill-extrusion",
      source: "openmaptiles",
      "source-layer": "building",
      minzoom: 14,
      paint: {
        "fill-extrusion-color": "#c5ccd1",
        "fill-extrusion-height": [
          "*",
          ["coalesce", ["get", "render_height"], ["get", "height"], 9],
          1.6,
        ],
        "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], ["get", "min_height"], 0],
        "fill-extrusion-opacity": 0.92,
      },
    },
    beforeId,
  );
}

/** Variant B: real pitched camera, free light vector tiles, billboarded sculpted pins. */
export async function mountMapLibreProto(mapEl, { handlers }) {
  const view = camera();
  const map = new maplibregl.Map({
    container: mapEl,
    style: STYLE,
    center: [-118.404, 33.891],
    zoom: 12,
    pitch: view.pitch,
    bearing: view.bearing,
    attributionControl: false,
    maxPitch: 70,
    minZoom: 10,
    maxZoom: 17,
    fadeDuration: 0,
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), "bottom-right");
  map.addControl(new maplibregl.AttributionControl({ compact: false }), "bottom-left");

  const markers = {};
  let disposed = false;

  const loaded = new Promise((resolve) => {
    const timer = window.setTimeout(resolve, 8000);
    map.once("load", () => {
      window.clearTimeout(timer);
      resolve();
    });
  });
  await loaded;
  if (disposed) {
    map.remove();
    return null;
  }

  try {
    addBuildings(map);
    map.setLight({
      anchor: "viewport",
      color: "#ffffff",
      intensity: 0.55,
      position: [1.15, 210, 28],
    });
  } catch (error) {
    console.warn("Prototype B buildings skipped", error);
  }

  for (const place of DINERS) {
    const el = document.createElement("div");
    el.innerHTML = gemMarkup(place, { labelled: true });
    const gem = el.firstElementChild;
    gem.addEventListener("click", (event) => {
      event.stopPropagation();
      handlers.onClick(place);
    });
    gem.addEventListener("mouseenter", () => handlers.onHover(place));
    gem.addEventListener("mouseleave", () => handlers.onLeave());
    const marker = new maplibregl.Marker({
      element: gem,
      anchor: "bottom",
      pitchAlignment: "viewport",
      rotationAlignment: "viewport",
    })
      .setLngLat([place.lng, place.lat])
      .addTo(map);
    markers[place.id] = marker;
  }

  function signalReady() {
    if (disposed) return;
    map.once("idle", () => {
      if (disposed) return;
      window.__dinersProtoReady = "b";
    });
    window.setTimeout(() => {
      if (!disposed && window.__dinersProtoReady !== "b") window.__dinersProtoReady = "b";
    }, 2500);
  }

  return {
    invalidateSize() {
      map.resize();
    },
    fit({ animate, padding, maxZoom }) {
      const cam = camera();
      const bounds = new maplibregl.LngLatBounds();
      for (const place of DINERS) bounds.extend([place.lng, place.lat]);
      map.fitBounds(bounds, {
        padding: trbl(padding),
        maxZoom,
        pitch: cam.pitch,
        bearing: cam.bearing,
        duration: animate ? 650 : 0,
      });
      signalReady();
    },
    focus(place, { padding, reduced }) {
      const cam = camera();
      const canvas = map.getCanvas();
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const pad = trbl(padding);
      const viewX = (pad.left + width - pad.right) / 2;
      const viewY = (pad.top + height - pad.bottom) / 2;
      map.flyTo({
        center: [place.lng, place.lat],
        zoom: Math.max(map.getZoom(), 14.2),
        pitch: cam.pitch,
        bearing: cam.bearing,
        offset: [viewX - width / 2, viewY - height / 2],
        duration: reduced ? 0 : 650,
        essential: true,
      });
    },
    phoneFocus(place, { reduced }) {
      const cam = camera();
      map.flyTo({
        center: [place.lng, place.lat],
        zoom: Math.max(map.getZoom(), 14.2),
        pitch: Math.min(cam.pitch, 52),
        bearing: cam.bearing,
        duration: reduced ? 0 : 650,
        essential: true,
      });
    },
    paint(selectedId, hoverId) {
      for (const [id, marker] of Object.entries(markers)) {
        const el = marker.getElement();
        if (!el) continue;
        el.style.zIndex = id === selectedId ? "8" : id === hoverId ? "4" : "";
      }
    },
    getZoom() {
      return map.getZoom();
    },
    destroy() {
      disposed = true;
      map.remove();
    },
  };
}
