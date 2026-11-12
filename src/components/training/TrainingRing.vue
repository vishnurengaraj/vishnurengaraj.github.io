<script setup>
import { computed } from "vue";

const props = defineProps({
  frac: { type: Number, default: 0 },
  size: { type: Number, default: 112 },
  stroke: { type: Number, default: 10 },
  color: { type: String, default: "#ffb020" },
});
const r = computed(() => (props.size - props.stroke) / 2);
const c = computed(() => 2 * Math.PI * r.value);
const f = computed(() => Math.max(0, Math.min(1, props.frac || 0)));
</script>

<template>
  <svg class="ring" :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`" aria-hidden="true" :data-frac="f.toFixed(3)">
    <circle :cx="size / 2" :cy="size / 2" :r="r" fill="none" stroke="#efe6de" :stroke-width="stroke" />
    <circle
      v-if="f > 0"
      class="ring-fill"
      :cx="size / 2"
      :cy="size / 2"
      :r="r"
      fill="none"
      :stroke="color"
      :stroke-width="stroke"
      stroke-linecap="round"
      :stroke-dasharray="`${(c * f).toFixed(2)} ${c.toFixed(2)}`"
      :transform="`rotate(-90 ${size / 2} ${size / 2})`"
    />
  </svg>
</template>
