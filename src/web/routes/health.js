/**
 * 健康检查路由
 *
 * 提供 GET /health 端点，用于负载均衡器和监控系统探测服务存活状态。
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// 启动时一次性读取版本号，避免每次请求都读文件
const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = resolve(__dirname, '..', '..', '..', 'package.json');
let appVersion = 'unknown';
try {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  appVersion = pkg.version || 'unknown';
} catch {
  // package.json 读取失败时使用默认值
}

/**
 * 注册健康检查路由
 *
 * @param {import('express').Router} router - Express 路由实例
 * @returns {import('express').Router} 注册后的路由实例
 */
export function healthRoutes(router) {
  router.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      version: appVersion,
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
