/**
 * 中转客户端模块
 *
 * 作为 Socket.IO 客户端连接 node-hiprint-transit 中转服务，
 * 接收远程打印任务并通过 jobManager 调度本地 Playwright + CUPS 执行。
 *
 * 通信流程：Web/Mobile → node-hiprint-transit → hiprint-agent(transit-client) → Printer
 *
 * 事件命名完全对齐 electron-hiprint 的 initClientEvent()，
 * 确保 node-hiprint-transit 无需任何修改即可兼容。
 */

import { io } from 'socket.io-client';
import { getLogger } from '../logger.js';
import { JobStatus, JobType } from '../jobs/types.js';
import { FragmentManager } from '../utils/fragments.js';

/** 中转客户端提交的 job 使用的 clientId 前缀 */
const TRANSIT_CLIENT_PREFIX = 'transit:';

/**
 * 创建中转客户端实例
 *
 * @param {object} deps
 * @param {object} deps.config - 应用配置（含 transitUrl, transitToken）
 * @param {object} deps.jobManager - Job Manager 实例
 * @param {object} deps.printerAdapter - 打印适配器
 * @param {object} deps.systemInfo - 系统信息（hostname, version, ip, mac 等）
 * @returns {{ client: import('socket.io-client').Socket, close: () => void, isConnected: () => boolean }}
 */
export function createTransitClient({ config, jobManager, printerAdapter, systemInfo }) {
  const log = getLogger();

  // 中转客户端独立的分片管理器（与 Server 模式隔离）
  const fragmentManager = new FragmentManager({
    checkInterval: 5,
    expire: 10,
  });

  const client = io(config.transitUrl, {
    transports: ['websocket'],
    // 使用 "electron-hiprint" 标识，零中转服务修改
    query: { client: 'electron-hiprint' },
    auth: { token: config.transitToken },
    reconnection: true,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 30000,
  });

  // 用于精确匹配回调路由的唯一标识
  const transitClientId = () => `${TRANSIT_CLIENT_PREFIX}${client.id}`;

  // ------------------------------------------------------------------
  // jobManager 事件监听器（结果回调至中转服务）
  // ------------------------------------------------------------------

  function onJobPrinted({ job, replyId }) {
    if (!job.clientId?.startsWith(TRANSIT_CLIENT_PREFIX)) return;

    const payload = {
      templateId: job.templateId,
      printer: job.printer,
      jobId: job.id,
      replyId,
    };

    // 兼容旧版 vue-plugin-hiprint（0.0.56 之前）的拼写错误，必须保留
    client.emit('successs', payload);
    client.emit('success', payload);
  }

  function onJobRendered({ job, buffer, replyId }) {
    if (!job.clientId?.startsWith(TRANSIT_CLIENT_PREFIX)) return;

    if (job.type === JobType.RENDER_JPEG) {
      client.emit('render-jpeg-success', {
        templateId: job.templateId,
        jobId: job.id,
        replyId,
        buffer,
      });
    } else if (job.type === JobType.RENDER_PDF) {
      client.emit('render-pdf-success', {
        templateId: job.templateId,
        jobId: job.id,
        replyId,
        buffer,
      });
    }
  }

  function onJobUpdate(job) {
    if (!job.clientId?.startsWith(TRANSIT_CLIENT_PREFIX)) return;

    const ctx = { jobId: job.id, replyId: null };

    switch (job.status) {
      case JobStatus.FAILED_RENDER:
        if (job.type === JobType.RENDER_JPEG) {
          client.emit('render-jpeg-error', { msg: job.errorMsg, ...ctx });
        } else if (job.type === JobType.RENDER_PDF) {
          client.emit('render-pdf-error', { msg: job.errorMsg, ...ctx });
        } else if (job.type === JobType.RENDER_PRINT) {
          client.emit('render-print-error', { msg: job.errorMsg, ...ctx });
        } else {
          client.emit('error', { msg: job.errorMsg, ...ctx });
        }
        break;

      case JobStatus.FAILED_PRINT:
        if (job.type === JobType.RENDER_PRINT) {
          client.emit('render-print-error', { msg: job.errorMsg, ...ctx });
        } else {
          client.emit('error', { msg: job.errorMsg, ...ctx });
        }
        break;

      case JobStatus.TIMEOUT:
        client.emit('error', { msg: job.errorMsg || '任务超时', ...ctx });
        break;

      default:
        break;
    }
  }

  // ------------------------------------------------------------------
  // 中转服务 → Agent 事件
  // ------------------------------------------------------------------

  client.on('connect', async () => {
    log.info({ socketId: client.id, url: config.transitUrl }, '已连接中转服务');

    // 推送打印机列表
    try {
      const printers = await printerAdapter.getPrinters();
      client.emit('printerList', printers);
    } catch (err) {
      log.error({ err }, '中转客户端: 获取打印机列表失败');
    }

    // 推送客户端信息
    client.emit('clientInfo', systemInfo);

    // 注册 jobManager 事件监听
    jobManager.events.on('job:printed', onJobPrinted);
    jobManager.events.on('job:rendered', onJobRendered);
    jobManager.events.on('job:update', onJobUpdate);
  });

  client.on('getClientInfo', () => {
    log.debug({ socketId: client.id }, '中转服务请求: getClientInfo');
    client.emit('clientInfo', systemInfo);
  });

  client.on('refreshPrinterList', async () => {
    log.debug({ socketId: client.id }, '中转服务请求: refreshPrinterList');
    try {
      const printers = await printerAdapter.getPrinters();
      client.emit('printerList', printers);
    } catch (err) {
      log.error({ err }, '中转客户端: 刷新打印机列表失败');
    }
  });

  client.on('news', (data) => {
    if (!data) return;

    log.info({ printer: data.printer, templateId: data.templateId }, '中转任务: news');

    try {
      jobManager.submit({
        html: data.html,
        printer: data.printer,
        templateId: data.templateId,
        type: data.type || 'html',
        clientId: transitClientId(),
        pageNum: data.pageNum,
        options: data,
        replyId: data.replyId,
      });
    } catch (err) {
      log.error({ err }, '中转任务提交失败: news');
      client.emit('error', { msg: err.message, replyId: data.replyId });
    }
  });

  client.on('printByFragments', (data) => {
    if (!data) return;

    const { total, index, htmlFragment, id } = data;

    log.debug({ fragmentId: id, index, total }, '中转分片: printByFragments');

    const result = fragmentManager.addFragment(id, total, index, htmlFragment);

    if (result.complete) {
      log.info({ fragmentId: id }, '中转分片合并完成，提交打印');

      try {
        data.html = result.html;

        jobManager.submit({
          html: data.html,
          printer: data.printer,
          templateId: data.templateId,
          type: data.type || 'html',
          clientId: transitClientId(),
          pageNum: data.pageNum,
          options: data,
          replyId: data.replyId,
        });
      } catch (err) {
        log.error({ err }, '中转分片任务提交失败');
        client.emit('error', { msg: err.message, replyId: data.replyId });
      }
    }
  });

  client.on('render-print', (data) => {
    if (!data) return;

    log.info('中转任务: render-print');

    try {
      jobManager.submit({
        html: data.html,
        printer: data.printer,
        templateId: data.templateId,
        type: JobType.RENDER_PRINT,
        clientId: transitClientId(),
        pageNum: data.pageNum,
        options: data,
        replyId: data.replyId,
      });
    } catch (err) {
      log.error({ err }, '中转任务提交失败: render-print');
      client.emit('render-print-error', { msg: err.message, replyId: data.replyId });
    }
  });

  client.on('render-jpeg', (data) => {
    if (!data) return;

    log.info('中转任务: render-jpeg');

    try {
      jobManager.submit({
        html: data.html,
        printer: data.printer,
        templateId: data.templateId,
        type: JobType.RENDER_JPEG,
        clientId: transitClientId(),
        pageNum: data.pageNum,
        options: data,
        replyId: data.replyId,
      });
    } catch (err) {
      log.error({ err }, '中转任务提交失败: render-jpeg');
      client.emit('render-jpeg-error', { msg: err.message, replyId: data.replyId });
    }
  });

  client.on('render-pdf', (data) => {
    if (!data) return;

    log.info('中转任务: render-pdf');

    try {
      jobManager.submit({
        html: data.html,
        printer: data.printer,
        templateId: data.templateId,
        type: JobType.RENDER_PDF,
        clientId: transitClientId(),
        pageNum: data.pageNum,
        options: data,
        replyId: data.replyId,
      });
    } catch (err) {
      log.error({ err }, '中转任务提交失败: render-pdf');
      client.emit('render-pdf-error', { msg: err.message, replyId: data.replyId });
    }
  });

  // IPP — Phase 2 预留
  client.on('ippPrint', (data) => {
    log.info('中转 ippPrint: Phase 2 尚未实现');
    client.emit('error', {
      msg: 'IPP 打印功能将在 Phase 2 中实现',
      replyId: data?.replyId,
    });
  });

  client.on('ippRequest', (data) => {
    log.info('中转 ippRequest: Phase 2 尚未实现');
    client.emit('error', {
      msg: 'IPP 请求功能将在 Phase 2 中实现',
      replyId: data?.replyId,
    });
  });

  // ------------------------------------------------------------------
  // 连接生命周期事件
  // ------------------------------------------------------------------

  client.on('connect_error', (err) => {
    const msg = `${err?.message || ''} ${err?.data?.message || ''}`.toLowerCase();

    // 鉴权失败时停止重连，防止无限重试冲击中转服务
    if (msg.includes('auth') || msg.includes('token') || msg.includes('unauthorized') || msg.includes('forbidden')) {
      log.fatal({ err }, '中转服务鉴权失败，停止重连。请检查 transitToken 配置');
      client.io.opts.reconnection = false;
      client.disconnect();
      return;
    }

    log.warn({ err }, '中转服务连接失败，等待重连...');
  });

  client.on('disconnect', (reason) => {
    log.info({ reason }, '与中转服务断开连接');

    // 移除 jobManager 事件监听器，防止向已断开的 socket 发送数据
    _removeJobListeners();
  });

  // ------------------------------------------------------------------
  // 内部方法
  // ------------------------------------------------------------------

  function _removeJobListeners() {
    jobManager.events.off('job:printed', onJobPrinted);
    jobManager.events.off('job:rendered', onJobRendered);
    jobManager.events.off('job:update', onJobUpdate);
  }

  // ------------------------------------------------------------------
  // 公共接口
  // ------------------------------------------------------------------

  return {
    client,

    isConnected() {
      return client.connected;
    },

    close() {
      _removeJobListeners();
      fragmentManager.destroy();
      client.disconnect();
      log.info('中转客户端已关闭');
    },
  };
}
