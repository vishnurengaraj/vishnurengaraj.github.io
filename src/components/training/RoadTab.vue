<script setup>
import { computed, ref } from "vue";
import CourseProfile from "./CourseProfile.vue";
import { MON, fmt0, fmt1, fmtDate, isoOf, monthDay, ms } from "../../training/view.js";
import { useWidth } from "../../training/useWidth.js";

const props = defineProps({ m: { type: Object, required: true } });
const m = props.m;
const DAY = 864e5;
const T0 = ms(m.weeks[0].start);
const T1 = ms(m.race.date) + DAY;
const TODAY = ms(m.asOf);
const planTotal = m.weeks.reduce((s, w) => s + w.miles, 0);


/* ---- block track ---- */
const track = useWidth();
const trackSvg = computed(() => {
  const W = track.width.value;
  if (!W) return null;
  const x = (t) => ((t - T0) / (T1 - T0)) * W;
  const phases = m.phases.map(([name, a, b], i) => {
    const x0 = x(ms(m.weeks[a - 1].start));
    const x1 = b === m.weeks.length ? W : x(ms(m.weeks[b - 1].start) + 7 * DAY);
    return { name, x0, x1, fill: i % 2 ? "#efe6de" : "#f6efe8", showLabel: x1 - x0 > name.length * 7 + 8 };
  });
  const done = Math.max(0, Math.min(W, x(TODAY + DAY)));
  return { W, phases, done, tx: x(TODAY + DAY / 2) };
});

/* ---- cumulative miles ---- */
const range = ref("near");
const cum = useWidth();
const cumSvg = computed(() => {
  const W = cum.width.value;
  if (!W) return null;
  const H = 240;
  const pl = 36;
  const pr = 12;
  const pt = 16;
  const pb = 24;
  const near = range.value === "near";
  const E = near ? T0 + 28 * DAY : T1;
  const max = near ? 100 : Math.ceil(planTotal / 50) * 50;
  const x = (t) => pl + ((t - T0) / (E - T0)) * (W - pl - pr);
  const y = (v) => pt + (1 - v / max) * (H - pt - pb);
  let c = 0;
  let plan = `M${x(T0)},${y(0)}`;
  const ends = [];
  for (const w of m.weeks) {
    const s0 = ms(w.start);
    c += w.miles;
    ends.push([s0 + 7 * DAY, c]);
    if (s0 >= E) continue;
    plan += `L${x(s0)},${y(c)}L${x(Math.min(s0 + 7 * DAY, T1))},${y(c)}`;
  }
  let a = 0;
  let act = `M${x(T0)},${y(0)}`;
  for (let t = T0; t <= Math.min(TODAY, T1 - DAY); t += DAY) {
    a += m.actual(isoOf(t)).list.filter((r) => r.type === "Run" || r.type === "Trail Run").reduce((s, r) => s + r.mi, 0);
    act += `L${x(t + DAY)},${y(a)}`;
  }
  const grid = (near ? [25, 50, 75, 100] : [100, 200, 300, 400].filter((v) => v <= max)).map((v) => ({ v, y: y(v) }));
  const ticks = near
    ? m.weeks.slice(0, 4).map((w) => ({ x: x(ms(w.start)), t: monthDay(w.start) }))
    : [
        [2026, 11],
        [2027, 0],
        [2027, 1],
        [2027, 2],
      ].map(([yy, mm]) => ({ x: x(Date.UTC(yy, mm, 1)), t: MON[mm] }));
  const cw = ends[m.current.week - 1];
  const nowX = x(Math.min(TODAY, T1 - DAY) + DAY);
  return { W, H, pl, pr, plan, act, grid, ticks, a, nowX, nowY: y(a), cw: { x: x(cw[0]), y: y(cw[1]), v: cw[1] }, totalY: y(planTotal), y0: y(0), near };
});

/* ---- long-run ladder ---- */
const ladder = computed(() =>
  m.weeks.map((w) => {
    const race = m.isRaceWeek(w);
    const a = m.progress[w.week];
    const keySat = w.days.find((d) => d.role === "Key" && d.date.length && new Date(ms(d.date)).getUTCDay() === 6);
    const date = race ? m.race.date : (keySat || w.days[5]).date;
    const target = race ? m.race.miles : w.long;
    return {
      w,
      race,
      date,
      target,
      longest: race ? 0 : a.longest,
      milestone: race || [10, 20].includes(w.long),
      tag: race ? "race" : w.long === Math.max(...m.weeks.filter((x) => !m.isRaceWeek(x)).map((x) => x.long)) ? "peak" : "",
    };
  }),
);
const ladderMax = m.race.miles;

/* ---- vert by week ---- */
const vert = useWidth();
const vertSvg = computed(() => {
  const W = vert.width.value;
  if (!W) return null;
  const H = 220;
  const pl = 44;
  const pr = 8;
  const pt = 16;
  const pb = 24;
  const max = 5000;
  const n = m.weeks.length;
  const bw = (W - pl - pr) / n;
  const y = (v) => pt + (1 - v / max) * (H - pt - pb);
  const bars = m.weeks.map((w, i) => {
    const x0 = pl + i * bw + bw * 0.18;
    const ww = bw * 0.64;
    const ft = m.progress[w.week].ft;
    return { w, x0, ww, race: m.isRaceWeek(w), hiY: y(w.vertHi), loY: y(w.vertLo), y0: y(0), ft, ftY: y(ft) };
  });
  return { W, H, pl, pr, bars, grid: [1000, 2000, 3000, 4000].map((v) => ({ v, y: y(v) })), raceY: y(m.race.gainFt), bw };
});
const cumLabel = computed(
  () => `Cumulative miles. The plan totals ${fmt0(planTotal)} miles through race week. Logged ${fmt1(cumSvg.value?.a || 0)} miles so far.`,
);
</script>

<template>
  <div class="tab-road">
    <section class="tcard road-hero">
      <div>
        <p class="big num">{{ m.daysToRace }}</p>
        <p class="bl">days to the start</p>
      </div>
      <div>
        <h2>Race day</h2>
        <p class="sub">
          {{ fmtDate(m.race.date) }}, 2027, {{ m.race.start }} · {{ m.race.place }} · {{ m.race.miles }} mi · {{ fmt0(m.race.gainFt) }} ft · finish inside {{ m.race.cutoff }}
        </p>
      </div>
      <div :ref="track.el" class="track">
        <svg
          v-if="trackSvg"
          :viewBox="`0 0 ${trackSvg.W} 54`"
          :width="trackSvg.W"
          height="54"
          role="img"
          :aria-label="`Training block from ${monthDay(m.weeks[0].start)} to ${monthDay(m.race.date)}. Today is in week ${m.current.week}, ${m.current.phase}.`"
        >
          <g v-for="(p, i) in trackSvg.phases" :key="`${p.name}-${i}`">
            <rect :x="p.x0 + 1" y="18" :width="Math.max(0, p.x1 - p.x0 - 2)" height="12" rx="3" :fill="p.fill" />
            <text v-if="p.showLabel" :x="p.x0 + 2" y="12" class="al">{{ p.name }}</text>
          </g>
          <rect x="0" y="18" :width="trackSvg.done" height="12" rx="3" fill="#ffb020" />
          <line :x1="trackSvg.tx" :x2="trackSvg.tx" y1="14" y2="34" stroke="#2d1d7a" stroke-width="2" />
          <text :x="Math.min(trackSvg.tx, trackSvg.W - 150)" y="48" class="ax">Today, week {{ m.current.week }}</text>
          <text :x="trackSvg.W" y="48" class="ax" text-anchor="end">{{ monthDay(m.race.date) }}</text>
        </svg>
      </div>
    </section>

    <div class="row2">
      <section class="tcard panel chart" aria-labelledby="h-cum">
        <div class="ph">
          <h2 id="h-cum">Miles so far</h2>
          <div class="seg" role="group" aria-label="Chart range">
            <button type="button" class="btn" :aria-pressed="range === 'near' ? 'true' : 'false'" @click="range = 'near'">First 4 weeks</button>
            <button type="button" class="btn" :aria-pressed="range === 'all' ? 'true' : 'false'" @click="range = 'all'">Whole block</button>
          </div>
        </div>
        <p class="label">Logged run miles against each week’s target, stacked.</p>
        <div :ref="cum.el" class="chart-box">
          <svg v-if="cumSvg" :viewBox="`0 0 ${cumSvg.W} ${cumSvg.H}`" :width="cumSvg.W" :height="cumSvg.H" role="img" :aria-label="cumLabel">
            <g v-for="g in cumSvg.grid" :key="g.v">
              <line :x1="cumSvg.pl" :x2="cumSvg.W - cumSvg.pr" :y1="g.y" :y2="g.y" stroke="#efe6de" />
              <text :x="cumSvg.pl - 6" :y="g.y + 4" text-anchor="end" class="ax">{{ g.v }}</text>
            </g>
            <g v-for="t in cumSvg.ticks" :key="t.t">
              <line :x1="t.x" :x2="t.x" :y1="cumSvg.y0" :y2="cumSvg.y0 + 4" stroke="#7a6558" />
              <text :x="t.x" :y="cumSvg.H - 8" text-anchor="middle" class="ax">{{ t.t }}</text>
            </g>
            <line :x1="cumSvg.pl" :x2="cumSvg.W - cumSvg.pr" :y1="cumSvg.y0" :y2="cumSvg.y0" stroke="#d9cabd" />
            <path :d="cumSvg.plan" fill="none" stroke="#b9a596" stroke-width="1.5" stroke-dasharray="4 3" />
            <path :d="cumSvg.act" fill="none" stroke="#ffb020" stroke-width="3" stroke-linejoin="round" />
            <circle :cx="cumSvg.nowX" :cy="cumSvg.nowY" r="4.5" fill="#2d1d7a" />
            <text :x="cumSvg.nowX + 8" :y="cumSvg.nowY - 8" class="al num">{{ fmt1(cumSvg.a) }} mi logged</text>
            <text :x="Math.min(cumSvg.cw.x + 6, cumSvg.W - 120)" :y="cumSvg.cw.y + 4" class="al num">Week {{ m.current.week }} target {{ cumSvg.cw.v }}</text>
            <text v-if="!cumSvg.near" :x="cumSvg.W - cumSvg.pr" :y="cumSvg.totalY - 8" class="al num" text-anchor="end">{{ fmt0(planTotal) }} mi by race week</text>
          </svg>
        </div>
        <div class="legend">
          <span><i class="sw-line"></i>Logged</span>
          <span><i class="sw-dash"></i>End-of-week targets, stacked</span>
        </div>
      </section>
      <section class="tcard panel" aria-labelledby="h-lad">
        <h2 id="h-lad">Long-run ladder</h2>
        <p class="label">One long run a week, {{ m.weeks[0].long }} to {{ Math.max(...m.weeks.filter((w) => !m.isRaceWeek(w)).map((w) => w.long)) }} miles, then race day.</p>
        <ol class="ladder">
          <li v-for="l in ladder" :key="l.w.week" :class="{ ms: l.milestone, race: l.race, now: l.w.week === m.current.week }" :data-week="l.w.week">
            <span class="lw">{{ monthDay(l.date) }}</span>
            <span class="lt" role="img" :aria-label="`Week ${l.w.week}: ${l.race ? 'race' : ''} ${l.target} miles${l.longest ? `, longest logged ${fmt1(l.longest)}` : ''}`">
              <span class="lp" :style="{ width: `${(l.target / ladderMax) * 100}%` }"></span>
              <span v-if="l.longest" class="la" :style="{ width: `${(Math.min(l.target, l.longest) / ladderMax) * 100}%` }"></span>
            </span>
            <span class="lv num">{{ l.target }}<template v-if="l.tag"> {{ l.tag }}</template></span>
          </li>
        </ol>
      </section>
    </div>

    <section class="tcard panel chart vert" aria-labelledby="h-vert">
      <h2 id="h-vert">Vert by week</h2>
      <p class="label">Target range per week, with logged climbing in gold. Race day is {{ fmt0(m.race.gainFt) }} ft. Training visits the grades, not the total.</p>
      <div :ref="vert.el" class="chart-box">
        <svg
          v-if="vertSvg"
          :viewBox="`0 0 ${vertSvg.W} ${vertSvg.H}`"
          :width="vertSvg.W"
          :height="vertSvg.H"
          role="img"
          :aria-label="`Weekly vert targets rising from ${fmt0(m.weeks[0].vertLo)}–${fmt0(m.weeks[0].vertHi)} feet in week 1 to ${fmt0(m.weeks[13].vertLo)}–${fmt0(m.weeks[13].vertHi)} feet at peak. Logged ${fmt0(m.progress[m.current.week].ft)} feet in week ${m.current.week}.`"
        >
          <g v-for="g in vertSvg.grid" :key="g.v">
            <line :x1="vertSvg.pl" :x2="vertSvg.W - vertSvg.pr" :y1="g.y" :y2="g.y" stroke="#efe6de" />
            <text :x="vertSvg.pl - 6" :y="g.y + 4" text-anchor="end" class="ax">{{ fmt0(g.v) }}</text>
          </g>
          <g v-for="b in vertSvg.bars" :key="b.w.week">
            <rect v-if="b.race" :x="b.x0" :y="vertSvg.raceY" :width="b.ww" :height="b.y0 - vertSvg.raceY" rx="3" fill="#2d1d7a" />
            <template v-else>
              <rect :x="b.x0" :y="b.hiY" :width="b.ww" :height="b.loY - b.hiY" rx="3" fill="#f3eef8" stroke="#2d1d7a" stroke-opacity=".35" />
              <rect :x="b.x0" :y="b.loY" :width="b.ww" :height="b.y0 - b.loY" fill="#f6efe8" />
            </template>
            <rect v-if="b.ft" :x="b.x0" :y="b.ftY - 1.5" :width="b.ww" :height="Math.max(3, b.y0 - b.ftY)" rx="2" fill="#ffb020" />
            <text :x="b.x0 + b.ww / 2" :y="vertSvg.H - 8" text-anchor="middle" class="ax" :class="{ now: b.w.week === m.current.week }">{{ b.w.week }}</text>
          </g>
          <text :x="vertSvg.pl + (vertSvg.bars.length - 1) * vertSvg.bw - 6" :y="vertSvg.raceY + 12" text-anchor="end" class="al">Race {{ fmt0(m.race.gainFt) }} ft</text>
          <text :x="vertSvg.pl - 6" :y="vertSvg.H - 8" class="ax" text-anchor="end">wk</text>
        </svg>
      </div>
    </section>

    <section class="tcard course" aria-labelledby="h-course">
      <h2 id="h-course">The course, and where each part gets rehearsed</h2>
      <p class="label">Elevation in official miles, from the Plotaroute GPX ({{ m.course.gpxMi }} mi) scaled to {{ m.course.officialMiles }}. Pick a section to highlight it.</p>
      <CourseProfile :course="m.course" :height="280" rehearsed />
    </section>
  </div>
</template>
