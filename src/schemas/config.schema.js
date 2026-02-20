/**
 * 系统配置 Zod Schema
 *
 * 定义所有 config.json 配置项的类型和校验规则，
 * 替代原有的手工 validateConfig 逻辑。
 */

import { z } from 'zod';

/** OpenTelemetry 配置 Schema */
const OtelSchema = z
  .object({
    enabled: z.boolean().optional().default(false),
    endpoint: z.string().optional().default('http://localhost:4318/v1/traces'),
    samplingRate: z.number().min(0).max(1).optional().default(0.1),
    serviceName: z.string().optional().default('hiprint-agent'),
  })
  .optional();

/** Admin 认证配置 Schema */
const AdminSchema = z
  .object({
    username: z.string().min(1, 'admin.username 必须为非空字符串'),
    password: z.string().min(1, 'admin.password 必须为非空字符串'),
    sessionSecret: z.string().optional(),
  })
  .optional();

/** Redis 连接配置 Schema */
const RedisSchema = z
  .object({
    host: z.string().optional().default('localhost'),
    port: z.number().int().min(1).max(65535).optional().default(6379),
    password: z.string().optional(),
  })
  .optional();

/** 队列后端配置 Schema */
const QueueSchema = z
  .object({
    backend: z.enum(['memory', 'bullmq']).optional().default('memory'),
    redis: RedisSchema,
  })
  .optional();

/** 系统配置 Schema */
export const ConfigSchema = z
  .object({
    port: z.number().int().min(1024).max(65535).optional().default(17521),
    adminPort: z.number().int().min(1024).max(65535).optional().default(17522),
    token: z.string().optional().default(''),
    ipWhitelist: z.array(z.string()).optional().default([]),
    agentId: z.string().optional().default(''),
    renderConcurrency: z.number().int().min(1).max(20).optional().default(4),
    printConcurrency: z.number().int().min(1).max(20).optional().default(2),
    maxQueueSize: z.number().int().min(1).max(10000).optional().default(1000),
    renderTimeout: z.number().int().min(1000).max(300000).optional().default(30000),
    printTimeout: z.number().int().min(1000).max(300000).optional().default(10000),
    logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).optional().default('info'),
    logDir: z.string().optional().default('./logs'),
    dbPath: z.string().optional().default('./data/hiprint.db'),
    pdfDir: z.string().optional().default('./data/pdf'),
    previewDir: z.string().optional().default('./data/preview'),
    defaultPrinter: z.string().optional().default(''),
    browserPoolSize: z.number().int().min(1).max(20).optional().default(4),
    pageReuseLimit: z.number().int().min(1).max(1000).optional().default(50),
    jobRetentionDays: z.number().int().min(1).max(3650).optional().default(30),
    allowEIO3: z.boolean().optional().default(true),
    cors: z.object({ origin: z.string().optional() }).passthrough().optional().default({ origin: '*' }),
    connectTransit: z.boolean().optional().default(false),
    transitUrl: z.string().optional().default(''),
    transitToken: z.string().optional().default(''),
    otel: OtelSchema,
    queue: QueueSchema,
    admin: AdminSchema,
  })
  .superRefine((cfg, ctx) => {
    // 中转模式联合校验：启用时 transitUrl 和 transitToken 必须合法
    if (cfg.connectTransit === true) {
      if (!cfg.transitUrl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['transitUrl'],
          message: 'connectTransit 启用时 transitUrl 必须为非空字符串',
        });
      } else {
        try {
          const url = new URL(cfg.transitUrl);
          const allowed = new Set(['http:', 'https:', 'ws:', 'wss:']);
          if (!allowed.has(url.protocol)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['transitUrl'],
              message: `transitUrl 协议不支持: ${url.protocol}，仅允许 http/https/ws/wss`,
            });
          }
        } catch {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['transitUrl'],
            message: `transitUrl 格式非法: ${cfg.transitUrl}`,
          });
        }
      }

      if (!cfg.transitToken) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['transitToken'],
          message: 'connectTransit 启用时 transitToken 必须为非空字符串',
        });
      }
    }
  });

/**
 * 解析并校验配置对象
 *
 * @param {object} cfg - 待校验的原始配置对象
 * @returns {object} 经过校验和默认值填充的配置对象
 * @throws {import('zod').ZodError} 校验失败时抛出 ZodError
 */
export function parseConfig(cfg) {
  return ConfigSchema.parse(cfg);
}
