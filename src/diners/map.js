import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { DINERS } from "../data/diners.js";
import { dropMarkup } from "./pins.js";

const STYLE = "https://tiles.openfreemap.org/styles/positron";

/* Idle motion on the pitched map. Yaw is ±13° around the resting bearing.
   Pitch floats ±1.5° around the pitched base (phone 58°, desktop 64°).
   Both share one sine: 42s for a full cycle, about 21s each way — five
   times the previous 8.4s sway. The first 700ms ramps in from rest.
   Zoom stays put. */
const SWAY_AMPLITUDE_DEG = 13;
const SWAY_PERIOD_MS = 42000;
const PITCH_FLOAT_DEG = 1.5;
const SWAY_RAMP_MS = 700;
/* Whole cycles only, so the handoff to the next ease lands on rest. */
const SWAY_SESSION_MS = SWAY_PERIOD_MS * 686;

function camera() {
  const phone = window.matchMedia("(max-width: 640px)").matches;
  return phone ? { pitch: 58, bearing: -16 } : { pitch: 64, bearing: -20 };
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** -1..1 sine shared by yaw and pitch. 0 at rest, eased in, slow at each end. */
function swayScale(elapsedMs) {
  const ramp = Math.min(1, elapsedMs / SWAY_RAMP_MS);
  const envelope = ramp * ramp * (3 - 2 * ramp);
  const phase = (elapsedMs / SWAY_PERIOD_MS) * Math.PI * 2;
  return envelope * Math.sin(phase);
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

/** Pitched OpenFreeMap map with flat teardrop pins. */
export async function mountDinerMap(mapEl, { handlers }) {
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
  let swayState = "idle";
  let restingBearing = null;
  let restingPitch = null;
  let removeMotionListener = null;

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
    console.warn("Diner building layer skipped", error);
  }

  for (const place of DINERS) {
    const wrap = document.createElement("div");
    wrap.innerHTML = dropMarkup(place);
    const node = wrap.firstElementChild;
    node.addEventListener("click", (event) => {
      event.stopPropagation();
      handlers.onClick(place);
    });
    node.addEventListener("mouseenter", () => handlers.onHover(place));
    node.addEventListener("mouseleave", () => handlers.onLeave());
    markers[place.id] = new maplibregl.Marker({
      element: node,
      anchor: "bottom",
      pitchAlignment: "viewport",
      rotationAlignment: "viewport",
    })
      .setLngLat([place.lng, place.lat])
      .addTo(map);
  }

  function framedBearing() {
    /* After the sway is dismissed, keep the yaw we froze on. fitBounds
       treats a missing bearing as 0, which would spin back to north. */
    if (swayState === "stopped") return map.getBearing();
    return camera().bearing;
  }

  function framedPitch() {
    /* After idle motion is dismissed, keep the pitch we froze on. A later
       fit or focus must not ease off that float or flatten the map. */
    if (swayState === "stopped") return map.getPitch();
    return camera().pitch;
  }

  function stopIdleSway() {
    if (swayState === "stopped") return;
    swayState = "stopped";
    removeMotionListener?.();
    removeMotionListener = null;
    /* Freeze the in-flight ease where it is. Do not pass a new bearing or
       pitch — stopping must not flatten the map or jump the yaw or float. */
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

  return {
    invalidateSize() {
      map.resize();
    },
    startIdleSway,
    stopIdleSway,
    fit({ animate, padding, maxZoom }) {
      const bounds = new maplibregl.LngLatBounds();
      for (const place of DINERS) bounds.extend([place.lng, place.lat]);
      map.fitBounds(bounds, {
        padding: trbl(padding),
        maxZoom,
        pitch: framedPitch(),
        bearing: framedBearing(),
        duration: animate ? 650 : 0,
      });
    },
    focus(place, { padding, reduced }) {
      const canvas = map.getCanvas();
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const pad = trbl(padding);
      const viewX = (pad.left + width - pad.right) / 2;
      const viewY = (pad.top + height - pad.bottom) / 2;
      map.flyTo({
        center: [place.lng, place.lat],
        zoom: Math.max(map.getZoom(), 14.2),
        pitch: framedPitch(),
        bearing: framedBearing(),
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
        bearing: framedBearing(),
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
    destroy() {
      disposed = true;
      swayState = "stopped";
      removeMotionListener?.();
      removeMotionListener = null;
      map.remove();
    },
  };
}
