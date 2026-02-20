/**
 * 事件分派器模块
 *
 * 提取 events.js 和 transit-client.js 中共享的事件处理逻辑和
 * jobManager 结果路由逻辑，作为统一的委托层。
 *
 * 两个通道（Socket.IO Gateway / 中转客户端）均通过此 dispatcher
 * 处理命令事件和结果路由，消除重复代码。
 */

import { getLogger } from '../logger.js';
import { getTracer } from '../observability/tracing.js';
import { JobStatus, JobType } from '../jobs/types.js';

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
 * 在 span 中执行处理函数（同步安全包装）
 *
 * OTel 未启用时直接执行 fn，零开销。
 *
 * @param {string} spanName - span 名称
 * @param {Record<string, string>} attributes - span 属性
 * @param {() => void} fn - 待执行的处理函数
 */
function withEventSpan(spanName, attributes, fn) {
  const tracer = getTracer();
  if (!tracer) {
    return fn();
  }

  const span = tracer.startSpan(spanName, { attributes });
  try {
    const result = fn();
    span.setStatus({ code: 1 }); // SpanStatusCode.OK
    return result;
  } catch (err) {
    span.setStatus({ code: 2, message: err.message }); // SpanStatusCode.ERROR
    span.recordException(err);
    throw err;
  } finally {
    span.end();
  }
}

/**
 * 创建事件分派器
 *
 * @param {object} deps
 * @param {object} deps.jobManager - Job Manager 实例
 * @param {object} deps.printerAdapter - 打印适配器实例
 * @param {object} deps.systemInfo - 预采集的系统信息（含 hostname、version、ip 等）
 * @returns {EventDispatcher}
 */
export function createEventDispatcher({ jobManager, printerAdapter, systemInfo }) {
  const log = getLogger();

  // ------------------------------------------------------------------
  // 命令处理器
  // ------------------------------------------------------------------

  /**
   * 处理 getClientInfo 事件
   *
   * @param {object} emitter - 具有 emit(event, data) 方法的对象
   */
  function handleGetClientInfo(emitter) {
    emitter.emit('clientInfo', systemInfo);
  }

  /**
   * 处理 refreshPrinterList 事件：获取打印机列表并推送
   *
   * @param {object} emitter - 具有 emit(event, data) 方法的对象
   */
  async function handleRefreshPrinterList(emitter) {
    try {
      const printers = await printerAdapter.getPrinters();
      emitter.emit('printerList', enrichPrinterList(printers, systemInfo));
    } catch (err) {
      log.error({ err }, '获取打印机列表失败');
    }
  }

  /**
   * 处理 news 事件：常规打印任务（HTML / PDF）
   *
   * @param {object} data - 事件数据
   * @param {string} clientId - 任务来源标识
   * @param {object} emitter - 具有 emit(event, data) 方法的对象
   * @returns {object|undefined} 提交成功时返回 job 对象，否则 undefined
   */
  function handleNews(data, clientId, emitter) {
    if (!data) return;

    return withEventSpan('socket.news', { 'socket.client_id': clientId }, () => {
      log.info({ clientId, printer: data.printer, templateId: data.templateId }, '收到打印任务: news');

      try {
        return jobManager.submit({
          html: data.html,
          printer: data.printer,
          templateId: data.templateId,
          type: data.type || 'html',
          clientId,
          pageNum: data.pageNum,
          options: data,
          replyId: data.replyId,
        });
      } catch (err) {
        log.error({ clientId, err }, '提交打印任务失败');
        emitter.emit('error', { msg: err.message, replyId: data.replyId });
      }
    });
  }

  /**
   * 处理 printByFragments 事件：分片传输打印任务
   *
   * @param {object} data - 事件数据
   * @param {string} clientId - 任务来源标识
   * @param {object} emitter - 具有 emit(event, data) 方法的对象
   * @param {import('../utils/fragments.js').FragmentManager} fragmentManager - 分片管理器
   * @returns {object|undefined} 分片合并完成并提交成功时返回 job 对象，否则 undefined
   */
  function handlePrintByFragments(data, clientId, emitter, fragmentManager) {
    if (!data) return;

    return withEventSpan('socket.printByFragments', { 'socket.client_id': clientId }, () => {
      const { total, index, htmlFragment, id } = data;

      log.debug({ clientId, fragmentId: id, index, total }, '收到分片: printByFragments');

      let result;
      try {
        result = fragmentManager.addFragment(id, total, index, htmlFragment);
      } catch (err) {
        log.warn({ clientId, fragmentId: id, err: err.message }, '分片校验失败');
        emitter.emit('error', { msg: err.message, replyId: data.replyId });
        return;
      }

      if (result.complete) {
        log.info({ clientId, fragmentId: id }, '分片合并完成，提交打印');

        try {
          // 用合并后的 HTML 覆盖原始数据
          data.html = result.html;

          return jobManager.submit({
            html: data.html,
            printer: data.printer,
            templateId: data.templateId,
            type: data.type || 'html',
            clientId,
            pageNum: data.pageNum,
            options: data,
            replyId: data.replyId,
          });
        } catch (err) {
          log.error({ clientId, err }, '分片打印任务提交失败');
          emitter.emit('error', { msg: err.message, replyId: data.replyId });
        }
      }
    });
  }

  /**
   * 处理 render-print 事件：模板渲染后直接打印
   *
   * @param {object} data - 事件数据
   * @param {string} clientId - 任务来源标识
   * @param {object} emitter - 具有 emit(event, data) 方法的对象
   * @returns {object|undefined} 提交成功时返回 job 对象，否则 undefined
   */
  function handleRenderPrint(data, clientId, emitter) {
    if (!data) return;

    return withEventSpan('socket.render-print', { 'socket.client_id': clientId }, () => {
      log.info({ clientId }, '收到渲染打印任务: render-print');

      try {
        return jobManager.submit({
          html: data.html,
          printer: data.printer,
          templateId: data.templateId,
          type: JobType.RENDER_PRINT,
          clientId,
          pageNum: data.pageNum,
          options: data,
          replyId: data.replyId,
        });
      } catch (err) {
        log.error({ clientId, err }, 'render-print 任务提交失败');
        emitter.emit('render-print-error', { msg: err.message, replyId: data.replyId });
      }
    });
  }

  /**
   * 处理 render-jpeg 事件：模板渲染为 JPEG 截图
   *
   * @param {object} data - 事件数据
   * @param {string} clientId - 任务来源标识
   * @param {object} emitter - 具有 emit(event, data) 方法的对象
   * @returns {object|undefined} 提交成功时返回 job 对象，否则 undefined
   */
  function handleRenderJpeg(data, clientId, emitter) {
    if (!data) return;

    return withEventSpan('socket.render-jpeg', { 'socket.client_id': clientId }, () => {
      log.info({ clientId }, '收到截图任务: render-jpeg');

      try {
        return jobManager.submit({
          html: data.html,
          printer: data.printer,
          templateId: data.templateId,
          type: JobType.RENDER_JPEG,
          clientId,
          pageNum: data.pageNum,
          options: data,
          replyId: data.replyId,
        });
      } catch (err) {
        log.error({ clientId, err }, 'render-jpeg 任务提交失败');
        emitter.emit('render-jpeg-error', { msg: err.message, replyId: data.replyId });
      }
    });
  }

  /**
   * 处理 render-pdf 事件：模板渲染为 PDF
   *
   * @param {object} data - 事件数据
   * @param {string} clientId - 任务来源标识
   * @param {object} emitter - 具有 emit(event, data) 方法的对象
   * @returns {object|undefined} 提交成功时返回 job 对象，否则 undefined
   */
  function handleRenderPdf(data, clientId, emitter) {
    if (!data) return;

    return withEventSpan('socket.render-pdf', { 'socket.client_id': clientId }, () => {
      log.info({ clientId }, '收到 PDF 渲染任务: render-pdf');

      try {
        return jobManager.submit({
          html: data.html,
          printer: data.printer,
          templateId: data.templateId,
          type: JobType.RENDER_PDF,
          clientId,
          pageNum: data.pageNum,
          options: data,
          replyId: data.replyId,
        });
      } catch (err) {
        log.error({ clientId, err }, 'render-pdf 任务提交失败');
        emitter.emit('render-pdf-error', { msg: err.message, replyId: data.replyId });
      }
    });
  }

  /**
   * 处理 ippPrint 事件 -- Phase 2 预留占位
   *
   * @param {object} data - 事件数据
   * @param {object} emitter - 具有 emit(event, data) 方法的对象
   */
  function handleIppPrint(data, emitter) {
    log.info('ippPrint: Phase 2 尚未实现');
    emitter.emit('error', {
      msg: 'IPP 打印功能将在 Phase 2 中实现',
      replyId: data?.replyId,
    });
  }

  /**
   * 处理 ippRequest 事件 -- Phase 2 预留占位
   *
   * @param {object} data - 事件数据
   * @param {object} emitter - 具有 emit(event, data) 方法的对象
   */
  function handleIppRequest(data, emitter) {
    log.info('ippRequest: Phase 2 尚未实现');
    emitter.emit('error', {
      msg: 'IPP 请求功能将在 Phase 2 中实现',
      replyId: data?.replyId,
    });
  }

  // ------------------------------------------------------------------
  // 结果路由
  // ------------------------------------------------------------------

  /**
   * 创建 jobManager 结果路由器
   *
   * 将 jobManager 的 job:printed / job:rendered / job:update 事件
   * 路由到指定的 emitter（socket 或 client），使用 matchFn 判断归属。
   *
   * @param {Function} emitFn - (event, data) => void，用于发送事件
   * @param {Function} matchFn - (job) => boolean，判断此 job 是否属于当前通道
   * @returns {{ attach: () => void, detach: () => void }}
   */
  function createResultRouter(emitFn, matchFn) {
    /** jobId -> replyId 映射，用于错误回包时关联原始请求 */
    const replyIdMap = new Map();

    /**
     * 注册任务与 replyId 的关联
     * @param {string} jobId
     * @param {string|null} replyId
     */
    function registerJob(jobId, replyId) {
      if (jobId && replyId) {
        replyIdMap.set(jobId, replyId);
      }
    }

    function onJobPrinted({ job, replyId }) {
      if (!matchFn(job)) return;

      // 回退到 replyIdMap（事件参数中的 replyId 可能为 null）
      const rid = replyId ?? replyIdMap.get(job.id) ?? null;
      replyIdMap.delete(job.id);

      const payload = {
        templateId: job.templateId,
        printer: job.printer,
        jobId: job.id,
        replyId: rid,
      };

      // 兼容旧版 vue-plugin-hiprint（0.0.56 之前）的拼写错误，必须保留
      emitFn('successs', payload);
      emitFn('success', payload);
    }

    function onJobRendered({ job, buffer, replyId }) {
      if (!matchFn(job)) return;

      // 回退到 replyIdMap（事件参数中的 replyId 可能为 null）
      const rid = replyId ?? replyIdMap.get(job.id) ?? null;
      replyIdMap.delete(job.id);

      if (job.type === JobType.RENDER_JPEG) {
        emitFn('render-jpeg-success', {
          templateId: job.templateId,
          jobId: job.id,
          replyId: rid,
          buffer,
        });
      } else if (job.type === JobType.RENDER_PDF) {
        emitFn('render-pdf-success', {
          templateId: job.templateId,
          jobId: job.id,
          replyId: rid,
          buffer,
        });
      }
    }

    function onJobUpdate(job) {
      if (!matchFn(job)) return;

      const replyId = replyIdMap.get(job.id) || null;
      const ctx = { jobId: job.id, replyId };

      switch (job.status) {
        case JobStatus.FAILED_RENDER:
          // 根据原始任务类型发送对应的 error 事件
          if (job.type === JobType.RENDER_JPEG) {
            emitFn('render-jpeg-error', { msg: job.errorMsg, ...ctx });
          } else if (job.type === JobType.RENDER_PDF) {
            emitFn('render-pdf-error', { msg: job.errorMsg, ...ctx });
          } else if (job.type === JobType.RENDER_PRINT) {
            emitFn('render-print-error', { msg: job.errorMsg, ...ctx });
          } else {
            emitFn('error', { msg: job.errorMsg, ...ctx });
          }
          break;

        case JobStatus.FAILED_PRINT:
          if (job.type === JobType.RENDER_PRINT) {
            emitFn('render-print-error', { msg: job.errorMsg, ...ctx });
          } else {
            emitFn('error', { msg: job.errorMsg, ...ctx });
          }
          break;

        case JobStatus.TIMEOUT:
          emitFn('error', { msg: job.errorMsg || '任务超时', ...ctx });
          break;

        // 其他状态不发送事件
        default:
          break;
      }

      // 终态时清理映射，防止内存泄漏
      if ([JobStatus.FAILED_RENDER, JobStatus.FAILED_PRINT, JobStatus.TIMEOUT, 'canceled'].includes(job.status)) {
        replyIdMap.delete(job.id);
      }
    }

    function attach() {
      jobManager.events.on('job:printed', onJobPrinted);
      jobManager.events.on('job:rendered', onJobRendered);
      jobManager.events.on('job:update', onJobUpdate);
    }

    function detach() {
      jobManager.events.off('job:printed', onJobPrinted);
      jobManager.events.off('job:rendered', onJobRendered);
      jobManager.events.off('job:update', onJobUpdate);
      replyIdMap.clear();
    }

    return { attach, detach, registerJob };
  }

  // ------------------------------------------------------------------
  // 全局结果路由（进程级单例，替代 per-socket 路由）
  // ------------------------------------------------------------------

  /**
   * 创建全局结果路由器
   *
   * 只 attach 3 个 jobManager 监听器（固定数量，不随连接数增长），
   * 用 io.to(clientId).emit() 广播到目标 socket。
   * 维护 replyIdMap: Map<jobId, replyId> 解决 replyId 丢失问题。
   *
   * 注意：此路由器仅适用于 Socket.IO Gateway 模式。
   * transit-client 仍使用 createResultRouter（per-connection 路由）。
   *
   * @param {import('socket.io').Server} io - Socket.IO Server 实例
   * @returns {{ attach: () => void, detach: () => void, trackReplyId: (jobId: string, replyId: string|null) => void }}
   */
  function createGlobalResultRouter(io) {
    const replyIdMap = new Map();

    /**
     * 追踪 job 提交时的 replyId，供后续回包使用
     */
    function trackReplyId(jobId, replyId) {
      if (replyId != null) replyIdMap.set(jobId, replyId);
    }

    function onJobPrinted({ job, replyId }) {
      // 中转任务不走全局路由（由 transit-client 的 per-connection 路由处理）
      if (job.clientId?.startsWith('transit:')) return;

      const rid = replyId ?? replyIdMap.get(job.id) ?? null;
      const payload = {
        templateId: job.templateId,
        printer: job.printer,
        jobId: job.id,
        replyId: rid,
      };

      // 兼容旧版 vue-plugin-hiprint（0.0.56 之前）的拼写错误，必须保留
      io.to(job.clientId).emit('successs', payload);
      io.to(job.clientId).emit('success', payload);
      replyIdMap.delete(job.id);
    }

    function onJobRendered({ job, buffer, replyId }) {
      if (job.clientId?.startsWith('transit:')) return;

      const rid = replyId ?? replyIdMap.get(job.id) ?? null;

      if (job.type === JobType.RENDER_JPEG) {
        io.to(job.clientId).emit('render-jpeg-success', {
          templateId: job.templateId,
          jobId: job.id,
          replyId: rid,
          buffer,
        });
      } else if (job.type === JobType.RENDER_PDF) {
        io.to(job.clientId).emit('render-pdf-success', {
          templateId: job.templateId,
          jobId: job.id,
          replyId: rid,
          buffer,
        });
      }
      replyIdMap.delete(job.id);
    }

    function onJobUpdate(job) {
      if (job.clientId?.startsWith('transit:')) return;

      const rid = replyIdMap.get(job.id) ?? null;
      const isTerminal = [
        JobStatus.DONE,
        JobStatus.FAILED_RENDER,
        JobStatus.FAILED_PRINT,
        JobStatus.CANCELED,
        JobStatus.TIMEOUT,
      ].includes(job.status);

      switch (job.status) {
        case JobStatus.FAILED_RENDER:
          if (job.type === JobType.RENDER_JPEG) {
            io.to(job.clientId).emit('render-jpeg-error', { msg: job.errorMsg, jobId: job.id, replyId: rid });
          } else if (job.type === JobType.RENDER_PDF) {
            io.to(job.clientId).emit('render-pdf-error', { msg: job.errorMsg, jobId: job.id, replyId: rid });
          } else if (job.type === JobType.RENDER_PRINT) {
            io.to(job.clientId).emit('render-print-error', { msg: job.errorMsg, jobId: job.id, replyId: rid });
          } else {
            io.to(job.clientId).emit('error', { msg: job.errorMsg, jobId: job.id, replyId: rid });
          }
          break;

        case JobStatus.FAILED_PRINT:
          if (job.type === JobType.RENDER_PRINT) {
            io.to(job.clientId).emit('render-print-error', { msg: job.errorMsg, jobId: job.id, replyId: rid });
          } else {
            io.to(job.clientId).emit('error', { msg: job.errorMsg, jobId: job.id, replyId: rid });
          }
          break;

        case JobStatus.TIMEOUT:
          io.to(job.clientId).emit('error', { msg: job.errorMsg || '任务超时', jobId: job.id, replyId: rid });
          break;

        default:
          break;
      }

      if (isTerminal) replyIdMap.delete(job.id);
    }

    function attach() {
      jobManager.events.on('job:printed', onJobPrinted);
      jobManager.events.on('job:rendered', onJobRendered);
      jobManager.events.on('job:update', onJobUpdate);
    }

    function detach() {
      jobManager.events.off('job:printed', onJobPrinted);
      jobManager.events.off('job:rendered', onJobRendered);
      jobManager.events.off('job:update', onJobUpdate);
      replyIdMap.clear();
    }

    return { attach, detach, trackReplyId };
  }

  return {
    handleGetClientInfo,
    handleRefreshPrinterList,
    handleNews,
    handlePrintByFragments,
    handleRenderPrint,
    handleRenderJpeg,
    handleRenderPdf,
    handleIppPrint,
    handleIppRequest,
    createResultRouter,
    createGlobalResultRouter,
  };
}
