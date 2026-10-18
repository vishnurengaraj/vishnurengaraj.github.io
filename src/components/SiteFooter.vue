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
          <circle class="scope-star star-a" cx="10" cy="10" r="1.15" fill="#ffffff" />
          <path class="scope-star star-b" fill="#ffb020" d="M24 4.2 L24.7 7.3 L27.8 8 L24.7 8.7 L24 11.8 L23.3 8.7 L20.2 8 L23.3 7.3 Z" />
          <circle class="scope-star star-c" cx="40" cy="7" r="0.85" fill="#ffffff" />
          <circle class="scope-star star-d" cx="8" cy="20" r="0.7" fill="#ffb020" />
          <path class="scope-star star-e" fill="#ffffff" d="M52 5 L52.55 7.2 L54.8 7.75 L52.55 8.3 L52 10.5 L51.45 8.3 L49.2 7.75 L51.45 7.2 Z" />
          <circle class="scope-star star-f" cx="66" cy="12" r="0.8" fill="#ffffff" />
          <path class="scope-star star-g" fill="#ffb020" d="M78 6.5 L78.45 8.2 L80.2 8.65 L78.45 9.1 L78 10.8 L77.55 9.1 L75.8 8.65 L77.55 8.2 Z" />
          <g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.35">
            <path d="M2 46 L16 30 L30 46" stroke="#ffffff" />
            <path d="M18 48 L36 20 L54 48" stroke="#ffb020" />
            <path d="M40 46 L56 32 L72 46" stroke="#ffffff" />
          </g>
          <g fill="none" stroke-linecap="round">
            <path d="M70 36 L56 52" stroke="#ffffff" stroke-width="1.5" />
            <path d="M70 36 L84 52" stroke="#ffffff" stroke-width="1.5" />
            <path d="M70 36 L70 52" stroke="#ffffff" stroke-width="1.5" />
            <path d="M70 36 L82 22" stroke="#ffb020" stroke-width="2.1" />
            <circle cx="84" cy="20" r="3.5" stroke="#ffffff" stroke-width="1.5" />
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
