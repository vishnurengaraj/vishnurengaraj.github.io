<script setup>
import { inject, onMounted, onUnmounted, ref } from "vue";
import { profile } from "../data/content.js";
import { scrollKey } from "../scroll.js";

const scrollTo = inject(scrollKey);
const typed = ref(profile.roles[0]);
const animate = ref(false);
const nameEl = ref(null);
const subtitleEl = ref(null);
let timer = 0;
let onResize = () => {};

function fit() {
  for (const el of [nameEl.value, subtitleEl.value]) {
    if (!el) continue;
    el.style.fontSize = "";
    const max = parseFloat(getComputedStyle(el).fontSize);
    const min = el === nameEl.value ? 30 : 16;
    let size = max;
    const limit = el.parentElement?.clientWidth || el.clientWidth;
    el.style.fontSize = `${size}px`;
    while (size > min && el.scrollWidth > limit + 1) {
      size -= 1;
      el.style.fontSize = `${size}px`;
    }
  }
}

onMounted(() => {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  fit();
  onResize = () => fit();
  window.addEventListener("resize", onResize);
  if (reduce) return;

  animate.value = true;
  let role = 0;
  let length = 0;
  let mode = "type";
  const tick = () => {
    const word = profile.roles[role];
    if (mode === "type") {
      length = Math.min(word.length, length + 1);
      typed.value = word.slice(0, length);
      fit();
      if (length === word.length) {
        mode = "hold";
        timer = window.setTimeout(tick, 1400);
        return;
      }
      timer = window.setTimeout(tick, 58);
      return;
    }
    if (mode === "hold") {
      mode = "delete";
      tick();
      return;
    }
    length = Math.max(0, length - 1);
    typed.value = word.slice(0, length);
    if (length === 0) {
      role = (role + 1) % profile.roles.length;
      mode = "type";
      timer = window.setTimeout(tick, 260);
      return;
    }
    timer = window.setTimeout(tick, 30);
  };
  length = 0;
  typed.value = "";
  timer = window.setTimeout(tick, 350);
});

onUnmounted(() => {
  window.clearTimeout(timer);
  window.removeEventListener("resize", onResize);
});
</script>

<template>
  <div id="top" class="center hero" tabindex="-1">
    <h1 ref="nameEl" class="name">Vishnu<br />Rengaraj</h1>
    <p class="sr-only">{{ profile.roles.join(", ") }}.</p>
    <p ref="subtitleEl" class="subtitle" aria-hidden="true">
      <span>{{ typed }}</span
      ><span v-if="animate" class="caret" aria-hidden="true"></span>
    </p>
    <ul class="socials">
      <li>
        <a
          class="icon-link"
          :href="profile.linkedin"
          target="_blank"
          rel="noopener noreferrer me"
          aria-label="LinkedIn (opens in a new tab)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S.02 4.88.02 3.5 1.13 1 2.5 1s2.48 1.12 2.48 2.5zM5 8H0v16h5V8zm7.98 0H8.01v16h4.97v-8.4c0-4.67 6.03-5.05 6.03 0V24H24V13.87c0-7.88-8.92-7.59-11.02-3.71V8z"
            />
          </svg>
        </a>
      </li>
      <li>
        <a class="icon-link" :href="`mailto:${profile.email}`" :aria-label="`Email ${profile.email}`">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z"
            />
          </svg>
        </a>
      </li>
      <li>
        <a
          class="icon-link"
          :href="profile.resume"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Resume PDF (opens in a new tab)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M16.59 9H15V4c0-.55-.45-1-1-1h-4c-.55 0-1 .45-1 1v5H7.41c-.89 0-1.34 1.08-.71 1.71l4.59 4.59c.39.39 1.02.39 1.41 0l4.59-4.59c.63-.63.18-1.71-.71-1.71zM6 18c0 .55.45 1 1 1h12c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1z"
            />
          </svg>
        </a>
      </li>
    </ul>
    <button class="learn" type="button" aria-label="Learn more" @click="scrollTo('about')">
      <svg viewBox="5 7.5 14 10" aria-hidden="true">
        <path fill="currentColor" d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.hero {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding-top: 7vh;
  padding-right: 8vw;
}

.subtitle {
  margin: 0.85rem 0 0;
  min-height: 1.3em;
  max-width: 100%;
  color: rgba(255, 255, 255, 0.92);
  font-family: "Roboto Mono", ui-monospace, monospace;
  font-size: clamp(16px, 4.4vw, 32px);
  font-weight: 400;
  letter-spacing: 0.01em;
  white-space: nowrap;
}

.caret {
  display: inline-block;
  width: 2px;
  height: 0.9em;
  margin-left: 3px;
  background: currentColor;
  vertical-align: text-bottom;
  animation: caret-blink 1s steps(1, end) infinite;
}

@keyframes caret-blink {
  0%,
  45% {
    opacity: 1;
  }
  50%,
  100% {
    opacity: 0;
  }
}

.socials {
  display: flex;
  gap: 0.75rem;
  list-style: none;
  margin: 1.1rem 0 0;
  padding: 0;
}

.icon-link {
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  color: #fff;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.4);
  background: rgba(0, 0, 0, 0.28);
  text-decoration: none;
}

@media (hover: hover) {
  .icon-link:hover {
    color: var(--md-sys-color-primary-container);
    border-color: var(--md-sys-color-primary-container);
  }

  .learn:hover {
    animation-play-state: paused;
  }

  .learn:hover::before {
    opacity: 0.08;
  }
}

.icon-link svg {
  width: 22px;
  height: 22px;
  fill: currentColor;
}

.learn {
  position: absolute;
  left: 50%;
  bottom: 28px;
  isolation: isolate;
  display: grid;
  place-items: center;
  width: 60px;
  height: 60px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: #ffb020;
  color: #1f1f1f;
  cursor: pointer;
  box-shadow: var(--shadow-rest);
  transform: translateX(-50%);
  animation: learn-hint 2.4s ease-in-out infinite;
}

.learn svg {
  width: 36px;
  height: 26px;
  display: block;
}

.learn::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: #1f1f1f;
  opacity: 0;
  pointer-events: none;
}

.learn:active::before {
  opacity: 0.12;
}

.learn:focus-visible {
  outline: 3px solid #ffffff;
  outline-offset: 3px;
}

@keyframes learn-hint {
  0%,
  100% {
    transform: translateX(-50%) translateY(0);
  }
  50% {
    transform: translateX(-50%) translateY(6px);
  }
}

@media (max-width: 700px) {
  .hero {
    padding-top: 6vh;
    padding-right: 20px;
  }

  .learn {
    bottom: 16px;
  }
}

@media (max-width: 430px) {
  .subtitle {
    font-size: clamp(16px, 4.6vw, 20px);
  }
}

@media (max-height: 560px) and (orientation: landscape) {
  .hero {
    padding-top: 6px;
  }

  .subtitle {
    margin-top: 0.2rem;
    font-size: 15px;
  }

  .socials {
    margin-top: 0.35rem;
    gap: 0.45rem;
  }

  .icon-link {
    width: 36px;
    height: 36px;
  }

  .learn {
    bottom: 8px;
    width: 48px;
    height: 48px;
  }
}

@media (max-width: 900px) and (orientation: portrait) {
  /* Centered pill, narrower than the screen. 40px of margin on each
     side, capped at 320px, and it sits above the home indicator. */
  .learn {
    left: 50%;
    right: auto;
    bottom: calc(16px + env(safe-area-inset-bottom, 0px));
    width: min(320px, calc(100% - 80px));
    height: 56px;
    min-height: 56px;
    padding: 0;
    border-radius: 999px;
    transform: translateX(-50%);
    animation: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .caret {
    animation: none;
    display: none;
  }

  .learn {
    animation: none;
  }
}
</style>
