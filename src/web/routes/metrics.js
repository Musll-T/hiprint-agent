/**
 * Prometheus 指标路由
 *
 * 使用 prom-client 注册表提供标准 Prometheus exposition format。
 * 包含默认 Node.js 指标和自定义 hiprint-agent 业务指标。
 */
import { getRegistry, setQueueDepth } from '../../observability/metrics.js';

/**
 * 注册 Prometheus 指标路由
 *
 * @param {import('express').Router} router - Express 路由实例
 * @param {object} deps - 依赖注入
 * @param {object} deps.jobManager - Job Manager 实例
 * @returns {import('express').Router} 注册后的路由实例
 */
export function metricsRoutes(router, { jobManager }) {
  router.get('/metrics', async (_req, res) => {
    // 每次采集时从 jobManager 同步队列深度等实时 gauge
    const stats = jobManager.getStats();
    setQueueDepth('render', stats.renderPending || 0);
    setQueueDepth('print', stats.printPending || 0);
    setQueueDepth('waiting', stats.queueSize || 0);

    try {
      const register = getRegistry();
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    } catch (err) {
      res.status(500).end(err.message);
    }
  });

  return router;
}
