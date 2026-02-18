/**
 * Admin WebSocket 推送模块
 *
 * 在 Admin HTTP 服务器上挂载 Socket.IO 实例，
 * 监听 JobManager 事件并实时推送给前端管理面板。
 *
 * 推送事件：
 *   - job:update    — 任务状态变更（实时）
 *   - sys:stats     — 系统+队列指标快照（每 5 秒）
 */

import { Server as SocketIOServer } from 'socket.io';
import { getSystemInfo } from '../utils/system.js';
import { getLogger } from '../logger.js';

/** 系统指标推送间隔（毫秒） */
const STATS_INTERVAL_MS = 5000;

/**
 * 创建 Admin WebSocket 实例
 *
 * @param {import('node:http').Server} httpServer - HTTP 服务器实例
 * @param {object} deps - 依赖注入
 * @param {object} deps.jobManager - Job Manager 实例
 * @param {object} deps.printerAdapter - 打印适配器实例
 * @returns {{ io: import('socket.io').Server, close: () => void }}
 */
export function createAdminSocket(httpServer, { jobManager, printerAdapter }) {
  const log = getLogger();

  const io = new SocketIOServer(httpServer, {
    path: '/admin-ws',
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

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
    jobManager.events.off('job:update', onJobUpdate);
    io.close();
    log.info('Admin WebSocket 已关闭');
  }

  return { io, close };
}
