import { mkdir, unlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import sharp from "sharp";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const srcDir = existsSync(path.join(root, "media-src"))
  ? path.join(root, "media-src")
  : path.join(root, "public/assets");
const outImg = path.join(root, "public/media/img");
const outLayer = path.join(root, "public/media/layers");
const outVideo = path.join(root, "public/media/video");

await mkdir(outImg, { recursive: true });
await mkdir(outLayer, { recursive: true });
await mkdir(outVideo, { recursive: true });

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    child.stderr.on("data", (chunk) => {
      err += chunk.toString();
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(" ")} failed\n${err.slice(-800)}`));
    });
  });
}

async function still(input, widths, name) {
  const meta = await sharp(input).metadata();
  const aspect = meta.width / meta.height;
  const used = [...new Set(widths.filter((w) => w < meta.width).concat(meta.width))]
    .filter((w) => w <= meta.width)
    .sort((a, b) => a - b);
  const avif = [];
  const webp = [];
  for (const w of used) {
    const height = Math.max(1, Math.round(w / aspect));
    const base = sharp(input).rotate().resize({ width: w, withoutEnlargement: true });
    const avifName = `${name}-${w}.avif`;
    const webpName = `${name}-${w}.webp`;
    await base.clone().avif({ quality: 42, effort: 4 }).toFile(path.join(outImg, avifName));
    await base.clone().webp({ quality: 68, effort: 4, alphaQuality: 80 }).toFile(path.join(outImg, webpName));
    avif.push(`/media/img/${avifName} ${w}w`);
    webp.push(`/media/img/${webpName} ${w}w`);
  }
  const largest = used[used.length - 1];
  const fallback = `${name}-${largest}.jpg`;
  await sharp(input)
    .rotate()
    .resize({ width: largest, withoutEnlargement: true })
    .flatten({ background: "#111111" })
    .jpeg({ quality: 72, mozjpeg: true })
    .toFile(path.join(outImg, fallback));
  return {
    w: largest,
    h: Math.max(1, Math.round(largest / aspect)),
    avif: avif.join(", "),
    webp: webp.join(", "),
    fallback: `/media/img/${fallback}`,
  };
}

async function layer(input, name, width) {
  const img = sharp(input).resize({ width, withoutEnlargement: true });
  await img.clone().avif({ quality: 36, effort: 4 }).toFile(path.join(outLayer, `${name}.avif`));
  await img.clone().webp({ quality: 58, effort: 4, alphaQuality: 75 }).toFile(path.join(outLayer, `${name}.webp`));
}

async function animatedWebp(input, name, width) {
  const meta = await sharp(input, { animated: true }).metadata();
  const pageHeight = meta.pageHeight || meta.height;
  const height = Math.max(1, Math.round((width * pageHeight) / meta.width));
  await run("ffmpeg", [
    "-y",
    "-i",
    input,
    "-vf",
    `fps=8,scale=${width}:-2:flags=lanczos`,
    "-c:v",
    "libwebp",
    "-quality",
    "42",
    "-loop",
    "0",
    "-an",
    path.join(outImg, `${name}.webp`),
  ]);
  await sharp(input, { animated: true, page: 0 })
    .resize({ width, height, fit: "fill" })
    .flatten({ background: "#111111" })
    .jpeg({ quality: 70, mozjpeg: true })
    .toFile(path.join(outImg, `${name}.jpg`));
  const out = await sharp(path.join(outImg, `${name}.webp`), { animated: true, page: 0 }).metadata();
  return {
    w: out.width,
    h: out.pageHeight || out.height,
    animated: `/media/img/${name}.webp`,
    fallback: `/media/img/${name}.jpg`,
  };
}

async function video(input, name) {
  const mp4 = path.join(outVideo, `${name}.mp4`);
  const webm = path.join(outVideo, `${name}.webm`);
  const frame = path.join(outVideo, `${name}-frame.png`);
  const vf = "scale=640:-2:flags=lanczos,fps=15";
  await run("ffmpeg", [
    "-y",
    "-i",
    input,
    "-an",
    "-vf",
    vf,
    "-c:v",
    "libx264",
    "-profile:v",
    "main",
    "-pix_fmt",
    "yuv420p",
    "-crf",
    "30",
    "-preset",
    "fast",
    "-movflags",
    "+faststart",
    mp4,
  ]);
  await run("ffmpeg", [
    "-y",
    "-i",
    input,
    "-an",
    "-vf",
    vf,
    "-c:v",
    "libvpx-vp9",
    "-crf",
    "42",
    "-b:v",
    "0",
    "-row-mt",
    "1",
    "-cpu-used",
    "4",
    webm,
  ]);
  await run("ffmpeg", ["-y", "-i", mp4, "-frames:v", "1", frame]);
  await sharp(frame).webp({ quality: 70 }).toFile(path.join(outVideo, `${name}.webp`));
  await unlink(frame);
  const meta = await sharp(path.join(outVideo, `${name}.webp`)).metadata();
  return {
    mp4: `/media/video/${name}.mp4`,
    webm: `/media/video/${name}.webm`,
    poster: `/media/video/${name}.webp`,
    w: meta.width,
    h: meta.height,
  };
}

const photos = {
  audio: ["audio.jpg", [480, 640]],
  fea: ["fea.jpg", [480, 800, 1096]],
  baja: ["baja.jpg", [480, 960, 1440]],
  altair: ["altair.jpg", [480, 918]],
  tesla: ["tesla.jpg", [480, 840]],
  teslaExtra: ["tesla_extra.png", [480, 960]],
  iroqouis: ["iroqouis.png", [480, 960]],
  umichGrad: ["umich_grad.jpg", [480, 960, 1400]],
  umichUndergrad: ["umich_undergrad.jpg", [480, 960, 1400]],
  oakland: ["oakland.jpg", [480, 728]],
  robotics: ["robotics.jpg", [480, 800, 1000]],
  spacex: ["spacex.png", [420, 840]],
};

const manifest = { img: {}, video: {} };

for (const [key, [file, widths]] of Object.entries(photos)) {
  process.stdout.write(`photo ${key}\n`);
  manifest.img[key] = await still(path.join(srcDir, file), widths, key);
}

process.stdout.write("gif\n");
manifest.img.bajaCrash = await animatedWebp(path.join(srcDir, "baja_crash.gif"), "baja-crash", 480);

const layers = [
  ["wt_l1_high-af19ac73.png", "l1", 2200],
  ["wt_l1_high-af19ac73.png", "l1-sm", 1100],
  ["wt_l2-c9ef9470.png", "l2", 1600],
  ["wt_l3-217224f3.png", "l3", 1600],
  ["wt_l4-9e8983bb.png", "l4", 1600],
  ["wt_l4-9e8983bb.png", "l4-sm", 1000],
  ["wt_l5-0c8e1f03.png", "l5", 1600],
  ["wt_l6-3ba705ea.png", "l6", 1600],
  ["wt_l7-4e8ecf18.png", "l7", 1600],
  ["wt_l7-4e8ecf18.png", "l7-sm", 1000],
];
for (const [file, name, width] of layers) {
  process.stdout.write(`layer ${name}\n`);
  await layer(path.join(srcDir, file), name, width);
}

process.stdout.write("video altair\n");
manifest.video.altair = await video(path.join(srcDir, "altair_spin.mp4"), "altair");
process.stdout.write("video iroqouis\n");
manifest.video.iroqouis = await video(path.join(srcDir, "iroqouis_spin.mp4"), "iroqouis");

await writeFile(path.join(root, "src/data/media.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify(manifest, null, 2));
