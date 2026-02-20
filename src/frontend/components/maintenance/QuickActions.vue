<template>
  <div class="quick-actions-grid">
    <n-card v-for="action in actions" :key="action.key" size="small">
      <div class="quick-action-content">
        <div class="quick-action-info">
          <div class="quick-action-title">{{ action.title }}</div>
          <div class="quick-action-desc">{{ action.desc }}</div>
        </div>
        <n-button
          :type="action.btnType"
          :loading="loadingMap[action.key]"
          :disabled="loadingMap[action.key]"
          size="small"
          @click="handleAction(action)"
        >
          {{ action.label }}
        </n-button>
      </div>
    </n-card>
  </div>
</template>

<script setup>
import { reactive } from 'vue';
import { NCard, NButton } from 'naive-ui';
import { postJSON, fetchJSON } from '../../composables/useApi.js';

const emit = defineEmits(['success', 'error', 'connectivity', 'cups-logs']);

const loadingMap = reactive({
  clearQueues: false,
  restartCups: false,
  connectivity: false,
  cupsLogs: false,
});

const actions = [
  {
    key: 'clearQueues',
    title: '清空打印队列',
    desc: '清空所有队列中的等待和处理中的任务',
    label: '清空队列',
    btnType: 'error',
    handler: async () => {
      await postJSON('/api/maintenance/queues/clear');
      emit('success', '队列已清空');
    },
  },
  {
    key: 'restartCups',
    title: '重启 CUPS 服务',
    desc: '重启系统 CUPS 打印服务',
    label: '重启 CUPS',
    btnType: 'warning',
    handler: async () => {
      await postJSON('/api/maintenance/cups/restart');
      emit('success', 'CUPS 服务已重启');
    },
  },
  {
    key: 'connectivity',
    title: '检测打印机连通性',
    desc: '检测所有打印机的网络连通性',
    label: '开始检测',
    btnType: 'default',
    handler: async () => {
      const data = await fetchJSON('/api/maintenance/printers/connectivity');
      emit('connectivity', data.results || []);
    },
  },
  {
    key: 'cupsLogs',
    title: '查看 CUPS 日志',
    desc: '获取 CUPS 错误日志',
    label: '获取日志',
    btnType: 'default',
    handler: async () => {
      const data = await fetchJSON('/api/maintenance/cups/logs?lines=200');
      emit('cups-logs', data.logs || '');
    },
  },
];

async function handleAction(action) {
  loadingMap[action.key] = true;
  try {
    await action.handler();
  } catch (err) {
    emit('error', action.title + '失败: ' + (err.message || '未知错误'));
  } finally {
    loadingMap[action.key] = false;
  }
}
</script>

<style scoped>
.quick-actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.quick-action-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.quick-action-info {
  flex: 1;
  min-width: 0;
}

.quick-action-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.quick-action-desc {
  font-size: 12px;
  color: var(--text-tertiary);
}
</style>
