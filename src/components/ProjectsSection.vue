<script setup>
import { computed } from "vue";
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
          <p>{{ project.body }}</p>
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
