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
export async function mountRunsMap(mapEl, { center, zoom, onPick, onGlobePick }) {
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

  function ensureGlobeLayers() {
    if (map.getSource("runs-globe")) return;
    map.addSource("runs-globe", { type: "geojson", data: emptyCollection() });
    map.addLayer({
      id: "runs-globe",
      type: "circle",
      source: "runs-globe",
      layout: { visibility: "none" },
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["sqrt", ["max", ["get", "count"], 1]], 1, 16, 20, 34],
        "circle-color": "#2d1d7a",
        "circle-opacity": 0.92,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffb020",
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
        properties: { id: city.id, label: city.label, count: city.count || 1 },
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
        if (id) {
          onGlobePick?.(id);
          return;
        }
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
    setGlobe(on, { reduced, cities } = {}) {
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
        layerVisibility(["runs-globe", "runs-globe-label"], true);
        setSpace(true);
        map.flyTo({
          center: [-100, 36],
          zoom: 1.55,
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
        layerVisibility(["runs-globe", "runs-globe-label"], false);
        layerVisibility(CITY_LAYERS, true);
        setSpace(false);
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
