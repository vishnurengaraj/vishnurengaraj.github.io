import { haversine } from "./geo.mjs";

/** Camera centers open on the part of town the runs actually use.
    LA stays on the South Bay strand, not a basin-wide fit. */
export const METROS = [
  {
    id: "la",
    label: "LA",
    name: "South Bay",
    west: -118.85,
    east: -117.7,
    south: 33.6,
    north: 34.2,
    center: [-118.4016, 33.8622],
    zoom: 12.35,
  },
  {
    id: "sf",
    label: "SF",
    name: "San Francisco",
    west: -122.55,
    east: -122.2,
    south: 37.45,
    north: 37.95,
    center: [-122.47, 37.804],
    zoom: 12.55,
  },
  {
    id: "nyc",
    label: "NYC",
    name: "New York",
    west: -74.08,
    east: -73.88,
    south: 40.66,
    north: 40.84,
    center: [-73.966, 40.782],
    zoom: 12.35,
  },
  {
    id: "sd",
    label: "SD",
    name: "San Diego",
    west: -117.3,
    east: -116.9,
    south: 32.55,
    north: 33.15,
    center: [-117.18, 32.75],
    zoom: 12,
  },
  {
    id: "sea",
    label: "SEA",
    name: "Seattle",
    west: -122.45,
    east: -122.2,
    south: 47.45,
    north: 47.75,
    center: [-122.33, 47.61],
    zoom: 12,
  },
  {
    id: "pdx",
    label: "PDX",
    name: "Portland",
    west: -122.8,
    east: -122.5,
    south: 45.4,
    north: 45.65,
    center: [-122.68, 45.52],
    zoom: 12,
  },
  {
    id: "bos",
    label: "BOS",
    name: "Boston",
    west: -71.2,
    east: -70.95,
    south: 42.25,
    north: 42.45,
    center: [-71.07, 42.36],
    zoom: 12,
  },
  {
    id: "chi",
    label: "CHI",
    name: "Chicago",
    west: -87.85,
    east: -87.5,
    south: 41.7,
    north: 42.05,
    center: [-87.65, 41.88],
    zoom: 12,
  },
  {
    id: "den",
    label: "DEN",
    name: "Denver",
    west: -105.1,
    east: -104.8,
    south: 39.6,
    north: 39.85,
    center: [-104.98, 39.74],
    zoom: 12,
  },
  {
    id: "aus",
    label: "AUS",
    name: "Austin",
    west: -97.9,
    east: -97.6,
    south: 30.15,
    north: 30.45,
    center: [-97.74, 30.27],
    zoom: 12,
  },
];

const PREFERRED = ["la", "sf", "nyc"];

/** Named regions for tracks that fall outside the metro boxes.
    Radii are wide enough to merge adjacent 0.5° away-buckets that are one place:
    Tokyo's palace and Ueno, Waco's two cells, the eastern Sierra, and
    Ann Arbor with Detroit. */
export const PLACES = [
  { id: "kings", label: "Kings", name: "Kings Canyon", center: [-118.4, 36.81], radiusM: 18000, zoom: 11.4 },
  { id: "whitney", label: "Whitney", name: "Mt Whitney", center: [-118.55, 36.58], radiusM: 42000, zoom: 10.2 },
  { id: "yosemite", label: "Yosemite", name: "Yosemite", center: [-119.5, 37.77], radiusM: 40000, zoom: 10.4 },
  { id: "sierra", label: "Sierra", name: "Eastern Sierra", center: [-118.78, 37.5], radiusM: 55000, zoom: 9.2 },
  { id: "humboldt", label: "Humboldt", name: "Humboldt Redwoods", center: [-124.0, 40.32], radiusM: 50000, zoom: 10.8 },
  { id: "madrid", label: "Madrid", name: "Madrid", center: [-3.72, 40.42], radiusM: 40000, zoom: 12.2 },
  { id: "alps", label: "Alps", name: "Mont Blanc", center: [6.75, 45.9], radiusM: 40000, zoom: 9.5 },
  { id: "geneva", label: "Geneva", name: "Geneva", center: [6.1, 46.22], radiusM: 30000, zoom: 11.2 },
  { id: "reyes", label: "Reyes", name: "Reyes Peak", center: [-119.29, 34.63], radiusM: 25000, zoom: 12 },
  { id: "ynez", label: "Ynez", name: "Santa Ynez", center: [-119.75, 34.58], radiusM: 28000, zoom: 11.4 },
  { id: "michigan", label: "Michigan", name: "Michigan", center: [-83.45, 42.48], radiusM: 85000, zoom: 8.2 },
  { id: "pinnacles", label: "Pinnacles", name: "Pinnacles", center: [-121.2, 36.49], radiusM: 28000, zoom: 11.5 },
  { id: "bigsur", label: "Big Sur", name: "Big Sur", center: [-121.67, 36.26], radiusM: 28000, zoom: 11.4 },
  { id: "tokyo", label: "Tokyo", name: "Tokyo", center: [139.76, 35.7], radiusM: 30000, zoom: 11.4 },
  { id: "izu", label: "Izu", name: "Izu", center: [138.93, 34.81], radiusM: 40000, zoom: 11 },
  { id: "channel", label: "Islands", name: "Channel Islands", center: [-119.6, 34.04], radiusM: 30000, zoom: 11 },
  { id: "jacinto", label: "Jacinto", name: "San Jacinto", center: [-116.75, 33.95], radiusM: 40000, zoom: 10.4 },
  { id: "joshua", label: "JTree", name: "Joshua Tree", center: [-116.17, 33.98], radiusM: 30000, zoom: 11.2 },
  { id: "waco", label: "Waco", name: "Waco", center: [-97.28, 31.5], radiusM: 50000, zoom: 10.4 },
  { id: "baldy", label: "Baldy", name: "Mt Baldy", center: [-117.6, 34.25], radiusM: 22000, zoom: 11.6 },
  { id: "atlanta", label: "Atlanta", name: "Atlanta", center: [-84.32, 33.99], radiusM: 40000, zoom: 11.4 },
  { id: "sonoma", label: "Sonoma", name: "Lake Sonoma", center: [-123.05, 38.7], radiusM: 40000, zoom: 11.4 },
  { id: "fortuna", label: "Fortuna", name: "La Fortuna", center: [-84.64, 10.47], radiusM: 40000, zoom: 12 },
  { id: "telescope", label: "Telescope", name: "Death Valley", center: [-117.09, 36.17], radiusM: 35000, zoom: 11.2 },
  { id: "canyon", label: "Canyon", name: "Grand Canyon", center: [-112.05, 36.21], radiusM: 40000, zoom: 11 },
  { id: "zion", label: "Zion", name: "Zion", center: [-112.95, 37.24], radiusM: 25000, zoom: 11.4 },
  { id: "india", label: "India", name: "Kanyakumari", center: [77.73, 8.69], radiusM: 40000, zoom: 11 },
];

function inMetro(metro, lng, lat) {
  return lng >= metro.west && lng <= metro.east && lat >= metro.south && lat <= metro.north;
}

function awayBucket(lng, lat) {
  const latBin = Math.round(lat / 0.5) * 0.5;
  const lngBin = Math.round(lng / 0.5) * 0.5;
  const enc = (n) => `${n < 0 ? "m" : "p"}${String(Math.abs(Math.round(n * 10))).padStart(3, "0")}`;
  return {
    id: `away-${enc(latBin)}-${enc(lngBin)}`,
    center: [lngBin, latBin],
  };
}

/** One metro per run. Points just outside a box join the nearest city within 80km.
    Anything farther gets its own chip so heatmaps never share a world layer. */
export function assignCity(lng, lat) {
  for (const metro of METROS) {
    if (inMetro(metro, lng, lat)) return { ...metro, generated: false };
  }
  let nearest = null;
  let nearestM = Infinity;
  for (const metro of METROS) {
    const dist = haversine([lng, lat], metro.center);
    if (dist < nearestM) {
      nearest = metro;
      nearestM = dist;
    }
  }
  if (nearest && nearestM <= 80000) return { ...nearest, generated: false };
  for (const place of PLACES) {
    if (haversine([lng, lat], place.center) <= place.radiusM) return { ...place, generated: false };
  }
  const bucket = awayBucket(lng, lat);
  return {
    id: bucket.id,
    label: "Away",
    name: "Away",
    center: bucket.center,
    zoom: 12,
    generated: true,
  };
}

export function orderCities(cities) {
  const rank = (id) => {
    const index = PREFERRED.indexOf(id);
    if (index !== -1) return index;
    return 10;
  };
  return [...cities].sort((a, b) => rank(a.id) - rank(b.id) || b.count - a.count || a.label.localeCompare(b.label));
}
