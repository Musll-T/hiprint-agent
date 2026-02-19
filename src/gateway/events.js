/**
 * Socket.IO 事件注册模块
 *
 * 将所有客户端→服务端的事件监听器注册到指定 socket 上，
 * 并绑定 jobManager 事件以将打印结果路由回发起 socket。
 *
 * 事件命名完全对齐 electron-hiprint，确保 vue-plugin-hiprint 无缝兼容。
 */

import { getLogger } from '../logger.js';
import { JobStatus, JobType } from '../jobs/types.js';

/**
 * 在指定 socket 上注册所有事件监听器
 *
 * @param {import('socket.io').Socket} socket - 客户端 socket 连接实例
 * @param {object} deps - 依赖对象
 * @param {object} deps.jobManager - Job Manager 实例
 * @param {object} deps.printerAdapter - 打印适配器实例
 * @param {import('../utils/fragments.js').FragmentManager} deps.fragmentManager - 分片管理器
 * @param {object} deps.systemInfo - 预采集的系统信息（含 hostname、version、ip 等）
 */
export function registerEvents(socket, { jobManager, printerAdapter, fragmentManager, systemInfo }) {
  const log = getLogger();

  log.info({ socketId: socket.id }, '新客户端连接');

  // ------------------------------------------------------------------
  // 连接后自动推送打印机列表和客户端信息
  // ------------------------------------------------------------------
  _emitPrinterList(socket, printerAdapter, systemInfo);
  socket.emit('clientInfo', systemInfo);

  // ------------------------------------------------------------------
  // 客户端→服务端事件
  // ------------------------------------------------------------------

  /**
   * 请求客户端信息
   */
  socket.on('getClientInfo', () => {
    log.debug({ socketId: socket.id }, 'getClientInfo');
    socket.emit('clientInfo', systemInfo);
  });

  /**
   * 请求刷新打印机列表
   */
  socket.on('refreshPrinterList', () => {
    log.debug({ socketId: socket.id }, 'refreshPrinterList');
    _emitPrinterList(socket, printerAdapter, systemInfo);
  });

  /**
   * 常规打印任务（HTML / PDF）
   */
  socket.on('news', (data) => {
    if (!data) return;

    log.info({ socketId: socket.id, printer: data.printer, templateId: data.templateId }, '收到打印任务: news');

    try {
      jobManager.submit({
        html: data.html,
        printer: data.printer,
        templateId: data.templateId,
        type: data.type || 'html',
        clientId: socket.id,
        pageNum: data.pageNum,
        options: data,
        replyId: data.replyId,
      });
    } catch (err) {
      log.error({ socketId: socket.id, err }, '提交打印任务失败');
      socket.emit('error', { msg: err.message, replyId: data.replyId });
    }
  });

  /**
   * 分片传输打印任务
   *
   * 当内容过大时，vue-plugin-hiprint 会将 HTML 拆分为多个分片传输，
   * 所有分片到齐后自动合并并提交打印。
   */
  socket.on('printByFragments', (data) => {
    if (!data) return;

    const { total, index, htmlFragment, id } = data;

    log.debug(
      { socketId: socket.id, fragmentId: id, index, total },
      '收到分片: printByFragments'
    );

    const result = fragmentManager.addFragment(id, total, index, htmlFragment);

    if (result.complete) {
      log.info({ socketId: socket.id, fragmentId: id }, '分片合并完成，提交打印');

      try {
        // 用合并后的 HTML 覆盖原始数据
        data.html = result.html;

        jobManager.submit({
          html: data.html,
          printer: data.printer,
          templateId: data.templateId,
          type: data.type || 'html',
          clientId: socket.id,
          pageNum: data.pageNum,
          options: data,
          replyId: data.replyId,
        });
      } catch (err) {
        log.error({ socketId: socket.id, err }, '分片打印任务提交失败');
        socket.emit('error', { msg: err.message, replyId: data.replyId });
      }
    }
  });

  /**
   * 模板渲染后直接打印
   */
  socket.on('render-print', (data) => {
    if (!data) return;

    log.info({ socketId: socket.id }, '收到渲染打印任务: render-print');

    try {
      jobManager.submit({
        html: data.html,
        printer: data.printer,
        templateId: data.templateId,
        type: JobType.RENDER_PRINT,
        clientId: socket.id,
        pageNum: data.pageNum,
        options: data,
        replyId: data.replyId,
      });
    } catch (err) {
      log.error({ socketId: socket.id, err }, 'render-print 任务提交失败');
      socket.emit('render-print-error', { msg: err.message, replyId: data.replyId });
    }
  });

  /**
   * 模板渲染为 JPEG 截图
   */
  socket.on('render-jpeg', (data) => {
    if (!data) return;

    log.info({ socketId: socket.id }, '收到截图任务: render-jpeg');

    try {
      jobManager.submit({
        html: data.html,
        printer: data.printer,
        templateId: data.templateId,
        type: JobType.RENDER_JPEG,
        clientId: socket.id,
        pageNum: data.pageNum,
        options: data,
        replyId: data.replyId,
      });
    } catch (err) {
      log.error({ socketId: socket.id, err }, 'render-jpeg 任务提交失败');
      socket.emit('render-jpeg-error', { msg: err.message, replyId: data.replyId });
    }
  });

  /**
   * 模板渲染为 PDF
   */
  socket.on('render-pdf', (data) => {
    if (!data) return;

    log.info({ socketId: socket.id }, '收到 PDF 渲染任务: render-pdf');

    try {
      jobManager.submit({
        html: data.html,
        printer: data.printer,
        templateId: data.templateId,
        type: JobType.RENDER_PDF,
        clientId: socket.id,
        pageNum: data.pageNum,
        options: data,
        replyId: data.replyId,
      });
    } catch (err) {
      log.error({ socketId: socket.id, err }, 'render-pdf 任务提交失败');
      socket.emit('render-pdf-error', { msg: err.message, replyId: data.replyId });
    }
  });

  /**
   * IPP 打印 — Phase 2 预留占位
   */
  socket.on('ippPrint', (data) => {
    log.info({ socketId: socket.id }, 'ippPrint: Phase 2 尚未实现');
    socket.emit('error', {
      msg: 'IPP 打印功能将在 Phase 2 中实现',
      replyId: data?.replyId,
    });
  });

  /**
   * IPP 请求 — Phase 2 预留占位
   */
  socket.on('ippRequest', (data) => {
    log.info({ socketId: socket.id }, 'ippRequest: Phase 2 尚未实现');
    socket.emit('error', {
      msg: 'IPP 请求功能将在 Phase 2 中实现',
      replyId: data?.replyId,
    });
  });

  /**
   * 客户端断开连接
   */
  socket.on('disconnect', (reason) => {
    log.info({ socketId: socket.id, reason }, '客户端断开连接');
    // 移除该 socket 上的 jobManager 事件监听器，防止内存泄漏
    _removeJobListeners();
  });

  // ------------------------------------------------------------------
  // jobManager 事件 → 路由回该 socket
  // ------------------------------------------------------------------

  /**
   * 任务完成事件：打印成功
   * 注意：同时 emit 'successs'（兼容旧版 vue-plugin-hiprint 拼写错误）和 'success'
   */
  function onJobPrinted({ job, replyId }) {
    if (job.clientId !== socket.id) return;

    const payload = {
      templateId: job.templateId,
      printer: job.printer,
      jobId: job.id,
      replyId,
    };

    // 兼容旧版 vue-plugin-hiprint（0.0.56 之前）的拼写错误，必须保留
    socket.emit('successs', payload);
    socket.emit('success', payload);
  }

  /**
   * 任务完成事件：渲染结果返回（JPEG / PDF）
   */
  function onJobRendered({ job, buffer, replyId }) {
    if (job.clientId !== socket.id) return;

    if (job.type === JobType.RENDER_JPEG) {
      socket.emit('render-jpeg-success', {
        templateId: job.templateId,
        jobId: job.id,
        replyId,
        buffer,
      });
    } else if (job.type === JobType.RENDER_PDF) {
      socket.emit('render-pdf-success', {
        templateId: job.templateId,
        jobId: job.id,
        replyId,
        buffer,
      });
    }
  }

  /**
   * 任务状态变更：失败时路由错误回调
   */
  function onJobUpdate(job) {
    if (job.clientId !== socket.id) return;

    const ctx = { jobId: job.id, replyId: null };

    switch (job.status) {
      case JobStatus.FAILED_RENDER:
        // 根据原始任务类型发送对应的 error 事件
        if (job.type === JobType.RENDER_JPEG) {
          socket.emit('render-jpeg-error', { msg: job.errorMsg, ...ctx });
        } else if (job.type === JobType.RENDER_PDF) {
          socket.emit('render-pdf-error', { msg: job.errorMsg, ...ctx });
        } else if (job.type === JobType.RENDER_PRINT) {
          socket.emit('render-print-error', { msg: job.errorMsg, ...ctx });
        } else {
          socket.emit('error', { msg: job.errorMsg, ...ctx });
        }
        break;

      case JobStatus.FAILED_PRINT:
        if (job.type === JobType.RENDER_PRINT) {
          socket.emit('render-print-error', { msg: job.errorMsg, ...ctx });
        } else {
          socket.emit('error', { msg: job.errorMsg, ...ctx });
        }
        break;

      case JobStatus.TIMEOUT:
        socket.emit('error', { msg: job.errorMsg || '任务超时', ...ctx });
        break;

      // 其他状态不发送事件
      default:
        break;
    }
  }

  // 注册监听器
  jobManager.events.on('job:printed', onJobPrinted);
  jobManager.events.on('job:rendered', onJobRendered);
  jobManager.events.on('job:update', onJobUpdate);

  /**
   * 移除当前 socket 关联的 jobManager 事件监听器
   */
  function _removeJobListeners() {
    jobManager.events.off('job:printed', onJobPrinted);
    jobManager.events.off('job:rendered', onJobRendered);
    jobManager.events.off('job:update', onJobUpdate);
  }
}

// ------------------------------------------------------------------
// 内部辅助函数
// ------------------------------------------------------------------

/**
 * 为打印机列表注入 agent 来源标识
 *
 * 在多 agent 部署场景下，Web 端需要知道每个打印机来自哪个 agent，
 * 以便在打印时正确路由到目标服务器。
 *
 * @param {Array} printers - 原始打印机列表
 * @param {object} systemInfo - 系统信息（含 agentId、hostname、ip）
 * @returns {Array} 增强后的打印机列表
 */
export function enrichPrinterList(printers, systemInfo) {
  if (!systemInfo || !Array.isArray(printers)) return printers;
  return printers.map(printer => ({
    ...printer,
    agentId: systemInfo.agentId || '',
    agentHost: systemInfo.hostname || '',
    agentIp: systemInfo.ip || '',
  }));
}

/**
 * 异步获取打印机列表并推送给客户端
 *
 * @param {import('socket.io').Socket} socket - 目标 socket
 * @param {object} printerAdapter - 打印适配器实例
 * @param {object} systemInfo - 预采集的系统信息（含 agentId、hostname、ip）
 */
async function _emitPrinterList(socket, printerAdapter, systemInfo) {
  try {
    const printers = await printerAdapter.getPrinters();
    socket.emit('printerList', enrichPrinterList(printers, systemInfo));
  } catch (err) {
    const log = getLogger();
    log.error({ socketId: socket.id, err }, '获取打印机列表失败');
  }
}
