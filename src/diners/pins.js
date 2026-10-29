import { DINERS, rankOf } from "../data/diners.js";

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Lift or drop a label when two diners sit on the same short stretch of coast. */
function liftOf(place) {
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

/** Flat teardrop: white edge, score, name. Rank 1 is the deeper purple. */
export function dropMarkup(place) {
  const lift = liftOf(place);
  const mid = rankOf(place) === 1 ? "" : " mid";
  const liftClass = lift ? ` ${lift}` : "";
  const score = place.weighted.toFixed(1);
  return `<div class="drop${mid}${liftClass}" data-id="${escapeHtml(place.id)}" aria-label="${escapeHtml(place.name)}, ${score}">
    <svg class="drop-shape" viewBox="0 0 34 44" width="34" height="44" aria-hidden="true">
      <path class="drop-ring" d="${DROP_GOLD}"/>
      <path d="${DROP_WHITE}" fill="#fff"/>
      <path class="drop-fill" d="${DROP_FILL}"/>
    </svg>
    <span class="drop-score">${score}</span>
    <span class="drop-name">${escapeHtml(place.name)}</span>
  </div>`;
}
