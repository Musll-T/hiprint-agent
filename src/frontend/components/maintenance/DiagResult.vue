<template>
  <div class="diag-results">
    <div
      v-for="(item, index) in results"
      :key="index"
      class="diag-item"
      :class="'diag-' + item.status"
    >
      <span class="diag-icon">
        <template v-if="item.status === 'ok'">&#10003;</template>
        <template v-else-if="item.status === 'warning'">&#9888;</template>
        <template v-else>&#10007;</template>
      </span>
      <span class="diag-name">{{ item.name }}</span>
      <span class="diag-detail">{{ item.detail }}</span>
    </div>
    <n-empty v-if="!results || results.length === 0" description="暂无诊断结果" />
  </div>
</template>

<script setup>
import { NEmpty } from 'naive-ui';

defineProps({
  results: {
    type: Array,
    default: () => [],
  },
});
</script>

<style scoped>
.diag-results {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.diag-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
  font-size: 13px;
}

.diag-icon {
  flex-shrink: 0;
  width: 20px;
  text-align: center;
  font-weight: 700;
  font-size: 14px;
}

.diag-name {
  font-weight: 500;
  color: var(--text-primary);
  min-width: 120px;
}

.diag-detail {
  color: var(--text-secondary);
  flex: 1;
}

.diag-ok .diag-icon {
  color: var(--color-done);
}

.diag-warning .diag-icon {
  color: var(--color-waiting);
}

.diag-error .diag-icon {
  color: var(--color-failed);
}
</style>
