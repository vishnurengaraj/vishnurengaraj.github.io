<script setup>
import { onMounted, onUnmounted, ref } from "vue";

const GOLD = "#ffb020";
const WHITE = "#ffffff";
/* Same four-point cross as the footer sparkles, in a 10x10 box. */
const SPARK = "M5 0 L5.92 4.08 L10 5 L5.92 5.92 L5 10 L4.08 5.92 L0 5 L4.08 4.08 Z";

/*
  Hand-placed hero marks. x and y are percentages of the title sky.
  They are constants so the server render never changes between loads.
  phase reuses the footer twinkle delays (a is the base timing).
  shape: 0 dot, 1 sparkle. gold: 0 white, 1 gold.
*/
const MARKS = [
  [16, 3, 15, 1, "b", 1],
  [44, 2.2, 11, 0, "e", 1],
  [88, 4.2, 12, 1, "c", 1],
  [79, 18, 16, 0, "f", 1],
  [96, 26, 9, 0, "a", 1],
  [70, 33, 10, 1, "d", 1],
  [91, 39, 13, 1, "g", 1],
  [74, 61, 9, 0, "b", 1],
  [95, 73, 8, 1, "e", 1],
  [2.4, 20, 9, 0, "c", 1],
  [24, 58, 15, 1, "f", 1],
  [42, 70, 11, 0, "d", 1],
  [12, 78, 8, 1, "a", 1],
  [58, 80, 10, 0, "b", 1],

  [4.5, 2.4, 2, 0, "c", 0],
  [12, 4.5, 3, 0, "e", 0],
  [24, 1.6, 2, 1, "g", 0],
  [35, 3.8, 2, 0, "b", 0],
  [56, 1.5, 3, 0, "d", 0],
  [66, 4.2, 2, 0, "f", 0],
  [81, 2, 2, 1, "a", 0],
  [97, 1.8, 2, 0, "c", 0],

  [71, 9, 2, 0, "e", 0],
  [83, 11, 3, 0, "b", 0],
  [99, 10, 2, 0, "g", 0],
  [68, 20, 2, 1, "d", 0],
  [91, 21, 2, 0, "a", 0],
  [76, 28, 3, 0, "f", 0],
  [98, 34, 2, 0, "c", 0],
  [72, 40, 2, 1, "e", 0],
  [86, 52, 4, 0, "b", 0],
  [67, 53, 3, 0, "d", 0],
  [81, 56, 2, 0, "a", 0],
  [93, 60, 2, 1, "f", 0],
  [70, 66, 2, 0, "c", 0],
  [87, 70, 3, 0, "e", 0],
  [75, 78, 2, 0, "b", 0],
  [94, 81, 2, 1, "d", 0],
  [82, 86, 3, 0, "g", 0],

  [6, 43, 2, 0, "a", 0],
  [15, 63, 3, 0, "f", 0],
  [27, 40, 2, 1, "c", 0],
  [36, 67, 2, 0, "e", 0],
  [51, 36, 3, 0, "b", 0],
  [60, 71, 2, 0, "g", 0],
  [9, 62, 2, 0, "d", 0],
  [21, 66, 4, 0, "a", 0],
  [33, 61, 2, 1, "f", 0],
  [46, 65, 2, 0, "c", 0],
  [57, 69, 3, 0, "e", 0],
  [5, 73, 2, 0, "b", 0],
  [17, 76, 2, 1, "g", 0],
  [31, 80, 3, 0, "d", 0],
  [44, 75, 2, 0, "a", 0],
  [55, 84, 2, 0, "f", 0],
  [8, 85, 3, 0, "e", 0],
  [63, 76, 2, 0, "c", 0],

  [2, 9, 2, 0, "e", 0],
  [1.4, 28, 3, 0, "b", 0],
  [3.2, 40, 2, 1, "g", 0],
  [2.2, 66, 2, 0, "c", 0],
  [3.6, 84, 2, 0, "f", 0],

  [49, 10, 2, 0, "d", 0],
  [59, 14, 3, 0, "a", 0],
  [52, 21, 2, 1, "f", 0],
  [64, 19, 2, 0, "c", 0],
  [47, 27, 2, 0, "e", 0],
  [58, 29, 3, 0, "b", 0],

  [14, 35, 2, 0, "g", 0],
  [27, 33, 3, 0, "e", 0],
  [38, 39, 2, 1, "d", 0],
  [48, 36, 2, 0, "a", 0],
  [34, 44, 2, 0, "b", 0],
  [55, 38, 2, 0, "f", 0],
  [66, 42, 3, 0, "c", 0],
  [63, 58, 2, 0, "e", 0],
  [77, 64, 2, 1, "a", 0],
  [19, 69, 2, 0, "d", 0],
  [8, 42, 3, 0, "g", 0],
];

const stars = MARKS.map(([x, y, size, gold, phase, spark], index) => ({
  id: index,
  x,
  y,
  size,
  fill: gold ? GOLD : WHITE,
  phase,
  spark: spark === 1,
}));

/* Upper-sky crossings. Start-to-start gaps stay inside 6–12s. */
const SHOTS = [
  { x0: "-16%", y0: "3.2%", x1: "62%", y1: "1.4%", ang: "-1.3deg", dur: "0.92s" },
  { x0: "64%", y0: "1.2%", x1: "112%", y1: "12%", ang: "12.7deg", dur: "0.7s" },
  { x0: "-12%", y0: "1.6%", x1: "36%", y1: "4.8%", ang: "3.8deg", dur: "0.64s" },
  { x0: "112%", y0: "9%", x1: "68%", y1: "20%", ang: "166deg", dur: "0.84s" },
  { x0: "8%", y0: "0.4%", x1: "44%", y1: "5.2%", ang: "7.6deg", dur: "0.6s" },
  { x0: "76%", y0: "7%", x1: "104%", y1: "19%", ang: "23.2deg", dur: "0.76s" },
];
const GAPS = [6800, 11200, 7600, 9400, 6100, 10800, 8400];

const sky = ref(null);
const shooter = ref(null);

let timer = 0;
let observer;
let onVisibility;
let onReduce;
let reduceQuery;
let running = false;
let shot = 0;
let gapIndex = 0;
let generation = 0;
let heroVisible = true;

function queue(delay) {
  window.clearTimeout(timer);
  timer = window.setTimeout(fire, delay);
}

function fire() {
  const el = shooter.value;
  if (!running || !el) return;
  const path = SHOTS[shot % SHOTS.length];
  shot += 1;
  const gen = ++generation;
  el.style.setProperty("--x0", path.x0);
  el.style.setProperty("--y0", path.y0);
  el.style.setProperty("--x1", path.x1);
  el.style.setProperty("--y1", path.y1);
  el.style.setProperty("--ang", path.ang);
  el.style.setProperty("--dur", path.dur);
  el.classList.remove("is-hot");
  requestAnimationFrame(() => {
    if (!running || gen !== generation) return;
    el.classList.add("is-hot");
  });
  const gap = GAPS[gapIndex % GAPS.length];
  gapIndex += 1;
  queue(gap);
}

function start() {
  sky.value?.classList.remove("is-paused");
  if (running) return;
  running = true;
  queue(GAPS[gapIndex % GAPS.length]);
  gapIndex += 1;
}

function stop() {
  running = false;
  generation += 1;
  window.clearTimeout(timer);
  sky.value?.classList.add("is-paused");
  shooter.value?.classList.remove("is-hot");
}

function sync() {
  const reduce = reduceQuery?.matches;
  if (reduce || document.hidden || !heroVisible) stop();
  else start();
}

onMounted(() => {
  reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  onReduce = () => sync();
  reduceQuery.addEventListener("change", onReduce);
  const hero = document.getElementById("top");
  const root = document.querySelector(".prlx");
  if (hero) {
    observer = new IntersectionObserver(
      (entries) => {
        heroVisible = entries.some((entry) => entry.isIntersecting);
        sync();
      },
      { root, threshold: 0 },
    );
    observer.observe(hero);
  }
  onVisibility = () => sync();
  document.addEventListener("visibilitychange", onVisibility);
  sync();
});

onUnmounted(() => {
  window.clearTimeout(timer);
  observer?.disconnect();
  reduceQuery?.removeEventListener("change", onReduce);
  document.removeEventListener("visibilitychange", onVisibility);
});
</script>

<template>
  <div ref="sky" class="stars hero-sky" aria-hidden="true">
    <svg
      v-for="star in stars"
      :key="star.id"
      class="scope-star hero-star"
      :class="star.phase === 'a' ? undefined : `star-${star.phase}`"
      :style="{
        left: `${star.x}%`,
        top: `${star.y}%`,
        width: `${star.size}px`,
        height: `${star.size}px`,
        marginLeft: `${-star.size / 2}px`,
        marginTop: `${-star.size / 2}px`,
      }"
      viewBox="0 0 10 10"
      focusable="false"
    >
      <circle v-if="!star.spark" cx="5" cy="5" r="4" :fill="star.fill" />
      <path v-else :d="SPARK" :fill="star.fill" />
    </svg>
    <div ref="shooter" class="hero-shooter">
      <span class="streak"></span>
    </div>
  </div>
</template>
