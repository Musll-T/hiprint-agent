<template>
  <div class="maintenance-view">
    <n-space vertical :size="16">
      <!-- 快速操作 -->
      <n-card title="快速操作" size="small">
        <QuickActions
          @success="handleSuccess"
          @error="handleError"
          @connectivity="showConnectivity"
          @cups-logs="showCupsLogs"
        />
      </n-card>

      <!-- 一键诊断 -->
      <n-card title="系统诊断" size="small">
        <template #header-extra>
          <n-button
            type="info"
            size="small"
            :loading="diagLoading"
            @click="runDiagnostics"
          >
            一键诊断
          </n-button>
        </template>
        <DiagResult :results="diagResults" />
      </n-card>

      <!-- 连通性结果 -->
      <n-card v-if="connectivityResults.length > 0" title="连通性检测结果" size="small">
        <div class="connectivity-results">
          <div
            v-for="item in connectivityResults"
            :key="item.name"
            class="connectivity-item"
          >
            <span class="connectivity-icon" :class="item.reachable ? 'reachable' : 'unreachable'">
              {{ item.reachable ? '&#10003;' : '&#10007;' }}
            </span>
            <span class="connectivity-name">{{ item.name }}</span>
            <span class="connectivity-status">
              {{ item.reachable ? '可达' : '不可达' }}
              <template v-if="item.error"> ({{ item.error }})</template>
            </span>
          </div>
        </div>
      </n-card>

      <!-- CUPS 日志 -->
      <n-card v-if="cupsLogs !== null" title="CUPS 日志" size="small">
        <CupsLogViewer :logs="cupsLogs" />
      </n-card>
    </n-space>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { NCard, NButton, NSpace, useMessage } from 'naive-ui';
import { postJSON } from '../composables/useApi.js';
import QuickActions from '../components/maintenance/QuickActions.vue';
import DiagResult from '../components/maintenance/DiagResult.vue';
import CupsLogViewer from '../components/maintenance/CupsLogViewer.vue';

const message = useMessage();

const diagLoading = ref(false);
const diagResults = ref([]);
const connectivityResults = ref([]);
const cupsLogs = ref(null);

function handleSuccess(msg) {
  message.success(msg);
}

function handleError(msg) {
  message.error(msg);
}

function showConnectivity(results) {
  connectivityResults.value = results;
  message.info('连通性检测完成');
}

function showCupsLogs(logs) {
  cupsLogs.value = logs;
}

async function runDiagnostics() {
  diagLoading.value = true;
  try {
    const data = await postJSON('/api/maintenance/diagnostics');
    diagResults.value = data.results || [];
    message.success('诊断完成');
  } catch (err) {
    message.error('诊断失败: ' + (err.message || '未知错误'));
  } finally {
    diagLoading.value = false;
  }
}
</script>

<style scoped>
.maintenance-view {
  max-width: 960px;
}

.connectivity-results {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.connectivity-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
  font-size: 13px;
}

.connectivity-icon {
  flex-shrink: 0;
  width: 20px;
  text-align: center;
  font-weight: 700;
}

.connectivity-icon.reachable {
  color: var(--color-done);
}

.connectivity-icon.unreachable {
  color: var(--color-failed);
}

.connectivity-name {
  font-weight: 500;
  color: var(--text-primary);
  min-width: 120px;
}

.connectivity-status {
  color: var(--text-secondary);
}
</style>
