import { DINERS, rankOf } from "../data/diners.js";

/** Stem tip sits on this point of the 52×70 pin box. */
export const GEM_W = 52;
export const GEM_H = 70;
export const GEM_ANCHOR_X = 26;
export const GEM_ANCHOR_Y = 70;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Same neighbor nudge the live markers use, so long coastal labels still separate. */
export function liftOf(place) {
  const neighbor = DINERS.find((other) => {
    if (other.id === place.id) return false;
    return Math.abs(other.lat - place.lat) < 0.01 && Math.abs(other.lng - place.lng) < 0.02;
  });
  if (!neighbor) return "";
  return neighbor.lat < place.lat ? "above" : "below";
}

export function gemMarkup(place, { labelled = false } = {}) {
  const lift = liftOf(place);
  const mid = rankOf(place) === 1 ? "" : " mid";
  const liftClass = lift ? ` ${lift}` : "";
  const score = place.weighted.toFixed(1);
  const label = labelled ? ` aria-label="${escapeHtml(place.name)}, ${score}"` : "";
  return `<div class="gem${mid}${liftClass}" data-id="${escapeHtml(place.id)}"${label}>
    <div class="gem-shadow" aria-hidden="true"></div>
    <div class="gem-upright">
      <div class="gem-body">
        <span class="gem-stem" aria-hidden="true"></span>
        <span class="gem-head">
          <span class="gem-slab" aria-hidden="true"></span>
          <span class="gem-face"><b>${score}</b></span>
        </span>
        <span class="gem-name">${escapeHtml(place.name)}</span>
      </div>
    </div>
  </div>`;
}
