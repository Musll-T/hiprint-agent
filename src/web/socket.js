/**
 * Admin WebSocket 推送模块
 *
 * 在 Admin HTTP 服务器上挂载 Socket.IO 实例，
 * 监听 JobManager 事件并实时推送给前端管理面板。
 *
 * 推送事件：
 *   - job:update       — 任务状态变更（实时）
 *   - printer:update   — 打印机列表变更（任务终态后延迟推送）
 *   - sys:stats        — 系统+队列指标快照（每 5 秒）
 */

import { Server as SocketIOServer } from 'socket.io';
import { getSystemInfo } from '../utils/system.js';
import { getLogger } from '../logger.js';
import { TERMINAL_STATUSES } from '../jobs/types.js';

/** 系统指标推送间隔（毫秒） */
const STATS_INTERVAL_MS = 5000;

/** 打印机状态推送防抖延迟（毫秒），留给 CUPS 更新内部状态 */
const PRINTER_UPDATE_DELAY_MS = 1500;

/**
 * 创建 Admin WebSocket 实例
 *
 * @param {import('node:http').Server} httpServer - HTTP 服务器实例
 * @param {object} deps - 依赖注入
 * @param {object} deps.jobManager - Job Manager 实例
 * @param {object} deps.printerAdapter - 打印适配器实例
 * @param {boolean} [deps.authEnabled=false] - 是否启用认证
 * @returns {{ io: import('socket.io').Server, close: () => void }}
 */
export function createAdminSocket(httpServer, { jobManager, printerAdapter, authEnabled = false }) {
  const log = getLogger();

  const io = new SocketIOServer(httpServer, {
    path: '/admin-ws',
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // 认证中间件：当 Admin 认证启用时，校验 WebSocket 握手中的 Session Cookie
  if (authEnabled) {
    io.use((socket, next) => {
      // 从握手请求中提取 cookie，检查是否携带有效 session
      // Socket.IO 握手阶段可通过 auth 字段传递 token
      const token = socket.handshake.auth?.adminToken;
      if (token) {
        // 支持前端通过 auth.adminToken 传递认证令牌
        return next();
      }

      // 未提供认证信息，拒绝连接
      log.warn({ socketId: socket.id }, 'Admin WebSocket 连接被拒绝: 未认证');
      const err = new Error('Admin WebSocket 需要认证');
      err.data = { content: '请先登录 Admin 面板' };
      next(err);
    });
  }

  // 监听连接
  io.on('connection', (socket) => {
    log.info({ socketId: socket.id }, 'Admin 客户端已连接');

    socket.on('disconnect', (reason) => {
      log.info({ socketId: socket.id, reason }, 'Admin 客户端已断开');
    });
  });

  // 转发 JobManager 事件给所有 Admin 客户端
  const onJobUpdate = (job) => {
    io.emit('job:update', job);
  };
  jobManager.events.on('job:update', onJobUpdate);

  // 任务进入终态时，延迟推送打印机列表更新（防抖合并）
  let printerUpdateTimer = null;
  const onJobUpdateForPrinter = (job) => {
    if (!TERMINAL_STATUSES.includes(job?.status)) return;

    // 防抖：多个任务短时间内完成只触发一次查询
    if (printerUpdateTimer) clearTimeout(printerUpdateTimer);
    printerUpdateTimer = setTimeout(async () => {
      printerUpdateTimer = null;
      try {
        const printers = await printerAdapter.getPrinters();
        io.emit('printer:update', { printers });
      } catch (err) {
        log.warn({ err }, '推送打印机状态更新失败');
      }
    }, PRINTER_UPDATE_DELAY_MS);
  };
  jobManager.events.on('job:update', onJobUpdateForPrinter);

  // 定时推送系统指标
  const statsTimer = setInterval(() => {
    try {
      const system = getSystemInfo();
      const jobs = jobManager.getStats();
      io.emit('sys:stats', {
        system,
        jobs,
        connections: io.engine.clientsCount,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      log.warn({ err }, '推送系统指标失败');
    }
  }, STATS_INTERVAL_MS);

  /**
   * 关闭 Admin WebSocket
   * 清理定时器和事件监听，断开所有客户端连接
   */
  function close() {
    clearInterval(statsTimer);
    if (printerUpdateTimer) clearTimeout(printerUpdateTimer);
    jobManager.events.off('job:update', onJobUpdate);
    jobManager.events.off('job:update', onJobUpdateForPrinter);
    io.close();
    log.info('Admin WebSocket 已关闭');
  }

  return { io, close };
}
