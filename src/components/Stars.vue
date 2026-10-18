<script setup>
import { onMounted, onUnmounted, ref } from "vue";

const canvas = ref(null);
let frame = 0;
let observer;
let onVisibility;

onMounted(() => {
  const el = canvas.value;
  if (!el) return;
  const ctx = el.getContext("2d", { alpha: true });
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const stars = Array.from({ length: 90 }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: Math.random() * 0.9 + 0.25,
    a: Math.random() * 0.45 + 0.35,
    p: Math.random() * Math.PI * 2,
  }));
  const dprCap = 1.5;
  let running = false;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    const width = el.clientWidth;
    const height = el.clientHeight;
    el.width = Math.max(1, Math.floor(width * dpr));
    el.height = Math.max(1, Math.floor(height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw(time) {
    const width = el.clientWidth;
    const height = el.clientHeight;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#ffffff";
    for (const star of stars) {
      ctx.globalAlpha = reduce ? star.a : star.a * (0.55 + 0.45 * Math.sin(time / 900 + star.p));
      ctx.beginPath();
      ctx.arc(star.x * width, star.y * height, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (running) frame = requestAnimationFrame(draw);
  }

  function setRunning(next) {
    if (next === running) return;
    running = next;
    if (running) frame = requestAnimationFrame(draw);
    else cancelAnimationFrame(frame);
  }

  resize();
  draw(0);
  if (!reduce) setRunning(true);

  const root = document.querySelector(".prlx");
  const hero = document.getElementById("top");
  if (hero) {
    observer = new IntersectionObserver(
      ([entry]) => setRunning(!reduce && entry.isIntersecting && !document.hidden),
      { root, threshold: 0 },
    );
    observer.observe(hero);
  }

  onVisibility = () => setRunning(!reduce && !document.hidden && running !== false && !document.hidden);
  document.addEventListener("visibilitychange", () => {
    const visible = !document.hidden;
    const heroVisible = !hero || hero.getBoundingClientRect().bottom > 0;
    setRunning(!reduce && visible && heroVisible);
  });
  window.addEventListener("resize", resize);
  el._cleanup = () => window.removeEventListener("resize", resize);
});

onUnmounted(() => {
  cancelAnimationFrame(frame);
  observer?.disconnect();
  canvas.value?._cleanup?.();
});
</script>

<template>
  <canvas ref="canvas" class="stars" aria-hidden="true"></canvas>
</template>

<style scoped>
.stars {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
}
</style>
