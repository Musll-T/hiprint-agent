<template>
  <n-card class="job-card" size="small">
    <!-- 第一行：ID + 状态 -->
    <div class="job-card-row">
      <span class="job-id" @click="emit('preview', job.id)">
        {{ shortId(job.id) }}
      </span>
      <StatusBadge :status="job.status" />
    </div>

    <!-- 第二行：类型 + 打印机 -->
    <div class="job-card-row secondary">
      <span>{{ job.type || '--' }}</span>
      <span v-if="job.printer" class="job-printer">{{ job.printer }}</span>
    </div>

    <!-- 打印参数标签 -->
    <div v-if="optTags.length" class="job-card-row">
      <n-space size="small" :wrap="true">
        <n-tag
          v-for="(tag, i) in optTags"
          :key="i"
          :type="optTagType(tag.type)"
          size="tiny"
          :bordered="false"
          round
          :title="tag.title"
        >
          {{ tag.label }}
        </n-tag>
      </n-space>
    </div>

    <!-- 第三行：时间 -->
    <div class="job-card-row secondary">
      <span>{{ formatTime(job.created_at) }}</span>
      <span v-if="duration" class="tabular-nums">{{ duration }}</span>
    </div>

    <!-- 操作 -->
    <div v-if="hasActions" class="job-card-actions">
      <n-button
        v-if="canCancel"
        size="tiny"
        type="warning"
        quaternary
        @click="emit('cancel', job.id)"
      >
        取消
      </n-button>
      <n-button
        v-if="canRetry"
        size="tiny"
        type="info"
        quaternary
        @click="emit('retry', job.id)"
      >
        重试
      </n-button>
    </div>
  </n-card>
</template>

<script setup>
/**
 * JobCard - 移动端任务卡片
 */
import { computed } from 'vue';
import { NCard, NButton, NTag, NSpace } from 'naive-ui';
import StatusBadge from '../common/StatusBadge.vue';
import { formatTime, shortId, formatPrintOptions } from '../../utils/format.js';

const props = defineProps({
  job: { type: Object, required: true },
});

const emit = defineEmits(['preview', 'cancel', 'retry']);

const optTags = computed(() => formatPrintOptions(props.job.print_options));

const canCancel = computed(() =>
  ['received', 'rendering'].includes(props.job.status)
);

const canRetry = computed(() =>
  ['failed_render', 'failed_print'].includes(props.job.status)
);

const hasActions = computed(() => canCancel.value || canRetry.value);

const duration = computed(() => {
  const r = props.job.render_duration;
  const p = props.job.print_duration;
  if (!r && !p) return '';
  const parts = [];
  if (r) parts.push('渲染 ' + r + 'ms');
  if (p) parts.push('打印 ' + p + 'ms');
  return parts.join(' / ');
});

/**
 * 打印参数标签类型映射
 * @param {string} type
 * @returns {string}
 */
function optTagType(type) {
  const map = {
    size: 'info',
    color: 'success',
    mono: 'default',
    duplex: 'warning',
    landscape: 'info',
    copies: 'warning',
    range: 'info',
  };
  return map[type] || 'default';
}
</script>

<style scoped>
.job-card {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-color);
}

.job-card-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.job-card-row + .job-card-row {
  margin-top: 6px;
}

.job-card-row.secondary {
  font-size: 12px;
  color: var(--text-tertiary);
}

.job-id {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 13px;
  color: var(--accent);
  cursor: pointer;
}

.job-id:hover {
  text-decoration: underline;
}

.job-printer {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 12px;
}

.job-card-actions {
  margin-top: 8px;
  display: flex;
  gap: 4px;
  justify-content: flex-end;
}
</style>
