<script setup>
import { onMounted, onUnmounted, ref } from "vue";
import ResponsiveImg from "./ResponsiveImg.vue";

const props = defineProps({
  item: { type: Object, required: true },
});

const videoEl = ref(null);
const poster = ref("");
let observer;

function attachSources(video) {
  if (video.dataset.armed === "true") return;
  video.dataset.armed = "true";
  poster.value = props.item.poster;
  const sources = [
    { src: props.item.webm, type: "video/webm" },
    { src: props.item.mp4, type: "video/mp4" },
  ];
  for (const item of sources) {
    if (!item.src) continue;
    const node = document.createElement("source");
    node.src = item.src;
    node.type = item.type;
    video.appendChild(node);
  }
  video.load();
}

onMounted(() => {
  const video = videoEl.value;
  if (!video) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const root = document.querySelector(".prlx");
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const visible = entry.isIntersecting && entry.intersectionRatio >= 0.45;
        if (!visible) {
          video.pause();
          continue;
        }
        if (reduce) {
          poster.value = props.item.poster;
          continue;
        }
        attachSources(video);
        video.play().catch(() => {});
      }
    },
    { root, threshold: [0, 0.45, 0.8] },
  );
  observer.observe(video);
  if (reduce) {
    video.addEventListener(
      "play",
      () => {
        attachSources(video);
      },
      { once: true },
    );
  }
});

onUnmounted(() => observer?.disconnect());
</script>

<template>
  <div v-if="item.kind === 'logo'" class="logo-plate">
    <ResponsiveImg :image="item.image" :alt="item.alt" sizes="(max-width: 800px) 78vw, 420px" />
  </div>
  <video
    v-else-if="item.kind === 'video'"
    ref="videoEl"
    controls
    muted
    loop
    playsinline
    preload="none"
    :poster="poster"
    :width="item.w"
    :height="item.h"
    :aria-label="item.alt"
  >
    <track kind="captions" src="/captions/no-speech.vtt" srclang="en" label="English" default />
  </video>
  <ResponsiveImg
    v-else
    class="photo-frame"
    :image="item.image"
    :alt="item.alt"
    sizes="(max-width: 800px) 92vw, 720px"
  />
</template>
