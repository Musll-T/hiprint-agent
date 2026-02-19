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
 * @param {object} [body] - 请求体（可选）
 * @returns {Promise<any>}
 */
async function postJSON(url, body) {
  const options = { method: 'POST' };
  if (body !== undefined) {
    options.headers = { 'Content-Type': 'application/json' };
    options.body = JSON.stringify(body);
  }
  const res = await fetch(url, options);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data.reason || data.error || `请求失败: ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return res.json();
}

/**
 * 发起 PUT 请求并返回 JSON
 * @param {string} url - 请求地址
 * @param {object} body - 请求体
 * @returns {Promise<any>}
 */
async function putJSON(url, body) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `请求失败: ${res.status}`);
  }
  return res.json();
}

/**
 * 发起 DELETE 请求并返回 JSON
 * @param {string} url - 请求地址
 * @returns {Promise<any>}
 */
async function deleteJSON(url) {
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `请求失败: ${res.status}`);
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
      { key: 'maintenance', label: '维护', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>' },
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
    // 打印机管理 - 模态框状态
    // ----------------------------------------------------------

    /** 是否显示打印机添加/编辑模态框 */
    const showPrinterModal = ref(false);

    /** 模态框模式：'add' 或 'edit' */
    const printerModalMode = ref('add');

    /** 打印机表单数据 */
    const printerForm = ref({
      name: '',
      deviceUri: '',
      model: '',
      description: '',
      location: '',
    });

    /** 打印机表单校验错误 */
    const printerFormErrors = ref({});

    /** 通用确认对话框状态（供多处复用：删除打印机、维护操作等） */
    const confirmDialog = ref({
      visible: false,
      title: '确认',
      message: '',
      onConfirm: () => {},
    });

    /** 操作进行中标记（防止重复提交） */
    const printerSubmitting = ref(false);

    // ----------------------------------------------------------
    // 维护面板 - 状态
    // ----------------------------------------------------------

    /** 诊断结果 */
    const diagnosticResult = ref(null);

    /** 诊断进行中 */
    const diagnosing = ref(false);

    /** CUPS 状态 */
    const cupsStatus = ref(null);

    /** 打印机连通性检测结果 */
    const connectivityResult = ref(null);

    /** 连通性检测进行中 */
    const checkingConnectivity = ref(false);

    /** CUPS 日志内容 */
    const cupsLogs = ref('');

    /** 日志加载进行中 */
    const loadingCupsLogs = ref(false);

    /** 维护操作执行中 */
    const maintenanceExecuting = ref(false);

    // ----------------------------------------------------------
    // 任务预览 - 状态
    // ----------------------------------------------------------

    /** 是否显示预览模态框 */
    const showPreviewModal = ref(false);

    /** 预览 iframe src URL */
    const previewUrl = ref('');

    /** 预览加载中 */
    const previewLoading = ref(false);

    /** 预览错误信息 */
    const previewError = ref('');

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

    /**
     * 将 printOptions 对象转换为可展示的标签数组
     *
     * 每个标签包含 { label, cssClass, title? }，其中 title 用于悬浮提示。
     * printOptions 为 null/undefined 时返回空数组。
     *
     * @param {object|null} options - 打印参数对象
     * @returns {Array<{label: string, cssClass: string, title?: string}>}
     */
    function formatPrintOptions(options) {
      if (!options || typeof options !== 'object') return [];

      const tags = [];

      // 纸张尺寸（最高优先级）
      if (options.pageSize) {
        tags.push({ label: options.pageSize, cssClass: 'opt-size' });
      }

      // 色彩模式
      if (options.color === true) {
        tags.push({ label: '彩色', cssClass: 'opt-color' });
      } else if (options.color === false) {
        tags.push({ label: '黑白', cssClass: 'opt-mono' });
      }

      // 双面打印
      if (options.duplex === true || options.duplexMode) {
        const mode = options.duplexMode === 'shortEdge' ? '短边' : '长边';
        tags.push({ label: '双面·' + mode, cssClass: 'opt-duplex' });
      }

      // 横向打印
      if (options.landscape === true) {
        tags.push({ label: '横向', cssClass: 'opt-landscape' });
      }

      // 打印份数（仅 > 1 时显示）
      if (options.copies != null && options.copies > 1) {
        tags.push({ label: '\u00d7' + options.copies, cssClass: 'opt-copies' });
      }

      // 页码范围
      if (options.pageRanges) {
        const range = String(options.pageRanges);
        const display = range.length > 8 ? range.substring(0, 8) + '...' : range;
        tags.push({ label: 'P:' + display, cssClass: 'opt-range', title: range.length > 8 ? range : undefined });
      }

      return tags;
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

    // ----------------------------------------------------------
    // 打印机管理操作
    // ----------------------------------------------------------

    /** 打开添加打印机模态框 */
    function openAddPrinter() {
      printerModalMode.value = 'add';
      printerForm.value = { name: '', deviceUri: '', model: '', description: '', location: '' };
      printerFormErrors.value = {};
      showPrinterModal.value = true;
    }

    /**
     * 打开编辑打印机模态框
     * @param {object} printer - 打印机对象
     */
    function openEditPrinter(printer) {
      printerModalMode.value = 'edit';
      printerForm.value = {
        name: printer.name || '',
        deviceUri: '',
        model: '',
        description: printer.description || '',
        location: '',
      };
      printerFormErrors.value = {};
      showPrinterModal.value = true;
    }

    /** 关闭打印机模态框 */
    function closePrinterModal() {
      showPrinterModal.value = false;
      printerFormErrors.value = {};
    }

    /**
     * 校验打印机表单
     * @returns {boolean} 是否通过校验
     */
    function validatePrinterForm() {
      const errors = {};
      const form = printerForm.value;
      const mode = printerModalMode.value;

      if (mode === 'add') {
        if (!form.name || !form.name.trim()) {
          errors.name = '打印机名称不能为空';
        } else if (!/^[a-zA-Z0-9_-]{1,127}$/.test(form.name.trim())) {
          errors.name = '只能包含字母、数字、下划线和短横线';
        }
        if (!form.deviceUri || !form.deviceUri.trim()) {
          errors.deviceUri = '设备 URI 不能为空';
        }
      }

      if (mode === 'edit') {
        // 编辑模式至少需要填写一项修改内容
        if (!form.description && !form.location && !form.deviceUri) {
          errors.general = '至少填写一项要修改的内容';
        }
      }

      printerFormErrors.value = errors;
      return Object.keys(errors).length === 0;
    }

    /** 提交打印机表单（添加或编辑） */
    async function submitPrinterForm() {
      if (!validatePrinterForm()) return;
      if (printerSubmitting.value) return;

      printerSubmitting.value = true;
      try {
        const form = printerForm.value;
        if (printerModalMode.value === 'add') {
          await postJSON('/api/printers', {
            name: form.name.trim(),
            deviceUri: form.deviceUri.trim(),
            model: form.model.trim() || undefined,
            description: form.description.trim() || undefined,
            location: form.location.trim() || undefined,
          });
          showToast('打印机添加成功', 'success');
        } else {
          const body = {};
          if (form.description) body.description = form.description.trim();
          if (form.location) body.location = form.location.trim();
          if (form.deviceUri) body.deviceUri = form.deviceUri.trim();
          await putJSON('/api/printers/' + encodeURIComponent(form.name), body);
          showToast('打印机配置已更新', 'success');
        }
        closePrinterModal();
        loadPrinters();
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        printerSubmitting.value = false;
      }
    }

    /**
     * 关闭通用确认对话框
     */
    function dismissConfirmDialog() {
      confirmDialog.value.visible = false;
    }

    /**
     * 确认删除打印机（使用通用确认对话框）
     * @param {string} name - 打印机名称
     */
    function confirmDeletePrinter(name) {
      confirmDialog.value = {
        visible: true,
        title: '确认删除',
        message: '确定要删除打印机 ' + name + ' 吗？此操作不可撤销。',
        onConfirm: async () => {
          confirmDialog.value.visible = false;
          try {
            await deleteJSON('/api/printers/' + encodeURIComponent(name));
            showToast('打印机 ' + name + ' 已删除', 'success');
            loadPrinters();
          } catch (err) {
            showToast('删除失败: ' + err.message, 'error');
          }
        },
      };
    }

    /**
     * 设为默认打印机
     * @param {string} name - 打印机名称
     */
    async function setDefaultPrinter(name) {
      try {
        await postJSON('/api/printers/' + encodeURIComponent(name) + '/default');
        showToast(name + ' 已设为默认打印机', 'success');
        loadPrinters();
      } catch (err) {
        showToast('设置失败: ' + err.message, 'error');
      }
    }

    /**
     * 启用打印机
     * @param {string} name - 打印机名称
     */
    async function enablePrinter(name) {
      try {
        await postJSON('/api/printers/' + encodeURIComponent(name) + '/enable');
        showToast(name + ' 已启用', 'success');
        loadPrinters();
      } catch (err) {
        showToast('启用失败: ' + err.message, 'error');
      }
    }

    /**
     * 停用打印机
     * @param {string} name - 打印机名称
     */
    async function disablePrinter(name) {
      try {
        await postJSON('/api/printers/' + encodeURIComponent(name) + '/disable');
        showToast(name + ' 已停用', 'success');
        loadPrinters();
      } catch (err) {
        showToast('停用失败: ' + err.message, 'error');
      }
    }

    // ----------------------------------------------------------
    // 维护功能操作
    // ----------------------------------------------------------

    /** 执行一键诊断 */
    async function runDiagnostics() {
      if (diagnosing.value) return;
      diagnosing.value = true;
      diagnosticResult.value = null;
      try {
        const data = await postJSON('/api/maintenance/diagnostics');
        diagnosticResult.value = data;
        showToast('诊断完成', 'success');
      } catch (err) {
        showToast('诊断失败: ' + err.message, 'error');
      } finally {
        diagnosing.value = false;
      }
    }

    /** 获取 CUPS 服务状态 */
    async function loadCupsStatus() {
      try {
        cupsStatus.value = await fetchJSON('/api/maintenance/cups/status');
      } catch (err) {
        console.error('获取 CUPS 状态失败:', err);
      }
    }

    /** 检测打印机连通性 */
    async function checkConnectivity() {
      if (checkingConnectivity.value) return;
      checkingConnectivity.value = true;
      connectivityResult.value = null;
      try {
        const data = await fetchJSON('/api/maintenance/printers/connectivity');
        connectivityResult.value = data.printers || [];
        showToast('连通性检测完成', 'success');
      } catch (err) {
        showToast('连通性检测失败: ' + err.message, 'error');
      } finally {
        checkingConnectivity.value = false;
      }
    }

    /** 加载 CUPS 错误日志 */
    async function loadCupsLogs() {
      if (loadingCupsLogs.value) return;
      loadingCupsLogs.value = true;
      try {
        const data = await fetchJSON('/api/maintenance/cups/logs?lines=100');
        cupsLogs.value = data.content || '(无日志内容)';
      } catch (err) {
        cupsLogs.value = '加载失败: ' + err.message;
      } finally {
        loadingCupsLogs.value = false;
      }
    }

    /**
     * 请求确认维护操作（使用通用确认对话框）
     * @param {string} type - 操作类型
     * @param {string} label - 操作标签
     */
    function confirmMaintenanceAction(type, label) {
      confirmDialog.value = {
        visible: true,
        title: '确认操作',
        message: '确定要执行 ' + label + ' 操作吗？',
        onConfirm: () => {
          confirmDialog.value.visible = false;
          executeMaintenanceAction(type);
        },
      };
    }

    /**
     * 执行维护操作
     * @param {string} action - 操作类型
     */
    async function executeMaintenanceAction(action) {
      maintenanceExecuting.value = true;
      try {
        if (action === 'clearQueues') {
          const data = await postJSON('/api/maintenance/queues/clear');
          showToast('队列已清空 (CUPS: ' + data.cupsCleared + ', 内部: ' + data.internalCanceled + ')', 'success');
        } else if (action === 'restartCups') {
          try {
            const data = await postJSON('/api/maintenance/cups/restart');
            if (data.success) {
              showToast('CUPS 服务已重启 (' + data.method + ')', 'success');
            } else {
              showToast('CUPS 服务重启失败', 'error');
            }
          } catch (restartErr) {
            if (restartErr.status === 403) {
              showToast(restartErr.data?.reason || 'CUPS 由宿主机管理，无法在容器内重启', 'warning');
            } else {
              throw restartErr;
            }
          }
          loadCupsStatus();
        }
      } catch (err) {
        showToast('操作失败: ' + err.message, 'error');
      } finally {
        maintenanceExecuting.value = false;
      }
    }

    /**
     * 诊断项状态对应的 CSS class
     * @param {string} status - ok / warning / error
     * @returns {string}
     */
    function diagStatusClass(status) {
      if (status === 'ok') return 'diag-ok';
      if (status === 'warning') return 'diag-warning';
      return 'diag-error';
    }

    /**
     * 诊断项状态对应的图标文字
     * @param {string} status
     * @returns {string}
     */
    function diagStatusIcon(status) {
      if (status === 'ok') return 'OK';
      if (status === 'warning') return 'WARN';
      return 'ERR';
    }

    /**
     * CUPS 运行模式中文名称
     * @param {string} mode - CUPS 运行模式
     * @returns {string}
     */
    function cupsModeName(mode) {
      if (mode === 'local_process') return '容器模式';
      if (mode === 'host_socket') return '宿主机模式';
      return '未知';
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
    // 任务预览操作
    // ----------------------------------------------------------

    /**
     * 打开任务预览模态框
     * @param {string} jobId - 任务 ID
     */
    function openPreview(jobId) {
      previewUrl.value = '/api/jobs/' + jobId + '/preview';
      previewError.value = '';
      previewLoading.value = true;
      showPreviewModal.value = true;
    }

    /** 预览 iframe 加载完成回调 */
    function onPreviewLoad() {
      previewLoading.value = false;
    }

    /** 预览 iframe 加载失败回调 */
    function onPreviewError() {
      previewLoading.value = false;
      previewError.value = '预览内容不可用（已过期或不支持的任务类型）';
    }

    /** 关闭预览模态框 */
    function closePreview() {
      showPreviewModal.value = false;
      previewUrl.value = '';
      previewError.value = '';
      previewLoading.value = false;
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
      // Clipboard API 仅在安全上下文（HTTPS/localhost）中可用
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(id).then(() => {
          showToast('设备编号已复制', 'success');
        }).catch(() => {
          showToast('复制失败，请手动选取', 'error');
        });
      } else {
        // HTTP 环境回退方案
        const ta = document.createElement('textarea');
        ta.value = id;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand('copy');
          showToast('设备编号已复制', 'success');
        } catch {
          showToast('复制失败，请手动选取', 'error');
        }
        document.body.removeChild(ta);
      }
    }

    // ----------------------------------------------------------
    // Socket.IO 连接初始化
    // ----------------------------------------------------------

    function initSocket() {
      socket = io({
        path: '/admin-ws',
        transports: ['websocket', 'polling'],
        auth: {
          // 认证令牌：已登录的 session cookie 会自动随请求发送，
          // 此标记用于告知 WebSocket 中间件本连接已通过页面认证
          adminToken: 'session',
        },
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

    // 切换到 printers / jobs / maintenance Tab 时自动刷新数据
    watch(currentTab, (tab) => {
      if (tab === 'printers') loadPrinters();
      if (tab === 'jobs') loadJobs();
      if (tab === 'maintenance') loadCupsStatus();
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

      // 打印机管理
      showPrinterModal,
      printerModalMode,
      printerForm,
      printerFormErrors,
      printerSubmitting,
      openAddPrinter,
      openEditPrinter,
      closePrinterModal,
      submitPrinterForm,
      confirmDeletePrinter,
      setDefaultPrinter,
      enablePrinter,
      disablePrinter,

      // 通用确认对话框
      confirmDialog,
      dismissConfirmDialog,

      // 任务
      jobStatusText,
      jobBadgeClass,
      canCancel,
      canRetry,
      formatPrintOptions,

      // 操作
      loadJobs,
      loadMoreJobs,
      cancelJob,
      retryJob,
      copyMachineId,

      // 维护
      diagnosticResult,
      diagnosing,
      cupsStatus,
      connectivityResult,
      checkingConnectivity,
      cupsLogs,
      loadingCupsLogs,
      maintenanceExecuting,
      runDiagnostics,
      loadCupsStatus,
      checkConnectivity,
      loadCupsLogs,
      confirmMaintenanceAction,
      executeMaintenanceAction,
      diagStatusClass,
      diagStatusIcon,
      cupsModeName,

      // 任务预览
      showPreviewModal,
      previewUrl,
      previewLoading,
      previewError,
      openPreview,
      onPreviewLoad,
      onPreviewError,
      closePreview,
    };
  },
});

app.mount('#app');
