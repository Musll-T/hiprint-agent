/**
 * Admin Web 认证中间件
 *
 * 基于 express-session 的登录认证，拦截未认证请求。
 * 白名单路径（无需认证即可访问）：
 *   - /health
 *   - /login
 *   - /api/login
 *   - /css/*
 *   - /js/login.js
 *   - /metrics
 */

import { getLogger } from '../../logger.js';

/** 白名单路径前缀/精确匹配 */
const PUBLIC_PATHS = [
  '/health',
  '/login',
  '/api/login',
  '/metrics',
];

/** 白名单路径前缀匹配 */
const PUBLIC_PREFIXES = [
  '/css/',
];

/** 白名单精确文件 */
const PUBLIC_FILES = [
  '/js/login.js',
];

/**
 * 判断请求路径是否在白名单中
 * @param {string} path - 请求路径
 * @returns {boolean}
 */
function isPublicPath(path) {
  if (PUBLIC_PATHS.includes(path)) return true;
  if (PUBLIC_FILES.includes(path)) return true;
  for (const prefix of PUBLIC_PREFIXES) {
    if (path.startsWith(prefix)) return true;
  }
  return false;
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
    // 白名单路径直接放行
    if (isPublicPath(req.path)) {
      return next();
    }

    // 检查 session 中的认证状态
    if (req.session && req.session.authenticated) {
      return next();
    }

    log.debug({ path: req.path, method: req.method }, '未认证请求被拦截');

    // API 请求返回 401 JSON
    if (req.path.startsWith('/api/') || req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(401).json({ error: '未认证，请先登录' });
    }

    // 页面请求重定向到登录页
    return res.redirect('/login');
  };
}
