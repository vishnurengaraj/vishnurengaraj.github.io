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
    sub: "Pitched camera, free OpenFreeMap light tiles, standing pins, soft building heights.",
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
