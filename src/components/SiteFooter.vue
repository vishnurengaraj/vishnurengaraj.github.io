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
          <circle class="scope-star star-d" cx="4" cy="31" r="0.7" fill="#ffb020" />
          <circle class="scope-star star-e" cx="6" cy="18" r="0.8" fill="#ffffff" />
          <path class="scope-star star-c" fill="#ffffff" d="M10 4.75 L10.55 6.95 L12.8 7.5 L10.55 8.05 L10 10.25 L9.45 8.05 L7.2 7.5 L9.45 6.95 Z" />
          <circle class="scope-star star-g" cx="15" cy="24" r="0.7" fill="#ffb020" />
          <path class="scope-star star-b" fill="#ffb020" d="M22 12.2 L22.7 15.3 L25.8 16 L22.7 16.7 L22 19.8 L21.3 16.7 L18.2 16 L21.3 15.3 Z" />
          <circle class="scope-star star-a" cx="35" cy="4.2" r="0.85" fill="#ffffff" />
          <path class="scope-star star-f" fill="#ffb020" d="M46 5.85 L46.45 7.55 L48.2 8 L46.45 8.45 L46 10.15 L45.55 8.45 L43.8 8 L45.55 7.55 Z" />
          <path class="scope-star star-d" fill="#ffffff" d="M55 20.25 L55.55 22.45 L57.8 23 L55.55 23.55 L55 25.75 L54.45 23.55 L52.2 23 L54.45 22.45 Z" />
          <circle class="scope-star star-e" cx="66" cy="11" r="0.85" fill="#ffffff" />
          <path class="scope-star star-b" fill="#ffb020" d="M78 13.85 L78.45 15.55 L80.2 16 L78.45 16.45 L78 18.15 L77.55 16.45 L75.8 16 L77.55 15.55 Z" />
          <circle class="scope-star star-g" cx="89" cy="25" r="0.7" fill="#ffb020" />
          <circle class="scope-star star-a" cx="93" cy="9" r="1.15" fill="#ffffff" />
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
