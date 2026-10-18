<script setup>
import { bio, timeline } from "../data/content.js";
</script>

<template>
  <section id="about" class="section" tabindex="-1" aria-labelledby="about-heading">
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
