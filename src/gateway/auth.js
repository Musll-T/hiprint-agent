/**
 * Socket.IO 认证与访问控制中间件
 *
 * 提供 Token 校验和 IP 白名单两种安全策略，
 * 作为 Socket.IO 中间件在连接握手阶段执行。
 */

import { getLogger } from '../logger.js';

/**
 * 创建 Token 认证中间件
 *
 * 校验逻辑：
 *   - 如果 config.token 为空字符串或 falsy，允许所有连接（开放模式）
 *   - 否则要求客户端在 handshake.auth.token 中携带匹配的 Token
 *
 * @param {object} config - 应用配置对象
 * @param {string} [config.token=''] - 认证 Token，为空时跳过校验
 * @returns {(socket: import('socket.io').Socket, next: Function) => void} Socket.IO 中间件
 */
export function createAuthMiddleware(config) {
  const log = getLogger();

  return (socket, next) => {
    const serverToken = config.token;

    // Token 未设置时，跳过认证
    if (!serverToken) {
      return next();
    }

    const clientToken = socket.handshake.auth?.token;

    if (serverToken === clientToken) {
      return next();
    }

    // Token 不匹配
    log.warn(
      { socketId: socket.id, clientToken },
      '客户端 Token 认证失败'
    );

    const err = new Error('Authentication error');
    err.data = { content: 'Token 错误' };
    next(err);
  };
}

/**
 * 创建 IP 白名单过滤中间件
 *
 * 校验逻辑：
 *   - 如果白名单为空数组，允许所有 IP 连接
 *   - 否则检查客户端 IP 是否在白名单中
 *   - 支持 IPv4 和 IPv6 地址
 *
 * @param {string[]} whitelist - IP 白名单数组，空数组表示不限制
 * @returns {(socket: import('socket.io').Socket, next: Function) => void} Socket.IO 中间件
 */
export function createIpFilter(whitelist) {
  const log = getLogger();

  // 预处理：构建 Set 加速查找
  const allowedSet = new Set(
    Array.isArray(whitelist) ? whitelist : []
  );

  return (socket, next) => {
    // 白名单为空时，不做限制
    if (allowedSet.size === 0) {
      return next();
    }

    // 获取客户端 IP（可能包含 ::ffff: 前缀的 IPv4-mapped IPv6 地址）
    const rawAddress = socket.handshake.address || '';
    // 提取纯 IPv4 地址（去除 ::ffff: 前缀）
    const normalizedAddress = rawAddress.replace(/^::ffff:/, '');

    if (allowedSet.has(rawAddress) || allowedSet.has(normalizedAddress)) {
      return next();
    }

    log.warn(
      { socketId: socket.id, address: rawAddress },
      '客户端 IP 不在白名单中，连接被拒绝'
    );

    const err = new Error('IP not allowed');
    err.data = { content: 'IP 地址不在白名单中' };
    next(err);
  };
}
