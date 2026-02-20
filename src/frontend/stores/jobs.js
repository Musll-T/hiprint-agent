/**
 * Jobs Store - 任务列表管理
 *
 * 完整迁移 app.js 中所有任务相关状态和操作。
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { fetchJSON, postJSON } from '../composables/useApi.js';

/** 每页数量 */
const PAGE_SIZE = 50;

export const useJobStore = defineStore('jobs', () => {
  // ------------------------------------------------------------------
  // State
  // ------------------------------------------------------------------

  /** 任务列表 */
  const jobs = ref([]);

  /** 任务过滤条件 */
  const filter = ref('');

  /** 任务分页偏移 */
  const offset = ref(0);

  /** 是否还有更多任务 */
  const hasMore = ref(false);

  // ------------------------------------------------------------------
  // Internal
  // ------------------------------------------------------------------

  /**
   * 将过滤标签映射到 API status 参数
   * @param {string} f - 过滤标签
   * @returns {string}
   */
  function mapFilterToStatus(f) {
    switch (f) {
      case 'active':
        return 'rendering,printing,received';
      case 'done':
        return 'done';
      case 'failed':
        return 'failed,cancelled';
      default:
        return '';
    }
  }

  // ------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------

  /** 加载任务列表（重新加载） */
  async function loadJobs() {
    try {
      offset.value = 0;
      const statusParam = mapFilterToStatus(filter.value);
      const url =
        '/api/jobs?limit=' +
        PAGE_SIZE +
        '&offset=0' +
        (statusParam ? '&status=' + statusParam : '');
      const data = await fetchJSON(url);
      jobs.value = data.jobs || [];
      hasMore.value = jobs.value.length >= PAGE_SIZE;
    } catch (err) {
      console.error('加载任务列表失败:', err);
    }
  }

  /** 加载更多任务 */
  async function loadMore() {
    try {
      offset.value += PAGE_SIZE;
      const statusParam = mapFilterToStatus(filter.value);
      const url =
        '/api/jobs?limit=' +
        PAGE_SIZE +
        '&offset=' +
        offset.value +
        (statusParam ? '&status=' + statusParam : '');
      const data = await fetchJSON(url);
      const newJobs = data.jobs || [];
      jobs.value = jobs.value.concat(newJobs);
      hasMore.value = newJobs.length >= PAGE_SIZE;
    } catch (err) {
      console.error('加载更多任务失败:', err);
    }
  }

  /**
   * 取消任务
   * @param {string} id - 任务 ID
   */
  async function cancelJob(id) {
    await postJSON('/api/jobs/' + id + '/cancel');
    await loadJobs();
  }

  /**
   * 重试任务
   * @param {string} id - 任务 ID
   */
  async function retryJob(id) {
    await postJSON('/api/jobs/' + id + '/retry');
    await loadJobs();
  }

  /**
   * 更新单个任务（由 WebSocket job:update 事件触发）
   * @param {object} job - 任务更新数据
   */
  function updateJob(job) {
    if (!job || !job.id) return;
    const idx = jobs.value.findIndex((j) => j.id === job.id);
    if (idx !== -1) {
      jobs.value[idx] = Object.assign({}, jobs.value[idx], job);
    }
  }

  return {
    jobs,
    filter,
    offset,
    hasMore,
    loadJobs,
    loadMore,
    cancelJob,
    retryJob,
    updateJob,
  };
});
