/**
 * Admin Web 服务主模块
 *
 * 创建 Express 应用，注册路由和中间件，启动 HTTP 服务器，
 * 并在同一端口挂载 Admin WebSocket，提供管理面板所需的全部后端能力。
 *
 * 默认监听端口：config.adminPort (17522)
 */

import { createServer } from 'node:http';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { getLogger } from '../logger.js';
import { healthRoutes } from './routes/health.js';
import { statusRoutes } from './routes/status.js';
import { printerRoutes } from './routes/printers.js';
import { jobRoutes } from './routes/jobs.js';
import { metricsRoutes } from './routes/metrics.js';
import { createAdminSocket } from './socket.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * 创建并启动 Admin Web 服务
 *
 * @param {object} deps - 依赖注入
 * @param {object} deps.config - 应用配置对象（至少包含 adminPort）
 * @param {object} deps.jobManager - Job Manager 实例
 * @param {object} deps.printerAdapter - 打印适配器实例
 * @param {import('socket.io').Server} [deps.gatewayIo] - Socket Gateway 的 IO 实例（用于获取连接数）
 * @returns {Promise<{ app: import('express').Express, httpServer: import('node:http').Server, close: () => Promise<void> }>}
 */
export async function createAdminWeb({ config, jobManager, printerAdapter, gatewayIo, transitClient }) {
  const log = getLogger();
  const app = express();

  // ============================================================
  // 全局中间件
  // ============================================================

  // 解析 JSON 请求体
  app.use(express.json());

  // CORS 支持
  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (_req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  // 静态文件服务（管理面板前端资源）
  const publicDir = resolve(__dirname, '..', 'public');
  app.use(express.static(publicDir));

  // ============================================================
  // 路由注册
  // ============================================================

  // 获取 Gateway 连接数的辅助函数
  const getConnectionCount = () => {
    if (gatewayIo && gatewayIo.engine) {
      return gatewayIo.engine.clientsCount;
    }
    return 0;
  };

  const deps = { jobManager, printerAdapter, getConnectionCount, transitClient };

  healthRoutes(app, deps);
  statusRoutes(app, deps);
  printerRoutes(app, deps);
  jobRoutes(app, deps);
  metricsRoutes(app, deps);

  // ============================================================
  // 全局错误处理中间件
  // ============================================================

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    log.error({ err }, '请求处理异常');
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      error: err.message || '服务器内部错误',
    });
  });

  // ============================================================
  // 启动 HTTP 服务器
  // ============================================================

  const httpServer = createServer(app);
  const port = config.adminPort || 17522;

  // 挂载 Admin WebSocket
  const adminSocket = createAdminSocket(httpServer, { jobManager, printerAdapter });

  await new Promise((resolve, reject) => {
    httpServer.listen(port, () => {
      log.info({ port }, 'Admin Web 服务已启动');
      resolve();
    });
    httpServer.on('error', reject);
  });

  /**
   * 优雅关闭 Admin Web 服务
   * 先关闭 WebSocket，再关闭 HTTP 服务器
   */
  async function close() {
    adminSocket.close();
    await new Promise((resolve) => {
      httpServer.close(() => {
        log.info('Admin HTTP 服务器已关闭');
        resolve();
      });
    });
  }

  return { app, httpServer, close };
}
