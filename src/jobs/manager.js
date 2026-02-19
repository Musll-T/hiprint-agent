/**
 * Job Manager - 打印任务核心调度器
 *
 * 负责接收打印任务、编排渲染→打印流水线、管理并发队列、
 * 处理超时/重试/取消，并通过事件通知上层（Socket/Web）状态变更。
 *
 * 依赖：
 *   - p-queue: 并发控制队列
 *   - store.js: SQLite 持久化
 *   - renderer (html-to-pdf / html-to-jpeg): Playwright 渲染
 *   - adapter.js: CUPS 打印适配
 */

import { EventEmitter } from 'node:events';
import { unlinkSync, mkdirSync } from 'node:fs';
import { writeFile as writeFileAsync, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import PQueue from 'p-queue';
import { v7 as uuidv7 } from 'uuid';
import { getLogger } from '../logger.js';
import {
  createJob,
  updateJobStatus,
  getJob,
  getJobStats,
  addAuditLog,
} from './store.js';
import { JobStatus, JobType, TERMINAL_STATUSES } from './types.js';
import { renderPDF } from '../renderer/html-to-pdf.js';
import { renderJPEG } from '../renderer/html-to-jpeg.js';

/** 最大重试次数 */
const MAX_RETRY_COUNT = 3;

/**
 * 标准打印参数字段列表（与 printer/options.js mapOptions 对齐）
 * 仅这些字段会被提取并持久化到数据库
 */
const PRINT_OPTION_KEYS = ['copies', 'duplex', 'duplexMode', 'landscape', 'pageSize', 'color', 'pageRanges'];

/**
 * 从 Socket.IO data 对象中提取标准打印参数
 *
 * 仅提取有实际值的字段，跳过 undefined/null，
 * 避免将 html/printer/templateId 等非打印参数混入。
 *
 * @param {object} options - 原始 options 对象（通常为整个 Socket.IO data）
 * @returns {string|null} JSON 字符串，无有效参数时返回 null
 */
function extractPrintOptions(options) {
  if (!options || typeof options !== 'object') return null;

  const extracted = {};
  let hasValue = false;

  for (const key of PRINT_OPTION_KEYS) {
    if (options[key] !== undefined && options[key] !== null) {
      extracted[key] = options[key];
      hasValue = true;
    }
  }

  return hasValue ? JSON.stringify(extracted) : null;
}

/** 需要渲染的任务类型集合 */
const RENDER_REQUIRED_TYPES = new Set([
  JobType.HTML,
  JobType.RENDER_PRINT,
  JobType.RENDER_PDF,
  JobType.RENDER_JPEG,
]);

/** 仅渲染、不打印的任务类型（返回 buffer 给调用方） */
const RENDER_ONLY_TYPES = new Set([
  JobType.RENDER_PDF,
  JobType.RENDER_JPEG,
]);

/** 跳过渲染、直接打印的任务类型 */
const DIRECT_PRINT_TYPES = new Set([
  JobType.PDF,
  JobType.URL_PDF,
  JobType.BLOB_PDF,
]);

/**
 * 创建 Job Manager 实例
 *
 * @param {object} deps - 依赖注入
 * @param {object} deps.rendererPool - createBrowserPool() 返回的浏览器池
 * @param {object} deps.printerAdapter - createPrinterAdapter() 返回的打印适配器
 * @param {object} deps.config - 应用配置对象
 * @returns {{ submit, cancel, retry, getStats, shutdown, events }}
 */
export function createJobManager({ rendererPool, printerAdapter, config }) {
  const log = getLogger();
  const events = new EventEmitter();

  // 确保 PDF 临时目录存在
  const pdfDir = config.pdfDir || './data/pdf';
  mkdirSync(pdfDir, { recursive: true });

  // ============================================================
  // 并发队列
  // ============================================================
  const renderQueue = new PQueue({ concurrency: config.renderConcurrency || 4 });
  const printQueue = new PQueue({ concurrency: config.printConcurrency || 2 });

  /**
   * 内存中维护的活跃任务上下文映射
   * 用于取消检测和回调数据传递（不持久化到数据库的临时数据）
   * @type {Map<string, { canceled: boolean, html?: string, options?: object, pdfPath?: string, replyId?: string, createdAt: number }>}
   */
  const jobContexts = new Map();

  /**
   * 定期清理可能泄漏的孤儿上下文（任务卡住未完成的场景）
   * 超过 2 倍渲染+打印超时仍未清理的上下文视为孤儿
   */
  const CONTEXT_MAX_AGE_MS = 2 * ((config.renderTimeout || 30000) + (config.printTimeout || 10000));
  const CONTEXT_CLEANUP_INTERVAL_MS = 60000; // 每分钟检查一次
  const contextCleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [jobId, ctx] of jobContexts) {
      if (now - ctx.createdAt > CONTEXT_MAX_AGE_MS) {
        log.warn({ jobId, ageMs: now - ctx.createdAt }, '清理过期任务上下文（疑似泄漏）');
        if (ctx.pdfPath) _cleanupPdf(ctx.pdfPath);
        jobContexts.delete(jobId);
      }
    }
  }, CONTEXT_CLEANUP_INTERVAL_MS);

  // ============================================================
  // 公共方法
  // ============================================================

  /**
   * 提交打印任务
   *
   * @param {object} jobData - 任务数据
   * @param {string} jobData.html - HTML 内容（渲染类型必填）
   * @param {string} [jobData.printer] - 目标打印机
   * @param {string} [jobData.templateId] - 模板 ID
   * @param {string} [jobData.type='html'] - 任务类型（见 JobType 枚举）
   * @param {string} [jobData.clientId] - 来源客户端 socketId
   * @param {string} [jobData.tenantId] - 租户 Token
   * @param {number} [jobData.pageNum] - 页数
   * @param {object} [jobData.options] - 渲染/打印参数
   * @param {string} [jobData.replyId] - 回调标识，用于 Socket 层匹配响应
   * @returns {import('./types.js').Job} 创建的任务对象
   * @throws {Error} 队列已满时抛出错误
   */
  function submit(jobData) {
    // 队列容量检查（同时检查渲染和打印队列总负载）
    const currentLoad = renderQueue.size + renderQueue.pending + printQueue.size + printQueue.pending;
    const maxSize = config.maxQueueSize || 1000;
    if (currentLoad >= maxSize) {
      throw new Error(`队列已满（当前 ${currentLoad}/${maxSize}），请稍后重试`);
    }

    // 持久化到数据库
    const job = createJob({
      printer: jobData.printer || null,
      templateId: jobData.templateId || null,
      type: jobData.type || JobType.HTML,
      clientId: jobData.clientId || null,
      tenantId: jobData.tenantId || null,
      pageNum: jobData.pageNum ?? null,
      printOptions: extractPrintOptions(jobData.options),
    });

    // 在内存中保存不持久化的上下文数据
    jobContexts.set(job.id, {
      canceled: false,
      html: jobData.html || null,
      options: jobData.options || {},
      pdfPath: null,
      replyId: jobData.replyId || null,
      createdAt: Date.now(),
    });

    log.info({ jobId: job.id, type: job.type, printer: job.printer }, '任务已提交');
    events.emit('job:update', job);

    // 异步保存 HTML 预览文件（不阻塞主流程）
    const previewDir = config.previewDir || './data/preview';
    if (jobData.html && RENDER_REQUIRED_TYPES.has(job.type)) {
      mkdir(previewDir, { recursive: true })
        .then(() => writeFileAsync(join(previewDir, `${job.id}.html`), jobData.html, 'utf-8'))
        .catch((err) => {
          log.warn({ jobId: job.id, err: err.message }, '保存预览文件失败');
        });
    }

    // 根据任务类型决定进入渲染队列还是直接打印队列
    if (DIRECT_PRINT_TYPES.has(job.type)) {
      // PDF/URL_PDF/BLOB_PDF 类型跳过渲染，直接进入打印
      // 此时 html 字段实际存放的是 PDF 文件路径或 buffer
      printQueue.add(() => _printJob(job));
    } else {
      // 其余类型先渲染再打印
      renderQueue.add(() => _renderJob(job));
    }

    return job;
  }

  /**
   * 渲染处理（内部方法）
   *
   * 根据任务类型选择渲染方式，成功后将打印任务入队或直接完成。
   * @param {import('./types.js').Job} job - 任务对象
   */
  async function _renderJob(job) {
    const ctx = jobContexts.get(job.id);

    // 取消检测
    if (ctx?.canceled) return;

    // 更新状态为渲染中
    job = updateJobStatus(job.id, JobStatus.RENDERING);
    events.emit('job:update', job);

    // 超时控制
    const renderTimeout = config.renderTimeout || 30000;
    const abortController = new AbortController();
    const timer = setTimeout(() => abortController.abort(), renderTimeout);

    try {
      const html = ctx?.html || '';
      const options = ctx?.options || {};

      let result;

      if (job.type === JobType.RENDER_JPEG) {
        // JPEG 截图渲染
        result = await Promise.race([
          renderJPEG(rendererPool, html, options),
          _abortPromise(abortController.signal),
        ]);
      } else {
        // HTML / RENDER_PRINT / RENDER_PDF 均走 PDF 渲染
        result = await Promise.race([
          renderPDF(rendererPool, html, options),
          _abortPromise(abortController.signal),
        ]);
      }

      clearTimeout(timer);

      // 取消检测（渲染期间可能被取消）
      if (ctx?.canceled) return;

      // 更新渲染耗时
      job = updateJobStatus(job.id, job.status, {
        renderDuration: result.duration,
      });

      // 仅渲染类型（render_pdf / render_jpeg）：直接标记完成，将 buffer 通过事件传递
      if (RENDER_ONLY_TYPES.has(job.type)) {
        job = updateJobStatus(job.id, JobStatus.DONE, {
          renderDuration: result.duration,
        });
        events.emit('job:update', job);
        events.emit('job:rendered', {
          job,
          buffer: result.buffer,
          replyId: ctx?.replyId,
        });
        _cleanupContext(job.id);
        return;
      }

      // 需要打印的类型：将 PDF buffer 写入临时文件，加入打印队列
      const pdfFileName = `${job.id}.pdf`;
      const pdfPath = join(pdfDir, pdfFileName);
      await writeFileAsync(pdfPath, result.buffer);

      if (ctx) {
        ctx.pdfPath = pdfPath;
      }

      log.debug({ jobId: job.id, pdfPath }, '渲染完成，PDF 已保存');

      // 加入打印队列
      printQueue.add(() => _printJob(job));
    } catch (err) {
      clearTimeout(timer);

      // 取消检测
      if (ctx?.canceled) return;

      if (abortController.signal.aborted) {
        // 超时
        log.warn({ jobId: job.id, timeout: renderTimeout }, '渲染超时');
        job = updateJobStatus(job.id, JobStatus.TIMEOUT, {
          errorMsg: `渲染超时（${renderTimeout}ms）`,
        });
        events.emit('job:update', job);
      } else {
        // 渲染失败
        log.error({ jobId: job.id, err }, '渲染失败');
        job = updateJobStatus(job.id, JobStatus.FAILED_RENDER, {
          errorMsg: err.message || String(err),
        });
        events.emit('job:update', job);
      }

      _cleanupContext(job.id);
    }
  }

  /**
   * 打印处理（内部方法）
   *
   * 调用打印适配器提交打印任务，支持失败重试（指数退避，最多 3 次）。
   * @param {import('./types.js').Job} job - 任务对象
   */
  async function _printJob(job) {
    const ctx = jobContexts.get(job.id);

    // 取消检测
    if (ctx?.canceled) return;

    // 更新状态为打印中
    job = updateJobStatus(job.id, JobStatus.PRINTING);
    events.emit('job:update', job);

    // 打印超时控制
    const printTimeout = config.printTimeout || 10000;
    const startTime = Date.now();

    try {
      // 确定 PDF 文件路径
      const pdfPath = ctx?.pdfPath || null;
      if (!pdfPath) {
        throw new Error('PDF 文件路径缺失，无法执行打印');
      }

      const timeout = _timeoutPromise(printTimeout, '打印提交超时');
      const printResult = await Promise.race([
        printerAdapter.print(pdfPath, job.printer, ctx?.options || {}),
        timeout.promise,
      ]);
      timeout.clear();

      const printDuration = Date.now() - startTime;

      // 打印成功
      log.info(
        { jobId: job.id, printer: printResult.printer, printDuration },
        '打印完成'
      );

      job = updateJobStatus(job.id, JobStatus.DONE, { printDuration });
      events.emit('job:update', job);
      events.emit('job:printed', {
        job,
        replyId: ctx?.replyId,
      });

      // 清理临时 PDF 文件和上下文
      _cleanupPdf(pdfPath);
      _cleanupContext(job.id);
    } catch (err) {
      // 取消检测
      if (ctx?.canceled) return;

      const currentRetry = job.retryCount || 0;

      if (currentRetry < MAX_RETRY_COUNT) {
        // 重试：指数退避
        const nextRetry = currentRetry + 1;
        const delay = 1000 * Math.pow(2, currentRetry); // 1s, 2s, 4s

        log.warn(
          { jobId: job.id, retryCount: nextRetry, delay, err: err.message },
          '打印失败，准备重试'
        );

        job = updateJobStatus(job.id, JobStatus.RECEIVED, {
          retryCount: nextRetry,
          errorMsg: `第 ${nextRetry} 次重试前错误: ${err.message}`,
        });
        events.emit('job:update', job);

        // 延迟后重新入队
        const retryJob = job;
        setTimeout(() => {
          printQueue.add(() => _printJob(retryJob));
        }, delay);
      } else {
        // 达到最大重试次数，标记为打印失败
        log.error(
          { jobId: job.id, retryCount: currentRetry, err },
          '打印失败，已达最大重试次数'
        );

        job = updateJobStatus(job.id, JobStatus.FAILED_PRINT, {
          errorMsg: err.message || String(err),
        });
        events.emit('job:update', job);

        // 清理临时文件和上下文
        const pdfPath = ctx?.pdfPath;
        if (pdfPath) _cleanupPdf(pdfPath);
        _cleanupContext(job.id);
      }
    }
  }

  /**
   * 取消任务
   *
   * 仅可取消 RECEIVED 或 RENDERING 状态的任务。
   * 已在 p-queue 中排队但未开始执行的任务会被标记取消，
   * 执行时通过 canceled 标志跳过。
   *
   * @param {string} jobId - 任务 ID
   * @returns {import('./types.js').Job|null} 更新后的任务，任务不存在时返回 null
   * @throws {Error} 任务不可取消时抛出错误
   */
  function cancel(jobId) {
    const job = getJob(jobId);
    if (!job) return null;

    // 仅允许取消非终态、非打印中的任务
    if (job.status !== JobStatus.RECEIVED && job.status !== JobStatus.RENDERING) {
      throw new Error(
        `任务 ${jobId} 当前状态为 ${job.status}，不可取消（仅 received/rendering 可取消）`
      );
    }

    // 标记内存上下文为已取消
    const ctx = jobContexts.get(jobId);
    if (ctx) {
      ctx.canceled = true;
    }

    const updated = updateJobStatus(jobId, JobStatus.CANCELED);
    addAuditLog(jobId, 'cancel', '用户手动取消任务');
    events.emit('job:update', updated);

    log.info({ jobId }, '任务已取消');

    // 清理临时文件
    if (ctx?.pdfPath) _cleanupPdf(ctx.pdfPath);
    _cleanupContext(jobId);

    return updated;
  }

  /**
   * 重试失败任务
   *
   * 仅可重试 FAILED_RENDER 或 FAILED_PRINT 状态的任务。
   * 重置重试计数并重新提交到渲染队列。
   *
   * @param {string} jobId - 任务 ID
   * @returns {import('./types.js').Job|null} 更新后的任务，任务不存在时返回 null
   * @throws {Error} 任务不可重试时抛出错误
   */
  function retry(jobId) {
    const job = getJob(jobId);
    if (!job) return null;

    if (
      job.status !== JobStatus.FAILED_RENDER &&
      job.status !== JobStatus.FAILED_PRINT
    ) {
      throw new Error(
        `任务 ${jobId} 当前状态为 ${job.status}，不可重试（仅 failed_render/failed_print 可重试）`
      );
    }

    // 重置状态和重试计数
    const updated = updateJobStatus(jobId, JobStatus.RECEIVED, {
      retryCount: 0,
      errorMsg: null,
    });

    addAuditLog(jobId, 'retry', '用户手动重试任务');
    events.emit('job:update', updated);

    log.info({ jobId }, '任务已重新入队');

    // 检查内存上下文是否还存在（可能已清理）
    const ctx = jobContexts.get(jobId);
    if (ctx) {
      ctx.canceled = false;
      // 重新提交到渲染队列
      renderQueue.add(() => _renderJob(updated));
    } else {
      // 上下文已丢失，标记为失败（无法恢复 html 等数据）
      log.warn({ jobId }, '重试失败：任务上下文已丢失');
      const failedJob = updateJobStatus(jobId, JobStatus.FAILED_RENDER, {
        errorMsg: '重试失败：任务上下文已丢失，请重新提交',
      });
      events.emit('job:update', failedJob);
      return failedJob;
    }

    return updated;
  }

  /**
   * 获取运行统计
   *
   * 合并数据库统计和队列实时状态。
   *
   * @returns {object} 统计数据
   */
  function getStats() {
    const dbStats = getJobStats();
    return {
      ...dbStats,
      queueSize: renderQueue.size + printQueue.size,
      renderPending: renderQueue.pending,
      printPending: printQueue.pending,
    };
  }

  /**
   * 优雅关闭
   *
   * 暂停所有队列、等待进行中任务完成、清理临时文件。
   */
  async function shutdown() {
    log.info('Job Manager 正在关闭...');

    // 暂停队列（不再接收新任务）
    renderQueue.pause();
    printQueue.pause();

    // 等待当前进行中的任务完成
    log.info('等待进行中的任务完成...');
    await Promise.all([renderQueue.onIdle(), printQueue.onIdle()]);

    // 清理所有内存上下文中的临时 PDF 文件
    for (const [jobId, ctx] of jobContexts) {
      if (ctx.pdfPath) {
        _cleanupPdf(ctx.pdfPath);
      }
    }
    jobContexts.clear();

    // 停止上下文泄漏检测定时器
    clearInterval(contextCleanupTimer);

    log.info('Job Manager 已关闭');
  }

  // ============================================================
  // 内部工具方法
  // ============================================================

  /**
   * 创建一个在 AbortSignal 触发时 reject 的 Promise
   * @param {AbortSignal} signal
   * @returns {Promise<never>}
   */
  function _abortPromise(signal) {
    return new Promise((_, reject) => {
      if (signal.aborted) {
        reject(new Error('操作已中止'));
        return;
      }
      signal.addEventListener('abort', () => {
        reject(new Error('操作已中止'));
      }, { once: true });
    });
  }

  /**
   * 创建一个在指定时间后 reject 的超时 Promise（可清除）
   * @param {number} ms - 超时毫秒数
   * @param {string} message - 超时错误信息
   * @returns {{ promise: Promise<never>, clear: () => void }}
   */
  function _timeoutPromise(ms, message) {
    let timer;
    const promise = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    });
    return { promise, clear: () => clearTimeout(timer) };
  }

  /**
   * 安全删除临时 PDF 文件
   * @param {string} pdfPath - 文件路径
   */
  function _cleanupPdf(pdfPath) {
    try {
      unlinkSync(pdfPath);
      log.debug({ pdfPath }, '临时 PDF 已删除');
    } catch (err) {
      // 文件可能不存在或已被删除，忽略
      if (err.code !== 'ENOENT') {
        log.warn({ pdfPath, err }, '删除临时 PDF 失败');
      }
    }
  }

  /**
   * 清理任务内存上下文
   * @param {string} jobId - 任务 ID
   */
  function _cleanupContext(jobId) {
    jobContexts.delete(jobId);
  }

  return {
    submit,
    cancel,
    retry,
    getStats,
    shutdown,
    events,
  };
}
