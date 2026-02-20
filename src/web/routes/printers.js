/**
 * 打印机路由
 *
 * 提供打印机列表查询和管理接口：
 *   GET    /api/printers              - 获取打印机列表
 *   POST   /api/printers              - 添加打印机
 *   PUT    /api/printers/:name        - 修改打印机配置
 *   DELETE /api/printers/:name        - 删除打印机
 *   POST   /api/printers/:name/default - 设为默认打印机
 *   POST   /api/printers/:name/enable  - 启用打印机
 *   POST   /api/printers/:name/disable - 停用打印机
 */

import { PrinterCreateSchema, PrinterUpdateSchema } from '../../schemas/api.schema.js';

/**
 * 注册打印机路由
 *
 * @param {import('express').Router} router - Express 路由实例
 * @param {object} deps - 依赖注入
 * @param {object} deps.printerAdapter - 打印适配器实例
 * @param {object} [deps.printerAdmin] - 打印机管理服务实例（可选，不存在时管理接口返回 501）
 * @returns {import('express').Router} 注册后的路由实例
 */
export function printerRoutes(router, { printerAdapter, printerAdmin }) {
  // 获取打印机列表
  router.get('/api/printers', async (_req, res, next) => {
    try {
      const printers = await printerAdapter.getPrinters();
      res.json({ printers });
    } catch (err) {
      next(err);
    }
  });

  // 添加打印机
  router.post('/api/printers', async (req, res, next) => {
    if (!printerAdmin) {
      return res.status(501).json({ error: '打印机管理功能未启用' });
    }
    try {
      const { name, deviceUri, model, description, location } = PrinterCreateSchema.parse(req.body);
      const result = await printerAdmin.add({ name, deviceUri, model, description, location });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  // 修改打印机配置
  router.put('/api/printers/:name', async (req, res, next) => {
    if (!printerAdmin) {
      return res.status(501).json({ error: '打印机管理功能未启用' });
    }
    try {
      const { description, location, deviceUri } = PrinterUpdateSchema.parse(req.body);
      const result = await printerAdmin.update(req.params.name, { description, location, deviceUri });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // 删除打印机
  router.delete('/api/printers/:name', async (req, res, next) => {
    if (!printerAdmin) {
      return res.status(501).json({ error: '打印机管理功能未启用' });
    }
    try {
      const result = await printerAdmin.remove(req.params.name);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // 设为默认打印机
  router.post('/api/printers/:name/default', async (req, res, next) => {
    if (!printerAdmin) {
      return res.status(501).json({ error: '打印机管理功能未启用' });
    }
    try {
      const result = await printerAdmin.setDefault(req.params.name);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // 启用打印机
  router.post('/api/printers/:name/enable', async (req, res, next) => {
    if (!printerAdmin) {
      return res.status(501).json({ error: '打印机管理功能未启用' });
    }
    try {
      const result = await printerAdmin.enable(req.params.name);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // 停用打印机
  router.post('/api/printers/:name/disable', async (req, res, next) => {
    if (!printerAdmin) {
      return res.status(501).json({ error: '打印机管理功能未启用' });
    }
    try {
      const result = await printerAdmin.disable(req.params.name);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
}
