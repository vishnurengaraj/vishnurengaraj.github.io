<script setup>
import { inject } from "vue";
import { profile } from "../data/content.js";
import { scrollKey } from "../scroll.js";

const scrollTo = inject(scrollKey);
</script>

<template>
  <footer class="footer">
    <p><strong>Vishnu Rengaraj</strong></p>
    <p>{{ profile.location }}</p>
    <nav aria-label="Contact">
      <a :href="profile.linkedin" target="_blank" rel="noopener noreferrer me">LinkedIn</a>
      <a :href="`mailto:${profile.email}`">Email</a>
      <a :href="profile.resume" target="_blank" rel="noopener noreferrer">Resume</a>
    </nav>
    <button class="to-top" type="button" @click="scrollTo('top')">Back to top</button>
  </footer>
</template>
