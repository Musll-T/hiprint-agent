/**
 * Admin Web 认证中间件
 *
 * 基于 express-session 的登录认证：
 * - 放行公开端点和前端 SPA 页面/静态资源请求
 * - 对未认证的受保护 API 请求统一返回 401 JSON
 * 前端 SPA 根据 401 响应执行登录跳转。
 *
 * 白名单路径（无需认证即可访问）：
 *   - /health
 *   - /api/login
 *   - 所有非 API / 非 WebSocket 的 GET 请求（SPA 页面和静态资源）
 */

import { getLogger } from '../../logger.js';

/** 白名单路径精确匹配 */
const PUBLIC_PATHS = [
  '/health',
  '/api/login',
  // '/metrics' 已移至需认证保护（安全基线 Phase 0）
];

/**
 * 判断请求是否为受保护的 API/WebSocket 端点
 * @param {import('express').Request} req
 * @returns {boolean}
 */
function isProtectedEndpoint(req) {
  const { path } = req;
  return (
    path === '/api' || path.startsWith('/api/')
    || path === '/admin-ws' || path.startsWith('/admin-ws/')
    || path === '/metrics'
    || path === '/openapi.json'
  );
}

/**
 * 创建认证中间件
 *
 * @param {object} config - 应用配置对象（需包含 admin 字段）
 * @returns {import('express').RequestHandler} Express 中间件
 */
export function createAuthMiddleware(config) {
  const log = getLogger();

  return (req, res, next) => {
    // 公开端点直接放行
    if (PUBLIC_PATHS.includes(req.path)) {
      return next();
    }

    // 非受保护端点（SPA 页面、静态资源）直接放行，让用户能加载前端应用
    if (!isProtectedEndpoint(req)) {
      return next();
    }

    // 检查 session 中的认证状态
    if (req.session && req.session.authenticated) {
      return next();
    }

    log.debug({ path: req.path, method: req.method }, '未认证请求被拦截');

    return res.status(401).json({ error: '未认证，请先登录' });
  };
}
