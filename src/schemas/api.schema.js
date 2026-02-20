/**
 * REST API 请求参数 Zod Schema
 *
 * 定义各 REST API 端点的请求体/查询参数校验规则，
 * 由路由处理函数在入口处调用以替代手工校验。
 */

import { z } from 'zod';

/** 添加打印机请求体 Schema */
export const PrinterCreateSchema = z.object({
  name: z.string().min(1, 'name 为必填项'),
  deviceUri: z.string().min(1, 'deviceUri 为必填项'),
  model: z.string().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
});

/** 修改打印机请求体 Schema */
export const PrinterUpdateSchema = z.object({
  description: z.string().optional(),
  location: z.string().optional(),
  deviceUri: z.string().optional(),
});

/** 配置更新请求体 Schema（宽松，主要由 ConfigSchema 做最终校验） */
export const ConfigUpdateSchema = z.object({}).passthrough();

/** 任务列表查询参数 Schema */
export const JobQuerySchema = z.object({
  status: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

/** CUPS 日志查询参数 Schema */
export const CupsLogsQuerySchema = z.object({
  lines: z.coerce.number().int().min(1).max(1000).optional().default(100),
});
