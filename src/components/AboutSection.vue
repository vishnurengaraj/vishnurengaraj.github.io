<script setup>
import { inject } from "vue";
import { bio, timeline } from "../data/content.js";
import { scrollKey } from "../scroll.js";

const scrollTo = inject(scrollKey);
</script>

<template>
  <section id="about" class="section" tabindex="-1" aria-labelledby="about-heading">
    <button class="home-return" type="button" aria-label="Back to title" @click="scrollTo('home')">
      <svg viewBox="5 6.5 14 10" aria-hidden="true">
        <path fill="currentColor" d="M7.41 15.41 12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
      </svg>
    </button>
    <h2 id="about-heading" class="section-title">About Me</h2>
    <p class="lead">
      <template v-for="(part, i) in bio" :key="i">
        <strong v-if="part.strong">{{ part.text }}</strong>
        <template v-else>{{ part.text }}</template>
      </template>
    </p>
    <ol class="timeline">
      <li v-for="item in timeline" :key="item.datetime + item.title">
        <time class="when" :datetime="item.datetime">{{ item.date }}</time>
        <h3>{{ item.title }}</h3>
        <span class="cat" :class="item.tone">{{ item.category }}</span>
        <p>{{ item.description }}</p>
      </li>
    </ol>
  </section>
</template>
