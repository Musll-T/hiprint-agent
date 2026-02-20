<template>
  <n-card class="printer-card" hoverable>
    <!-- 头部：状态灯 + 名称 + 徽章 -->
    <template #header>
      <div class="printer-card-header">
        <span class="status-dot" :class="statusDotClass" />
        <span class="printer-name">{{ printer.name }}</span>
        <n-tag
          v-if="printer.isDefault"
          type="info"
          size="tiny"
          :bordered="false"
          round
        >
          默认
        </n-tag>
        <StatusBadge :status="printerStatusKey" />
      </div>
    </template>

    <!-- 中部：详细信息 -->
    <div class="printer-detail">
      <div v-if="printer.model" class="detail-row">
        <span class="detail-label">型号</span>
        <span class="detail-value">{{ printer.model }}</span>
      </div>
      <div v-if="printer.description" class="detail-row">
        <span class="detail-label">描述</span>
        <span class="detail-value">{{ printer.description }}</span>
      </div>
      <div v-if="printer.location" class="detail-row">
        <span class="detail-label">位置</span>
        <span class="detail-value">{{ printer.location }}</span>
      </div>
      <div v-if="printer.deviceUri" class="detail-row">
        <span class="detail-label">URI</span>
        <span class="detail-value uri-text">{{ printer.deviceUri }}</span>
      </div>
      <div v-if="printer.statusMessage" class="detail-row">
        <span class="detail-label">状态</span>
        <span class="detail-value">{{ printer.statusMessage }}</span>
      </div>
    </div>

    <!-- 底部：操作按钮 -->
    <template #action>
      <n-space size="small">
        <n-button
          v-if="!printer.isDefault"
          size="small"
          quaternary
          :loading="props.actionLoading === 'setDefault'"
          :disabled="!!props.actionLoading"
          @click="emit('setDefault', printer.name)"
        >
          设为默认
        </n-button>
        <n-button
          v-if="isStopped"
          size="small"
          quaternary
          type="success"
          :loading="props.actionLoading === 'enable'"
          :disabled="!!props.actionLoading"
          @click="emit('enable', printer.name)"
        >
          启用
        </n-button>
        <n-button
          v-else
          size="small"
          quaternary
          type="warning"
          :loading="props.actionLoading === 'disable'"
          :disabled="!!props.actionLoading"
          @click="emit('disable', printer.name)"
        >
          停用
        </n-button>
        <n-button
          size="small"
          quaternary
          type="info"
          :disabled="!!props.actionLoading"
          @click="emit('edit', printer)"
        >
          编辑
        </n-button>
        <n-button
          size="small"
          quaternary
          type="error"
          :loading="props.actionLoading === 'delete'"
          :disabled="!!props.actionLoading"
          @click="emit('delete', printer.name)"
        >
          删除
        </n-button>
      </n-space>
    </template>
  </n-card>
</template>

<script setup>
/**
 * PrinterCard - 打印机卡片
 *
 * 三分区布局：头部状态/中部信息/底部操作。
 */
import { computed } from 'vue';
import { NCard, NButton, NSpace, NTag } from 'naive-ui';
import StatusBadge from '../common/StatusBadge.vue';

const props = defineProps({
  printer: { type: Object, required: true },
  actionLoading: { type: String, default: '' },
});

const emit = defineEmits(['edit', 'delete', 'setDefault', 'enable', 'disable']);

/** 解析打印机状态 */
const printerStatusKey = computed(() => {
  const s = (props.printer.status || '').toLowerCase();
  if (s === 'idle' || s.includes('idle')) return 'idle';
  if (s.includes('printing') || s.includes('processing')) return 'printing';
  return 'stopped';
});

const statusDotClass = computed(() => {
  const key = printerStatusKey.value;
  if (key === 'idle') return 'dot-ready';
  if (key === 'printing') return 'dot-busy';
  return 'dot-stopped';
});

const isStopped = computed(() => printerStatusKey.value === 'stopped');
</script>

<style scoped>
.printer-card {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-color);
  transition: border-color var(--transition-fast);
}

.printer-card:hover {
  border-color: var(--accent);
}

.printer-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.printer-name {
  font-weight: 600;
  font-size: 15px;
  word-break: break-all;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot-ready {
  background-color: var(--color-done);
  box-shadow: 0 0 6px var(--color-done);
}

.dot-busy {
  background-color: var(--color-printing);
  box-shadow: 0 0 6px var(--color-printing);
  animation: pulse 1.5s infinite;
}

.dot-stopped {
  background-color: var(--color-cancelled);
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

.printer-detail {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.detail-row {
  display: flex;
  gap: 8px;
  font-size: 13px;
  line-height: 1.4;
}

.detail-label {
  color: var(--text-tertiary);
  flex-shrink: 0;
  width: 40px;
  text-align: right;
}

.detail-value {
  color: var(--text-secondary);
  word-break: break-all;
}

.uri-text {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 12px;
}
</style>
