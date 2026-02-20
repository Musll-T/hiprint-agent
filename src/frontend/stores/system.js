/**
 * System Store - 系统状态管理
 *
 * 管理系统指标数据（CPU/内存/队列/连接数），
 * 由 sys:stats WebSocket 事件驱动更新。
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { fetchJSON } from '../composables/useApi.js';

export const useSystemStore = defineStore('system', () => {
  // ------------------------------------------------------------------
  // State
  // ------------------------------------------------------------------

  /** 系统指标（由 sys:stats 事件更新） */
  const systemStats = ref({
    system: null,
    jobs: null,
    connections: 0,
    timestamp: null,
  });

  // ------------------------------------------------------------------
  // Computed
  // ------------------------------------------------------------------

  /** 活跃任务数 = 渲染中 + 打印中 */
  const activeJobCount = computed(() => {
    const j = systemStats.value.jobs;
    if (!j) return 0;
    return (j.rendering || 0) + (j.printing || 0);
  });

  /** 内存使用百分比 */
  const memUsagePercent = computed(() => {
    const s = systemStats.value.system;
    if (!s || !s.totalMem) return 0;
    const used = s.totalMem - s.freeMem;
    return Math.round((used / s.totalMem) * 100);
  });

  // ------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------

  /** 初始加载系统状态（REST API） */
  async function loadStatus() {
    try {
      const data = await fetchJSON('/api/status');
      systemStats.value = {
        system: data.system || null,
        jobs: data.jobs || null,
        connections: data.connections || 0,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      console.error('加载系统状态失败:', err);
    }
  }

  /**
   * 更新系统指标（由 WebSocket sys:stats 事件触发）
   * @param {object} stats - 后端推送的指标数据
   */
  function updateStats(stats) {
    if (stats) {
      systemStats.value = stats;
    }
  }

  return {
    systemStats,
    activeJobCount,
    memUsagePercent,
    loadStatus,
    updateStats,
  };
});
