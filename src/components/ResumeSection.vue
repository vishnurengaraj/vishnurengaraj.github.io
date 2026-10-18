<script setup>
import { computed } from "vue";
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
const current = computed(() =>
  tabs.some((tab) => tab.id === route.params.tab) ? route.params.tab : "experience",
);

function select(id) {
  router.push(id === "experience" ? "/resume" : `/resume/${id}`);
}

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

    <div
      id="panel-experience"
      class="panel-block"
      :class="{ 'is-active': current === 'experience' }"
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
      :class="{ 'is-active': current === 'education' }"
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
      :class="{ 'is-active': current === 'clubs' }"
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
      :class="{ 'is-active': current === 'awards' }"
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
  </section>
</template>

