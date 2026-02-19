/**
 * 任务路由
 *
 * 提供任务的查询、详情、预览、取消和重试接口：
 *   GET    /api/jobs              - 分页查询任务列表
 *   GET    /api/jobs/:id          - 获取单个任务详情
 *   GET    /api/jobs/:id/preview  - 获取任务 HTML 预览内容
 *   POST   /api/jobs/:id/cancel   - 取消任务
 *   POST   /api/jobs/:id/retry    - 重试任务
 */

import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { listJobs, getJob, countJobs } from '../../jobs/store.js';
import { config } from '../../config.js';

/**
 * 注册任务路由
 *
 * @param {import('express').Router} router - Express 路由实例
 * @param {object} deps - 依赖注入
 * @param {object} deps.jobManager - Job Manager 实例
 * @returns {import('express').Router} 注册后的路由实例
 */
export function jobRoutes(router, { jobManager }) {
  // 分页查询任务列表
  router.get('/api/jobs', (req, res, next) => {
    try {
      const { status, limit = 50, offset = 0 } = req.query;
      const queryOpts = {
        status: status || undefined,
        limit: Number(limit),
        offset: Number(offset),
      };
      const jobs = listJobs(queryOpts);
      const total = countJobs({ status: status || undefined });
      res.json({ jobs, total });
    } catch (err) {
      next(err);
    }
  });

  // 获取单个任务详情
  router.get('/api/jobs/:id', (req, res, next) => {
    try {
      const job = getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: '任务不存在' });
      }
      res.json({ job });
    } catch (err) {
      next(err);
    }
  });

  // 获取任务预览内容（HTML）
  router.get('/api/jobs/:id/preview', async (req, res, next) => {
    try {
      const job = getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: '任务不存在' });
      }

      // 路径遍历防护：确保最终路径仍在预览目录内
      const previewDir = resolve(config.previewDir || './data/preview');
      const filePath = resolve(previewDir, `${req.params.id}.html`);

      if (!filePath.startsWith(previewDir)) {
        return res.status(400).json({ error: '非法的任务 ID' });
      }

      const html = await readFile(filePath, 'utf-8');
      res.type('text/html').send(html);
    } catch (err) {
      if (err.code === 'ENOENT') {
        return res.status(404).json({ error: '预览内容不可用（已过期或不支持的任务类型）' });
      }
      next(err);
    }
  });

  // 取消任务
  router.post('/api/jobs/:id/cancel', (req, res, next) => {
    try {
      const job = jobManager.cancel(req.params.id);
      if (!job) {
        return res.status(404).json({ error: '任务不存在' });
      }
      res.json({ job });
    } catch (err) {
      // cancel 在状态不合法时抛出 Error，返回 400
      res.status(400).json({ error: err.message });
    }
  });

  // 重试任务
  router.post('/api/jobs/:id/retry', (req, res, next) => {
    try {
      const job = jobManager.retry(req.params.id);
      if (!job) {
        return res.status(404).json({ error: '任务不存在' });
      }
      res.json({ job });
    } catch (err) {
      // retry 在状态不合法时抛出 Error，返回 400
      res.status(400).json({ error: err.message });
    }
  });

  return router;
}
