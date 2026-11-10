/** Positive integer Strava activity ids. Sample slugs and Garmin ids are not links. */
export function stravaActivityId(run) {
  const value = run?.stravaId;
  if (value == null || value === "") return null;
  const text = String(value).trim();
  if (!/^[1-9]\d*$/.test(text)) return null;
  return text;
}

export function stravaActivityUrl(run) {
  const id = stravaActivityId(run);
  if (!id) return null;
  return `https://www.strava.com/activities/${id}`;
}

export function activitySharePath(id) {
  return `/runs?activity=${encodeURIComponent(String(id))}`;
}

/** True when browser Back lands on /runs with no activity selected. */
export function plainRunsBehind(back) {
  if (typeof back !== "string" || back === "") return false;
  let url;
  try {
    url = new URL(back, "https://local.test");
  } catch {
    return false;
  }
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (path !== "/runs") return false;
  return !url.searchParams.has("activity") && !url.searchParams.has("run");
}
