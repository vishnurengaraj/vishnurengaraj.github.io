<script setup>
import { nextTick, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import BulletTree from "./BulletTree.vue";
import MediaFrame from "./MediaFrame.vue";
import ResponsiveImg from "./ResponsiveImg.vue";
import {
  awards,
  clubs,
  coursework,
  earlierEducation,
  education,
  experience,
  skills,
} from "../data/content.js";

const tabs = [
  { id: "experience", label: "Experience" },
  { id: "education", label: "Education" },
  { id: "clubs", label: "Clubs" },
  { id: "awards", label: "Awards" },
];

const route = useRoute();
const router = useRouter();
const tabIds = tabs.map((tab) => tab.id);

function tabFromRoute() {
  return tabIds.includes(route.params.tab) ? route.params.tab : "experience";
}

const current = ref(route.name === "resume" ? tabFromRoute() : "experience");
const stage = ref(null);
const stageMin = ref(0);
const leaving = ref(null);
const dir = ref("forward");
let leaveTimer = 0;
let swipeX = 0;
let swipeY = 0;

watch(
  () => route.fullPath,
  () => {
    if (route.name !== "resume") return;
    const next = tabFromRoute();
    if (next !== current.value) current.value = next;
  },
);

watch(current, async (next, prev) => {
  if (!prev || next === prev) return;
  dir.value = tabIds.indexOf(next) > tabIds.indexOf(prev) ? "forward" : "back";
  window.clearTimeout(leaveTimer);
  if (stage.value) stageMin.value = stage.value.offsetHeight;
  leaving.value = prev;
  await nextTick();
  stage.value?.querySelectorAll(".is-active, .is-out").forEach((el) => {
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "";
  });
  leaveTimer = window.setTimeout(endLeave, 420);
});

function endLeave() {
  window.clearTimeout(leaveTimer);
  if (!leaving.value) {
    stageMin.value = 0;
    return;
  }
  const active = stage.value?.querySelector(".panel-block.is-active");
  stageMin.value = active?.offsetHeight || 0;
  leaving.value = null;
  requestAnimationFrame(() => {
    if (!leaving.value) stageMin.value = 0;
  });
}

function onAnimEnd(event) {
  if (event.target?.classList?.contains("is-out")) endLeave();
}

function select(id) {
  if (!tabIds.includes(id) || id === current.value) return;
  current.value = id;
  const path = id === "experience" ? "/resume" : `/resume/${id}`;
  if (route.path !== path) router.push(path);
}

function onSwipeStart(event) {
  const touch = event.touches?.[0];
  if (!touch) return;
  swipeX = touch.clientX;
  swipeY = touch.clientY;
}

function onSwipeEnd(event) {
  const touch = event.changedTouches?.[0];
  if (!touch) return;
  const dx = touch.clientX - swipeX;
  const dy = touch.clientY - swipeY;
  if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
  const index = tabIds.indexOf(current.value);
  if (dx < 0 && index < tabIds.length - 1) select(tabIds[index + 1]);
  else if (dx > 0 && index > 0) select(tabIds[index - 1]);
}

onUnmounted(() => window.clearTimeout(leaveTimer));

function onKeydown(event) {
  const ids = tabs.map((tab) => tab.id);
  const index = ids.indexOf(current.value);
  let next = index;
  if (event.key === "ArrowRight") next = (index + 1) % ids.length;
  else if (event.key === "ArrowLeft") next = (index - 1 + ids.length) % ids.length;
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = ids.length - 1;
  else return;
  event.preventDefault();
  select(ids[next]);
  document.getElementById(`tab-${ids[next]}`)?.focus();
}
</script>

<template>
  <section id="resume" class="section" tabindex="-1" aria-labelledby="resume-heading">
    <h2 id="resume-heading" class="section-title">Resume</h2>
    <h3 class="section-label">Skills</h3>
    <ul class="skills">
      <li v-for="skill in skills" :key="skill">{{ skill }}</li>
    </ul>

    <div class="tablist-wrap">
      <div class="tablist-shell">
        <div class="tablist" role="tablist" aria-label="Resume sections" @keydown="onKeydown">
      <button
        v-for="tab in tabs"
        :id="`tab-${tab.id}`"
        :key="tab.id"
        type="button"
        role="tab"
        :aria-selected="current === tab.id"
        :aria-controls="`panel-${tab.id}`"
        :tabindex="current === tab.id ? 0 : -1"
        @click="select(tab.id)"
      >
        {{ tab.label }}
      </button>
        </div>
      </div>
    </div>

    <div
      ref="stage"
      class="panel-stage"
      :class="{ 'is-anim': leaving }"
      :data-dir="dir"
      :style="stageMin ? { minHeight: `${stageMin}px` } : undefined"
      @animationend="onAnimEnd"
      @touchstart.passive="onSwipeStart"
      @touchend.passive="onSwipeEnd"
    >
    <div
      id="panel-experience"
      class="panel-block"
      :class="{ 'is-active': current === 'experience', 'is-out': leaving === 'experience' }"
      :aria-hidden="leaving === 'experience' ? 'true' : undefined"
      role="tabpanel"
      aria-labelledby="tab-experience"
      tabindex="0"
    >
      <article v-for="job in experience" :key="job.title" class="card">
        <header class="card-head">
          <h3>{{ job.title }}</h3>
          <span class="card-date">{{ job.date }}</span>
        </header>
        <p class="role">{{ job.subtitle }}</p>
        <MediaFrame v-for="(item, i) in job.media" :key="`m-${i}`" :item="item" />
        <h4>About the company</h4>
        <p>{{ job.about }}</p>
        <h4>What I did</h4>
        <BulletTree :items="job.bullets" />
        <MediaFrame v-for="(item, i) in job.after || []" :key="`a-${i}`" :item="item" />
        <a class="pill" :href="job.link" target="_blank" rel="noopener noreferrer">
          Details
          <span class="sr-only"> about {{ job.title }} (opens in a new tab)</span>
        </a>
      </article>
    </div>

    <div
      id="panel-education"
      class="panel-block"
      :class="{ 'is-active': current === 'education', 'is-out': leaving === 'education' }"
      :aria-hidden="leaving === 'education' ? 'true' : undefined"
      role="tabpanel"
      aria-labelledby="tab-education"
      tabindex="0"
    >
      <article v-for="school in education" :key="school.subtitle" class="card">
        <header class="card-head">
          <h3>{{ school.title }}</h3>
          <span class="card-date">{{ school.date }}</span>
        </header>
        <p class="role">{{ school.subtitle }}</p>
        <p v-if="school.gpa" class="gpa">GPA: {{ school.gpa }}</p>
        <ResponsiveImg
          v-if="school.image"
          class="photo-frame"
          :image="school.image"
          :alt="school.imageAlt"
          sizes="(max-width: 960px) 92vw, 480px"
        />
        <a
          v-if="school.link"
          class="pill"
          :href="school.link"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ school.linkLabel }}
          <span class="sr-only"> (opens in a new tab)</span>
        </a>
      </article>
      <aside class="coursework">
        <h3>Coursework</h3>
        <p>{{ coursework }}</p>
      </aside>
      <article v-for="school in earlierEducation" :key="school.title" class="card">
        <header class="card-head">
          <h3>{{ school.title }}</h3>
          <span class="card-date">{{ school.date }}</span>
        </header>
        <p v-if="school.subtitle" class="role">{{ school.subtitle }}</p>
        <p v-if="school.gpa" class="gpa">GPA: {{ school.gpa }}</p>
        <ResponsiveImg
          v-if="school.image"
          class="photo-frame"
          :image="school.image"
          :alt="school.imageAlt"
          sizes="(max-width: 960px) 92vw, 480px"
        />
        <a
          v-if="school.link"
          class="pill"
          :href="school.link"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ school.linkLabel }}
          <span class="sr-only"> (opens in a new tab)</span>
        </a>
      </article>
    </div>

    <div
      id="panel-clubs"
      class="panel-block"
      :class="{ 'is-active': current === 'clubs', 'is-out': leaving === 'clubs' }"
      :aria-hidden="leaving === 'clubs' ? 'true' : undefined"
      role="tabpanel"
      aria-labelledby="tab-clubs"
      tabindex="0"
    >
      <article v-for="club in clubs" :key="club.title" class="card">
        <header class="card-head">
          <h3>{{ club.title }}</h3>
          <span class="card-date">{{ club.date }}</span>
        </header>
        <p class="role">{{ club.subtitle }}</p>
        <MediaFrame v-for="(item, i) in club.media" :key="i" :item="item" />
        <h4>{{ club.aboutLabel }}</h4>
        <p>{{ club.about }}</p>
        <h4>What I did</h4>
        <BulletTree v-if="club.bullets" :items="club.bullets" />
        <div v-if="club.prose" class="prose">
          <p v-for="(paragraph, i) in club.prose" :key="i">{{ paragraph }}</p>
        </div>
        <a class="pill" :href="club.link" target="_blank" rel="noopener noreferrer">
          Details
          <span class="sr-only"> about {{ club.title }} (opens in a new tab)</span>
        </a>
      </article>
    </div>

    <div
      id="panel-awards"
      class="panel-block"
      :class="{ 'is-active': current === 'awards', 'is-out': leaving === 'awards' }"
      :aria-hidden="leaving === 'awards' ? 'true' : undefined"
      role="tabpanel"
      aria-labelledby="tab-awards"
      tabindex="0"
    >
      <article v-for="award in awards" :key="award.title" class="card card-compact">
        <header class="card-head">
          <h3>{{ award.title }}</h3>
          <span class="card-date">{{ award.date }}</span>
        </header>
        <p v-if="award.subtitle" class="role">{{ award.subtitle }}</p>
        <a
          v-if="award.link"
          class="pill"
          :href="award.link"
          target="_blank"
          rel="noopener noreferrer"
        >
          Details
          <span class="sr-only"> (opens in a new tab)</span>
        </a>
      </article>
    </div>
    </div>
  </section>
</template>

