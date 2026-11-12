<script setup>
import { computed } from "vue";
import { fmt0, fmt1, fmtDate, roleWord, sleepText } from "../../training/view.js";

const props = defineProps({ m: { type: Object, required: true }, date: { type: String, required: true } });
const d = computed(() => props.m.dayByDate[props.date]);
const w = computed(() => props.m.weeks[d.value.week - 1]);
const a = computed(() => props.m.actual(props.date));
const r = computed(() => props.m.ready[props.date] || null);
const when = computed(() => (props.date < props.m.asOf ? "past" : props.date === props.m.asOf ? "today" : "future"));
</script>

<template>
  <div class="day-detail">
    <p class="label">{{ fmtDate(date) }} · Week {{ w.week }} · {{ w.phase }}<template v-if="when === 'today'"> · today</template></p>
    <p class="dd-sess"><span class="dd-role" :class="`role-${d.role}`">{{ roleWord(d.role) }}</span> {{ d.session }}</p>
    <p class="dd-purp">{{ d.purpose }}</p>
    <template v-if="a.list.length">
      <h3 class="dd-h">Logged</h3>
      <p v-for="x in a.list" :key="x.id" class="act">
        <span class="act-chip num">{{ fmt1(x.mi) }} mi</span>
        {{ x.title }} · {{ x.time }}<template v-if="x.hr"> · avg HR {{ x.hr }}</template> · {{ fmt0(x.ft) }} ft
        <a v-if="x.url" :href="x.url" rel="noopener" target="_blank">{{ x.src === "Garmin" ? "Garmin" : "Strava" }}</a>
      </p>
    </template>
    <p v-else-if="when !== 'past' && d.mi" class="muted dd-note">Suggested. Move it to any day that suits the week.</p>
    <template v-if="r">
      <h3 class="dd-h">Morning check-in</h3>
      <p class="ready-line num">
        Readiness {{ r.score }}<template v-if="r.level"> ({{ r.level }})</template>
        <template v-if="r.hrv"> · HRV 7-day {{ r.hrv }} ms</template>
        <template v-if="r.sleep"> · Sleep {{ r.sleep }}, {{ sleepText(r.sleepMin) }}</template>
      </p>
    </template>
  </div>
</template>
