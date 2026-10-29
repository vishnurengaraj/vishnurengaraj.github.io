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

const DROP_GOLD =
  "M17 43.2C17 43.2 2.2 27.2 2.2 15.6a14.8 14.8 0 1 1 29.6 0c0 11.6-14.8 27.6-14.8 27.6z";
const DROP_WHITE =
  "M17 41.4C17 41.4 4.2 26.4 4.2 15.6a12.8 12.8 0 1 1 25.6 0c0 10.8-12.8 25.8-12.8 25.8z";
const DROP_FILL =
  "M17 39.6C17 39.6 6 25.6 6 15.6a11 11 0 1 1 22 0c0 10-11 24-11 24z";

function pinBody(style, score) {
  if (style === "2") {
    return `<svg class="mpin-shape" viewBox="0 0 34 44" width="34" height="44" aria-hidden="true">
      <path class="mpin-selpath" d="${DROP_GOLD}"/>
      <path d="${DROP_WHITE}" fill="#fff"/>
      <path class="mpin-fill" d="${DROP_FILL}"/>
    </svg><span class="mpin-score">${score}</span>`;
  }
  if (style === "3") {
    return `<svg class="mpin-shape" viewBox="0 0 28 48" width="28" height="48" aria-hidden="true">
      <circle class="mpin-selpath" cx="14" cy="12" r="13"/>
      <line class="mpin-line" x1="14" y1="21" x2="14" y2="46" stroke-width="2" stroke-linecap="round"/>
      <circle cx="14" cy="12" r="11" fill="#fff"/>
      <circle class="mpin-fill" cx="14" cy="12" r="9"/>
    </svg><span class="mpin-ground" aria-hidden="true"></span><span class="mpin-score">${score}</span>`;
  }
  return `<span class="mpin-dot"><b>${score}</b></span>`;
}

/** Clean pins for prototype B. A and C still use gemMarkup. */
export function pinMarkup(place, style, { labelled = false } = {}) {
  const id = style === "2" || style === "3" ? style : "1";
  const lift = liftOf(place);
  const mid = rankOf(place) === 1 ? "" : " mid";
  const liftClass = lift ? ` ${lift}` : "";
  const score = place.weighted.toFixed(1);
  const label = labelled ? ` aria-label="${escapeHtml(place.name)}, ${score}"` : "";
  return `<div class="mpin mpin-${id}${mid}${liftClass}" data-id="${escapeHtml(place.id)}"${label}>${pinBody(id, score)}<span class="mpin-name">${escapeHtml(place.name)}</span></div>`;
}

export function pinAnchor(style) {
  return style === "2" || style === "3" ? "bottom" : "center";
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
