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
        <svg class="scope" viewBox="0 0 96 56" aria-hidden="true" focusable="false">
          <circle class="scope-star star-a" cx="8" cy="9" r="1.15" fill="#ffffff" />
          <path class="scope-star star-b" fill="#ffb020" d="M22 5.2 L22.7 8.3 L25.8 9 L22.7 9.7 L22 12.8 L21.3 9.7 L18.2 9 L21.3 8.3 Z" />
          <circle class="scope-star star-c" cx="36" cy="6.5" r="0.85" fill="#ffffff" />
          <circle class="scope-star star-d" cx="12" cy="20" r="0.7" fill="#ffb020" />
          <path class="scope-star star-e" fill="#ffffff" d="M50 4.2 L50.55 6.4 L52.8 6.95 L50.55 7.5 L50 9.7 L49.45 7.5 L47.2 6.95 L49.45 6.4 Z" />
          <circle class="scope-star star-f" cx="66" cy="8" r="0.8" fill="#ffffff" />
          <path class="scope-star star-g" fill="#ffb020" d="M84 6 L84.45 7.7 L86.2 8.15 L84.45 8.6 L84 10.3 L83.55 8.6 L81.8 8.15 L83.55 7.7 Z" />
          <g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.35">
            <path d="M1 46 L12 32 L24 40" stroke="#ffffff" />
            <path d="M14 54 L38 14 L64 48" stroke="#ffb020" />
            <path d="M52 50 L74 22 L95 36" stroke="#ffffff" />
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
