/**
 * HiPrint Agent 管理面板 - 前端应用
 *
 * 基于 Vue 3 Composition API (CDN 全局构建) + Socket.IO Client，
 * 提供 Dashboard / Printers / Jobs / Logs 四个视图，
 * 通过 REST API 获取数据，通过 WebSocket 实时更新。
 */

/* global Vue, io */

const { createApp, ref, shallowRef, computed, onMounted, onUnmounted, watch, nextTick } = Vue;

// ============================================================
// API 工具函数
// ============================================================

/**
 * 发起 GET 请求并返回 JSON
 * @param {string} url - 请求地址
 * @returns {Promise<any>}
 */
async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`请求失败: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/**
 * 发起 POST 请求并返回 JSON
 * @param {string} url - 请求地址
 * @returns {Promise<any>}
 */
async function postJSON(url) {
  const res = await fetch(url, { method: 'POST' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `请求失败: ${res.status}`);
  }
  return res.json();
}

// ============================================================
// Vue 应用
// ============================================================

const app = createApp({
  setup() {
    // ----------------------------------------------------------
    // 导航 Tab 定义
    // ----------------------------------------------------------
    // SVG 图标（Lucide 风格，stroke-based）
    const tabs = [
      { key: 'dashboard', label: '仪表盘', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>' },
      { key: 'printers',  label: '打印机', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>' },
      { key: 'jobs',      label: '任务',   icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect><line x1="9" y1="12" x2="15" y2="12"></line><line x1="9" y1="16" x2="13" y2="16"></line></svg>' },
      { key: 'logs',      label: '日志',   icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>' },
    ];

    const currentTab = ref('dashboard');

    // ----------------------------------------------------------
    // 响应式检测
    // ----------------------------------------------------------
    const isMobile = ref(window.innerWidth < 768);
    let resizeHandler = null;

    // ----------------------------------------------------------
    // Socket.IO 连接
    // ----------------------------------------------------------
    const socketConnected = ref(false);
    let socket = null;

    // ----------------------------------------------------------
    // 响应式数据
    // ----------------------------------------------------------

    /** 系统指标（由 sys:stats 事件更新） */
    const systemStats = ref({
      system: null,
      jobs: null,
      connections: 0,
      timestamp: null,
    });

    /** 打印机列表 */
    const printers = ref([]);

    /** 任务列表 */
    const jobs = ref([]);

    /** 任务过滤条件 */
    const jobFilter = ref('');

    /** 任务分页偏移 */
    const jobOffset = ref(0);

    /** 是否还有更多任务 */
    const hasMoreJobs = ref(false);

    /** 每页数量 */
    const PAGE_SIZE = 50;

    /** Toast 消息队列 */
    const toasts = ref([]);
    let toastIdCounter = 0;

    /** 日志条目（从任务事件中收集，使用 shallowRef 避免深层响应式开销） */
    const logEntries = shallowRef([]);
    const MAX_LOG_ENTRIES = 200;

    // ----------------------------------------------------------
    // 任务过滤选项
    // ----------------------------------------------------------
    const jobFilters = [
      { label: '全部',   value: '' },
      { label: '进行中', value: 'active' },
      { label: '已完成', value: 'done' },
      { label: '失败',   value: 'failed' },
    ];

    // ----------------------------------------------------------
    // 计算属性
    // ----------------------------------------------------------

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

    /** 内存使用等级样式 */
    const memUsageClass = computed(() => {
      const p = memUsagePercent.value;
      if (p < 60) return 'mem-low';
      if (p < 85) return 'mem-medium';
      return 'mem-high';
    });

    // ----------------------------------------------------------
    // 格式化工具
    // ----------------------------------------------------------

    /**
     * 格式化字节数为可读字符串
     * @param {number} bytes - 字节数
     * @returns {string}
     */
    function formatBytes(bytes) {
      if (!bytes && bytes !== 0) return '--';
      if (bytes === 0) return '0 B';
      const units = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      const val = (bytes / Math.pow(1024, i)).toFixed(1);
      return val + ' ' + units[i];
    }

    /**
     * 格式化运行时间（秒）
     * @param {number} seconds - 秒数
     * @returns {string}
     */
    function formatUptime(seconds) {
      if (!seconds && seconds !== 0) return '--';
      const d = Math.floor(seconds / 86400);
      const h = Math.floor((seconds % 86400) / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      if (d > 0) return d + '天 ' + h + '时';
      if (h > 0) return h + '时 ' + m + '分';
      return m + '分';
    }

    /**
     * 格式化时间戳为本地时间
     * @param {string|number} ts - ISO 时间字符串或时间戳
     * @returns {string}
     */
    function formatTime(ts) {
      if (!ts) return '--';
      try {
        const d = new Date(ts);
        return d.toLocaleString('zh-CN', {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
      } catch {
        return '--';
      }
    }

    /**
     * 截取 ID 的前 8 位
     * @param {string} id - 完整 ID
     * @returns {string}
     */
    function shortId(id) {
      if (!id) return '--';
      return id.length > 8 ? id.substring(0, 8) : id;
    }

    // ----------------------------------------------------------
    // 打印机状态辅助函数
    // ----------------------------------------------------------

    /**
     * 获取打印机状态指示灯 CSS class
     * @param {number} status - 打印机状态码
     * @returns {string}
     */
    function printerStatusClass(status) {
      if (status === 0) return 'status-ready';
      if (status === 1) return 'status-busy';
      return 'status-stopped';
    }

    /**
     * 获取打印机状态文字
     * @param {number} status - 打印机状态码
     * @returns {string}
     */
    function printerStatusText(status) {
      if (status === 0) return '就绪';
      if (status === 1) return '打印中';
      return '已停止';
    }

    /**
     * 获取打印机状态徽章 CSS class
     * @param {number} status - 打印机状态码
     * @returns {string}
     */
    function printerBadgeClass(status) {
      if (status === 0) return 'badge-printer-ready';
      if (status === 1) return 'badge-printer-busy';
      return 'badge-printer-stopped';
    }

    // ----------------------------------------------------------
    // 任务状态辅助函数
    // ----------------------------------------------------------

    /** 任务状态到中文文本的映射 */
    const JOB_STATUS_TEXT = {
      received:   '已接收',
      rendering:  '渲染中',
      printing:   '打印中',
      done:       '已完成',
      failed:     '失败',
      cancelled:  '已取消',
    };

    /** 任务状态到徽章 CSS class 的映射 */
    const JOB_BADGE_CLASS = {
      received:   'badge-received',
      rendering:  'badge-rendering',
      printing:   'badge-printing',
      done:       'badge-done',
      failed:     'badge-failed',
      cancelled:  'badge-cancelled',
    };

    /**
     * 获取任务状态文字
     * @param {string} status - 任务状态
     * @returns {string}
     */
    function jobStatusText(status) {
      return JOB_STATUS_TEXT[status] || status || '--';
    }

    /**
     * 获取任务状态徽章 CSS class
     * @param {string} status - 任务状态
     * @returns {string}
     */
    function jobBadgeClass(status) {
      return JOB_BADGE_CLASS[status] || 'badge-received';
    }

    /**
     * 判断任务是否可以取消
     * @param {string} status - 任务状态
     * @returns {boolean}
     */
    function canCancel(status) {
      return status === 'received' || status === 'rendering' || status === 'printing';
    }

    /**
     * 判断任务是否可以重试
     * @param {string} status - 任务状态
     * @returns {boolean}
     */
    function canRetry(status) {
      return status === 'failed' || status === 'cancelled';
    }

    // ----------------------------------------------------------
    // Toast 提示
    // ----------------------------------------------------------

    /**
     * 显示 Toast 提示
     * @param {string} message - 消息文本
     * @param {'success'|'error'|'info'|'warning'} type - 消息类型
     */
    function showToast(message, type) {
      const id = ++toastIdCounter;
      toasts.value.push({ id, message, type: type || 'info' });
      // 3 秒后自动移除
      setTimeout(() => {
        toasts.value = toasts.value.filter((t) => t.id !== id);
      }, 3000);
    }

    // ----------------------------------------------------------
    // 数据加载
    // ----------------------------------------------------------

    /** 加载打印机列表 */
    async function loadPrinters() {
      try {
        const data = await fetchJSON('/api/printers');
        printers.value = data.printers || [];
      } catch (err) {
        console.error('加载打印机列表失败:', err);
      }
    }

    /** 加载任务列表（重新加载） */
    async function loadJobs() {
      try {
        jobOffset.value = 0;
        // 将过滤条件映射到 API 参数
        const statusParam = mapFilterToStatus(jobFilter.value);
        const url = '/api/jobs?limit=' + PAGE_SIZE + '&offset=0' + (statusParam ? '&status=' + statusParam : '');
        const data = await fetchJSON(url);
        jobs.value = data.jobs || [];
        hasMoreJobs.value = jobs.value.length >= PAGE_SIZE;
      } catch (err) {
        console.error('加载任务列表失败:', err);
      }
    }

    /** 加载更多任务 */
    async function loadMoreJobs() {
      try {
        jobOffset.value += PAGE_SIZE;
        const statusParam = mapFilterToStatus(jobFilter.value);
        const url = '/api/jobs?limit=' + PAGE_SIZE + '&offset=' + jobOffset.value + (statusParam ? '&status=' + statusParam : '');
        const data = await fetchJSON(url);
        const newJobs = data.jobs || [];
        jobs.value = jobs.value.concat(newJobs);
        hasMoreJobs.value = newJobs.length >= PAGE_SIZE;
      } catch (err) {
        console.error('加载更多任务失败:', err);
      }
    }

    /**
     * 将过滤标签映射到 API status 参数
     * @param {string} filter - 过滤标签
     * @returns {string} API 查询参数
     */
    function mapFilterToStatus(filter) {
      switch (filter) {
        case 'active':  return 'rendering,printing,received';
        case 'done':    return 'done';
        case 'failed':  return 'failed,cancelled';
        default:        return '';
      }
    }

    /** 初始加载系统状态 */
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

    // ----------------------------------------------------------
    // 任务操作
    // ----------------------------------------------------------

    /**
     * 取消任务
     * @param {string} id - 任务 ID
     */
    async function cancelJob(id) {
      try {
        await postJSON('/api/jobs/' + id + '/cancel');
        showToast('任务已取消', 'success');
        loadJobs();
      } catch (err) {
        showToast('取消失败: ' + err.message, 'error');
      }
    }

    /**
     * 重试任务
     * @param {string} id - 任务 ID
     */
    async function retryJob(id) {
      try {
        await postJSON('/api/jobs/' + id + '/retry');
        showToast('任务已重新提交', 'success');
        loadJobs();
      } catch (err) {
        showToast('重试失败: ' + err.message, 'error');
      }
    }

    // ----------------------------------------------------------
    // 日志记录
    // ----------------------------------------------------------

    /**
     * 添加日志条目
     * @param {object} job - 任务对象
     */
    function addLogEntry(job) {
      const entry = {
        id: job.id,
        status: job.status,
        printer: job.printer || null,
        time: job.updatedAt || job.createdAt || new Date().toISOString(),
      };
      // shallowRef 需要替换整个数组引用才能触发响应式更新
      const updated = [entry, ...logEntries.value];
      logEntries.value = updated.length > MAX_LOG_ENTRIES
        ? updated.slice(0, MAX_LOG_ENTRIES)
        : updated;
    }

    // ----------------------------------------------------------
    // 剪贴板工具
    // ----------------------------------------------------------

    /**
     * 复制设备编号到剪贴板
     */
    function copyMachineId() {
      const id = systemStats.value.system?.machineId;
      if (!id) return;
      navigator.clipboard.writeText(id).then(() => {
        showToast('设备编号已复制', 'success');
      }).catch(() => {
        showToast('复制失败，请手动选取', 'error');
      });
    }

    // ----------------------------------------------------------
    // Socket.IO 连接初始化
    // ----------------------------------------------------------

    function initSocket() {
      socket = io({
        path: '/admin-ws',
        transports: ['websocket', 'polling'],
      });

      socket.on('connect', () => {
        socketConnected.value = true;
        showToast('WebSocket 已连接', 'success');
      });

      socket.on('disconnect', () => {
        socketConnected.value = false;
        showToast('WebSocket 已断开', 'warning');
      });

      // 任务状态变更（使用 requestAnimationFrame 节流批量处理）
      let jobUpdateQueue = [];
      let jobUpdateScheduled = false;

      socket.on('job:update', (job) => {
        if (!job || !job.id) return;
        jobUpdateQueue.push(job);

        if (!jobUpdateScheduled) {
          jobUpdateScheduled = true;
          requestAnimationFrame(() => {
            // 批量处理所有排队的更新
            for (const update of jobUpdateQueue) {
              // 更新任务列表中已有的任务
              const idx = jobs.value.findIndex((j) => j.id === update.id);
              if (idx !== -1) {
                jobs.value[idx] = Object.assign({}, jobs.value[idx], update);
              }

              // 记录日志
              addLogEntry(update);

              // 特定状态显示 Toast
              if (update.status === 'done') {
                showToast('任务 ' + shortId(update.id) + ' 已完成', 'success');
              } else if (update.status === 'failed') {
                showToast('任务 ' + shortId(update.id) + ' 失败', 'error');
              }
            }
            jobUpdateQueue = [];
            jobUpdateScheduled = false;
          });
        }
      });

      // 系统指标更新
      socket.on('sys:stats', (stats) => {
        if (stats) {
          systemStats.value = stats;
        }
      });
    }

    // ----------------------------------------------------------
    // 生命周期
    // ----------------------------------------------------------

    /** 定时刷新打印机列表的定时器 */
    let printerRefreshTimer = null;

    onMounted(() => {
      // 初始化响应式监听
      resizeHandler = () => {
        isMobile.value = window.innerWidth < 768;
      };
      window.addEventListener('resize', resizeHandler);

      // 初始化 Socket.IO
      initSocket();

      // 加载初始数据
      loadStatus();
      loadPrinters();
      loadJobs();

      // 定时刷新打印机列表（每 30 秒）
      printerRefreshTimer = setInterval(loadPrinters, 30000);
    });

    onUnmounted(() => {
      // 清理资源
      if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler);
      }
      if (socket) {
        socket.disconnect();
      }
      if (printerRefreshTimer) {
        clearInterval(printerRefreshTimer);
      }
    });

    // 切换到 printers / jobs Tab 时自动刷新数据
    watch(currentTab, (tab) => {
      if (tab === 'printers') loadPrinters();
      if (tab === 'jobs') loadJobs();
    });

    // ----------------------------------------------------------
    // 暴露到模板
    // ----------------------------------------------------------
    return {
      // 导航
      tabs,
      currentTab,
      isMobile,
      socketConnected,

      // 数据
      systemStats,
      printers,
      jobs,
      jobFilter,
      jobFilters,
      hasMoreJobs,
      toasts,
      logEntries,

      // 计算属性
      activeJobCount,
      memUsagePercent,
      memUsageClass,

      // 格式化
      formatBytes,
      formatUptime,
      formatTime,
      shortId,

      // 打印机
      printerStatusClass,
      printerStatusText,
      printerBadgeClass,

      // 任务
      jobStatusText,
      jobBadgeClass,
      canCancel,
      canRetry,

      // 操作
      loadJobs,
      loadMoreJobs,
      cancelJob,
      retryJob,
      copyMachineId,
    };
  },
});

app.mount('#app');
