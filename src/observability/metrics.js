/**
 * Prometheus 指标注册中心
 *
 * 集中定义所有 hiprint-agent 的 Prometheus 指标，
 * 通过 prom-client 自定义注册表管理。提供指标更新函数供各模块调用。
 */
import client from 'prom-client';

// 创建自定义注册表（不污染默认全局注册表）
const register = new client.Registry();

// 收集默认 Node.js 指标（CPU/内存/GC/事件循环）
client.collectDefaultMetrics({ register });

// ── Counters ──

/** 任务处理总数（按类型和最终状态分类） */
const jobsTotal = new client.Counter({
  name: 'hiprint_jobs_total',
  help: 'Total number of jobs processed',
  labelNames: ['type', 'status'],
  registers: [register],
});

/** Socket.IO 事件接收总数 */
const socketEventsTotal = new client.Counter({
  name: 'hiprint_socket_events_total',
  help: 'Total number of Socket.IO events received',
  labelNames: ['event'],
  registers: [register],
});

// ── Histograms ──

/** 渲染耗时分布（秒） */
const renderDuration = new client.Histogram({
  name: 'hiprint_render_duration_seconds',
  help: 'Render duration in seconds',
  labelNames: ['type'],
  buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
  registers: [register],
});

/** 打印耗时分布（秒） */
const printDuration = new client.Histogram({
  name: 'hiprint_print_duration_seconds',
  help: 'Print duration in seconds',
  buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

// ── Gauges ──

/** 队列深度（按队列名分类） */
const queueDepth = new client.Gauge({
  name: 'hiprint_queue_depth',
  help: 'Current queue depth',
  labelNames: ['queue'],
  registers: [register],
});

/** 浏览器池活跃页面数 */
const browserPoolActive = new client.Gauge({
  name: 'hiprint_browser_pool_active',
  help: 'Number of active browser pages in pool',
  registers: [register],
});

/** 活跃 Socket.IO 连接数 */
const activeConnections = new client.Gauge({
  name: 'hiprint_active_connections',
  help: 'Number of active Socket.IO connections',
  registers: [register],
});

// ── 更新函数（供各模块调用） ──

/**
 * 递增任务计数器
 * @param {string} type - 任务类型（html/pdf/render_jpeg 等）
 * @param {string} status - 最终状态（done/failed_render/failed_print 等）
 */
export function incJobsTotal(type, status) {
  jobsTotal.inc({ type, status });
}

/**
 * 递增 Socket.IO 事件计数器
 * @param {string} event - 事件名称（news/render-print/refreshPrinterList 等）
 */
export function incSocketEvent(event) {
  socketEventsTotal.inc({ event });
}

/**
 * 记录渲染耗时
 * @param {string} type - 任务类型
 * @param {number} durationMs - 渲染耗时（毫秒）
 */
export function observeRenderDuration(type, durationMs) {
  renderDuration.observe({ type }, durationMs / 1000);
}

/**
 * 记录打印耗时
 * @param {number} durationMs - 打印耗时（毫秒）
 */
export function observePrintDuration(durationMs) {
  printDuration.observe(durationMs / 1000);
}

/**
 * 设置队列深度
 * @param {string} queue - 队列名称（render/print/waiting）
 * @param {number} depth - 当前深度
 */
export function setQueueDepth(queue, depth) {
  queueDepth.set({ queue }, depth);
}

/**
 * 设置浏览器池活跃页面数
 * @param {number} count - 活跃页面数量
 */
export function setBrowserPoolActive(count) {
  browserPoolActive.set(count);
}

/**
 * 设置活跃连接数
 * @param {number} count - 当前 Socket.IO 连接数
 */
export function setActiveConnections(count) {
  activeConnections.set(count);
}

/**
 * 获取 Prometheus 注册表（供 /metrics 路由使用）
 * @returns {import('prom-client').Registry}
 */
export function getRegistry() {
  return register;
}
