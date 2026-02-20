<template>
  <n-card :title="title" size="small">
    <slot />
  </n-card>
</template>

<script setup>
import { NCard } from 'naive-ui';

defineProps({
  title: {
    type: String,
    required: true,
  },
});
</script>
