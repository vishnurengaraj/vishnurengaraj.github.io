<script setup>
import { inject, nextTick, onMounted, watch } from "vue";
import { resumeJumpKey, resumePartKey } from "../scroll.js";
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
  { id: "skills", label: "Skills" },
  { id: "experience", label: "Experience" },
  { id: "education", label: "Education" },
  { id: "clubs", label: "Clubs" },
  { id: "awards", label: "Awards" },
];

const current = inject(resumePartKey);
const jumpResumePart = inject(resumeJumpKey);

function prefersReduced() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function onPick(event, id) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
  event.preventDefault();
  jumpResumePart(id);
}

/* Keep the chosen label in the row when the names overflow.
   Scroll the row only — scrollIntoView would move the page too. */
async function revealCurrent(id) {
  if (!id) return;
  await nextTick();
  const link = document.getElementById(`tab-${id}`);
  const row = link?.closest(".tablist");
  if (!link || !row || row.scrollWidth <= row.clientWidth + 1) return;
  const rowBox = row.getBoundingClientRect();
  const linkBox = link.getBoundingClientRect();
  const delta = linkBox.left - rowBox.left - (row.clientWidth - linkBox.width) / 2;
  row.scrollTo({
    left: Math.max(0, row.scrollLeft + delta),
    behavior: prefersReduced() ? "instant" : "smooth",
  });
}

watch(current, revealCurrent);
onMounted(() => revealCurrent(current.value));
</script>

<template>
  <section id="resume" class="section" tabindex="-1" aria-labelledby="resume-heading">
    <h2 id="resume-heading" class="section-title">Resume</h2>
    <div id="resume-tabs-sentinel" class="tab-sentinel" aria-hidden="true"></div>
    <Teleport defer to="#nav-tab-slot">
      <div class="tablist-shell">
        <nav class="tablist" aria-label="Resume sections">
          <a
            v-for="tab in tabs"
            :id="`tab-${tab.id}`"
            :key="tab.id"
            :href="`/resume/${tab.id}`"
            :aria-current="current === tab.id ? 'location' : undefined"
            @click="onPick($event, tab.id)"
          >
            {{ tab.label }}
          </a>
        </nav>
      </div>
    </Teleport>

    <section id="skills" class="panel-block resume-part" tabindex="-1" aria-labelledby="skills-heading">
      <h3 id="skills-heading" class="era">Skills</h3>
      <ul class="skills">
        <li v-for="skill in skills" :key="skill">{{ skill }}</li>
      </ul>
    </section>

    <section id="experience" class="panel-block resume-part" tabindex="-1" aria-labelledby="experience-heading">
      <h3 id="experience-heading" class="era">Experience</h3>
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
    </section>

    <section id="education" class="panel-block resume-part" tabindex="-1" aria-labelledby="education-heading">
      <h3 id="education-heading" class="era">Education</h3>
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
    </section>

    <section id="clubs" class="panel-block resume-part" tabindex="-1" aria-labelledby="clubs-heading">
      <h3 id="clubs-heading" class="era">Clubs</h3>
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
    </section>

    <section id="awards" class="panel-block resume-part" tabindex="-1" aria-labelledby="awards-heading">
      <h3 id="awards-heading" class="era">Awards</h3>
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
    </section>
  </section>
</template>
