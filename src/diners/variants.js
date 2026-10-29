/** Query-string prototypes for /diners. Absent on the live map. */

export const PROTO_VARIANTS = {
  a: {
    id: "a",
    title: "A · Leaflet isometric",
    sub: "CSS tilt on the light-gray ArcGIS map. Sculpted pins stand up off the plane.",
    switch: "A",
  },
  b: {
    id: "b",
    title: "B · MapLibre pitch",
    sub: "Locked camera: pitched OpenFreeMap Positron, soft buildings. Pin style is the open choice.",
    switch: "B",
  },
  c: {
    id: "c",
    title: "C · Sculpted pins",
    sub: "Today's flat ArcGIS map. Only the pins change: bevel, thickness, and shadow.",
    switch: "C",
  },
};

export function protoId(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "a" || raw === "b" || raw === "c" ? raw : null;
}

/** Minimal pin studies for prototype B. The live map does not use these. */
export const PIN_STYLES = [
  {
    id: "1",
    title: "Pin 1 · Dot",
    sub: "Circle on the coordinate. White edge, one soft shadow.",
    switch: "Dot",
  },
  {
    id: "2",
    title: "Pin 2 · Drop",
    sub: "Flat teardrop. White edge, no bevel.",
    switch: "Drop",
  },
  {
    id: "3",
    title: "Pin 3 · Needle",
    sub: "Small head on a hairline stem.",
    switch: "Needle",
  },
];

export function pinStyleId(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "2" || raw === "3" ? raw : "1";
}
