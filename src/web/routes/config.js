/**
 * 系统配置路由
 *
 * 提供系统配置的查看和修改 REST API 端点：
 *   GET  /api/config  - 获取当前配置（敏感字段脱敏）
 *   PUT  /api/config  - 更新配置（支持部分更新）
 */

import bcrypt from 'bcryptjs';
import { getConfig, updateConfig } from '../../config.js';
import { addAuditLog } from '../../jobs/store.js';
import { getLogger } from '../../logger.js';
import { ConfigUpdateSchema } from '../../schemas/api.schema.js';

/** 需要重启才能生效的参数列表 */
const RESTART_REQUIRED_KEYS = new Set([
  'port',
  'adminPort',
  'browserPoolSize',
  'dbPath',
  'allowEIO3',
  'renderConcurrency',
  'printConcurrency',
  'pageReuseLimit',
  'connectTransit',
  'transitUrl',
  'agentId',
]);

/**
 * 对配置进行脱敏处理
 * @param {object} cfg - 原始配置对象
 * @returns {object} 脱敏后的配置
 */
function sanitizeConfig(cfg) {
  const sanitized = JSON.parse(JSON.stringify(cfg));

  // token 脱敏：仅显示前 4 位 + 掩码
  if (sanitized.token) {
    sanitized.token = sanitized.token.length > 4 ? sanitized.token.substring(0, 4) + '****' : '****';
  }

  // transitToken 脱敏
  if (sanitized.transitToken) {
    sanitized.transitToken =
      sanitized.transitToken.length > 4 ? sanitized.transitToken.substring(0, 4) + '****' : '****';
  }

  // admin 脱敏
  if (sanitized.admin) {
    // password 不返回哈希值
    sanitized.admin.password = '';
    // sessionSecret 不返回
    delete sanitized.admin.sessionSecret;
  }

  return sanitized;
}

/**
 * 注册配置路由
 *
 * @param {import('express').Router} router - Express 路由实例
 * @returns {import('express').Router}
 */
export function configRoutes(router) {
  const log = getLogger();

  // 获取当前配置（脱敏）
  router.get('/api/config', (_req, res) => {
    try {
      const cfg = getConfig();
      const sanitized = sanitizeConfig(cfg);
      // 附加元数据：标注哪些字段需要重启
      sanitized._meta = {
        restartRequired: [...RESTART_REQUIRED_KEYS],
      };
      res.json(sanitized);
    } catch (err) {
      log.error({ err }, '获取配置失败');
      res.status(500).json({ error: `获取配置失败: ${err.message}` });
    }
  });

  // 更新配置
  router.put('/api/config', async (req, res, next) => {
    try {
      const partial = ConfigUpdateSchema.parse(req.body);

      // 删除客户端不应修改的元数据字段
      delete partial._meta;

      // 记录变更的字段名（用于审计日志）
      const changedKeys = Object.keys(partial);

      // 处理 admin.password 特殊逻辑
      if (partial.admin) {
        if (partial.admin.password && partial.admin.password.trim() !== '') {
          // 新密码：进行 bcrypt 哈希
          const plainPassword = partial.admin.password.trim();
          if (plainPassword.length < 6) {
            return res.status(400).json({ error: '密码长度不能少于 6 个字符' });
          }
          partial.admin.password = await bcrypt.hash(plainPassword, 10);
          log.info('管理员密码已更新');
        } else {
          // 空密码或未提供：保留原密码，从 partial 中移除
          delete partial.admin.password;
          // 如果 admin 对象只剩空字段则删除整个 admin
          if (Object.keys(partial.admin).length === 0) {
            delete partial.admin;
          }
        }

        // sessionSecret 不允许通过 API 修改
        if (partial.admin) {
          delete partial.admin.sessionSecret;
        }
      }

      // token 脱敏值还原：如果值以 **** 结尾说明未修改，删除该字段
      if (partial.token && partial.token.endsWith('****')) {
        delete partial.token;
      }
      if (partial.transitToken && partial.transitToken.endsWith('****')) {
        delete partial.transitToken;
      }

      // 如果没有实际要更新的字段
      if (Object.keys(partial).length === 0) {
        return res.json({ ok: true, message: '无变更', config: sanitizeConfig(getConfig()) });
      }

      // 调用 updateConfig 执行校验和写盘
      const updated = updateConfig(partial);

      // 检测是否有需要重启的参数被修改
      const needRestart = changedKeys.some((k) => RESTART_REQUIRED_KEYS.has(k));

      // 审计日志
      addAuditLog(null, 'config_update', `API 更新配置: ${changedKeys.join(', ')}`);

      log.info({ changedKeys, needRestart }, '配置已更新');

      res.json({
        ok: true,
        needRestart,
        message: needRestart ? '配置已保存，部分参数需要重启服务后生效' : '配置已保存',
        config: sanitizeConfig(updated),
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
