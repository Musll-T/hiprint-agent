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
import crypto from 'node:crypto';
import express from 'express';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import { getLogger } from '../logger.js';
import { healthRoutes } from './routes/health.js';
import { statusRoutes } from './routes/status.js';
import { printerRoutes } from './routes/printers.js';
import { jobRoutes } from './routes/jobs.js';
import { metricsRoutes } from './routes/metrics.js';
import { maintenanceRoutes } from './routes/maintenance.js';
import { configRoutes } from './routes/config.js';
import { createAdminSocket } from './socket.js';
import { createAuthMiddleware } from './middleware/auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * 创建并启动 Admin Web 服务
 *
 * @param {object} deps - 依赖注入
 * @param {object} deps.config - 应用配置对象（至少包含 adminPort）
 * @param {object} deps.jobManager - Job Manager 实例
 * @param {object} deps.printerAdapter - 打印适配器实例
 * @param {object} [deps.printerAdmin] - 打印机管理服务实例
 * @param {import('socket.io').Server} [deps.gatewayIo] - Socket Gateway 的 IO 实例（用于获取连接数）
 * @returns {Promise<{ app: import('express').Express, httpServer: import('node:http').Server, close: () => Promise<void> }>}
 */
export async function createAdminWeb({ config, jobManager, printerAdapter, printerAdmin, maintenanceService, gatewayIo, transitClient }) {
  const log = getLogger();
  const app = express();

  // ============================================================
  // 全局中间件
  // ============================================================

  // 解析 JSON 请求体
  app.use(express.json());

  // CORS 支持（从 config.cors 读取，默认 '*'）
  const corsOrigin = config.cors?.origin || '*';
  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', corsOrigin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (_req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  // ============================================================
  // Session 与认证中间件（仅在 config.admin 存在时启用）
  // ============================================================

  const authEnabled = !!(config.admin && config.admin.username && config.admin.password);
  const publicDir = resolve(__dirname, '..', 'public');

  if (authEnabled) {
    // express-session 配置
    const sessionSecret = config.admin.sessionSecret || crypto.randomBytes(32).toString('hex');
    if (!config.admin.sessionSecret) {
      log.warn('admin.sessionSecret 未配置，每次重启将导致所有 session 失效。建议在 config.json 中设置固定值');
    }
    app.use(session({
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 小时
      },
    }));

    // 登录页路由（在 auth 中间件之前注册，避免循环重定向）
    app.get('/login', (_req, res) => {
      res.sendFile(resolve(publicDir, 'login.html'));
    });

    // 登录接口
    app.post('/api/login', async (req, res) => {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: '用户名和密码不能为空' });
      }

      // 校验用户名
      if (username !== config.admin.username) {
        log.warn({ username }, '登录失败：用户名不匹配');
        return res.status(401).json({ error: '用户名或密码错误' });
      }

      // 校验密码（bcrypt 比较）
      try {
        const match = await bcrypt.compare(password, config.admin.password);
        if (!match) {
          log.warn({ username }, '登录失败：密码错误');
          return res.status(401).json({ error: '用户名或密码错误' });
        }
      } catch (err) {
        log.error({ err }, '密码校验异常');
        return res.status(500).json({ error: '服务器内部错误' });
      }

      // 认证成功，创建 session
      req.session.authenticated = true;
      req.session.username = username;
      log.info({ username }, '用户登录成功');

      return res.json({ ok: true });
    });

    // 登出接口
    app.post('/api/logout', (req, res) => {
      const username = req.session?.username;
      req.session.destroy((err) => {
        if (err) {
          log.error({ err }, 'Session 销毁失败');
          return res.status(500).json({ error: '登出失败' });
        }
        log.info({ username }, '用户已登出');
        return res.json({ ok: true });
      });
    });

    // 认证中间件（拦截未认证请求）
    app.use(createAuthMiddleware(config));

    log.info('Admin 认证已启用');
  } else {
    log.info('Admin 认证未配置，以开放模式运行');
  }

  // 静态文件服务（管理面板前端资源）
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

  const deps = { jobManager, printerAdapter, printerAdmin, maintenanceService, getConnectionCount, transitClient };

  healthRoutes(app, deps);
  statusRoutes(app, deps);
  printerRoutes(app, deps);
  jobRoutes(app, deps);
  metricsRoutes(app, deps);
  maintenanceRoutes(app, deps);
  configRoutes(app, deps);

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

  // 挂载 Admin WebSocket（传递认证状态，确保 WebSocket 也受到保护）
  const adminSocket = createAdminSocket(httpServer, { jobManager, printerAdapter, authEnabled });

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
