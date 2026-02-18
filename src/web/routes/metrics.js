/**
 * Prometheus 指标路由
 *
 * 提供 GET /metrics 端点，以 Prometheus exposition format 输出关键运行指标。
 * 可直接被 Prometheus server 抓取，无需额外 exporter。
 */

/**
 * 注册 Prometheus 指标路由
 *
 * @param {import('express').Router} router - Express 路由实例
 * @param {object} deps - 依赖注入
 * @param {object} deps.jobManager - Job Manager 实例
 * @returns {import('express').Router} 注册后的路由实例
 */
export function metricsRoutes(router, { jobManager }) {
  router.get('/metrics', (_req, res) => {
    const stats = jobManager.getStats();
    const lines = [];

    // 按状态统计的任务总数
    lines.push('# HELP hiprint_jobs_total Total number of jobs by status');
    lines.push('# TYPE hiprint_jobs_total gauge');

    // 跳过队列大小字段，仅输出状态计数
    const QUEUE_FIELDS = new Set(['queueSize', 'renderPending', 'printPending']);
    for (const [status, count] of Object.entries(stats)) {
      if (QUEUE_FIELDS.has(status)) continue;
      lines.push(`hiprint_jobs_total{status="${status}"} ${count}`);
    }

    // 队列大小
    lines.push('# HELP hiprint_queue_size Current queue size');
    lines.push('# TYPE hiprint_queue_size gauge');
    lines.push(`hiprint_render_queue_size ${stats.renderPending || 0}`);
    lines.push(`hiprint_print_queue_size ${stats.printPending || 0}`);

    // 进程运行时间
    lines.push('# HELP hiprint_uptime_seconds Process uptime in seconds');
    lines.push('# TYPE hiprint_uptime_seconds gauge');
    lines.push(`hiprint_uptime_seconds ${Math.floor(process.uptime())}`);

    res.set('Content-Type', 'text/plain; version=0.0.4');
    res.send(lines.join('\n') + '\n');
  });

  return router;
}
