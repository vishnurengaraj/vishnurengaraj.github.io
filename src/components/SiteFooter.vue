<script setup>
import { inject } from "vue";
import { profile } from "../data/content.js";
import { scrollKey } from "../scroll.js";

const scrollTo = inject(scrollKey);
</script>

<template>
  <footer class="site-footer">
    <div class="footer-inner">
      <div class="footer-id">
        <svg class="scope" viewBox="0 0 72 64" width="56" height="50" aria-hidden="true" focusable="false">
          <circle class="scope-star star-a" cx="14" cy="12" r="1.5" fill="#ffb020" />
          <circle class="scope-star star-b" cx="60" cy="8" r="1.15" fill="#ffffff" />
          <g fill="none" stroke="#ffffff" stroke-width="1.7" stroke-linecap="round">
            <path d="M36 38 L16 60" />
            <path d="M36 38 L56 60" />
            <path d="M36 38 L36 60" />
          </g>
          <g class="scope-tube" fill="none" stroke-linecap="round">
            <path d="M36 38 L54 20" stroke="#ffb020" stroke-width="2.4" />
            <circle cx="56" cy="18" r="4.2" stroke="#ffffff" stroke-width="1.7" />
          </g>
        </svg>
        <div>
          <p class="footer-name">Vishnu Rengaraj</p>
          <p class="footer-place">{{ profile.location }}</p>
        </div>
      </div>
      <div class="footer-actions">
        <nav aria-label="Contact">
          <a :href="profile.linkedin" target="_blank" rel="noopener noreferrer me">LinkedIn</a>
          <a :href="`mailto:${profile.email}`">Email</a>
          <a :href="profile.resume" target="_blank" rel="noopener noreferrer">Resume</a>
        </nav>
        <button class="to-top" type="button" @click="scrollTo('top')">Back to top</button>
      </div>
    </div>
  </footer>
</template>
