<script setup>
import BulletTree from "./BulletTree.vue";

defineProps({
  items: { type: Array, required: true },
});
</script>

<template>
  <ul class="bullets">
    <li v-for="(item, i) in items" :key="i">
      <template v-if="typeof item === 'string'">{{ item }}</template>
      <template v-else>
        <strong v-if="item.strong">{{ item.text }}</strong>
        <template v-else>{{ item.text }}</template>
        <BulletTree v-if="item.children?.length" :items="item.children" />
      </template>
    </li>
  </ul>
</template>
