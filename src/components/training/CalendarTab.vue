<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";
import DayDetail from "./DayDetail.vue";
import { MON, MONTH, WD, fmt0, fmt1, fmtDate, monthDay, ms, rangeText, readinessShade, roleWord } from "../../training/view.js";

const props = defineProps({ m: { type: Object, required: true } });
const m = props.m;

/* Months the plan touches, oldest first. */
const months = (() => {
  const out = [];
  const seen = new Set();
  for (const d of m.days) {
    const k = d.date.slice(0, 7);
    if (!seen.has(k)) {
      seen.add(k);
      out.push([+k.slice(0, 4), +k.slice(5, 7) - 1]);
    }
  }
  return out;
})();
const mi = ref(Math.max(0, months.findIndex(([y, mo]) => m.asOf.startsWith(`${y}-${String(mo + 1).padStart(2, "0")}`))));
const selW = ref(m.current.week);
const selD = ref(m.dayByDate[m.asOf] ? m.asOf : null);
const showReady = ref(false);
const sheet = ref(null);
const sheetOpen = ref(false);
let opener = null;

const title = computed(() => `${MONTH[months[mi.value][1]]} ${months[mi.value][0]}`);
const rows = computed(() => {
  const [y, mo] = months[mi.value];
  const first = Date.UTC(y, mo, 1);
  const last = Date.UTC(y, mo + 1, 0);
  return m.weeks
    .filter((w) => ms(w.start) <= last && ms(w.end) >= first)
    .map((w) => {
      const a = m.progress[w.week];
      return {
        w,
        a,
        pct: Math.min(1, a.mi / w.miles),
        status: a.state === "future" ? `${w.miles} mi target` : `${fmt1(a.mi)} of ${w.miles} mi`,
        days: w.days.map((d) => {
          const t = ms(d.date);
          return { d, inMonth: t >= first && t <= last, ac: m.actual(d.date), r: m.ready[d.date] };
        }),
      };
    });
});

function chipClass(d) {
  if (d.date === m.race.date) return "race";
  if (d.role === "Key") return "plan key";
  if (d.role === "Optional") return "plan opt";
  return d.mi ? "plan" : "plan rest";
}
function shortChip(d) {
  if (d.date === m.race.date) return "Race";
  return d.mi ? d.miText.replace("–", "-") : "·";
}
function dayLabel(x) {
  return `${fmtDate(x.d.date)}: ${roleWord(x.d.role)}, ${m.chipText(x.d)}${x.ac.mi ? `, logged ${fmt1(x.ac.mi)} mi` : ""}${x.r ? `, readiness ${x.r.score}` : ""}`;
}

const isDesk = () => window.matchMedia("(min-width: 900px)").matches;
function pickWeek(w, e) {
  selW.value = w.week;
  selD.value = null;
  openSheet(e);
}
function pickDay(d, e) {
  selD.value = d.date;
  selW.value = m.dayByDate[d.date].week;
  openSheet(e);
}
function openSheet(e) {
  if (isDesk()) return;
  opener = e?.currentTarget || null;
  sheetOpen.value = true;
  nextTick(() => {
    if (sheet.value && !sheet.value.open) sheet.value.showModal();
  });
}
function closeSheet() {
  sheet.value?.close();
}
function onClose() {
  sheetOpen.value = false;
  opener?.focus?.({ preventScroll: true });
}
function backdrop(e) {
  if (e.target === sheet.value) closeSheet();
}
function onResize() {
  if (isDesk() && sheet.value?.open) closeSheet();
}
onMounted(() => window.addEventListener("resize", onResize));
onUnmounted(() => window.removeEventListener("resize", onResize));

const pw = computed(() => m.weeks[selW.value - 1]);
const pa = computed(() => m.progress[selW.value]);
const pRace = computed(() => m.isRaceWeek(pw.value));
const targets = computed(() => {
  const w = pw.value;
  const a = pa.value;
  const fut = a.state === "future";
  const vertTxt = pRace.value ? `race ${fmt0(m.race.gainFt)} ft` : `${fmt0(w.vertLo)}–${fmt0(w.vertHi)} ft`;
  return [
    { id: "miles", label: "Miles", val: fut ? `${w.miles} mi` : `${fmt1(a.mi)} / ${w.miles}`, frac: a.mi / w.miles },
    { id: "vert", label: "Vert", val: fut ? vertTxt : `${fmt0(a.ft)} / ${vertTxt}`, frac: a.ft / w.vertLo },
    {
      id: "long",
      label: "Long run",
      val: pRace.value ? `race ${m.race.miles} mi` : fut ? `${w.long} mi` : `longest ${fmt1(a.longest)} / ${w.long} mi`,
      frac: pRace.value ? 0 : a.longest / w.long,
    },
  ];
});
const sheetTitle = computed(() => (selD.value ? fmtDate(selD.value) : `Week ${selW.value}`));
</script>

<template>
  <div class="tab-cal">
    <div class="layout">
      <section class="tcard cal" aria-labelledby="cal-title">
        <div class="cal-head">
          <button class="iconbtn" type="button" aria-label="Previous month" :disabled="mi === 0" @click="mi--">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <h2 id="cal-title" aria-live="polite">{{ title }}</h2>
          <button class="iconbtn" type="button" aria-label="Next month" :disabled="mi === months.length - 1" @click="mi++">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
          </button>
          <div class="months" role="group" aria-label="Jump to month">
            <button
              v-for="(mo, i) in months"
              :key="i"
              type="button"
              class="btn"
              :aria-pressed="i === mi ? 'true' : 'false'"
              @click="mi = i"
            >
              {{ MON[mo[1]] }}
            </button>
          </div>
        </div>
        <div class="tools">
          <div class="legend">
            <span><i class="sw-plan"></i>Suggested</span>
            <span><i class="sw-key"></i>Key session</span>
            <span><i class="sw-done"></i>Logged</span>
          </div>
          <label class="toggle"><input v-model="showReady" type="checkbox" />Readiness overlay</label>
        </div>
        <p v-if="showReady" class="label rleg">
          Readiness is Garmin’s morning score. The bar is darker when it’s higher. Only mornings with data show one.
        </p>
        <div class="grid" :class="{ 'show-ready': showReady }">
          <div class="wd corner">Week</div>
          <div v-for="d in WD" :key="d" class="wd" aria-hidden="true">{{ d }}</div>
          <template v-for="row in rows" :key="row.w.week">
            <button
              type="button"
              class="wk"
              :aria-pressed="row.w.week === selW && !selD ? 'true' : 'false'"
              :aria-label="`Week ${row.w.week}, ${row.w.phase}, ${row.status}`"
              @click="pickWeek(row.w, $event)"
            >
              <span class="wn">W{{ row.w.week }} · {{ row.w.phase }}</span>
              <span class="wt num">{{ row.status }}</span>
              <span class="wt num mobile-only">long {{ m.isRaceWeek(row.w) ? "race" : `${row.w.long} mi` }} · {{ row.w.vertText }}</span>
              <span class="bar"><i :style="{ width: `${(row.pct * 100).toFixed(1)}%` }"></i></span>
            </button>
            <template v-for="x in row.days" :key="x.d.date">
              <div v-if="!x.inMonth" class="day out" aria-hidden="true"></div>
              <button
                v-else
                type="button"
                class="day"
                :class="{ today: x.d.date === m.asOf }"
                :data-date="x.d.date"
                :aria-pressed="x.d.date === selD ? 'true' : 'false'"
                :aria-label="dayLabel(x)"
                @click="pickDay(x.d, $event)"
              >
                <span class="dn">{{ +x.d.date.slice(8) }}</span>
                <span class="chip" :class="chipClass(x.d)"><span class="long">{{ m.chipText(x.d) }}</span><span class="short">{{ shortChip(x.d) }}</span></span>
                <span v-if="x.ac.list.length" class="chip done num">{{ fmt1(x.ac.mi) }}<span class="long"> mi</span></span>
                <template v-if="x.r">
                  <span class="rd num">R {{ x.r.score }}</span>
                  <span class="rdbar" :style="{ background: readinessShade(x.r.score) }"></span>
                </template>
              </button>
            </template>
          </template>
        </div>
        <p class="label cal-foot">Week bars fill with logged miles against that week’s target. Data as of {{ fmtDate(m.asOf) }}.</p>
      </section>
      <aside class="tcard panel" aria-live="polite">
        <div class="panel-body">
          <p class="label">Week {{ pw.week }} · {{ rangeText(pw.start, pw.end) }} · {{ pw.phase }}</p>
          <h2 class="num">{{ pa.state === "future" ? `${pw.miles} miles planned` : `${fmt1(pa.mi)} of ${pw.miles} miles` }}</h2>
          <p v-if="pa.state === 'current'" class="muted num">{{ fmt1(Math.max(0, pw.miles - pa.mi)) }} mi to go across {{ pa.daysLeft }} days. Any order works.</p>
          <div class="targets">
            <div v-for="t in targets" :key="t.id" class="tg">
              <span class="tl">{{ t.label }}</span>
              <span class="tv num">{{ t.val }}</span>
              <span class="bar"><i :style="{ width: `${(Math.min(1, t.frac) * 100).toFixed(1)}%` }"></i></span>
            </div>
            <div class="tg">
              <span class="tl">Key session</span>
              <span class="tv">{{ pa.key.done ? "done" : pa.state === "current" ? "not yet" : "" }}</span>
              <span class="tk">{{ pw.key }}</span>
            </div>
          </div>
          <p class="note">{{ pw.note }}</p>
          <div v-if="selD" class="dd"><DayDetail :m="m" :date="selD" /></div>
        </div>
      </aside>
    </div>
    <dialog v-if="sheetOpen" ref="sheet" class="tsheet" aria-labelledby="sh-title" @close="onClose" @click="backdrop">
      <div class="sheet-head">
        <h2 id="sh-title">{{ sheetTitle }}</h2>
        <button class="iconbtn" type="button" aria-label="Close" @click="closeSheet">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
      <div class="sheet-body">
        <p class="label">Week {{ pw.week }} · {{ rangeText(pw.start, pw.end) }} · {{ pw.phase }}</p>
        <div class="targets">
          <div v-for="t in targets" :key="t.id" class="tg">
            <span class="tl">{{ t.label }}</span>
            <span class="tv num">{{ t.val }}</span>
            <span class="bar"><i :style="{ width: `${(Math.min(1, t.frac) * 100).toFixed(1)}%` }"></i></span>
          </div>
          <div class="tg">
            <span class="tl">Key session</span>
            <span class="tv">{{ pa.key.done ? "done" : pa.state === "current" ? "not yet" : "" }}</span>
            <span class="tk">{{ pw.key }}</span>
          </div>
        </div>
        <DayDetail v-if="selD" :m="m" :date="selD" />
        <p v-else class="note">{{ pw.note }}</p>
      </div>
    </dialog>
  </div>
</template>
