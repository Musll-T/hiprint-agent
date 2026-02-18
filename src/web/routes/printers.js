/**
 * 打印机路由
 *
 * 提供 GET /api/printers 端点，返回系统中所有打印机的列表及状态信息。
 */

/**
 * 注册打印机路由
 *
 * @param {import('express').Router} router - Express 路由实例
 * @param {object} deps - 依赖注入
 * @param {object} deps.printerAdapter - 打印适配器实例
 * @returns {import('express').Router} 注册后的路由实例
 */
export function printerRoutes(router, { printerAdapter }) {
  router.get('/api/printers', async (_req, res, next) => {
    try {
      const printers = await printerAdapter.getPrinters();
      res.json({ printers });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
