<script setup lang="ts">
import { computed } from 'vue';
import { detectDirection } from '../lib/textDirection';

const props = defineProps<{ text: string }>();
const direction = computed(() => detectDirection(props.text));
const lang = computed(() => (direction.value === 'rtl' ? 'ur' : 'en'));
</script>

<template>
  <p :dir="direction" :lang="lang" :class="{ urdu: direction === 'rtl' }">{{ text }}</p>
</template>

<style scoped>
p {
  margin: 0;
  white-space: pre-wrap;
}
.urdu {
  font-family: var(--font-family-urdu);
  font-size: 1.1em;
  line-height: 2;
}
</style>
