/**
 * Job Manager - 打印任务核心调度器
 *
 * 负责接收打印任务、编排渲染→打印流水线、管理并发队列、
 * 处理超时/重试/取消，并通过事件通知上层（Socket/Web）状态变更。
 *
 * 依赖：
 *   - p-queue: 并发控制队列
 *   - store.js: SQLite 持久化
 *   - RendererPort / PrinterPort: 通过 Ports 抽象注入
 *   - state-machine.js: 状态转换校验
 */

import { EventEmitter } from 'node:events';
import { existsSync, unlinkSync, mkdirSync, readFileSync } from 'node:fs';
import { writeFile as writeFileAsync, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import PQueue from 'p-queue';
import { v7 as uuidv7 } from 'uuid';
import { getLogger } from '../logger.js';
import { getTracer } from '../observability/tracing.js';
import {
  createJob,
  updateJobStatus,
  getJob,
  getJobStats,
  getRecoverableJobs,
  addAuditLog,
} from './store.js';
import { JobStatus, JobType, TERMINAL_STATUSES } from './types.js';
import { canTransition } from './state-machine.js';

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
 * OTel context API 懒加载引用
 *
 * 仅在 getTracer() 返回非 null 时按需导入，
 * 避免 OTel 未启用时加载模块。
 * @type {{ context: object, trace: object } | null}
 */
let otelApi = null;

/**
 * 获取 OTel context/trace API（懒加载）
 *
 * @returns {Promise<{ context: object, trace: object } | null>}
 */
async function getOtelApi() {
  if (otelApi) return otelApi;
  if (!getTracer()) return null;
  try {
    otelApi = await import('@opentelemetry/api');
    return otelApi;
  } catch {
    return null;
  }
}

/**
 * 创建 Job Manager 实例
 *
 * @param {object} deps - 依赖注入
 * @param {import('../core/ports.js').RendererPort} deps.renderer - 渲染能力端口
 * @param {import('../core/ports.js').PrinterPort} deps.printer - 打印能力端口
 * @param {object} deps.config - 应用配置对象
 * @returns {{ submit, cancel, retry, getStats, shutdown, events }}
 */
export function createJobManager({ renderer, printer, config }) {
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
   * 用于取消检测、回调数据传递和 OTel span 生命周期管理
   * @type {Map<string, { canceled: boolean, html?: string, options?: object, pdfPath?: string, replyId?: string, createdAt: number, span?: object, otelContext?: object }>}
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
    const ctx = {
      canceled: false,
      html: jobData.html || null,
      options: jobData.options || {},
      pdfPath: null,
      replyId: jobData.replyId || null,
      createdAt: Date.now(),
      span: null,
      otelContext: null,
    };

    // 创建 OTel 根 span（job.process），贯穿任务完整生命周期
    const tracer = getTracer();
    if (tracer) {
      const span = tracer.startSpan('job.process', {
        attributes: {
          'job.id': job.id,
          'job.type': job.type,
          'job.printer': job.printer || '',
          'job.client_id': jobData.clientId || '',
        },
      });
      ctx.span = span;
      // 异步获取 otelApi 并设置上下文（submit 是同步的，但渲染/打印是异步的）
      getOtelApi().then((api) => {
        if (api && ctx.span) {
          ctx.otelContext = api.trace.setSpan(api.context.active(), ctx.span);
        }
      });
    }

    jobContexts.set(job.id, ctx);

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
      // 此时 html 字段实际存放的是 PDF 文件路径、URL 或 Base64 数据
      ctx.directPayload = jobData.html || null;
      // PDF 类型引用外部文件，不应在打印后删除；URL_PDF/BLOB_PDF 需要落盘后清理
      ctx.ownsPdfFile = job.type !== JobType.PDF;

      // 直打任务从 received 直接跳到 printing（由 _printJob 执行状态转换）
      printQueue.add(() => _printJob(job)).catch((err) => {
        log.error({ jobId: job.id, err: err.message }, '打印队列任务异常');
      });
    } else {
      // 其余类型先渲染再打印
      renderQueue.add(() => _renderJob(job)).catch((err) => {
        log.error({ jobId: job.id, err: err.message }, '渲染队列任务异常');
      });
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
    // 从 DB 重读最新状态，防止闭包中的快照过期（例如任务已被取消）
    job = getJob(job.id) || job;

    const ctx = jobContexts.get(job.id);
    const tracer = getTracer();
    const api = await getOtelApi();

    // 在父 span（job.process）上下文中创建子 span
    const parentCtx = ctx?.otelContext;
    const runInContext = (parentCtx && api)
      ? (fn) => api.context.with(parentCtx, fn)
      : (fn) => fn();

    await runInContext(async () => {
      const span = tracer?.startSpan('job.render', {
        attributes: {
          'job.id': job.id,
          'job.type': job.type,
          'job.printer': job.printer || '',
        },
      });

      // 取消检测
      if (ctx?.canceled) {
        span?.end();
        _cleanupContext(job.id);
        return;
      }

      // 状态转换校验
      if (!canTransition(job.status, JobStatus.RENDERING)) {
        log.warn({ jobId: job.id, from: job.status, to: JobStatus.RENDERING }, '非法状态转换，跳过渲染');
        span?.end();
        return;
      }

      // 更新状态为渲染中
      job = updateJobStatus(job.id, JobStatus.RENDERING);
      events.emit('job:update', job);

      // 超时控制：signal 直接传入渲染器，超时时主动 close 页面
      const renderTimeout = config.renderTimeout || 30000;
      const abortController = new AbortController();
      const timer = setTimeout(() => abortController.abort(), renderTimeout);

      try {
        const html = ctx?.html || '';
        const options = ctx?.options || {};

        let result;

        if (job.type === JobType.RENDER_JPEG) {
          // JPEG 截图渲染
          result = await renderer.renderJpeg(html, options, abortController.signal);
        } else {
          // HTML / RENDER_PRINT / RENDER_PDF 均走 PDF 渲染
          result = await renderer.renderPdf(html, options, abortController.signal);
        }

        clearTimeout(timer);

        // 取消检测（渲染期间可能被取消）
        if (ctx?.canceled) {
          span?.end();
          _cleanupContext(job.id);
          return;
        }

        // 更新渲染耗时
        job = updateJobStatus(job.id, job.status, {
          renderDuration: result.duration,
        });

        span?.setAttribute('job.render_duration_ms', result.duration);

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
          span?.setStatus({ code: 1 });
          span?.end();
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

        span?.setStatus({ code: 1 });
        span?.end();

        // 加入打印队列
        printQueue.add(() => _printJob(job)).catch((err) => {
          log.error({ jobId: job.id, err: err.message }, '打印队列任务异常');
        });
      } catch (err) {
        clearTimeout(timer);

        // 取消检测
        if (ctx?.canceled) {
          span?.end();
          _cleanupContext(job.id);
          return;
        }

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

        span?.setStatus({ code: 2, message: err.message });
        span?.recordException(err);
        span?.end();
        _cleanupContext(job.id);
      }
    });
  }

  /**
   * 打印处理（内部方法）
   *
   * 调用打印适配器提交打印任务，支持失败重试（指数退避，最多 3 次）。
   * @param {import('./types.js').Job} job - 任务对象
   */
  async function _printJob(job) {
    // 从 DB 重读最新状态，防止闭包中的快照过期（例如任务已被取消）
    job = getJob(job.id) || job;

    const ctx = jobContexts.get(job.id);
    const tracer = getTracer();
    const api = await getOtelApi();

    // 在父 span（job.process）上下文中创建子 span
    const parentCtx = ctx?.otelContext;
    const runInContext = (parentCtx && api)
      ? (fn) => api.context.with(parentCtx, fn)
      : (fn) => fn();

    await runInContext(async () => {
      const span = tracer?.startSpan('job.print', {
        attributes: {
          'job.id': job.id,
          'job.type': job.type,
          'job.printer': job.printer || '',
        },
      });

      // 取消检测
      if (ctx?.canceled) {
        span?.end();
        _cleanupContext(job.id);
        return;
      }

      // 状态转换校验
      if (!canTransition(job.status, JobStatus.PRINTING)) {
        log.warn({ jobId: job.id, from: job.status, to: JobStatus.PRINTING }, '非法状态转换，跳过打印');
        span?.end();
        return;
      }

      // 更新状态为打印中
      job = updateJobStatus(job.id, JobStatus.PRINTING);
      events.emit('job:update', job);

      // 打印超时控制
      const printTimeout = config.printTimeout || 10000;
      const startTime = Date.now();

      try {
        // 确定 PDF 文件路径（直打类型需解析 directPayload）
        let pdfPath = ctx?.pdfPath || null;

        if (!pdfPath && DIRECT_PRINT_TYPES.has(job.type) && ctx?.directPayload) {
          if (job.type === JobType.PDF) {
            // 本地 PDF 文件路径
            pdfPath = ctx.directPayload;
            if (!existsSync(pdfPath)) {
              throw new Error(`PDF 文件不存在: ${pdfPath}`);
            }
          } else if (job.type === JobType.URL_PDF) {
            // 通过 URL 下载 PDF 到临时目录（含 SSRF 防护和大小限制）
            const pdfUrl = ctx.directPayload;
            let parsedUrl;
            try {
              parsedUrl = new URL(pdfUrl);
            } catch {
              throw new Error(`无效的 PDF URL: ${pdfUrl}`);
            }

            // 仅允许 http/https 协议
            if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
              throw new Error(`不允许的 URL 协议: ${parsedUrl.protocol}，仅支持 http/https`);
            }

            // 阻止内网地址（SSRF 防护）
            const hostname = parsedUrl.hostname;
            if (
              hostname === 'localhost' ||
              hostname === '127.0.0.1' ||
              hostname === '::1' ||
              hostname === '0.0.0.0' ||
              hostname.startsWith('10.') ||
              hostname.startsWith('192.168.') ||
              /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
              hostname.endsWith('.local') ||
              hostname === 'metadata.google.internal' ||
              hostname === '169.254.169.254'
            ) {
              throw new Error(`URL 指向内网地址，已拒绝: ${hostname}`);
            }

            const MAX_PDF_SIZE = 100 * 1024 * 1024; // 100MB
            const DOWNLOAD_TIMEOUT_MS = 30000;
            const downloadController = new AbortController();
            const downloadTimer = setTimeout(() => downloadController.abort(), DOWNLOAD_TIMEOUT_MS);

            try {
              const response = await fetch(pdfUrl, {
                signal: downloadController.signal,
                redirect: 'manual',
              });
              clearTimeout(downloadTimer);

              // 拒绝重定向响应（防止通过 3xx 重定向绕过 SSRF 检查）
              if (response.status >= 300 && response.status < 400) {
                throw new Error(`PDF URL 返回重定向（${response.status}），已拒绝以防止 SSRF 绕过`);
              }

              if (!response.ok) {
                throw new Error(`下载 PDF 失败: HTTP ${response.status} ${response.statusText}`);
              }

              // 检查 Content-Length（如果服务端提供）
              const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
              if (contentLength > MAX_PDF_SIZE) {
                throw new Error(`PDF 文件过大（${contentLength} bytes），超过 ${MAX_PDF_SIZE} 上限`);
              }

              const arrayBuf = await response.arrayBuffer();
              if (arrayBuf.byteLength > MAX_PDF_SIZE) {
                throw new Error(`PDF 文件过大（${arrayBuf.byteLength} bytes），超过 ${MAX_PDF_SIZE} 上限`);
              }

              const destPath = join(pdfDir, `${job.id}.pdf`);
              await writeFileAsync(destPath, Buffer.from(arrayBuf));
              pdfPath = destPath;
              ctx.pdfPath = destPath;
            } catch (dlErr) {
              clearTimeout(downloadTimer);
              if (dlErr.name === 'AbortError') {
                throw new Error(`下载 PDF 超时（${DOWNLOAD_TIMEOUT_MS}ms）`);
              }
              throw dlErr;
            }
          } else if (job.type === JobType.BLOB_PDF) {
            // Base64 数据落盘
            const destPath = join(pdfDir, `${job.id}.pdf`);
            const buffer = Buffer.from(ctx.directPayload, 'base64');
            await writeFileAsync(destPath, buffer);
            pdfPath = destPath;
            ctx.pdfPath = destPath;
          }
        }

        if (!pdfPath) {
          throw new Error('PDF 文件路径缺失，无法执行打印');
        }

        // 打印超时控制 — 使用 Promise.race 确保不会永久阻塞
        const { promise: timeoutPromise, clear: clearTimeoutPromise } =
          _timeoutPromise(printTimeout, `打印提交超时（${printTimeout}ms），CUPS 任务可能仍在进行`);

        let printResult;
        try {
          printResult = await Promise.race([
            printer.print(pdfPath, job.printer, ctx?.options || {}),
            timeoutPromise,
          ]);
          clearTimeoutPromise();
        } catch (printErr) {
          clearTimeoutPromise();
          // 标记超时错误，在 catch 块中据此跳过自动重试
          if (printErr.message?.includes('打印提交超时')) {
            printErr._isTimeout = true;
          }
          throw printErr;
        }

        const printDuration = Date.now() - startTime;

        span?.setAttribute('job.print_duration_ms', printDuration);
        span?.setAttribute('job.cups_printer', printResult.printer || '');

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

        span?.setStatus({ code: 1 });
        span?.end();

        // 清理临时 PDF 文件（外部文件不删除）和上下文
        if (ctx?.ownsPdfFile !== false) {
          _cleanupPdf(pdfPath);
        }
        _cleanupContext(job.id);
      } catch (err) {
        // 取消检测
        if (ctx?.canceled) {
          span?.end();
          _cleanupContext(job.id);
          return;
        }

        const currentRetry = job.retryCount || 0;

        span?.setAttribute('job.retry_count', currentRetry);

        if (currentRetry < MAX_RETRY_COUNT && !err._isTimeout) {
          // 重试：指数退避（超时错误不自动重试，防止 CUPS 已开始执行导致重复打印）
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

          // 当前 print span 标记错误但结束（重试会创建新 span）
          span?.setStatus({ code: 2, message: err.message });
          span?.recordException(err);
          span?.end();

          // 延迟后重新入队
          const retryJob = job;
          setTimeout(() => {
            printQueue.add(() => _printJob(retryJob)).catch((retryErr) => {
              log.error({ jobId: retryJob.id, err: retryErr.message }, '重试打印队列任务异常');
            });
          }, delay);
        } else if (err._isTimeout) {
          // 超时错误：直接标记 TIMEOUT，不自动重试（CUPS 任务可能已开始执行）
          log.error({ jobId: job.id, err: err.message }, '打印超时');

          job = updateJobStatus(job.id, JobStatus.TIMEOUT, {
            errorMsg: err.message || String(err),
          });
          events.emit('job:update', job);

          span?.setStatus({ code: 2, message: err.message });
          span?.recordException(err);
          span?.end();

          // 清理临时文件和上下文
          const timeoutPdfPath = ctx?.pdfPath;
          if (timeoutPdfPath && ctx?.ownsPdfFile !== false) {
            _cleanupPdf(timeoutPdfPath);
          }
          _cleanupContext(job.id);
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

          span?.setStatus({ code: 2, message: err.message });
          span?.recordException(err);
          span?.end();

          // 清理临时文件（外部文件不删除）和上下文
          const failedPdfPath = ctx?.pdfPath;
          if (failedPdfPath && ctx?.ownsPdfFile !== false) {
            _cleanupPdf(failedPdfPath);
          }
          _cleanupContext(job.id);
        }
      }
    });
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

    // 标记内存上下文为已取消（不立即清理上下文，让队列中的闭包执行时通过取消检测退出后再清理）
    const ctx = jobContexts.get(jobId);
    if (ctx) {
      ctx.canceled = true;
    }

    const updated = updateJobStatus(jobId, JobStatus.CANCELED);
    addAuditLog(jobId, 'cancel', '用户手动取消任务');
    events.emit('job:update', updated);

    log.info({ jobId }, '任务已取消');

    // 清理临时 PDF 文件（如有）
    if (ctx?.pdfPath) _cleanupPdf(ctx.pdfPath);
    // 注意：不在此处调用 _cleanupContext()，
    // 因为队列中排队的闭包需要读取 ctx.canceled 标志来跳过执行。
    // 上下文将在 _renderJob / _printJob 的取消检测分支中清理，
    // 或由孤儿上下文定时清理机制兜底。

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
    let ctx = jobContexts.get(jobId);
    if (ctx) {
      ctx.canceled = false;
    } else {
      // 上下文已丢失，尝试从 preview 目录恢复 HTML
      const previewDir = config.previewDir || './data/preview';
      const previewPath = join(previewDir, `${jobId}.html`);

      if (RENDER_REQUIRED_TYPES.has(job.type) && existsSync(previewPath)) {
        const html = readFileSync(previewPath, 'utf-8');
        ctx = {
          canceled: false,
          html,
          options: job.printOptions || {},
          pdfPath: null,
          replyId: null,
          createdAt: Date.now(),
          span: null,
          otelContext: null,
        };
        jobContexts.set(jobId, ctx);
        log.info({ jobId }, '从 preview 文件恢复任务上下文');
      } else if (DIRECT_PRINT_TYPES.has(job.type)) {
        // 直打类型无法恢复 payload，标记失败
        log.warn({ jobId }, '重试失败：直打类型任务上下文已丢失，无法恢复');
        const failedJob = updateJobStatus(jobId, JobStatus.FAILED_RENDER, {
          errorMsg: '重试失败：任务数据已丢失，请重新提交',
        });
        events.emit('job:update', failedJob);
        return failedJob;
      } else {
        log.warn({ jobId }, '重试失败：任务上下文和预览文件均不存在');
        const failedJob = updateJobStatus(jobId, JobStatus.FAILED_RENDER, {
          errorMsg: '重试失败：任务上下文已丢失，请重新提交',
        });
        events.emit('job:update', failedJob);
        return failedJob;
      }
    }

    // 根据任务类型决定入哪个队列
    if (DIRECT_PRINT_TYPES.has(updated.type)) {
      printQueue.add(() => _printJob(updated)).catch((err) => {
        log.error({ jobId, err: err.message }, '重试打印队列任务异常');
      });
    } else {
      renderQueue.add(() => _renderJob(updated)).catch((err) => {
        log.error({ jobId, err: err.message }, '重试渲染队列任务异常');
      });
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
      // 结束所有未完成的父 span
      ctx.span?.end();
    }
    jobContexts.clear();

    // 停止上下文泄漏检测定时器
    clearInterval(contextCleanupTimer);

    log.info('Job Manager 已关闭');
  }

  /**
   * 恢复中断的任务
   *
   * 服务重启后，将数据库中处于中间状态（received/rendering/printing）的任务
   * 标记为对应的终态，因为内存上下文（html/options 等）已丢失无法继续处理。
   */
  function recoverJobs() {
    const recoverableJobs = getRecoverableJobs();
    if (recoverableJobs.length === 0) return;

    const previewDir = config.previewDir || './data/preview';
    log.info({ count: recoverableJobs.length }, '发现可恢复任务，开始处理');

    for (const job of recoverableJobs) {
      if (job.status === JobStatus.RECEIVED) {
        const previewPath = join(previewDir, `${job.id}.html`);
        const reason = existsSync(previewPath)
          ? '服务重启，任务上下文丢失'
          : '服务重启，任务数据不可恢复';
        const auditDetail = existsSync(previewPath)
          ? '重启恢复: received -> timeout (上下文丢失)'
          : '重启恢复: received -> timeout (无预览文件)';

        const updated = updateJobStatus(job.id, JobStatus.TIMEOUT, { errorMsg: reason });
        addAuditLog(job.id, 'recovery', auditDetail);
        events.emit('job:update', updated);
      } else if (job.status === JobStatus.RENDERING) {
        const updated = updateJobStatus(job.id, JobStatus.FAILED_RENDER, {
          errorMsg: '服务重启，渲染中断',
        });
        addAuditLog(job.id, 'recovery', '重启恢复: rendering -> failed_render');
        events.emit('job:update', updated);
      } else if (job.status === JobStatus.PRINTING) {
        const updated = updateJobStatus(job.id, JobStatus.FAILED_PRINT, {
          errorMsg: '服务重启，打印中断',
        });
        addAuditLog(job.id, 'recovery', '重启恢复: printing -> failed_print');
        events.emit('job:update', updated);
      }
    }

    log.info({ count: recoverableJobs.length }, '任务恢复处理完成');
  }

  // 构造完成后立即执行任务恢复（同步操作）
  recoverJobs();

  // ============================================================
  // 内部工具方法
  // ============================================================

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
   *
   * 结束关联的 OTel 父 span（job.process）并移除上下文。
   * @param {string} jobId - 任务 ID
   */
  function _cleanupContext(jobId) {
    const ctx = jobContexts.get(jobId);
    // 结束父 span（job.process 生命周期结束）
    ctx?.span?.end();
    jobContexts.delete(jobId);
  }

  return {
    submit,
    cancel,
    retry,
    recoverJobs,
    getStats,
    shutdown,
    events,
  };
}
