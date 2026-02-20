/**
 * OpenAPI 文档生成模块
 *
 * 基于 @asteasolutions/zod-to-openapi 将已有的 Zod Schema 转换为
 * OpenAPI 3.0 规范文档，供 /openapi.json 端点返回。
 */

import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

/** 缓存生成的文档，避免每次请求重新构建 */
let cachedDocument = null;

/**
 * 生成 OpenAPI 3.0 文档
 *
 * @returns {object} OpenAPI 3.0.3 JSON 文档
 */
export function generateOpenAPIDocument() {
  if (cachedDocument) return cachedDocument;

  const registry = new OpenAPIRegistry();

  // ── 通用响应 Schema ──────────────────────────────────────────

  const ErrorResponse = z.object({
    error: z.string(),
    code: z.string().optional(),
    details: z.array(z.any()).optional(),
  }).openapi('ErrorResponse');

  const OkResponse = z.object({
    ok: z.boolean(),
  }).openapi('OkResponse');

  // ── 公开端点 ────────────────────────────────────────────────

  registry.registerPath({
    method: 'get',
    path: '/health',
    summary: '健康检查',
    tags: ['系统'],
    responses: {
      200: {
        description: '服务健康状态',
        content: {
          'application/json': {
            schema: z.object({
              status: z.string(),
              uptime: z.number(),
              version: z.string(),
              timestamp: z.string(),
            }),
          },
        },
      },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/metrics',
    summary: 'Prometheus 指标',
    tags: ['监控'],
    responses: {
      200: {
        description: 'Prometheus 格式指标数据',
        content: { 'text/plain': { schema: z.string() } },
      },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/openapi.json',
    summary: 'OpenAPI 文档',
    tags: ['系统'],
    responses: {
      200: {
        description: 'OpenAPI 3.0 JSON 文档',
        content: { 'application/json': { schema: z.object({}).passthrough() } },
      },
    },
  });

  // ── 认证端点 ────────────────────────────────────────────────

  registry.registerPath({
    method: 'post',
    path: '/api/login',
    summary: '登录',
    tags: ['认证'],
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              username: z.string(),
              password: z.string(),
            }),
          },
        },
      },
    },
    responses: {
      200: { description: '登录成功', content: { 'application/json': { schema: OkResponse } } },
      401: { description: '认证失败', content: { 'application/json': { schema: ErrorResponse } } },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/logout',
    summary: '登出',
    tags: ['认证'],
    responses: {
      200: { description: '登出成功', content: { 'application/json': { schema: OkResponse } } },
    },
  });

  // ── 状态端点 ────────────────────────────────────────────────

  registry.registerPath({
    method: 'get',
    path: '/api/status',
    summary: '系统状态概览',
    tags: ['系统'],
    responses: {
      200: {
        description: 'CPU/内存/队列/连接数/中转状态',
        content: { 'application/json': { schema: z.object({}).passthrough() } },
      },
    },
  });

  // ── 配置端点 ────────────────────────────────────────────────

  registry.registerPath({
    method: 'get',
    path: '/api/config',
    summary: '获取系统配置（敏感字段脱敏）',
    tags: ['配置'],
    responses: {
      200: {
        description: '当前系统配置',
        content: { 'application/json': { schema: z.object({}).passthrough() } },
      },
    },
  });

  registry.registerPath({
    method: 'put',
    path: '/api/config',
    summary: '更新系统配置',
    tags: ['配置'],
    request: {
      body: {
        content: {
          'application/json': { schema: z.object({}).passthrough() },
        },
      },
    },
    responses: {
      200: {
        description: '更新成功',
        content: {
          'application/json': {
            schema: z.object({
              ok: z.boolean(),
              needRestart: z.boolean(),
            }),
          },
        },
      },
      400: { description: '校验失败', content: { 'application/json': { schema: ErrorResponse } } },
    },
  });

  // ── 打印机端点 ──────────────────────────────────────────────

  const PrinterSchema = z.object({
    name: z.string(),
    displayName: z.string(),
    isDefault: z.boolean(),
    status: z.number(),
    description: z.string(),
    location: z.string(),
    options: z.object({}).passthrough(),
  }).openapi('Printer');

  registry.registerPath({
    method: 'get',
    path: '/api/printers',
    summary: '获取打印机列表',
    tags: ['打印机'],
    responses: {
      200: {
        description: '打印机列表',
        content: { 'application/json': { schema: z.array(PrinterSchema) } },
      },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/printers',
    summary: '添加打印机',
    tags: ['打印机'],
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              name: z.string(),
              deviceUri: z.string(),
              model: z.string().optional(),
              description: z.string().optional(),
              location: z.string().optional(),
            }),
          },
        },
      },
    },
    responses: {
      201: { description: '添加成功', content: { 'application/json': { schema: OkResponse } } },
      400: { description: '参数校验失败', content: { 'application/json': { schema: ErrorResponse } } },
    },
  });

  registry.registerPath({
    method: 'put',
    path: '/api/printers/{name}',
    summary: '修改打印机配置',
    tags: ['打印机'],
    request: {
      params: z.object({ name: z.string() }),
      body: {
        content: {
          'application/json': {
            schema: z.object({
              description: z.string().optional(),
              location: z.string().optional(),
              deviceUri: z.string().optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: { description: '修改成功', content: { 'application/json': { schema: OkResponse } } },
    },
  });

  registry.registerPath({
    method: 'delete',
    path: '/api/printers/{name}',
    summary: '删除打印机',
    tags: ['打印机'],
    request: { params: z.object({ name: z.string() }) },
    responses: {
      200: { description: '删除成功', content: { 'application/json': { schema: OkResponse } } },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/printers/{name}/default',
    summary: '设为默认打印机',
    tags: ['打印机'],
    request: { params: z.object({ name: z.string() }) },
    responses: {
      200: { description: '设置成功', content: { 'application/json': { schema: OkResponse } } },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/printers/{name}/enable',
    summary: '启用打印机',
    tags: ['打印机'],
    request: { params: z.object({ name: z.string() }) },
    responses: {
      200: { description: '启用成功', content: { 'application/json': { schema: OkResponse } } },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/printers/{name}/disable',
    summary: '停用打印机',
    tags: ['打印机'],
    request: { params: z.object({ name: z.string() }) },
    responses: {
      200: { description: '停用成功', content: { 'application/json': { schema: OkResponse } } },
    },
  });

  // ── 任务端点 ────────────────────────────────────────────────

  const JobSchema = z.object({
    id: z.string(),
    status: z.string(),
    printer: z.string().nullable(),
    templateId: z.string().nullable(),
    type: z.string().nullable(),
    clientId: z.string().nullable(),
    tenantId: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
    renderDuration: z.number().nullable(),
    printDuration: z.number().nullable(),
    errorMsg: z.string().nullable(),
    retryCount: z.number(),
    pageNum: z.number().nullable(),
    printOptions: z.object({}).passthrough().nullable(),
  }).openapi('Job');

  registry.registerPath({
    method: 'get',
    path: '/api/jobs',
    summary: '分页查询任务',
    tags: ['任务'],
    request: {
      query: z.object({
        status: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }),
    },
    responses: {
      200: {
        description: '任务列表',
        content: {
          'application/json': {
            schema: z.object({
              data: z.array(JobSchema),
              total: z.number(),
              limit: z.number(),
              offset: z.number(),
            }),
          },
        },
      },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/jobs/{id}',
    summary: '获取任务详情',
    tags: ['任务'],
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: { description: '任务详情', content: { 'application/json': { schema: JobSchema } } },
      404: { description: '任务不存在', content: { 'application/json': { schema: ErrorResponse } } },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/jobs/{id}/preview',
    summary: '获取任务 HTML 预览',
    tags: ['任务'],
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: { description: 'HTML 预览内容', content: { 'text/html': { schema: z.string() } } },
      404: { description: '预览不存在', content: { 'application/json': { schema: ErrorResponse } } },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/jobs/{id}/cancel',
    summary: '取消任务',
    tags: ['任务'],
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: { description: '取消成功', content: { 'application/json': { schema: JobSchema } } },
      400: { description: '任务不可取消', content: { 'application/json': { schema: ErrorResponse } } },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/jobs/{id}/retry',
    summary: '重试失败任务',
    tags: ['任务'],
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: { description: '重试成功', content: { 'application/json': { schema: JobSchema } } },
      400: { description: '任务不可重试', content: { 'application/json': { schema: ErrorResponse } } },
    },
  });

  // ── 维护端点 ────────────────────────────────────────────────

  registry.registerPath({
    method: 'post',
    path: '/api/maintenance/queues/clear',
    summary: '清空所有队列',
    tags: ['维护'],
    responses: {
      200: { description: '清空成功', content: { 'application/json': { schema: OkResponse } } },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/maintenance/cups/restart',
    summary: '重启 CUPS 服务',
    tags: ['维护'],
    responses: {
      200: { description: '重启成功', content: { 'application/json': { schema: OkResponse } } },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/maintenance/printers/connectivity',
    summary: '检测所有打印机连通性',
    tags: ['维护'],
    responses: {
      200: {
        description: '连通性检测结果',
        content: { 'application/json': { schema: z.object({}).passthrough() } },
      },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/maintenance/cups/logs',
    summary: '获取 CUPS 错误日志',
    tags: ['维护'],
    request: {
      query: z.object({
        lines: z.number().optional(),
      }),
    },
    responses: {
      200: {
        description: 'CUPS 日志内容',
        content: { 'application/json': { schema: z.object({ logs: z.string() }) } },
      },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/maintenance/diagnostics',
    summary: '一键诊断',
    tags: ['维护'],
    responses: {
      200: {
        description: '诊断结果',
        content: { 'application/json': { schema: z.object({}).passthrough() } },
      },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/maintenance/cups/status',
    summary: '获取 CUPS 服务状态',
    tags: ['维护'],
    responses: {
      200: {
        description: 'CUPS 状态',
        content: { 'application/json': { schema: z.object({}).passthrough() } },
      },
    },
  });

  // ── 生成文档 ────────────────────────────────────────────────

  const generator = new OpenApiGeneratorV3(registry.definitions);
  cachedDocument = generator.generateDocument({
    openapi: '3.0.3',
    info: {
      title: 'hiprint-agent Admin API',
      version: '1.0.0',
      description:
        'hiprint-agent 管理面板 REST API。提供任务管理、打印机 CRUD、系统配置、维护诊断和 Prometheus 监控端点。',
    },
    servers: [{ url: 'http://localhost:17522', description: 'Admin Web 默认地址' }],
    tags: [
      { name: '系统', description: '健康检查、状态概览' },
      { name: '认证', description: '登录/登出' },
      { name: '配置', description: '系统配置查看与修改' },
      { name: '打印机', description: '打印机 CRUD 管理' },
      { name: '任务', description: '打印任务管理' },
      { name: '维护', description: '维护与诊断工具' },
      { name: '监控', description: 'Prometheus 指标' },
    ],
  });

  return cachedDocument;
}
