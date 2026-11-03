import { moveMeters, offsetPath, pathLength } from "./geo.mjs";

/** Synthetic South Bay, San Francisco, and New York runs.
    Inland spurs stand in for a driveway. The build strips them.
    These are not scraped Strava activities. */

export const SAMPLE_PIER = [-118.4016, 33.8622];

const STRAND = [
  [-118.4168, 33.902],
  [-118.4138, 33.8935],
  [-118.4108, 33.8843],
  [-118.4068, 33.8748],
  [-118.4036, 33.868],
  [-118.4016, 33.8622],
  [-118.3994, 33.8564],
  [-118.396, 33.8495],
  [-118.3924, 33.843],
  [-118.3892, 33.8378],
  [-118.3872, 33.831],
];

const CRISSY = [
  [-122.4905, 37.8068],
  [-122.483, 37.8055],
  [-122.4745, 37.8038],
  [-122.466, 37.8032],
  [-122.4575, 37.804],
  [-122.449, 37.8055],
];

const EMBARCADERO = [
  [-122.41, 37.7952],
  [-122.4015, 37.7978],
  [-122.3948, 37.8006],
  [-122.3895, 37.8044],
  [-122.3955, 37.8082],
];

const PARK = [
  [-73.973, 40.7648],
  [-73.9816, 40.7682],
  [-73.9812, 40.7765],
  [-73.9788, 40.7852],
  [-73.9685, 40.7935],
  [-73.9582, 40.799],
  [-73.9496, 40.7962],
  [-73.9498, 40.7855],
  [-73.9588, 40.7718],
  [-73.9678, 40.7662],
  [-73.973, 40.7648],
];

const HUDSON = [
  [-74.0118, 40.7345],
  [-74.0138, 40.7448],
  [-74.0102, 40.7562],
  [-74.0052, 40.7684],
  [-74.0012, 40.7785],
];

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function attachSpurs(core, seed, loopHome) {
  const rand = mulberry32(seed);
  const east = 700 + rand() * 180;
  const north = (rand() - 0.5) * 260;
  const startTip = moveMeters(core[0], east, north);
  const endTip = loopHome
    ? moveMeters(core[0], east + 25, north + 15)
    : moveMeters(core[core.length - 1], 700 + rand() * 180, (rand() - 0.5) * 260);
  return [startTip, ...core, endTip];
}

function activity({ id, title, date, spine, from, to, offsetM, pace, elevM, outAndBack = false, samplePhoto = false }) {
  let core = spine.slice(from, to + 1).map((coord) => coord.slice());
  core = offsetPath(core, offsetM);
  if (outAndBack) core = core.concat(core.slice(0, -1).reverse());
  const coords = attachSpurs(core, hash(id), outAndBack);
  const distanceM = pathLength(coords);
  const movingS = Math.round(distanceM / pace);
  return {
    id,
    title,
    date,
    type: "Run",
    distanceM,
    movingS,
    elapsedS: Math.round(movingS * 1.05),
    elevM,
    coords,
    companions: [],
    sample: true,
    samplePhoto,
  };
}

const LA = [
  ["sample-la-strand", "Strand sunrise", "2025-06-08T15:00:00Z", 0, 10, 0, 3.15, 18],
  ["sample-la-hermosa", "Hermosa out and back", "2025-04-19T15:30:00Z", 4, 10, -4, 2.95, 22, true, true],
  ["sample-la-mb", "Manhattan Beach easy", "2025-03-02T16:10:00Z", 0, 5, 3, 2.8, 14],
  ["sample-la-elsegundo", "El Segundo to the pier", "2024-11-16T15:45:00Z", 0, 5, -6, 3.3, 16],
  ["sample-la-redondo", "Redondo horseshoe", "2025-08-23T14:20:00Z", 5, 10, 5, 3.05, 28],
  ["sample-la-repeats", "Strand repeats", "2025-09-14T15:05:00Z", 3, 9, -2, 3.4, 24],
  ["sample-la-evening", "Evening miles", "2025-01-09T15:15:00Z", 4, 9, 7, 2.7, 20],
  ["sample-la-long", "Long beach path", "2024-07-04T14:00:00Z", 1, 10, -5, 3.2, 31],
  ["sample-la-saturday", "Saturday strand", "2025-05-17T15:40:00Z", 0, 9, 2, 3.0, 26],
  ["sample-la-recovery", "Recovery jog", "2025-02-11T16:00:00Z", 2, 8, -3, 2.6, 15],
  ["sample-la-pier", "Pier to pier", "2024-12-21T15:25:00Z", 2, 7, 6, 3.25, 19],
  ["sample-la-sunrise", "Redondo sunrise", "2025-10-05T14:50:00Z", 5, 10, -7, 3.1, 21],
  ["sample-la-miles", "Hermosa miles", "2023-09-30T15:10:00Z", 3, 8, 4, 2.9, 17],
  ["sample-la-southbay", "South Bay long run", "2024-05-26T14:35:00Z", 0, 10, 1, 3.35, 36],
];

export function buildSampleActivities() {
  const runs = LA.map(([id, title, date, from, to, offsetM, pace, elevM, outAndBack, samplePhoto]) =>
    activity({
      id,
      title,
      date,
      spine: STRAND,
      from,
      to,
      offsetM,
      pace,
      elevM,
      outAndBack: Boolean(outAndBack),
      samplePhoto: Boolean(samplePhoto),
    }),
  );

  runs.push(
    activity({
      id: "sample-sf-crissy",
      title: "Crissy Field",
      date: "2024-08-18T16:00:00Z",
      spine: CRISSY,
      from: 0,
      to: 5,
      offsetM: 0,
      pace: 3.05,
      elevM: 12,
    }),
    activity({
      id: "sample-sf-bridge",
      title: "Bridge to the warmup",
      date: "2025-07-12T15:20:00Z",
      spine: CRISSY,
      from: 0,
      to: 4,
      offsetM: 6,
      pace: 3.25,
      elevM: 18,
    }),
    activity({
      id: "sample-sf-marina",
      title: "Marina loop",
      date: "2023-11-04T16:40:00Z",
      spine: CRISSY,
      from: 2,
      to: 5,
      offsetM: -5,
      pace: 2.85,
      elevM: 9,
    }),
    activity({
      id: "sample-sf-embarcadero",
      title: "Embarcadero",
      date: "2024-02-25T16:15:00Z",
      spine: EMBARCADERO,
      from: 0,
      to: 4,
      offsetM: 0,
      pace: 3.1,
      elevM: 14,
    }),
    activity({
      id: "sample-nyc-park",
      title: "Central Park loop",
      date: "2024-10-13T14:10:00Z",
      spine: PARK,
      from: 0,
      to: PARK.length - 1,
      offsetM: 0,
      pace: 3.0,
      elevM: 48,
    }),
    activity({
      id: "sample-nyc-morning",
      title: "Park morning",
      date: "2025-04-06T13:50:00Z",
      spine: PARK,
      from: 0,
      to: PARK.length - 1,
      offsetM: 8,
      pace: 3.2,
      elevM: 52,
    }),
    activity({
      id: "sample-nyc-hudson",
      title: "Hudson greenway",
      date: "2023-06-17T14:30:00Z",
      spine: HUDSON,
      from: 0,
      to: HUDSON.length - 1,
      offsetM: 0,
      pace: 3.15,
      elevM: 11,
    }),
  );

  return runs;
}
