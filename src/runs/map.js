import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { densityHeat, densityWeight } from "./density.js";
import { GLOBE_VIEW_ZOOM, globeHandoff } from "./globe.js";
import { closerZoom } from "./pick.js";

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
   MapLibre's peak is ~0.4×weight×intensity. The globe ramp is the same family,
   wider, so one city glows instead of reading as a flat disc. */
const GLOBE_HEAT_COLOR = [
  "interpolate",
  ["linear"],
  ["heatmap-density"],
  0,
  "rgba(255, 214, 150, 0)",
  0.05,
  "rgba(255, 206, 130, 0.28)",
  0.16,
  "rgba(255, 170, 64, 0.5)",
  0.34,
  "rgba(240, 112, 40, 0.7)",
  0.52,
  "rgba(214, 72, 56, 0.82)",
  0.7,
  "rgba(150, 42, 112, 0.9)",
  0.86,
  "rgba(88, 32, 128, 0.94)",
  1,
  "rgba(45, 29, 122, 0.97)",
];

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
      "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 8, 14, 10, 22, 11.4, 36, 12.3, 58, 13.2, 72, 14.2, 64, 15.2, 44],
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

/** Pitched OpenFreeMap map. One city of lines is loaded at a time. */
export async function mountRunsMap(mapEl, { center, zoom, onPick, onGlobePick, onGlobeMode }) {
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
  let restingBearing = null;
  let restingPitch = null;
  let removeMotionListener = null;
  let layersReady = false;
  let runCount = 0;
  let cityId = "";
  let globeOn = false;
  let handoff = false;

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
    mapEl.dataset.globe = globeOn ? "on" : "off";
    if (layersReady) mapEl.dataset.map = "ready";
  }

  map.on("move", syncProbe);
  map.on("moveend", syncProbe);
  syncProbe();

  function gestures(enabled) {
    const controls = [map.scrollZoom, map.touchZoomRotate, map.doubleClickZoom, map.boxZoom, map.keyboard];
    for (const control of controls) {
      if (!control) continue;
      if (enabled) control.enable();
      else control.disable();
    }
  }

  /* User zoom only. Programmatic flights omit originalEvent, so a fly to the
     globe does not immediately fly back out. The handoff waits until the
     current zoom frame finishes, or it would resume that same gesture. */
  function onUserZoom(event) {
    if (disposed || handoff || !event.originalEvent) return;
    const action = globeHandoff(globeOn, map.getZoom());
    if (action === "none") return;
    handoff = true;
    gestures(false);
    const enter = action === "enter";
    queueMicrotask(() => {
      if (disposed) return;
      map.stop();
      onGlobeMode?.(enter);
      const release = () => {
        gestures(true);
        handoff = false;
      };
      if (map.isMoving()) map.once("moveend", release);
      else queueMicrotask(release);
    });
  }
  map.on("zoom", onUserZoom);

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

  const CITY_LAYERS = ["runs-heat", "runs-vein-glow", "runs-vein", "runs-highlight-casing", "runs-highlight", "runs-hit"];

  function layerVisibility(ids, visible) {
    for (const id of ids) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
    }
  }

  function labelFont() {
    for (const layer of map.getStyle()?.layers || []) {
      const font = layer.layout?.["text-font"];
      if (Array.isArray(font) && font.length) return font;
    }
    return ["Noto Sans Regular"];
  }

  const GLOBE_LAYERS = ["runs-globe-heat", "runs-globe", "runs-globe-label"];

  function ensureGlobeLayers() {
    if (map.getSource("runs-globe")) return;
    map.addSource("runs-globe", { type: "geojson", data: emptyCollection() });
    /* One weighted point per region. The kernel is the same thermal ramp as the
       city map, wide enough that a cluster like California blends instead of
       stacking as separate discs. */
    map.addLayer({
      id: "runs-globe-heat",
      type: "heatmap",
      source: "runs-globe",
      layout: { visibility: "none" },
      paint: {
        "heatmap-weight": ["coalesce", ["get", "w"], 0],
        "heatmap-intensity": 1.85,
        "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0.8, 28, 1.55, 48, 3.2, 72],
        "heatmap-opacity": 0.95,
        "heatmap-color": GLOBE_HEAT_COLOR,
      },
    });
    map.addLayer({
      id: "runs-globe",
      type: "circle",
      source: "runs-globe",
      layout: { visibility: "none" },
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 0.8, 22, 1.55, 34, 3.2, 52],
        "circle-color": "#2d1d7a",
        "circle-opacity": 0.01,
        "circle-stroke-width": 0,
      },
    });
    try {
      map.addLayer({
        id: "runs-globe-label",
        type: "symbol",
        source: "runs-globe",
        layout: {
          visibility: "none",
          "text-field": ["get", "label"],
          "text-font": labelFont(),
          "text-size": 12,
          "text-offset": [0, 1.15],
          "text-anchor": "top",
        },
        paint: {
          "text-color": "#1a1033",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.4,
        },
      });
    } catch (error) {
      console.warn("Globe labels skipped", error);
    }
  }

  function globeCollection(cities) {
    return {
      type: "FeatureCollection",
      features: [...(cities || [])]
        .sort((a, b) => (b.count || 1) - (a.count || 1))
        .map((city) => ({
        type: "Feature",
        properties: {
          id: city.id,
          label: city.label,
          count: city.count || 1,
          w: densityWeight(city.count || 1),
        },
        geometry: { type: "Point", coordinates: city.center },
      })),
    };
  }

  function setSpace(on) {
    try {
      map.setFog(
        on
          ? {
              color: "rgb(196, 206, 214)",
              "high-color": "rgb(90, 120, 200)",
              "horizon-blend": 0.08,
              "space-color": "#1a1033",
              "star-intensity": 0.35,
            }
          : null,
      );
    } catch (error) {
      console.warn("Globe atmosphere skipped", error);
    }
  }

  function ensureInteractions() {
    map.on("click", (event) => {
      if (globeOn && map.getLayer("runs-globe")) {
        const regions = map.queryRenderedFeatures(event.point, { layers: ["runs-globe"] });
        let id = "";
        let best = Infinity;
        for (const feature of regions) {
          const coordinates = feature.geometry?.coordinates;
          if (!coordinates) continue;
          const projected = map.project(coordinates);
          const distance = Math.hypot(projected.x - event.point.x, projected.y - event.point.y);
          if (distance < best) {
            best = distance;
            id = String(feature.properties.id);
          }
        }
        /* Ocean and empty globe stay put. A region flies in; the run itself
           is a later click on that city's route geometry. */
        if (id) onGlobePick?.(id);
        return;
      }
      onPick(hitsAt(map, event.point), [event.lngLat.lng, event.lngLat.lat]);
    });
    map.on("mousemove", (event) => {
      const layers = globeOn && map.getLayer("runs-globe") ? ["runs-globe"] : map.getLayer("runs-hit") ? ["runs-hit"] : [];
      const hit = layers.length ? map.queryRenderedFeatures(event.point, { layers }).length > 0 : false;
      map.getCanvas().style.cursor = hit ? "pointer" : "";
    });
  }

  const api = {
    resize() {
      map.resize();
    },
    startIdleSway,
    stopIdleSway,
    setCity(id, lines) {
      if (disposed) return;
      cityId = id;
      runCount = lines?.features?.length || 0;
      if (!layersReady) {
        addRunLayers(map);
        ensureInteractions();
        layersReady = true;
      }
      map.getSource("runs-lines").setData(lines);
      map.getSource("runs-heat").setData(densityHeat(lines));
      if (globeOn) layerVisibility(CITY_LAYERS, false);
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
    isGlobe() {
      return globeOn;
    },
    regionAt(lngLat) {
      if (!map.getLayer("runs-globe")) return "";
      const point = map.project(lngLat);
      const regions = map.queryRenderedFeatures(point, { layers: ["runs-globe"] });
      let id = "";
      let best = Infinity;
      for (const feature of regions) {
        const coordinates = feature.geometry?.coordinates;
        if (!coordinates) continue;
        const projected = map.project(coordinates);
        const distance = Math.hypot(projected.x - point.x, projected.y - point.y);
        if (distance < best) {
          best = distance;
          id = String(feature.properties.id);
        }
      }
      return id;
    },
    setGlobe(on, { reduced, cities, city } = {}) {
      if (disposed) return;
      globeOn = Boolean(on);
      ensureGlobeLayers();
      if (globeOn) {
        stopIdleSway();
        try {
          map.setProjection({ type: "globe" });
        } catch (error) {
          console.warn("Globe projection unavailable", error);
        }
        map.getSource("runs-globe").setData(globeCollection(cities));
        layerVisibility(CITY_LAYERS, false);
        layerVisibility(GLOBE_LAYERS, true);
        setSpace(true);
        map.flyTo({
          center: [-100, 36],
          zoom: GLOBE_VIEW_ZOOM,
          pitch: 0,
          bearing: 0,
          duration: reduced ? 0 : 1100,
          essential: true,
        });
      } else {
        try {
          map.setProjection({ type: "mercator" });
        } catch (error) {
          console.warn("Mercator projection unavailable", error);
        }
        layerVisibility(GLOBE_LAYERS, false);
        layerVisibility(CITY_LAYERS, true);
        setSpace(false);
        if (city) {
          map.flyTo({
            center: city.center,
            zoom: city.zoom,
            pitch: framedPitch(),
            bearing: framedBearing(),
            duration: reduced ? 0 : 1100,
            essential: true,
          });
        }
      }
      syncProbe();
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
