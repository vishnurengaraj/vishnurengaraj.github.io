/** South Bay Sunday breakfast visits. Scores are real; weighted in the page. */
export const WEIGHTS = { taste: 0.4, price: 0.3, atmosphere: 0.15, service: 0.15 };

const PLACES = [
  {
    id: "wendys",
    name: "Wendy's Place",
    hood: "El Segundo",
    addr: "107 W Grand Ave, El Segundo, CA 90245",
    lat: 33.9191695,
    lng: -118.4163119,
    taste: 7,
    price: 8,
    atmosphere: 7.5,
    service: 5,
    hue: [280, 30],
    photo: "/media/diners/wendys.jpg",
    photoCredit: "Photo by Vishnu",
  },
  {
    id: "unclebills",
    name: "Uncle Bill's Pancake House",
    hood: "Manhattan Beach",
    addr: "1305 Highland Ave, Manhattan Beach, CA 90266",
    lat: 33.886526,
    lng: -118.410603,
    taste: 7,
    price: 7,
    atmosphere: 7.5,
    service: 6,
    hue: [205, 30],
    photo: "/media/diners/unclebills.jpg",
    photoCredit: "Uncle Bill's Pancake House (official site)",
  },
  {
    id: "marthas",
    name: "Martha's 22nd Street Grill",
    hood: "Hermosa Beach",
    addr: "25 22nd St, Hermosa Beach, CA 90254",
    lat: 33.869338,
    lng: -118.403923,
    taste: 7,
    price: 6.5,
    atmosphere: 7.5,
    service: 5,
    hue: [38, 24],
    photo: "/media/diners/marthas.jpg",
    photoCredit: "Martha's Hermosa Beach — patio / sign (official site)",
  },
];

function scoreOf(place) {
  const sum =
    place.taste * WEIGHTS.taste +
    place.price * WEIGHTS.price +
    place.atmosphere * WEIGHTS.atmosphere +
    place.service * WEIGHTS.service;
  return Math.round(sum * 100 + 1e-9) / 100;
}

export const DINERS = PLACES.map((place) => ({ ...place, weighted: scoreOf(place) }));

export function ranked() {
  return [...DINERS].sort((a, b) => b.weighted - a.weighted);
}

export function rankOf(place) {
  return ranked().findIndex((item) => item.id === place.id) + 1;
}

export function mapsUrl(place) {
  return (
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(`${place.name}, ${place.addr}`)
  );
}

/** Apple Maps pin at the diner's coordinates, labeled with name and address. */
export function appleMapsUrl(place) {
  return (
    "https://maps.apple.com/?ll=" +
    place.lat +
    "," +
    place.lng +
    "&q=" +
    encodeURIComponent(place.name + ", " + place.addr)
  );
}

/** Plate-and-mountain stand-in used only when a diner has no photo file. */
export function photoPlaceholder(place) {
  const [h, s] = place.hue;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 220'>
  <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='hsl(${h},${s + 20}%,88%)'/><stop offset='1' stop-color='hsl(${h + 20},${s + 10}%,74%)'/></linearGradient>
  <radialGradient id='p'><stop offset='0' stop-color='#f6efe0'/><stop offset='.7' stop-color='#e8dcc4'/><stop offset='1' stop-color='#c9bfa8'/></radialGradient></defs>
  <rect width='400' height='220' fill='url(#g)'/>
  <path d='M0 220 L90 120 L140 165 L220 80 L300 170 L340 135 L400 180 L400 220Z' fill='rgba(45,29,122,.22)'/>
  <ellipse cx='200' cy='118' rx='78' ry='60' fill='url(#p)' opacity='.95'/>
  <ellipse cx='200' cy='118' rx='54' ry='40' fill='none' stroke='rgba(255,176,32,.8)' stroke-width='2'/>
  <circle cx='185' cy='110' r='16' fill='#f4c542'/><circle cx='185' cy='110' r='7' fill='#e89a1c'/>
  <rect x='205' y='102' width='34' height='10' rx='5' fill='#b5542f'/><rect x='205' y='118' width='30' height='10' rx='5' fill='#a34a28'/>
  </svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg).replace(/'/g, "%27")}")`;
}
