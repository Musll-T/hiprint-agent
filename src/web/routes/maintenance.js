/**
 * 维护路由
 *
 * 提供系统维护和故障排查的 REST API 端点：
 *   POST /api/maintenance/queues/clear        - 清空所有队列
 *   POST /api/maintenance/cups/restart        - 重启 CUPS 服务
 *   GET  /api/maintenance/printers/connectivity - 检测打印机连通性
 *   GET  /api/maintenance/cups/logs           - 获取 CUPS 错误日志
 *   POST /api/maintenance/diagnostics         - 一键诊断
 *   GET  /api/maintenance/cups/status         - 获取 CUPS 服务状态
 */

import { addAuditLog } from '../../jobs/store.js';
import { CupsLogsQuerySchema } from '../../schemas/api.schema.js';

/**
 * 注册维护路由
 *
 * @param {import('express').Router} router - Express 路由实例
 * @param {object} deps - 依赖注入
 * @param {object} deps.maintenanceService - 维护服务实例
 * @returns {import('express').Router} 注册后的路由实例
 */
export function maintenanceRoutes(router, { maintenanceService }) {
  // 清空所有队列
  router.post('/api/maintenance/queues/clear', async (req, res) => {
    try {
      const result = await maintenanceService.clearAllQueues();
      addAuditLog(
        null,
        'api_clear_queues',
        `API 调用清空队列: CUPS=${result.cupsCleared}, 内部=${result.internalCanceled}`,
      );
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: `清空队列失败: ${err.message}` });
    }
  });

  // 重启 CUPS 服务
  router.post('/api/maintenance/cups/restart', async (req, res) => {
    try {
      const result = await maintenanceService.restartCupsService();
      addAuditLog(null, 'api_restart_cups', `API 调用重启 CUPS: success=${result.success}, method=${result.method}`);
      if (!result.success) {
        if (result.method === 'blocked_external') {
          // 外部管理的 CUPS（如宿主机 socket 挂载），返回 403
          return res.status(403).json({
            success: false,
            method: result.method,
            reason: result.reason,
          });
        }
        // 其他失败情况，返回 500
        return res.status(500).json({
          error: 'CUPS 服务重启失败（systemctl 和 service 命令均失败）',
          ...result,
        });
      }
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: `重启 CUPS 服务失败: ${err.message}` });
    }
  });

  // 检测打印机连通性
  router.get('/api/maintenance/printers/connectivity', async (req, res) => {
    try {
      const printers = await maintenanceService.checkPrinterConnectivity();
      res.json({ printers });
    } catch (err) {
      res.status(500).json({ error: `打印机连通性检测失败: ${err.message}` });
    }
  });

  // 获取 CUPS 错误日志
  router.get('/api/maintenance/cups/logs', async (req, res, next) => {
    try {
      const { lines } = CupsLogsQuerySchema.parse(req.query);
      const logContent = await maintenanceService.getCupsErrorLog(lines);
      res.json({ lines, content: logContent });
    } catch (err) {
      next(err);
    }
  });

  // 一键诊断
  router.post('/api/maintenance/diagnostics', async (req, res) => {
    try {
      const result = await maintenanceService.runDiagnostics();
      addAuditLog(null, 'api_diagnostics', `API 调用一键诊断: ${result.checks.length} 项检查`);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: `诊断执行失败: ${err.message}` });
    }
  });

  // 获取 CUPS 服务状态
  router.get('/api/maintenance/cups/status', async (req, res) => {
    try {
      const status = await maintenanceService.getCupsStatus();
      res.json(status);
    } catch (err) {
      res.status(500).json({ error: `获取 CUPS 状态失败: ${err.message}` });
    }
  });

  return router;
}
