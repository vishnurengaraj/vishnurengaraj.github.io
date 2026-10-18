<script setup>
defineProps({
  image: { type: Object, required: true },
  alt: { type: String, default: "" },
  sizes: { type: String, default: "(max-width: 800px) 92vw, 720px" },
});
</script>

<template>
  <picture>
    <source v-if="image.avif" type="image/avif" :srcset="image.avif" :sizes="sizes" />
    <source v-if="image.webp" type="image/webp" :srcset="image.webp" :sizes="sizes" />
    <source v-if="image.animated" type="image/webp" :srcset="image.animated" />
    <img
      :src="image.fallback"
      :alt="alt"
      :width="image.w"
      :height="image.h"
      loading="lazy"
      decoding="async"
    />
  </picture>
</template>
