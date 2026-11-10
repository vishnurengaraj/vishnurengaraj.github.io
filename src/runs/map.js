import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { densityHeat } from "./density.js";
import { boundsFromGeometry, routeCamera } from "./frame.js";
import { REGION_ZOOM, WORLD_CENTER, WORLD_ZOOM, nearestCity, pitchForZoom } from "./globe.js";
import { closerZoom } from "./pick.js";

const ROUTE_EASE_MS = 850;

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

/* Cream → amber → coral → purple. Alpha stays low until the kernel has
   actually piled up, so a trail feathers out instead of drawing a hard disc.
   Radius stays wide relative to the 50m cells so neighboring kernels blend.
   The same heat is on the map from a city all the way out to the world. */
const HEAT_COLOR = [
  "interpolate",
  ["linear"],
  ["heatmap-density"],
  0,
  "rgba(255, 214, 150, 0)",
  0.08,
  "rgba(255, 220, 160, 0.04)",
  0.18,
  "rgba(255, 198, 110, 0.16)",
  0.32,
  "rgba(255, 168, 64, 0.36)",
  0.48,
  "rgba(236, 112, 46, 0.56)",
  0.64,
  "rgba(196, 58, 72, 0.72)",
  0.8,
  "rgba(130, 36, 112, 0.84)",
  1,
  "rgba(45, 29, 122, 0.92)",
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
      "heatmap-weight": ["coalesce", ["get", "w"], 0],
      "heatmap-intensity": [
        "interpolate",
        ["linear"],
        ["zoom"],
        1.2,
        0.45,
        5,
        0.6,
        8,
        0.9,
        10,
        0.62,
        11.4,
        0.42,
        12.3,
        0.32,
        13.4,
        0.34,
        14.4,
        0.48,
      ],
      "heatmap-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        1.2,
        8,
        4,
        16,
        6,
        20,
        8,
        16,
        10,
        22,
        11.4,
        36,
        12.3,
        58,
        13.2,
        72,
        14.2,
        64,
        15.2,
        44,
      ],
      "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 1.2, 0.88, 10, 0.9, 12.2, 0.78, 13.3, 0.32, 14.4, 0],
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
  /* Invisible corridor around each route. Queryable from the city overview,
     before the ink veins fade in, so a click can land on one activity. */
  map.addLayer({
    id: "runs-hit",
    type: "line",
    source: "runs-lines",
    minzoom: 8,
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

/** One pitched map of every region. Zooming out reveals the world on the same layers. */
export async function mountRunsMap(mapEl, { center, zoom, onPick, onView }) {
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
    minZoom: 0.5,
    maxZoom: 17.5,
    fadeDuration: 0,
    hash: false,
    clickTolerance: 12,
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), "bottom-right");
  map.addControl(new maplibregl.AttributionControl({ compact: false }), "bottom-left");

  let disposed = false;
  let swayState = "idle";
  const geometryById = new Map();
  let restingBearing = null;
  let restingPitch = null;
  let removeMotionListener = null;
  let layersReady = false;
  let runCount = 0;
  let cityId = "";
  let regions = [];
  let highlighted = "";
  mapEl.dataset.highlight = "";

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
    map.setProjection({ type: "globe" });
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
    const pad = map.getPadding() || {};
    mapEl.dataset.lng = current.lng.toFixed(5);
    mapEl.dataset.lat = current.lat.toFixed(5);
    mapEl.dataset.zoom = map.getZoom().toFixed(3);
    mapEl.dataset.pitch = map.getPitch().toFixed(2);
    mapEl.dataset.bearing = map.getBearing().toFixed(2);
    mapEl.dataset.pad = [pad.top || 0, pad.right || 0, pad.bottom || 0, pad.left || 0]
      .map((n) => Math.round(n))
      .join(",");
    mapEl.dataset.city = cityId;
    mapEl.dataset.runs = String(runCount);
    if (layersReady) mapEl.dataset.map = "ready";
  }

  function followRegion() {
    if (map.getZoom() < REGION_ZOOM || !regions.length) return;
    const current = map.getCenter();
    const city = nearestCity(regions, [current.lng, current.lat]);
    if (city) cityId = city.id;
  }

  /* Pitch eases down only after the gesture ends. setPitch/jumpTo during a
     pinch calls stop(), which resets the touch handler and the zoom snaps back. */
  let pitching = false;
  let suppressPitch = false;
  /* A finger drag or pinch after the run was chosen owns the camera. */
  let gestureSinceArm = false;
  map.on("movestart", (event) => {
    if (event.originalEvent) gestureSinceArm = true;
  });
  function easePitchDown() {
    if (suppressPitch || pitching || map.isMoving()) return;
    const cap = pitchForZoom(map.getZoom(), camera().pitch);
    if (map.getPitch() <= cap + 0.5) return;
    pitching = true;
    map.easeTo({
      pitch: cap,
      duration: prefersReducedMotion() ? 0 : 280,
      essential: true,
    });
    if (map.isMoving()) {
      map.once("moveend", () => {
        pitching = false;
      });
    } else {
      pitching = false;
    }
  }

  map.on("move", syncProbe);
  map.on("moveend", () => {
    followRegion();
    syncProbe();
    const current = map.getCenter();
    onView?.([current.lng, current.lat], map.getZoom());
    easePitchDown();
  });
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

  function labelFont() {
    for (const layer of map.getStyle()?.layers || []) {
      const font = layer.layout?.["text-font"];
      if (Array.isArray(font) && font.length) return font;
    }
    return ["Noto Sans Regular"];
  }

  function ensureRegionLabels(cities) {
    const data = {
      type: "FeatureCollection",
      features: (cities || []).map((city) => ({
        type: "Feature",
        properties: { id: city.id, label: city.label },
        geometry: { type: "Point", coordinates: city.center },
      })),
    };
    if (!map.getSource("runs-regions")) {
      map.addSource("runs-regions", { type: "geojson", data });
      try {
        map.addLayer({
          id: "runs-region-label",
          type: "symbol",
          source: "runs-regions",
          maxzoom: 5.5,
          layout: {
            "text-field": ["get", "label"],
            "text-font": labelFont(),
            "text-size": ["interpolate", ["linear"], ["zoom"], 1.2, 11, 4.5, 13],
            "text-offset": [0, 0.6],
            "text-anchor": "top",
            "text-padding": 2,
          },
          paint: {
            "text-color": "#1a1033",
            "text-halo-color": "#ffffff",
            "text-halo-width": 1.3,
            "text-opacity": ["interpolate", ["linear"], ["zoom"], 4.2, 1, 5.5, 0],
          },
        });
      } catch (error) {
        console.warn("Region labels skipped", error);
      }
      return;
    }
    map.getSource("runs-regions").setData(data);
  }

  function applyHighlight() {
    mapEl.dataset.highlight = highlighted;
    if (disposed || !map.getLayer("runs-highlight")) return;
    const filter = ["==", ["get", "id"], highlighted || ""];
    map.setFilter("runs-highlight", filter);
    map.setFilter("runs-highlight-casing", filter);
  }

  function ensureInteractions() {
    map.on("click", (event) => {
      onPick(hitsAt(map, event.point), [event.lngLat.lng, event.lngLat.lat]);
    });
    map.on("mousemove", (event) => {
      const hit = map.getLayer("runs-hit")
        ? map.queryRenderedFeatures(event.point, { layers: ["runs-hit"] }).length > 0
        : false;
      map.getCanvas().style.cursor = hit ? "pointer" : "";
    });
  }

  function indexLines(lines) {
    geometryById.clear();
    for (const feature of lines?.features || []) {
      const id = feature?.properties?.id;
      if (id == null || !feature.geometry) continue;
      geometryById.set(String(id), feature.geometry);
    }
  }

  function paddingClear() {
    const pad = map.getPadding() || {};
    return (pad.top || 0) < 0.5 && (pad.right || 0) < 0.5 && (pad.bottom || 0) < 0.5 && (pad.left || 0) < 0.5;
  }

  /* Drop drawer padding without moving the pixels. The geographic point under
     the canvas center stays there, so closing the sheet does not snap the map. */
  function releaseFrame() {
    if (disposed || paddingClear()) return;
    const canvas = map.getCanvas();
    const visual = map.unproject([canvas.clientWidth / 2, canvas.clientHeight / 2]);
    suppressPitch = true;
    try {
      map.jumpTo({
        center: [visual.lng, visual.lat],
        zoom: map.getZoom(),
        pitch: map.getPitch(),
        bearing: map.getBearing(),
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
      });
    } finally {
      suppressPitch = false;
    }
  }

  function frameRoute(id, padding, reduced) {
    if (disposed || gestureSinceArm) return;
    const bounds = boundsFromGeometry(geometryById.get(String(id)));
    const canvas = map.getCanvas();
    const pad = {
      top: padding?.top || 0,
      right: padding?.right || 0,
      bottom: padding?.bottom || 0,
      left: padding?.left || 0,
    };
    const framed = routeCamera(bounds, { width: canvas.clientWidth, height: canvas.clientHeight }, pad);
    if (!framed) return;
    stopIdleSway();
    map.easeTo({
      center: framed.center,
      zoom: framed.zoom,
      pitch: 0,
      bearing: 0,
      padding: pad,
      duration: reduced ? 0 : ROUTE_EASE_MS,
      essential: true,
    });
  }

  const api = {
    resize() {
      map.resize();
    },
    startIdleSway,
    stopIdleSway,
    setLines(lines, id) {
      if (disposed) return;
      if (id) cityId = id;
      runCount = lines?.features?.length || 0;
      if (!layersReady) {
        addRunLayers(map);
        ensureInteractions();
        layersReady = true;
      }
      indexLines(lines);
      map.getSource("runs-lines").setData(lines);
      map.getSource("runs-heat").setData(densityHeat(lines));
      applyHighlight();
      syncProbe();
    },
    setRegions(cities) {
      if (disposed) return;
      regions = cities || [];
      ensureRegionLabels(regions);
      followRegion();
      syncProbe();
    },
    highlight(id) {
      highlighted = id || "";
      applyHighlight();
    },
    flyCity(city, reduced) {
      if (disposed || !city) return;
      cityId = city.id;
      syncProbe();
      map.flyTo({
        center: city.center,
        zoom: city.zoom,
        pitch: camera().pitch,
        bearing: camera().bearing,
        duration: reduced ? 0 : 1200,
        essential: true,
      });
    },
    frameWorld(reduced) {
      if (disposed) return;
      releaseFrame();
      stopIdleSway();
      map.flyTo({
        center: WORLD_CENTER,
        zoom: WORLD_ZOOM,
        pitch: 0,
        bearing: 0,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        duration: reduced ? 0 : 1400,
        essential: true,
      });
    },
    armFrame() {
      gestureSinceArm = false;
    },
    frameRoute,
    releaseFrame,
    project(lngLat) {
      const point = map.project(lngLat);
      return { x: point.x, y: point.y };
    },
    unproject(pixel) {
      const lngLat = map.unproject(pixel);
      return [lngLat.lng, lngLat.lat];
    },
    getZoom() {
      return map.getZoom();
    },
    hitIds(lngLat) {
      if (!lngLat || !map.getLayer("runs-hit")) return [];
      const point = map.project(lngLat);
      return hitsAt(map, point).map((run) => run.id);
    },
    zoomToward(lngLat) {
      if (disposed || !lngLat) return;
      map.easeTo({
        center: lngLat,
        zoom: closerZoom(map.getZoom()),
        pitch: framedPitch(),
        bearing: framedBearing(),
        duration: prefersReducedMotion() ? 0 : 700,
        essential: true,
      });
    },
    /* Hairlines queryable at the probe after the heat has faded. */
    veinHits(lngLat) {
      if (!map.getLayer("runs-vein")) return 0;
      const point = map.project(lngLat);
      const box = [
        [point.x - 10, point.y - 10],
        [point.x + 10, point.y + 10],
      ];
      return map.queryRenderedFeatures(box, { layers: ["runs-vein"] }).length;
    },
    nearestAt(lngLat) {
      return nearestCity(regions, lngLat)?.id || "";
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
