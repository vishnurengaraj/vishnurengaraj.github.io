// Rasterize design/layer-sources into public/media/layers.
// Encoder settings match layer() in optimize-media.mjs.
// Files that already exist are left as they are.

import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const srcDir = path.join(root, "design/layer-sources");
const outDir = path.join(root, "public/media/layers");

const layers = [
  ["l1", 14058, 4277],
  ["l2", 4686, 1689],
  ["l3", 4686, 1692],
  ["l4", 4686, 1704],
  ["l5", 4685, 1704],
  ["l6", 4685, 1707],
  ["l7", 4685, 2019],
];

// Keep in sync with widthsFor() in src/App.vue.
function widthsFor(master) {
  const widths = [960, 1600, 2400, 3200];
  if (master >= 4200) widths.push(4200);
  if (master >= 4800) widths.push(4800);
  else if (master > 4200) widths.push(master);
  return widths;
}

for (const [id, masterW, masterH] of layers) {
  const input = path.join(srcDir, `${id}.svg`);
  const meta = await sharp(input, { density: 72 }).metadata();
  if (meta.width !== masterW || meta.height !== masterH) {
    throw new Error(`${id} svg is ${meta.width}x${meta.height}, expected ${masterW}x${masterH}`);
  }
  for (const width of widthsFor(masterW)) {
    const avifPath = path.join(outDir, `${id}-${width}.avif`);
    const webpPath = path.join(outDir, `${id}-${width}.webp`);
    if (existsSync(avifPath) && existsSync(webpPath)) {
      console.log(`keep ${id}-${width}`);
      continue;
    }
    const resized = sharp(input, { density: 72 }).resize({ width, withoutEnlargement: true });
    const avifBuf = await resized.clone().avif({ quality: 36, effort: 4 }).toBuffer();
    const webpBuf = await resized.clone().webp({ quality: 58, effort: 4, alphaQuality: 75 }).toBuffer();
    const avifMeta = await sharp(avifBuf).metadata();
    const webpMeta = await sharp(webpBuf).metadata();
    if (avifMeta.width !== width || webpMeta.width !== width) {
      throw new Error(`${id}-${width} encoded ${avifMeta.width}/${webpMeta.width}`);
    }
    await sharp(avifBuf).toFile(avifPath);
    await sharp(webpBuf).toFile(webpPath);
    console.log(
      `wrote ${id}-${width} avif ${avifBuf.length} webp ${webpBuf.length} (${avifMeta.width}x${avifMeta.height})`,
    );
  }
}
