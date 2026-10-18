import { createServer } from "vite";

function lum(hex) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

function contrast(a, b) {
  const L1 = lum(a);
  const L2 = lum(b);
  const hi = Math.max(L1, L2);
  const lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
}

const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
  ssr: { noExternal: ["@material/material-color-utilities"] },
});
const mod = await server.ssrLoadModule("/src/theme.js");
const colors = mod.schemeColors();
console.log(JSON.stringify(colors, null, 2));
const pairs = [
  ["onPrimary", "primary"],
  ["onPrimaryContainer", "primaryContainer"],
  ["onSecondary", "secondary"],
  ["onSecondaryContainer", "secondaryContainer"],
  ["onTertiary", "tertiary"],
  ["onTertiaryContainer", "tertiaryContainer"],
  ["onSurface", "surface"],
  ["onSurface", "surfaceContainer"],
  ["onSurface", "surfaceContainerHigh"],
  ["onSurface", "surfaceContainerHighest"],
  ["onSurfaceVariant", "surface"],
  ["onSurfaceVariant", "surfaceContainerHigh"],
  ["primary", "surface"],
  ["primary", "surfaceContainerHigh"],
  ["inverseOnSurface", "inverseSurface"],
  ["onBackground", "background"],
];
for (const [fg, bg] of pairs) {
  const ratio = contrast(colors[fg], colors[bg]);
  console.log(
    `${fg} ${colors[fg]} on ${bg} ${colors[bg]} = ${ratio.toFixed(2)} ${ratio >= 4.5 ? "AA" : ratio >= 3 ? "AA-large" : "FAIL"}`,
  );
}
await server.close();
