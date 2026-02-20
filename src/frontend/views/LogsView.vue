<template>
  <div class="logs-view">
    <n-card title="实时日志" size="small">
      <template #header-extra>
        <n-space :size="8">
          <n-tag :type="isConnected ? 'success' : 'error'" size="small" round>
            {{ isConnected ? '已连接' : '未连接' }}
          </n-tag>
          <n-button size="small" @click="clearLogs">清空</n-button>
        </n-space>
      </template>

      <div v-if="logs.length === 0" class="logs-empty">
        <n-empty description="等待事件..." />
      </div>
      <div v-else ref="logContainer" class="logs-list">
        <div v-for="(log, index) in logs" :key="index" class="log-entry">
          <span class="log-time">{{ log.time }}</span>
          <n-tag :type="statusType(log.action)" size="tiny" round>
            {{ statusLabel(log.action) }}
          </n-tag>
          <span class="log-detail">{{ log.detail }}</span>
        </div>
      </div>
    </n-card>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { NCard, NButton, NTag, NSpace, NEmpty } from 'naive-ui';
import { useSocket } from '../composables/useSocket.js';
import { shortId } from '../utils/format.js';

const MAX_LOGS = 200;

const { on, off, isConnected } = useSocket();
const logs = ref([]);
const logContainer = ref(null);

const statusMap = {
  received: { label: '已接收', type: 'default' },
  rendering: { label: '渲染中', type: 'info' },
  printing: { label: '打印中', type: 'info' },
  done: { label: '完成', type: 'success' },
  failed_render: { label: '渲染失败', type: 'error' },
  failed_print: { label: '打印失败', type: 'error' },
  canceled: { label: '已取消', type: 'warning' },
  timeout: { label: '超时', type: 'warning' },
};

function statusLabel(action) {
  return statusMap[action]?.label || action;
}

function statusType(action) {
  return statusMap[action]?.type || 'default';
}

function addLog(job) {
  const entry = {
    time: new Date().toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    action: job.status,
    detail:
      '\u4EFB\u52A1 ' + shortId(job.id) + ' \u2192 ' + statusLabel(job.status) +
      (job.printer ? ' [' + job.printer + ']' : '') +
      (job.error_msg ? ' ' + job.error_msg : ''),
  };
  logs.value.unshift(entry);
  if (logs.value.length > MAX_LOGS) {
    logs.value.pop();
  }
}

function clearLogs() {
  logs.value = [];
}

onMounted(() => {
  on('job:update', addLog);
});

onUnmounted(() => {
  off('job:update', addLog);
});
</script>

<style scoped>
.logs-view {
  max-width: 960px;
}

.logs-empty {
  padding: 40px 0;
}

.logs-list {
  max-height: 600px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.log-entry {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  transition: background var(--transition-fast);
}

.log-entry:hover {
  background: var(--bg-elevated);
}

.log-time {
  flex-shrink: 0;
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 12px;
  color: var(--text-quaternary);
  min-width: 70px;
}

.log-detail {
  color: var(--text-secondary);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
