<template>
  <n-space size="small">
    <n-button
      v-for="f in filters"
      :key="f.value"
      :type="current === f.value ? 'primary' : 'default'"
      size="small"
      secondary
      @click="emit('change', f.value)"
    >
      {{ f.label }}
    </n-button>
  </n-space>
</template>

<script setup>
/**
 * JobFilter - 任务过滤按钮组
 */
import { NSpace, NButton } from 'naive-ui';

defineProps({
  current: { type: String, default: '' },
});

const emit = defineEmits(['change']);

const filters = [
  { value: '', label: '全部' },
  { value: 'active', label: '进行中' },
  { value: 'done', label: '已完成' },
  { value: 'failed', label: '异常' },
];
</script>
