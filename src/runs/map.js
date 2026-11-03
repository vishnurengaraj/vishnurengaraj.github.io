import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const STYLE = "https://tiles.openfreemap.org/styles/positron";

/* Idle motion matches /diners: yaw ±13° and pitch ±1.5° on one 84s sine.
   The first 700ms ramps in from rest. Zoom stays put. */
const SWAY_AMPLITUDE_DEG = 13;
const SWAY_PERIOD_MS = 84000;
const PITCH_FLOAT_DEG = 1.5;
const SWAY_RAMP_MS = 700;
const SWAY_SESSION_MS = SWAY_PERIOD_MS * 686;

function camera() {
  const phone = window.matchMedia("(max-width: 640px)").matches;
  return phone ? { pitch: 58, bearing: -16 } : { pitch: 64, bearing: -20 };
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function swayScale(elapsedMs) {
  const ramp = Math.min(1, elapsedMs / SWAY_RAMP_MS);
  const envelope = ramp * ramp * (3 - 2 * ramp);
  const phase = (elapsedMs / SWAY_PERIOD_MS) * Math.PI * 2;
  return envelope * Math.sin(phase);
}

function addBuildings(map) {
  if (!map.getSource("openmaptiles") || map.getLayer("runs-buildings")) return;
  if (map.getLayer("building")) map.setLayoutProperty("building", "visibility", "none");
  const layers = map.getStyle().layers || [];
  const index = layers.findIndex((layer) => layer.id === "building");
  const beforeId = index >= 0 ? layers[index + 1]?.id : undefined;
  map.addLayer(
    {
      id: "runs-buildings",
      type: "fill-extrusion",
      source: "openmaptiles",
      "source-layer": "building",
      minzoom: 14,
      paint: {
        "fill-extrusion-color": "#c5ccd1",
        "fill-extrusion-height": ["*", ["coalesce", ["get", "render_height"], ["get", "height"], 9], 1.3],
        "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], ["get", "min_height"], 0],
        "fill-extrusion-opacity": 0.9,
      },
    },
    beforeId,
  );
}

const HEAT_COLOR = [
  "interpolate",
  ["linear"],
  ["heatmap-density"],
  0,
  "rgba(246, 239, 226, 0)",
  0.12,
  "rgba(246, 236, 214, 0.5)",
  0.32,
  "rgba(240, 190, 96, 0.75)",
  0.52,
  "rgba(232, 120, 86, 0.84)",
  0.74,
  "rgba(142, 62, 112, 0.9)",
  1,
  "rgba(45, 29, 122, 0.95)",
];

function addRunLayers(map) {
  map.addSource("runs-heat", { type: "geojson", data: emptyCollection() });
  map.addSource("runs-lines", { type: "geojson", data: emptyCollection() });
  map.addLayer({
    id: "runs-heat",
    type: "heatmap",
    source: "runs-heat",
    maxzoom: 15,
    paint: {
      "heatmap-weight": ["coalesce", ["get", "w"], 1],
      "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 10, 0.55, 12.5, 1.05, 14, 1.2],
      "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 10, 12, 12.4, 24, 14, 18],
      "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 10, 0.9, 12.2, 0.78, 13.3, 0.32, 14.4, 0],
      "heatmap-color": HEAT_COLOR,
    },
  });
  map.addLayer({
    id: "runs-vein-glow",
    type: "line",
    source: "runs-lines",
    minzoom: 11.5,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": "#ffb020",
      "line-width": ["interpolate", ["linear"], ["zoom"], 12, 2.4, 15.5, 7],
      "line-opacity": ["interpolate", ["linear"], ["zoom"], 11.7, 0, 13, 0.16, 15.5, 0.32],
      "line-blur": 0.7,
    },
  });
  map.addLayer({
    id: "runs-vein",
    type: "line",
    source: "runs-lines",
    minzoom: 11.5,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": "#2d1d7a",
      "line-width": ["interpolate", ["linear"], ["zoom"], 12, 0.7, 15.5, 1.8],
      "line-opacity": ["interpolate", ["linear"], ["zoom"], 11.7, 0, 12.8, 0.2, 14.4, 0.45, 16, 0.62],
    },
  });
  const highlightFilter = ["==", ["get", "id"], ""];
  map.addLayer({
    id: "runs-highlight-casing",
    type: "line",
    source: "runs-lines",
    filter: highlightFilter,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#2d1d7a", "line-width": 7, "line-opacity": 0.95 },
  });
  map.addLayer({
    id: "runs-highlight",
    type: "line",
    source: "runs-lines",
    filter: highlightFilter,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#ffb020", "line-width": 3.2, "line-opacity": 1 },
  });
  map.addLayer({
    id: "runs-hit",
    type: "line",
    source: "runs-lines",
    minzoom: 13.6,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#2d1d7a", "line-width": 18, "line-opacity": 0.01 },
  });
}

function emptyCollection() {
  return { type: "FeatureCollection", features: [] };
}

function hitsAt(map, point) {
  if (!map.getLayer("runs-hit")) return [];
  const features = map.queryRenderedFeatures(point, { layers: ["runs-hit"] });
  const seen = new Set();
  const runs = [];
  for (const feature of features) {
    const id = feature.properties?.id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    runs.push({ id: String(id) });
  }
  return runs;
}

/** Pitched OpenFreeMap map. One city of lines is loaded at a time. */
export async function mountRunsMap(mapEl, { center, zoom, onPick }) {
  const view = camera();
  const map = new maplibregl.Map({
    container: mapEl,
    style: STYLE,
    center,
    zoom,
    pitch: view.pitch,
    bearing: view.bearing,
    attributionControl: false,
    maxPitch: 70,
    minZoom: 10,
    maxZoom: 17.5,
    fadeDuration: 0,
    hash: false,
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), "bottom-right");
  map.addControl(new maplibregl.AttributionControl({ compact: false }), "bottom-left");

  let disposed = false;
  let swayState = "idle";
  let restingBearing = null;
  let restingPitch = null;
  let removeMotionListener = null;
  let layersReady = false;
  let runCount = 0;
  let cityId = "";

  const loaded = new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("Map style timed out")), 20000);
    map.once("load", () => {
      window.clearTimeout(timer);
      resolve();
    });
  });
  try {
    await loaded;
  } catch (error) {
    if (!disposed) {
      mapEl.dataset.map = "error";
      map.remove();
    }
    throw error;
  }
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
    console.warn("Run building layer skipped", error);
  }

  function framedBearing() {
    if (swayState === "stopped") return map.getBearing();
    return camera().bearing;
  }

  function framedPitch() {
    if (swayState === "stopped") return map.getPitch();
    return camera().pitch;
  }

  function syncProbe() {
    const current = map.getCenter();
    mapEl.dataset.lng = current.lng.toFixed(5);
    mapEl.dataset.lat = current.lat.toFixed(5);
    mapEl.dataset.zoom = map.getZoom().toFixed(3);
    mapEl.dataset.city = cityId;
    mapEl.dataset.runs = String(runCount);
    if (layersReady) mapEl.dataset.map = "ready";
  }

  map.on("move", syncProbe);
  map.on("moveend", syncProbe);
  syncProbe();

  function stopIdleSway() {
    if (swayState === "stopped") return;
    swayState = "stopped";
    removeMotionListener?.();
    removeMotionListener = null;
    if (!disposed) map.stop();
  }

  function runSway() {
    if (disposed || swayState === "stopped") return;
    if (restingBearing == null) restingBearing = map.getBearing();
    if (restingPitch == null) restingPitch = map.getPitch();
    swayState = "running";
    map.easeTo({
      bearing: restingBearing + SWAY_AMPLITUDE_DEG,
      pitch: restingPitch + PITCH_FLOAT_DEG,
      duration: SWAY_SESSION_MS,
      easing(t) {
        return swayScale(t * SWAY_SESSION_MS);
      },
    });
    map.once("moveend", () => {
      if (disposed || swayState !== "running") return;
      swayState = "arming";
      window.requestAnimationFrame(() => window.requestAnimationFrame(armSway));
    });
  }

  function armSway() {
    if (disposed || swayState === "stopped") return;
    if (prefersReducedMotion()) {
      stopIdleSway();
      return;
    }
    swayState = "arming";
    if (map.isMoving()) {
      map.once("moveend", armSway);
      return;
    }
    runSway();
  }

  function startIdleSway() {
    if (disposed || swayState !== "idle") return;
    if (prefersReducedMotion()) {
      swayState = "stopped";
      return;
    }
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => {
      if (motion.matches) stopIdleSway();
    };
    motion.addEventListener("change", onMotion);
    removeMotionListener = () => motion.removeEventListener("change", onMotion);
    window.requestAnimationFrame(() => window.requestAnimationFrame(armSway));
  }

  function ensureInteractions() {
    map.on("click", (event) => {
      onPick(hitsAt(map, event.point), [event.lngLat.lng, event.lngLat.lat]);
    });
    map.on("mousemove", (event) => {
      const hit = hitsAt(map, event.point).length > 0;
      map.getCanvas().style.cursor = hit ? "pointer" : "";
    });
  }

  const api = {
    resize() {
      map.resize();
    },
    startIdleSway,
    stopIdleSway,
    setCity(id, lines, heat) {
      if (disposed) return;
      cityId = id;
      runCount = lines?.features?.length || 0;
      if (!layersReady) {
        addRunLayers(map);
        ensureInteractions();
        layersReady = true;
      }
      map.getSource("runs-lines").setData(lines);
      map.getSource("runs-heat").setData(heat);
      syncProbe();
    },
    highlight(id) {
      if (disposed || !map.getLayer("runs-highlight")) return;
      const filter = ["==", ["get", "id"], id || ""];
      map.setFilter("runs-highlight", filter);
      map.setFilter("runs-highlight-casing", filter);
    },
    flyCity(city, reduced) {
      if (disposed || !city) return;
      map.flyTo({
        center: city.center,
        zoom: city.zoom,
        pitch: framedPitch(),
        bearing: framedBearing(),
        duration: reduced ? 0 : 1200,
        essential: true,
      });
    },
    focus(lngLat, { reduced, phone }) {
      if (disposed || !lngLat) return;
      map.easeTo({
        center: lngLat,
        zoom: Math.max(map.getZoom(), 14.8),
        pitch: framedPitch(),
        bearing: framedBearing(),
        padding: phone ? { top: 24, bottom: 320, left: 16, right: 16 } : { top: 48, bottom: 24, left: 24, right: 440 },
        duration: reduced ? 0 : 650,
        essential: true,
      });
    },
    project(lngLat) {
      const point = map.project(lngLat);
      return { x: point.x, y: point.y };
    },
    destroy() {
      disposed = true;
      swayState = "stopped";
      removeMotionListener?.();
      removeMotionListener = null;
      map.remove();
    },
  };
  mapEl._runsMap = api;
  return api;
}
