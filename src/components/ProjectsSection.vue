<script setup>
import { computed, ref } from "vue";
import { projectGroups, projects } from "../data/content.js";
import ResponsiveImg from "./ResponsiveImg.vue";

const groups = computed(() =>
  projectGroups
    .map((group) => ({
      ...group,
      items: projects.filter((project) => (project.era || "earlier") === group.id),
    }))
    .filter((group) => group.items.length > 0),
);

const showEraLabels = computed(() => groups.value.length > 1);
const open = ref({});

function slug(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function toggle(title) {
  open.value = { ...open.value, [title]: !open.value[title] };
}
</script>

<template>
  <section id="projects" class="section" tabindex="-1" aria-labelledby="projects-heading">
    <h2 id="projects-heading" class="section-title">Projects</h2>
    <template v-for="group in groups" :key="group.id">
      <h3 v-if="showEraLabels" class="era">{{ group.label }}</h3>
      <article v-for="project in group.items" :key="project.title" class="project">
        <div>
          <h3>{{ project.title }}</h3>
          <p class="subhead">{{ project.subtitle }}</p>
          <div :id="`more-${slug(project.title)}`" class="project-body" :class="{ 'is-open': open[project.title] }">
            <p>{{ project.body }}</p>
          </div>
          <div class="project-actions">
            <button
              type="button"
              class="more"
              :aria-expanded="open[project.title] ? 'true' : 'false'"
              :aria-controls="`more-${slug(project.title)}`"
              @click="toggle(project.title)"
            >
              <span>{{ open[project.title] ? "Less" : "More" }}</span>
              <svg class="chev" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="currentColor" d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
              </svg>
            </button>
            <a
              v-if="project.href"
              class="pill"
              :href="project.href"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ project.button }}
              <span class="sr-only"> (PDF, opens in a new tab)</span>
            </a>
          </div>
        </div>
        <figure v-if="project.image">
          <ResponsiveImg
            :image="project.image"
            :alt="project.imageAlt"
            sizes="(max-width: 960px) 92vw, 460px"
          />
        </figure>
      </article>
    </template>
  </section>
</template>
