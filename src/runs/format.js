const MILES = 1609.344;

export function formatDistance(meters) {
  const value = Number(meters);
  if (!Number.isFinite(value) || value <= 0) return "";
  const miles = value / MILES;
  return `${miles.toFixed(miles >= 10 ? 1 : 2)} mi`;
}

export function formatPace(meters, movingS) {
  const distance = Number(meters);
  const moving = Number(movingS);
  if (!Number.isFinite(distance) || distance <= 0 || !Number.isFinite(moving) || moving <= 0) return "";
  const whole = Math.round(moving / (distance / MILES));
  const minutes = Math.floor(whole / 60);
  const seconds = whole % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")} /mi`;
}

export function formatElev(meters) {
  const value = Number(meters);
  if (!Number.isFinite(value)) return "";
  return `${Math.round(value * 3.28084)} ft`;
}

export function formatDate(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
