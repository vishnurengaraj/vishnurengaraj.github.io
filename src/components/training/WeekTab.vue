<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";
import CourseProfile from "./CourseProfile.vue";
import TrainingRing from "./TrainingRing.vue";
import { MON, WD, fmt0, fmt1, fmtDate, monthDay, ms, rangeText } from "../../training/view.js";

const props = defineProps({ m: { type: Object, required: true } });
const emit = defineEmits(["go"]);
const m = props.m;

const sel = ref(m.current.week);
const strip = ref(null);
const week = computed(() => m.weeks[sel.value - 1]);
const p = computed(() => m.progress[sel.value]);
const future = computed(() => p.value.state === "future");
const race = computed(() => m.isRaceWeek(week.value));

/* Session moves live only in this tab's memory. Nothing is saved. */
const moves = reactive({});
const weekMoves = computed(() => Object.keys(moves).filter((k) => k.startsWith(`${sel.value}:`)));

const head = computed(() => (future.value ? `${week.value.miles} miles` : `${fmt1(p.value.mi)} of ${week.value.miles} miles`));
const lead = computed(() => {
  if (p.value.state === "current") {
    const left = Math.max(0, week.value.miles - p.value.mi);
    return `${fmt1(left)} miles to go across ${p.value.daysLeft} ${p.value.daysLeft === 1 ? "day" : "days"}. The long run is the one to protect; the rest can shift or drop.`;
  }
  if (p.value.state === "past") return "Short weeks stay short. The next week does not make up miles.";
  const note = week.value.note.split(". ").slice(0, 2).join(". ");
  return note.endsWith(".") ? note : `${note}.`;
});

const rings = computed(() => {
  const w = week.value;
  const a = p.value;
  const fut = future.value;
  const keyD = m.keyDay(w);
  const k = a.key;
  return [
    {
      id: "miles",
      name: "Miles",
      frac: a.mi / w.miles,
      big: fut ? String(w.miles) : fmt1(a.mi),
      small: fut ? "mi target" : `of ${w.miles} mi`,
      sub: "Weekly total, any days",
    },
    {
      id: "vert",
      name: "Vert",
      frac: a.ft / w.vertLo,
      big: fut ? fmt0(w.vertLo) : fmt0(a.ft),
      small: fut ? `to ${fmt0(w.vertHi)} ft` : `of ${fmt0(w.vertLo)}+ ft`,
      sub: race.value ? `Race ${fmt0(m.race.gainFt)} ft` : `${fmt0(w.vertLo)}–${fmt0(w.vertHi)} ft`,
    },
    {
      id: "long",
      name: "Long run",
      frac: race.value ? 0 : a.longest / w.long,
      big: race.value ? String(m.race.miles) : fut ? String(w.long) : fmt1(a.longest),
      small: race.value ? "race" : fut ? "mi" : `of ${w.long} mi`,
      sub: fut || race.value ? "One run" : "Longest single run so far",
    },
    {
      id: "key",
      name: "Key session",
      frac: k.done ? 1 : 0,
      color: "#2d1d7a",
      big: k.done ? "Done" : race.value ? "Sat" : keyD ? WD[(new Date(ms(keyD.date)).getUTCDay() + 6) % 7] : "",
      small: k.done ? monthDay(k.by.date) : race.value ? monthDay(m.race.date) : keyD ? monthDay(keyD.date) : "",
      sub: w.key,
      rule: race.value ? "Counts when the race is logged" : `Counts when a run besides the longest climbs ${fmt0(k.threshold)}+ ft`,
    },
  ];
});

const readiness = computed(() =>
  week.value.days.map((d) => ({ d, r: m.ready[d.date] })).filter((x) => x.r),
);

const dayCols = computed(() => {
  const w = week.value;
  const slots = w.days.map(() => []);
  w.days.forEach((d, i) => {
    const to = moves[`${w.week}:${i}`] ?? i;
    slots[to].push({ s: d, from: i, moved: to !== i });
  });
  return w.days.map((d, i) => {
    const ac = m.actual(d.date);
    const sugs = slots[i].filter(({ s, moved }) => (s.mi || s.date === m.race.date) && (moved || !m.actual(s.date).list.length));
    const away = moves[`${w.week}:${i}`];
    return {
      d,
      i,
      ac,
      r: m.ready[d.date],
      sugs,
      restText: !sugs.length && !ac.list.length ? (away !== undefined ? `Moved to ${WD[away]}` : d.session) : "",
    };
  });
});

function sugClass(s) {
  return s.role === "Key" ? "key" : s.role === "Optional" ? "opt" : "";
}
function canMove(s) {
  return s.date > m.asOf && s.date !== m.race.date;
}
function moveTo(from, to) {
  const k = `${sel.value}:${from}`;
  if (to === from) delete moves[k];
  else moves[k] = to;
}
function undo() {
  for (const k of weekMoves.value) delete moves[k];
}

function weekLabel(w) {
  const a = m.progress[w.week];
  return `Week ${w.week}, ${monthDay(w.start)} to ${monthDay(w.end)}, ${w.miles} miles${a.state !== "future" ? `, ${fmt1(a.mi)} logged` : ""}`;
}
function centerStrip() {
  const el = strip.value?.querySelector('[aria-current="true"]');
  if (!el || !strip.value) return;
  const box = strip.value;
  box.scrollLeft = el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2;
}
onMounted(() => nextTick(centerStrip));
watch(sel, () => nextTick(centerStrip));
function stripKey(e) {
  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
  e.preventDefault();
  sel.value = Math.max(1, Math.min(m.weeks.length, sel.value + (e.key === "ArrowRight" ? 1 : -1)));
  nextTick(() => strip.value?.querySelector('[aria-current="true"]')?.focus());
}
</script>

<template>
  <div class="tab-week">
    <div class="strip-head">
      <h2>{{ m.weeks.length }} weeks to Cool</h2>
      <span class="label">Pick a week, or use the arrow keys. Rings fill with logged miles.</span>
    </div>
    <nav ref="strip" class="strip" aria-label="Training weeks" @keydown="stripKey">
      <button
        v-for="w in m.weeks"
        :key="w.week"
        type="button"
        class="wkb"
        :class="{ cut: /Cutback|Taper/.test(w.phase) }"
        :aria-current="w.week === sel ? 'true' : 'false'"
        :tabindex="w.week === sel ? 0 : -1"
        :aria-label="weekLabel(w)"
        :data-week="w.week"
        @click="sel = w.week"
      >
        <span class="wl">W{{ w.week }}</span>
        <TrainingRing :frac="m.progress[w.week].mi / w.miles" :size="36" :stroke="5" />
        <span class="wm num">{{ w.miles }}</span>
        <span class="wl">{{ MON[new Date(ms(w.start)).getUTCMonth()] }} {{ new Date(ms(w.start)).getUTCDate() }}</span>
      </button>
    </nav>

    <div class="hero">
      <section class="tcard week" aria-live="polite" :aria-label="`Week ${week.week} targets`">
        <p class="label">Week {{ week.week }} · {{ rangeText(week.start, week.end) }} · {{ week.phase }}</p>
        <h2 class="week-head num">{{ head }}</h2>
        <p class="week-lead">{{ lead }}</p>
        <div class="rings">
          <div v-for="r in rings" :key="r.id" class="rg" :data-ring="r.id">
            <div class="rw">
              <TrainingRing :frac="r.frac" :color="r.color || '#ffb020'" />
              <div class="rv">
                <b class="num">{{ r.big }}</b>
                <span class="num">{{ r.small }}</span>
              </div>
            </div>
            <span class="rn">{{ r.name }}</span>
            <span class="rs">{{ r.sub }}</span>
            <span v-if="r.rule" class="rr">{{ r.rule }}</span>
          </div>
        </div>
      </section>
      <div class="side">
        <section class="tcard rdy" aria-labelledby="rdy-h">
          <h2 id="rdy-h">Readiness this week</h2>
          <template v-if="readiness.length">
            <div v-for="{ d, r } in readiness" :key="d.date" class="rdy-row">
              <span>{{ fmtDate(d.date).slice(0, 3) }} {{ +d.date.slice(8) }}</span>
              <span class="bar" role="img" :aria-label="`Readiness ${r.score} of 100`"><i :style="{ width: `${r.score}%` }"></i></span>
              <span class="num">{{ r.score }}</span>
            </div>
            <p class="muted num">
              <template v-if="readiness.at(-1).r.hrv">HRV 7-day {{ readiness.at(-1).r.hrv }} ms, {{ readiness.at(-1).r.hrvStatus.toLowerCase() }}. </template>A low morning moves the key session. It doesn’t cancel the week.
            </p>
          </template>
          <p v-else class="muted">Fills in each morning once the week starts.</p>
        </section>
      </div>
    </div>

    <div class="days-head">
      <h2>Suggested days</h2>
      <p>Move any session to a day that fits. Moves last until you leave the page.</p>
      <button v-if="weekMoves.length" type="button" class="btn reset" @click="undo">Undo moves</button>
    </div>
    <div class="days">
      <article v-for="c in dayCols" :key="c.d.date" class="dc" :class="{ today: c.d.date === m.asOf }" :data-date="c.d.date">
        <div class="dh">
          <b>{{ WD[c.i] }} {{ +c.d.date.slice(8) }}</b>
          <span v-if="c.d.date === m.asOf" class="tday">today</span>
        </div>
        <div v-for="x in c.ac.list" :key="x.id" class="log">
          <b class="num">{{ fmt1(x.mi) }} mi logged</b>
          <span class="tx">{{ x.title }} · {{ x.time }}<template v-if="x.hr"> · HR {{ x.hr }}</template> · {{ fmt0(x.ft) }} ft</span>
          <a v-if="x.url" :href="x.url" target="_blank" rel="noopener" class="slink">View on {{ x.src }}</a>
        </div>
        <div v-for="{ s, from, moved } in c.sugs" :key="s.date" class="sug" :class="[sugClass(s), { moved }]">
          <b>{{ m.chipText(s) }}</b>
          <span class="tx">{{ s.session }}</span>
          <label v-if="canMove(s)" class="mv">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M7 7h13l-3-3M17 17H4l3 3" /></svg>
            <select :aria-label="`Move ${m.chipText(s)} from ${WD[from]} to another day`" :value="c.i" @change="moveTo(from, +$event.target.value)">
              <option v-for="(x, j) in week.days" :key="x.date" :value="j" :disabled="x.date <= m.asOf">{{ WD[j] }}</option>
            </select>
          </label>
          <span v-if="moved" class="mv">from {{ WD[from] }}</span>
        </div>
        <p v-if="c.restText" class="restx">{{ c.restText }}</p>
        <span v-if="c.r" class="rmini num">Readiness {{ c.r.score }}<template v-if="c.r.sleep"> · sleep {{ c.r.sleep }}</template></span>
      </article>
    </div>

    <section class="tcard course" aria-labelledby="w-course">
      <div class="course-head">
        <h2 id="w-course">What the long runs build toward</h2>
        <button type="button" class="textbtn" @click="emit('go', 'road')">Full course profile</button>
      </div>
      <p class="label">{{ m.course.officialMiles }} mi, {{ fmt0(m.course.gainFt) }} ft of gain. Gold marks the climbs, purple the canyon descent.</p>
      <CourseProfile :course="m.course" :height="150" compact />
    </section>
  </div>
</template>
