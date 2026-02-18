/**
 * 状态概览路由
 *
 * 提供 GET /api/status 端点，返回系统信息、任务队列状态和连接数概览。
 */

import { getSystemInfo } from '../../utils/system.js';

/**
 * 注册状态概览路由
 *
 * @param {import('express').Router} router - Express 路由实例
 * @param {object} deps - 依赖注入
 * @param {object} deps.jobManager - Job Manager 实例
 * @param {object} deps.printerAdapter - 打印适配器实例
 * @param {() => number} deps.getConnectionCount - 获取当前 WebSocket 连接数的函数
 * @returns {import('express').Router} 注册后的路由实例
 */
export function statusRoutes(router, { jobManager, printerAdapter, getConnectionCount }) {
  router.get('/api/status', async (_req, res, next) => {
    try {
      const system = getSystemInfo();
      const jobs = jobManager.getStats();
      const connections = typeof getConnectionCount === 'function' ? getConnectionCount() : 0;

      res.json({
        system,
        jobs,
        connections,
        uptime: process.uptime(),
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
