<script setup>
import { computed, ref } from "vue";
import { VARIANTS, variantById } from "../title-proto.js";

const props = defineProps({
  variant: { type: String, required: true },
});

const emit = defineEmits(["pick", "scrub"]);

const open = ref(true);
const rangeEl = ref(null);
const readEl = ref(null);
let sliding = false;

const meta = computed(() => variantById(props.variant) || VARIANTS[0]);

function onRange(event) {
  emit("scrub", Number(event.target.value) / 1000);
}

function setReadout(info) {
  if (readEl.value) {
    const fmt = (n) => (n > 0 ? `+${n}` : String(n));
    readEl.value.textContent = `FG lead ${info.lead}px · l1 ${fmt(info.rate)} · l7 ${fmt(info.far)}`;
  }
  if (rangeEl.value && !sliding) {
    rangeEl.value.value = String(Math.round(info.progress * 1000));
  }
}

defineExpose({ setReadout });
</script>

<template>
  <aside class="title-proto" :class="{ 'is-shut': !open }" :data-variant="variant">
    <div class="proto-top">
      <p class="proto-kicker">
        Title prototypes
        <span class="proto-current">{{ meta.label }} · {{ meta.short }}</span>
      </p>
      <button type="button" class="proto-hide" @click="open = !open">
        {{ open ? "Hide" : "Show" }}
      </button>
    </div>
    <div v-show="open" class="proto-body">
      <div class="proto-picks" role="radiogroup" aria-label="Title scroll variant">
        <button
          v-for="item in VARIANTS"
          :key="item.id"
          type="button"
          role="radio"
          class="proto-pick"
          :class="{ 'is-on': item.id === variant }"
          :aria-checked="item.id === variant ? 'true' : 'false'"
          @click="emit('pick', item.id)"
        >
          <b>{{ item.label }}</b>
          <span>{{ item.short }}</span>
        </button>
      </div>
      <p class="proto-note">{{ meta.blurb }}</p>
      <p v-if="meta.warn" class="proto-warn">{{ meta.warn }}</p>
      <label class="proto-scrub">
        <span>Sunrise</span>
        <input
          ref="rangeEl"
          type="range"
          min="0"
          max="1000"
          step="1"
          value="0"
          aria-label="Sunrise progress"
          @pointerdown="sliding = true"
          @pointerup="sliding = false"
          @pointercancel="sliding = false"
          @input="onRange"
          @change="onRange"
        />
      </label>
      <div class="proto-row">
        <button type="button" class="proto-jump" @click="emit('scrub', 0)">Top</button>
        <button type="button" class="proto-jump" @click="emit('scrub', 'mid')">Meet</button>
      </div>
      <p ref="readEl" class="proto-read">FG lead 0px · l1 -0.62 · l7 -0.04</p>
    </div>
  </aside>
</template>

<style scoped>
.title-proto {
  position: fixed;
  z-index: 40;
  top: 10px;
  right: 10px;
  width: min(392px, calc(100vw - 20px));
  padding: 10px 12px 12px;
  border-radius: 16px;
  background: rgba(26, 16, 51, 0.92);
  color: #fff;
  font-family: "Roboto", "Segoe UI", sans-serif;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28);
  pointer-events: auto;
}

.title-proto.is-shut {
  width: auto;
  padding-bottom: 10px;
}

.proto-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.proto-kicker {
  margin: 0;
  font-size: 12px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.72);
}

.proto-current {
  display: block;
  margin-top: 2px;
  font-size: 14px;
  letter-spacing: 0;
  text-transform: none;
  color: #ffb020;
  font-weight: 700;
}

.proto-hide,
.proto-jump,
.proto-pick {
  font: inherit;
  cursor: pointer;
}

.proto-hide,
.proto-jump {
  border: 1px solid rgba(255, 255, 255, 0.28);
  background: transparent;
  color: #fff;
  border-radius: 999px;
  min-height: 32px;
  padding: 0 12px;
}

.proto-body {
  margin-top: 10px;
}

.proto-picks {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.proto-pick {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  min-width: 68px;
  min-height: 44px;
  padding: 6px 8px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: rgba(255, 255, 255, 0.04);
  color: #fff;
  text-align: left;
}

.proto-pick b {
  font-size: 13px;
  line-height: 1.1;
}

.proto-pick span {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.72);
}

.proto-pick.is-on {
  background: #ffb020;
  border-color: #ffb020;
  color: #1f1f1f;
}

.proto-pick.is-on span {
  color: #1f1f1f;
}

.proto-note,
.proto-warn,
.proto-read {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.35;
}

.proto-warn {
  color: #ffb020;
}

.proto-scrub {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  font-size: 12px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.72);
}

.proto-scrub input {
  flex: 1;
  min-width: 0;
  accent-color: #ffb020;
}

.proto-row {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}

.proto-read {
  font-family: "Roboto Mono", ui-monospace, monospace;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.86);
}

@media (max-width: 700px) {
  .title-proto {
    top: auto;
    bottom: 10px;
    left: 10px;
    right: 10px;
    width: auto;
  }

  .title-proto.is-shut {
    left: auto;
    width: auto;
  }
}

@media print {
  .title-proto {
    display: none;
  }
}
</style>
