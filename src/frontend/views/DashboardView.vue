<template>
  <div class="dashboard">
    <!-- 统计卡片网格 -->
    <div class="stats-grid">
      <!-- CPU 使用率 -->
      <StatCard
        :icon="Cpu"
        icon-class="stat-icon-cpu"
        label="CPU"
        :value="cpuValue"
        sub-label="处理器使用率"
        :animated="true"
      />

      <!-- 内存使用 -->
      <StatCard
        :icon="MemoryStick"
        icon-class="stat-icon-mem"
        label="MEMORY"
        :value="memValue"
        :animated="true"
      >
        <MemRing
          :percent="systemStore.memUsagePercent"
          :total-mem="sys?.totalMem || 0"
          :free-mem="sys?.freeMem || 0"
        />
      </StatCard>

      <!-- 活跃任务 -->
      <StatCard
        :icon="FileText"
        icon-class="stat-icon-jobs"
        label="JOBS"
        :value="String(systemStore.activeJobCount)"
        sub-label="活跃任务"
        :animated="true"
      >
        <template #detail>
          <span class="badge badge-rendering">{{ jobStats.rendering }} 渲染</span>
          <span class="badge badge-printing">{{ jobStats.printing }} 打印</span>
          <span class="badge badge-received">{{ jobStats.received }} 等待</span>
        </template>
      </StatCard>

      <!-- 运行时间 -->
      <StatCard
        :icon="Clock"
        icon-class="stat-icon-uptime"
        label="UPTIME"
        :value="uptimeValue"
        sub-label="服务运行时间"
        :animated="true"
      />

      <!-- 连接数 -->
      <StatCard
        :icon="Wifi"
        icon-class="stat-icon-conn"
        label="CONNECTIONS"
        :value="String(systemStats.connections || 0)"
        sub-label="Socket.IO 连接"
        :animated="true"
        :mini="true"
      />
    </div>

    <!-- 设备信息卡片 -->
    <div class="info-section">
      <StatCard
        :icon="Monitor"
        icon-class="stat-icon-device"
        label="DEVICE"
        value=""
      >
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">主机名</span>
            <span class="info-value">{{ sys?.hostname || '--' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">平台</span>
            <span class="info-value">{{ sys?.platform || '--' }} / {{ sys?.arch || '--' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Node.js</span>
            <span class="info-value">{{ sys?.nodeVersion || '--' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Machine ID</span>
            <span class="info-value mono">{{ shortId(sys?.machineId) }}</span>
          </div>
          <div v-if="sys?.agentId" class="info-item">
            <span class="info-label">Agent ID</span>
            <span class="info-value mono">{{ sys.agentId }}</span>
          </div>
        </div>
      </StatCard>

      <!-- 中转服务状态 -->
      <StatCard
        v-if="transit"
        :icon="Globe"
        icon-class="stat-icon-transit"
        label="TRANSIT"
        value=""
      >
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">连接状态</span>
            <span class="info-value">
              <span class="conn-dot" :class="{ connected: transit.connected }"></span>
              {{ transit.connected ? '已连接' : '未连接' }}
            </span>
          </div>
          <div class="info-item">
            <span class="info-label">服务地址</span>
            <span class="info-value mono">{{ transit.url || '--' }}</span>
          </div>
        </div>
      </StatCard>
    </div>
  </div>
</template>

<script setup>
/**
 * DashboardView - 仪表盘视图
 *
 * 完整迁移旧版 app.js 中 Dashboard 区域的数据展示：
 * - CPU/内存/任务/运行时间/连接数统计卡片
 * - 设备信息卡片
 * - 中转服务状态（可选）
 */
import { computed } from 'vue';
import {
  Cpu,
  MemoryStick,
  FileText,
  Clock,
  Wifi,
  Monitor,
  Globe,
} from 'lucide-vue-next';

import { useSystemStore } from '../stores/system.js';
import { formatBytes, formatUptime, shortId } from '../utils/format.js';
import StatCard from '../components/dashboard/StatCard.vue';
import MemRing from '../components/dashboard/MemRing.vue';

const systemStore = useSystemStore();

const systemStats = computed(() => systemStore.systemStats);
const sys = computed(() => systemStats.value.system);
const transit = computed(() => systemStats.value.transit || null);

const cpuValue = computed(() => {
  const cpu = sys.value?.cpuUsage;
  if (cpu == null) return '--';
  return cpu.toFixed(1) + '%';
});

const memValue = computed(() => {
  return systemStore.memUsagePercent + '%';
});

const uptimeValue = computed(() => {
  return formatUptime(sys.value?.uptime);
});

const jobStats = computed(() => {
  const j = systemStats.value.jobs;
  return {
    rendering: j?.rendering || 0,
    printing: j?.printing || 0,
    received: j?.received || 0,
  };
});
</script>

<style scoped>
.dashboard {
  max-width: 1200px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.info-section {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 16px;
}

/* 状态徽章 */
.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.badge-rendering {
  background: rgba(168, 85, 247, 0.12);
  color: var(--color-rendering);
}

.badge-printing {
  background: rgba(59, 130, 246, 0.12);
  color: var(--color-printing);
}

.badge-received {
  background: rgba(245, 158, 11, 0.12);
  color: var(--color-waiting);
}

/* 设备信息网格 */
.info-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 4px;
}

.info-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.info-label {
  font-size: 13px;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.info-value {
  font-size: 13px;
  color: var(--text-secondary);
  text-align: right;
  word-break: break-all;
  display: flex;
  align-items: center;
  gap: 6px;
}

.info-value.mono {
  font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
  font-size: 12px;
}

/* 连接状态点 */
.conn-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--color-failed);
  flex-shrink: 0;
  transition: background-color var(--transition-base);
}

.conn-dot.connected {
  background-color: var(--color-done);
}

@media (max-width: 767px) {
  .stats-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .info-section {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}
</style>
