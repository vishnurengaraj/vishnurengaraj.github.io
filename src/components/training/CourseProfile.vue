<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { fmt0 } from "../../training/view.js";

const props = defineProps({
  course: { type: Object, required: true },
  height: { type: Number, default: 240 },
  /** Short version: no section list, no scrubbing readout. */
  compact: { type: Boolean, default: false },
  rehearsed: { type: Boolean, default: false },
});

const box = ref(null);
const W = ref(0);
const picked = ref(-1);
const cursorMi = ref(null);
let ro = null;

onMounted(() => {
  const measure = () => {
    const w = Math.round(box.value?.clientWidth || 0);
    if (w && w !== W.value) W.value = w;
  };
  ro = new ResizeObserver(measure);
  ro.observe(box.value);
  measure();
});
onUnmounted(() => ro?.disconnect());

const LO = 400;
const HI = 1800;
const PAD = { l: 40, r: 8, t: 26, b: 24 };
const total = computed(() => props.course.officialMiles);
const H = computed(() => Math.round(Math.min(props.height, Math.max(props.compact ? 120 : 170, W.value * 0.4))));
const narrow = computed(() => W.value < 600);
const x = (mi) => PAD.l + (mi / total.value) * (W.value - PAD.l - PAD.r);
const y = (ft) => PAD.t + (1 - (ft - LO) / (HI - LO)) * (H.value - PAD.t - PAD.b);
const toPath = (pts) => pts.map((p, i) => `${i ? "L" : "M"}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join("");

const line = computed(() => (W.value ? toPath(props.course.profile) : ""));
const area = computed(() => (W.value ? `${line.value}L${x(total.value)},${y(LO)}L${x(0)},${y(LO)}Z` : ""));
const sections = computed(() =>
  props.course.sections.map((s) => ({
    ...s,
    x0: x(s.from),
    x1: x(s.to),
    d: toPath(props.course.profile.filter((p) => p[0] >= s.from - 1e-9 && p[0] <= s.to + 1e-9)),
  })),
);
const grid = [600, 1000, 1400];
const ticks = [0, 5, 10, 15, 20, 25, 30];
const aids = computed(() => props.course.aids.slice(1, -1));
const point = computed(() => {
  if (cursorMi.value == null) return null;
  const p = props.course.profile[Math.round(cursorMi.value * 10)] || props.course.profile.at(-1);
  const sec = props.course.sections.find((s) => p[0] >= s.from && p[0] <= s.to);
  return { mi: p[0], ft: p[1], sec };
});
const readout = computed(() =>
  point.value
    ? `Mile ${point.value.mi.toFixed(1)} · ${fmt0(point.value.ft)} ft${point.value.sec ? ` · ${point.value.sec.name}` : ""}`
    : "Drag across the profile, or use the arrow keys, to read mile and elevation.",
);
const label = computed(
  () =>
    `Way Too Cool 50K elevation profile, ${total.value} miles, ${fmt0(props.course.gainFt)} feet of gain. Marked: ` +
    props.course.sections.map((s) => `${s.name.toLowerCase()} miles ${s.from} to ${s.to}`).join(", ") +
    ".",
);

function scrub(e) {
  const r = e.currentTarget.getBoundingClientRect();
  const mi = (((e.clientX - r.left) / r.width) * W.value - PAD.l) / (W.value - PAD.l - PAD.r) * total.value;
  cursorMi.value = Math.max(0, Math.min(total.value, mi));
}
function key(e) {
  const step = e.shiftKey ? 1 : 0.1;
  const now = cursorMi.value ?? 0;
  let next = null;
  if (e.key === "ArrowRight") next = now + step;
  else if (e.key === "ArrowLeft") next = now - step;
  else if (e.key === "Home") next = 0;
  else if (e.key === "End") next = total.value;
  if (next == null) return;
  e.preventDefault();
  cursorMi.value = Math.max(0, Math.min(total.value, Math.round(next * 10) / 10));
}
function pick(i) {
  picked.value = picked.value === i ? -1 : i;
  if (picked.value >= 0) {
    const s = props.course.sections[i];
    cursorMi.value = Math.round(((s.from + s.to) / 2) * 10) / 10;
  }
}
</script>

<template>
  <div class="profile" :class="{ compact }">
    <div ref="box" class="profile-box" :style="{ height: `${W ? H : compact ? 120 : 200}px` }">
      <svg
        v-if="W"
        :viewBox="`0 0 ${W} ${H}`"
        :width="W"
        :height="H"
        role="img"
        :aria-label="label"
        :tabindex="compact ? -1 : 0"
        @pointermove="scrub"
        @pointerdown="scrub"
        @keydown="key"
      >
        <g v-for="f in grid" :key="f">
          <line :x1="PAD.l" :x2="W - PAD.r" :y1="y(f)" :y2="y(f)" stroke="#efe6de" />
          <text :x="PAD.l - 6" :y="y(f) + 4" text-anchor="end" class="pax">{{ fmt0(f) }}</text>
        </g>
        <g v-for="a in aids" :key="a[1]">
          <line :x1="x(a[0])" :x2="x(a[0])" :y1="PAD.t - 4" :y2="y(LO)" stroke="#d9cabd" stroke-dasharray="2 3" />
          <text :x="x(a[0])" :y="PAD.t - 10" text-anchor="middle" class="paid">{{ narrow ? a[2] : a[1] }}</text>
        </g>
        <path :d="area" fill="#f6efe8" />
        <g v-for="(s, i) in sections" :key="s.name" class="sec">
          <rect
            :x="s.x0"
            :y="PAD.t"
            :width="s.x1 - s.x0"
            :height="y(LO) - PAD.t"
            :fill="s.kind === 'down' ? '#2d1d7a' : '#ffb020'"
            :opacity="picked === i ? 0.28 : 0.1"
            class="sec-band"
          />
          <path :d="s.d" fill="none" :stroke="s.kind === 'down' ? '#2d1d7a' : '#c2410c'" stroke-width="4" stroke-linecap="round" />
        </g>
        <path :d="line" fill="none" stroke="#3f3834" stroke-width="1.6" />
        <template v-if="point">
          <line :x1="x(point.mi)" :x2="x(point.mi)" :y1="PAD.t" :y2="y(LO)" stroke="#2d1d7a" stroke-width="1.5" />
          <circle :cx="x(point.mi)" :cy="y(point.ft)" r="6" fill="#2d1d7a" />
        </template>
        <text v-for="m in ticks" :key="m" :x="x(m)" :y="H - 6" text-anchor="middle" class="pax">{{ m }}</text>
      </svg>
    </div>
    <p v-if="!compact" class="readout" aria-live="polite">{{ readout }}</p>
    <ul v-if="!compact" class="sec-list">
      <li v-for="(s, i) in course.sections" :key="s.name">
        <button type="button" :aria-pressed="picked === i ? 'true' : 'false'" @click="pick(i)">
          <span class="sn">{{ s.name }}</span>
          <span class="sm num">mi {{ s.from }}–{{ s.to }}</span>
          <span class="sm num">{{ s.change }}</span>
          <span class="sp">
            {{ s.grade }}. {{ s.practice }}.
            <span v-if="rehearsed" class="rh">Rehearsed: {{ s.rehearsed }}</span>
          </span>
        </button>
      </li>
    </ul>
  </div>
</template>
