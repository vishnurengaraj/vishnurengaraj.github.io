import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

/** The light Positron basemap /runs draws on. /travel reuses it. */
export const STYLE = "https://tiles.openfreemap.org/styles/positron";

/** A globe-projection map with the /runs controls, resolved once the style loads.
    On a load failure the map is removed, `data-map="error"` is set, and this throws. */
export async function openGlobeMap(mapEl, options, { timeoutMs = 20000, beforeGlobe } = {}) {
  const map = new maplibregl.Map({
    container: mapEl,
    style: STYLE,
    attributionControl: false,
    fadeDuration: 0,
    hash: false,
    ...options,
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), "bottom-right");
  map.addControl(new maplibregl.AttributionControl({ compact: false }), "bottom-left");
  try {
    await new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error("Map style timed out")), timeoutMs);
      map.once("load", () => {
        window.clearTimeout(timer);
        resolve();
      });
    });
  } catch (error) {
    mapEl.dataset.map = "error";
    map.remove();
    throw error;
  }
  try {
    beforeGlobe?.(map);
    map.setProjection({ type: "globe" });
    map.setLight({
      anchor: "viewport",
      color: "#ffffff",
      intensity: 0.55,
      position: [1.15, 210, 28],
    });
  } catch (error) {
    console.warn("Globe setup skipped part of the style", error);
  }
  return map;
}

export { maplibregl };
