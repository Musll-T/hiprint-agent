/**
 * Socket.IO 协议契约测试
 *
 * 验证事件分派器（event-dispatcher.js）的行为契约：
 * - 命令事件处理（客户端 -> 服务端）
 * - 结果路由（服务端 -> 客户端）
 * - enrichPrinterList 字段注入（多 Agent 部署）
 * - successs 向后兼容拼写（vue-plugin-hiprint < 0.0.56）
 *
 * 不依赖外部服务（CUPS、Playwright、数据库），
 * 通过 mock 替代 jobManager/printerAdapter 等重量级依赖。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';

// mock logger，避免拉起 pino transport
vi.mock('../../src/logger.js', () => ({
  getLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    fatal: vi.fn(),
  }),
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    fatal: vi.fn(),
  },
}));

import { createEventDispatcher, enrichPrinterList } from '../../src/gateway/event-dispatcher.js';
import { JobStatus, JobType } from '../../src/jobs/types.js';

// ─── 公共 fixtures ─────────────────────────────────────────

/** 模拟系统信息 */
const SYSTEM_INFO = Object.freeze({
  agentId: 'agent-001',
  hostname: 'print-server',
  ip: '192.168.1.100',
  version: '1.0.0',
  machineId: 'machine-abc',
});

/** 模拟打印机列表 */
const MOCK_PRINTERS = [
  { name: 'HP_LaserJet', status: 'idle', isDefault: true, location: 'Office A' },
  { name: 'Canon_PIXMA', status: 'idle', isDefault: false, location: '' },
];

/** 创建 mock emitter，记录所有 emit 调用 */
function createMockEmitter() {
  const calls = [];
  return {
    emit: vi.fn((event, data) => calls.push({ event, data })),
    _calls: calls,
  };
}

/** 创建 mock jobManager */
function createMockJobManager() {
  return {
    submit: vi.fn(),
    events: new EventEmitter(),
  };
}

/** 创建 mock printerAdapter */
function createMockPrinterAdapter(printers = MOCK_PRINTERS) {
  return {
    getPrinters: vi.fn().mockResolvedValue(printers),
  };
}

// ═══════════════════════════════════════════════════════════════
// enrichPrinterList
// ═══════════════════════════════════════════════════════════════

describe('enrichPrinterList', () => {
  it('应为每台打印机注入 agentId/agentHost/agentIp', () => {
    const result = enrichPrinterList(MOCK_PRINTERS, SYSTEM_INFO);

    expect(result).toHaveLength(2);
    for (const printer of result) {
      expect(printer).toHaveProperty('agentId', 'agent-001');
      expect(printer).toHaveProperty('agentHost', 'print-server');
      expect(printer).toHaveProperty('agentIp', '192.168.1.100');
    }
  });

  it('应保留原始打印机字段不变', () => {
    const result = enrichPrinterList(MOCK_PRINTERS, SYSTEM_INFO);

    expect(result[0]).toMatchObject({
      name: 'HP_LaserJet',
      status: 'idle',
      isDefault: true,
      location: 'Office A',
    });
  });

  it('systemInfo 为空时应原样返回', () => {
    const result = enrichPrinterList(MOCK_PRINTERS, null);
    expect(result).toBe(MOCK_PRINTERS);
  });

  it('printers 非数组时应原样返回', () => {
    const result = enrichPrinterList('not-array', SYSTEM_INFO);
    expect(result).toBe('not-array');
  });

  it('空打印机列表应返回空数组', () => {
    const result = enrichPrinterList([], SYSTEM_INFO);
    expect(result).toEqual([]);
  });

  it('systemInfo 字段缺失时应使用空字符串兜底', () => {
    const result = enrichPrinterList(MOCK_PRINTERS, { hostname: 'host-only' });

    expect(result[0].agentId).toBe('');
    expect(result[0].agentHost).toBe('host-only');
    expect(result[0].agentIp).toBe('');
  });
});

// ═══════════════════════════════════════════════════════════════
// createEventDispatcher - 命令处理器
// ═══════════════════════════════════════════════════════════════

describe('createEventDispatcher', () => {
  let jobManager;
  let printerAdapter;
  let dispatcher;
  let emitter;

  beforeEach(() => {
    jobManager = createMockJobManager();
    printerAdapter = createMockPrinterAdapter();
    dispatcher = createEventDispatcher({
      jobManager,
      printerAdapter,
      systemInfo: SYSTEM_INFO,
    });
    emitter = createMockEmitter();
  });

  // ─── handleGetClientInfo ─────────────────────────────────

  describe('handleGetClientInfo', () => {
    it('应通过 emitter 发送 clientInfo 事件', () => {
      dispatcher.handleGetClientInfo(emitter);

      expect(emitter.emit).toHaveBeenCalledWith('clientInfo', SYSTEM_INFO);
    });

    it('clientInfo payload 应包含完整系统信息字段', () => {
      dispatcher.handleGetClientInfo(emitter);

      const payload = emitter.emit.mock.calls[0][1];
      expect(payload).toHaveProperty('hostname');
      expect(payload).toHaveProperty('version');
      expect(payload).toHaveProperty('ip');
      expect(payload).toHaveProperty('agentId');
      expect(payload).toHaveProperty('machineId');
    });
  });

  // ─── handleRefreshPrinterList ────────────────────────────

  describe('handleRefreshPrinterList', () => {
    it('应获取打印机列表并通过 printerList 事件推送', async () => {
      await dispatcher.handleRefreshPrinterList(emitter);

      expect(printerAdapter.getPrinters).toHaveBeenCalledOnce();
      expect(emitter.emit).toHaveBeenCalledWith(
        'printerList',
        expect.arrayContaining([
          expect.objectContaining({
            name: 'HP_LaserJet',
            agentId: 'agent-001',
            agentHost: 'print-server',
            agentIp: '192.168.1.100',
          }),
        ]),
      );
    });

    it('printerAdapter 异常时不应抛出错误', async () => {
      printerAdapter.getPrinters.mockRejectedValue(new Error('CUPS 未安装'));

      // 不应抛出，仅记录日志
      await expect(dispatcher.handleRefreshPrinterList(emitter)).resolves.toBeUndefined();
      expect(emitter.emit).not.toHaveBeenCalled();
    });
  });

  // ─── handleNews ──────────────────────────────────────────

  describe('handleNews', () => {
    it('应将 HTML 打印任务提交到 jobManager', () => {
      const data = {
        html: '<h1>Invoice</h1>',
        printer: 'HP_LaserJet',
        templateId: 'tpl-001',
        pageNum: 1,
        replyId: 'reply-123',
      };

      dispatcher.handleNews(data, 'socket-abc', emitter);

      expect(jobManager.submit).toHaveBeenCalledWith(
        expect.objectContaining({
          html: '<h1>Invoice</h1>',
          printer: 'HP_LaserJet',
          templateId: 'tpl-001',
          type: 'html',
          clientId: 'socket-abc',
          pageNum: 1,
          replyId: 'reply-123',
        }),
      );
    });

    it('data 为空时应跳过不提交', () => {
      dispatcher.handleNews(null, 'socket-abc', emitter);
      dispatcher.handleNews(undefined, 'socket-abc', emitter);

      expect(jobManager.submit).not.toHaveBeenCalled();
    });

    it('未指定 type 时默认使用 html', () => {
      dispatcher.handleNews({ html: '<p>test</p>' }, 'socket-abc', emitter);

      expect(jobManager.submit).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'html' }),
      );
    });

    it('指定 type 时应使用指定值', () => {
      dispatcher.handleNews({ html: 'data', type: 'pdf' }, 'socket-abc', emitter);

      expect(jobManager.submit).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'pdf' }),
      );
    });

    it('submit 异常时应发送 error 事件', () => {
      jobManager.submit.mockImplementation(() => {
        throw new Error('队列已满');
      });

      dispatcher.handleNews({ html: '<p>test</p>', replyId: 'r-1' }, 'socket-abc', emitter);

      expect(emitter.emit).toHaveBeenCalledWith('error', {
        msg: '队列已满',
        replyId: 'r-1',
      });
    });
  });

  // ─── handlePrintByFragments ──────────────────────────────

  describe('handlePrintByFragments', () => {
    it('分片未完成时不应提交任务', () => {
      const fragmentManager = {
        addFragment: vi.fn().mockReturnValue({ complete: false }),
      };

      dispatcher.handlePrintByFragments(
        { id: 'frag-1', total: 3, index: 0, htmlFragment: '<p>part1</p>' },
        'socket-abc',
        emitter,
        fragmentManager,
      );

      expect(jobManager.submit).not.toHaveBeenCalled();
    });

    it('分片合并完成后应提交打印任务', () => {
      const fragmentManager = {
        addFragment: vi.fn().mockReturnValue({
          complete: true,
          html: '<p>part1</p><p>part2</p>',
        }),
      };

      dispatcher.handlePrintByFragments(
        { id: 'frag-1', total: 2, index: 1, htmlFragment: '<p>part2</p>', printer: 'HP', replyId: 'r-2' },
        'socket-abc',
        emitter,
        fragmentManager,
      );

      expect(jobManager.submit).toHaveBeenCalledWith(
        expect.objectContaining({
          html: '<p>part1</p><p>part2</p>',
          printer: 'HP',
          clientId: 'socket-abc',
        }),
      );
    });

    it('data 为空时应跳过', () => {
      const fragmentManager = { addFragment: vi.fn() };
      dispatcher.handlePrintByFragments(null, 'socket-abc', emitter, fragmentManager);
      expect(fragmentManager.addFragment).not.toHaveBeenCalled();
    });
  });

  // ─── handleRenderPrint ───────────────────────────────────

  describe('handleRenderPrint', () => {
    it('应使用 RENDER_PRINT 类型提交任务', () => {
      const data = { html: '<p>render</p>', printer: 'HP', replyId: 'r-3' };

      dispatcher.handleRenderPrint(data, 'socket-abc', emitter);

      expect(jobManager.submit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: JobType.RENDER_PRINT,
          clientId: 'socket-abc',
        }),
      );
    });

    it('submit 异常时应发送 render-print-error 事件', () => {
      jobManager.submit.mockImplementation(() => {
        throw new Error('渲染失败');
      });

      dispatcher.handleRenderPrint({ html: '<p>test</p>', replyId: 'r-3' }, 'socket-abc', emitter);

      expect(emitter.emit).toHaveBeenCalledWith('render-print-error', {
        msg: '渲染失败',
        replyId: 'r-3',
      });
    });

    it('data 为空时应跳过', () => {
      dispatcher.handleRenderPrint(null, 'socket-abc', emitter);
      expect(jobManager.submit).not.toHaveBeenCalled();
    });
  });

  // ─── handleRenderJpeg ────────────────────────────────────

  describe('handleRenderJpeg', () => {
    it('应使用 RENDER_JPEG 类型提交任务', () => {
      dispatcher.handleRenderJpeg({ html: '<p>img</p>' }, 'socket-abc', emitter);

      expect(jobManager.submit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: JobType.RENDER_JPEG,
          clientId: 'socket-abc',
        }),
      );
    });

    it('submit 异常时应发送 render-jpeg-error 事件', () => {
      jobManager.submit.mockImplementation(() => {
        throw new Error('JPEG 失败');
      });

      dispatcher.handleRenderJpeg({ html: '<p>x</p>', replyId: 'r-4' }, 'socket-abc', emitter);

      expect(emitter.emit).toHaveBeenCalledWith('render-jpeg-error', {
        msg: 'JPEG 失败',
        replyId: 'r-4',
      });
    });
  });

  // ─── handleRenderPdf ─────────────────────────────────────

  describe('handleRenderPdf', () => {
    it('应使用 RENDER_PDF 类型提交任务', () => {
      dispatcher.handleRenderPdf({ html: '<p>pdf</p>' }, 'socket-abc', emitter);

      expect(jobManager.submit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: JobType.RENDER_PDF,
          clientId: 'socket-abc',
        }),
      );
    });

    it('submit 异常时应发送 render-pdf-error 事件', () => {
      jobManager.submit.mockImplementation(() => {
        throw new Error('PDF 失败');
      });

      dispatcher.handleRenderPdf({ html: '<p>x</p>', replyId: 'r-5' }, 'socket-abc', emitter);

      expect(emitter.emit).toHaveBeenCalledWith('render-pdf-error', {
        msg: 'PDF 失败',
        replyId: 'r-5',
      });
    });
  });

  // ─── handleIppPrint / handleIppRequest ───────────────────

  describe('handleIppPrint', () => {
    it('应返回 Phase 2 未实现错误', () => {
      dispatcher.handleIppPrint({ replyId: 'ipp-1' }, emitter);

      expect(emitter.emit).toHaveBeenCalledWith('error', {
        msg: 'IPP 打印功能将在 Phase 2 中实现',
        replyId: 'ipp-1',
      });
    });

    it('data 为 null 时 replyId 应为 undefined', () => {
      dispatcher.handleIppPrint(null, emitter);

      expect(emitter.emit).toHaveBeenCalledWith('error', {
        msg: 'IPP 打印功能将在 Phase 2 中实现',
        replyId: undefined,
      });
    });
  });

  describe('handleIppRequest', () => {
    it('应返回 Phase 2 未实现错误', () => {
      dispatcher.handleIppRequest({ replyId: 'ipp-2' }, emitter);

      expect(emitter.emit).toHaveBeenCalledWith('error', {
        msg: 'IPP 请求功能将在 Phase 2 中实现',
        replyId: 'ipp-2',
      });
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// createResultRouter - 结果路由
// ═══════════════════════════════════════════════════════════════

describe('createResultRouter', () => {
  let jobManager;
  let dispatcher;

  beforeEach(() => {
    jobManager = createMockJobManager();
    dispatcher = createEventDispatcher({
      jobManager,
      printerAdapter: createMockPrinterAdapter(),
      systemInfo: SYSTEM_INFO,
    });
  });

  // ─── success / successs 兼容拼写 ────────────────────────

  describe('successs 向后兼容拼写（关键兼容性测试）', () => {
    it('打印成功时应同时发送 success 和 successs（三个 s）事件', () => {
      const emitFn = vi.fn();
      const matchFn = () => true;

      const router = dispatcher.createResultRouter(emitFn, matchFn);
      router.attach();

      const job = {
        id: 'job-001',
        templateId: 'tpl-001',
        printer: 'HP_LaserJet',
        clientId: 'socket-abc',
      };

      jobManager.events.emit('job:printed', { job, replyId: 'r-10' });

      // 必须同时收到 successs 和 success
      const events = emitFn.mock.calls.map(([event]) => event);
      expect(events).toContain('successs');
      expect(events).toContain('success');
      expect(emitFn).toHaveBeenCalledTimes(2);

      router.detach();
    });

    it('successs 应先于 success 发送（兼容旧版客户端优先）', () => {
      const emitFn = vi.fn();
      const router = dispatcher.createResultRouter(emitFn, () => true);
      router.attach();

      jobManager.events.emit('job:printed', {
        job: { id: 'j-1', templateId: 't-1', printer: 'P1', clientId: 's-1' },
        replyId: 'r-x',
      });

      expect(emitFn.mock.calls[0][0]).toBe('successs');
      expect(emitFn.mock.calls[1][0]).toBe('success');

      router.detach();
    });

    it('success payload 应包含 templateId/printer/jobId/replyId', () => {
      const emitFn = vi.fn();
      const router = dispatcher.createResultRouter(emitFn, () => true);
      router.attach();

      const job = { id: 'j-2', templateId: 't-2', printer: 'Canon', clientId: 's-2' };
      jobManager.events.emit('job:printed', { job, replyId: 'r-20' });

      const payload = emitFn.mock.calls[1][1]; // success 的 payload
      expect(payload).toEqual({
        templateId: 't-2',
        printer: 'Canon',
        jobId: 'j-2',
        replyId: 'r-20',
      });

      router.detach();
    });
  });

  // ─── matchFn 过滤 ───────────────────────────────────────

  describe('matchFn 过滤逻辑', () => {
    it('matchFn 返回 false 时不应发送任何事件', () => {
      const emitFn = vi.fn();
      const router = dispatcher.createResultRouter(emitFn, () => false);
      router.attach();

      jobManager.events.emit('job:printed', {
        job: { id: 'j-3', clientId: 'other-socket' },
        replyId: 'r-30',
      });

      expect(emitFn).not.toHaveBeenCalled();
      router.detach();
    });

    it('应根据 clientId 精确匹配', () => {
      const emitFn = vi.fn();
      const mySocketId = 'socket-mine';
      const router = dispatcher.createResultRouter(
        emitFn,
        (job) => job.clientId === mySocketId,
      );
      router.attach();

      // 其他 socket 的任务不应触发
      jobManager.events.emit('job:printed', {
        job: { id: 'j-4', clientId: 'socket-other' },
        replyId: 'r-40',
      });
      expect(emitFn).not.toHaveBeenCalled();

      // 自己的任务应触发
      jobManager.events.emit('job:printed', {
        job: { id: 'j-5', clientId: 'socket-mine' },
        replyId: 'r-50',
      });
      expect(emitFn).toHaveBeenCalled();

      router.detach();
    });
  });

  // ─── 渲染结果路由（job:rendered）──────────────────────────

  describe('job:rendered 事件路由', () => {
    it('RENDER_JPEG 类型应发送 render-jpeg-success', () => {
      const emitFn = vi.fn();
      const router = dispatcher.createResultRouter(emitFn, () => true);
      router.attach();

      const job = { id: 'j-6', type: JobType.RENDER_JPEG, templateId: 't-6', clientId: 's-6' };
      const buffer = Buffer.from('fake-jpeg');
      jobManager.events.emit('job:rendered', { job, buffer, replyId: 'r-60' });

      expect(emitFn).toHaveBeenCalledWith('render-jpeg-success', {
        templateId: 't-6',
        jobId: 'j-6',
        replyId: 'r-60',
        buffer,
      });

      router.detach();
    });

    it('RENDER_PDF 类型应发送 render-pdf-success', () => {
      const emitFn = vi.fn();
      const router = dispatcher.createResultRouter(emitFn, () => true);
      router.attach();

      const job = { id: 'j-7', type: JobType.RENDER_PDF, templateId: 't-7', clientId: 's-7' };
      const buffer = Buffer.from('fake-pdf');
      jobManager.events.emit('job:rendered', { job, buffer, replyId: 'r-70' });

      expect(emitFn).toHaveBeenCalledWith('render-pdf-success', {
        templateId: 't-7',
        jobId: 'j-7',
        replyId: 'r-70',
        buffer,
      });

      router.detach();
    });
  });

  // ─── 错误结果路由（job:update）────────────────────────────

  describe('job:update 错误事件路由', () => {
    it('FAILED_RENDER + HTML 类型应发送 error 事件', () => {
      const emitFn = vi.fn();
      const router = dispatcher.createResultRouter(emitFn, () => true);
      router.attach();

      jobManager.events.emit('job:update', {
        id: 'j-8',
        type: JobType.HTML,
        status: JobStatus.FAILED_RENDER,
        errorMsg: '渲染超时',
        clientId: 's-8',
      });

      expect(emitFn).toHaveBeenCalledWith('error', expect.objectContaining({
        msg: '渲染超时',
        jobId: 'j-8',
      }));

      router.detach();
    });

    it('FAILED_RENDER + RENDER_JPEG 应发送 render-jpeg-error', () => {
      const emitFn = vi.fn();
      const router = dispatcher.createResultRouter(emitFn, () => true);
      router.attach();

      jobManager.events.emit('job:update', {
        id: 'j-9',
        type: JobType.RENDER_JPEG,
        status: JobStatus.FAILED_RENDER,
        errorMsg: 'JPEG 渲染失败',
        clientId: 's-9',
      });

      expect(emitFn).toHaveBeenCalledWith('render-jpeg-error', expect.objectContaining({
        msg: 'JPEG 渲染失败',
      }));

      router.detach();
    });

    it('FAILED_RENDER + RENDER_PDF 应发送 render-pdf-error', () => {
      const emitFn = vi.fn();
      const router = dispatcher.createResultRouter(emitFn, () => true);
      router.attach();

      jobManager.events.emit('job:update', {
        id: 'j-10',
        type: JobType.RENDER_PDF,
        status: JobStatus.FAILED_RENDER,
        errorMsg: 'PDF 渲染失败',
        clientId: 's-10',
      });

      expect(emitFn).toHaveBeenCalledWith('render-pdf-error', expect.objectContaining({
        msg: 'PDF 渲染失败',
      }));

      router.detach();
    });

    it('FAILED_RENDER + RENDER_PRINT 应发送 render-print-error', () => {
      const emitFn = vi.fn();
      const router = dispatcher.createResultRouter(emitFn, () => true);
      router.attach();

      jobManager.events.emit('job:update', {
        id: 'j-11',
        type: JobType.RENDER_PRINT,
        status: JobStatus.FAILED_RENDER,
        errorMsg: '渲染打印失败',
        clientId: 's-11',
      });

      expect(emitFn).toHaveBeenCalledWith('render-print-error', expect.objectContaining({
        msg: '渲染打印失败',
      }));

      router.detach();
    });

    it('FAILED_PRINT + HTML 类型应发送 error 事件', () => {
      const emitFn = vi.fn();
      const router = dispatcher.createResultRouter(emitFn, () => true);
      router.attach();

      jobManager.events.emit('job:update', {
        id: 'j-12',
        type: JobType.HTML,
        status: JobStatus.FAILED_PRINT,
        errorMsg: 'CUPS 打印失败',
        clientId: 's-12',
      });

      expect(emitFn).toHaveBeenCalledWith('error', expect.objectContaining({
        msg: 'CUPS 打印失败',
      }));

      router.detach();
    });

    it('FAILED_PRINT + RENDER_PRINT 应发送 render-print-error', () => {
      const emitFn = vi.fn();
      const router = dispatcher.createResultRouter(emitFn, () => true);
      router.attach();

      jobManager.events.emit('job:update', {
        id: 'j-13',
        type: JobType.RENDER_PRINT,
        status: JobStatus.FAILED_PRINT,
        errorMsg: '打印机离线',
        clientId: 's-13',
      });

      expect(emitFn).toHaveBeenCalledWith('render-print-error', expect.objectContaining({
        msg: '打印机离线',
      }));

      router.detach();
    });

    it('TIMEOUT 应发送 error 事件', () => {
      const emitFn = vi.fn();
      const router = dispatcher.createResultRouter(emitFn, () => true);
      router.attach();

      jobManager.events.emit('job:update', {
        id: 'j-14',
        type: JobType.HTML,
        status: JobStatus.TIMEOUT,
        errorMsg: '任务超时',
        clientId: 's-14',
      });

      expect(emitFn).toHaveBeenCalledWith('error', expect.objectContaining({
        msg: '任务超时',
      }));

      router.detach();
    });

    it('TIMEOUT 且 errorMsg 为空时应使用默认消息', () => {
      const emitFn = vi.fn();
      const router = dispatcher.createResultRouter(emitFn, () => true);
      router.attach();

      jobManager.events.emit('job:update', {
        id: 'j-15',
        type: JobType.HTML,
        status: JobStatus.TIMEOUT,
        errorMsg: null,
        clientId: 's-15',
      });

      expect(emitFn).toHaveBeenCalledWith('error', expect.objectContaining({
        msg: '任务超时',
      }));

      router.detach();
    });

    it('非错误状态不应发送任何事件', () => {
      const emitFn = vi.fn();
      const router = dispatcher.createResultRouter(emitFn, () => true);
      router.attach();

      // DONE 状态由 job:printed 处理，job:update 中不应触发事件
      jobManager.events.emit('job:update', {
        id: 'j-16',
        type: JobType.HTML,
        status: JobStatus.DONE,
        clientId: 's-16',
      });

      // RENDERING/PRINTING 等中间状态也不应触发
      jobManager.events.emit('job:update', {
        id: 'j-17',
        type: JobType.HTML,
        status: JobStatus.RENDERING,
        clientId: 's-17',
      });

      jobManager.events.emit('job:update', {
        id: 'j-18',
        type: JobType.HTML,
        status: JobStatus.PRINTING,
        clientId: 's-18',
      });

      expect(emitFn).not.toHaveBeenCalled();

      router.detach();
    });
  });

  // ─── detach 清理 ────────────────────────────────────────

  describe('detach 生命周期', () => {
    it('detach 后不应再收到事件', () => {
      const emitFn = vi.fn();
      const router = dispatcher.createResultRouter(emitFn, () => true);

      router.attach();
      router.detach();

      jobManager.events.emit('job:printed', {
        job: { id: 'j-19', clientId: 's-19' },
        replyId: 'r-19',
      });

      expect(emitFn).not.toHaveBeenCalled();
    });

    it('多次 detach 不应报错', () => {
      const router = dispatcher.createResultRouter(vi.fn(), () => true);
      router.attach();

      expect(() => {
        router.detach();
        router.detach();
      }).not.toThrow();
    });
  });
});
