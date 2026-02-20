/**
 * REST API 协议契约测试
 *
 * 验证 Admin Web REST API 的路由注册、HTTP 方法、响应结构和业务逻辑：
 * - GET /health 健康检查端点
 * - GET /api/jobs 任务列表查询参数
 * - GET /api/printers 打印机列表
 * - GET /api/config 配置脱敏
 * - 打印机 CRUD 路由注册
 *
 * 测试策略：挂载单个路由模块到轻量 Express app 进行验证，
 * 不依赖外部服务（CUPS、Playwright、数据库）。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import { createServer } from 'node:http';

// ─── mock 外部依赖 ──────────────────────────────────────────

// mock logger
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

// mock config 模块（config.js 导出的 getConfig/updateConfig 被 config 路由使用）
vi.mock('../../src/config.js', () => ({
  config: {
    previewDir: './data/preview',
  },
  getConfig: vi.fn(),
  updateConfig: vi.fn(),
}));

// mock store 模块（被 jobs 路由和 config 路由使用）
vi.mock('../../src/jobs/store.js', () => ({
  listJobs: vi.fn(),
  getJob: vi.fn(),
  countJobs: vi.fn(),
  addAuditLog: vi.fn(),
}));

import { healthRoutes } from '../../src/web/routes/health.js';
import { jobRoutes } from '../../src/web/routes/jobs.js';
import { printerRoutes } from '../../src/web/routes/printers.js';
import { configRoutes } from '../../src/web/routes/config.js';
import { getConfig } from '../../src/config.js';
import { listJobs, countJobs, getJob } from '../../src/jobs/store.js';

// ─── 辅助工具 ──────────────────────────────────────────────

/**
 * 创建绑定指定路由的轻量 Express app 并启动监听
 * @param {Function} routeRegistrar - 路由注册函数
 * @param {object} [deps] - 路由依赖
 * @returns {Promise<{app, server, baseUrl, close}>}
 */
async function createTestApp(routeRegistrar, deps = {}) {
  const app = express();
  app.use(express.json());
  routeRegistrar(app, deps);

  // 全局错误处理（与 server.js 保持一致的格式）
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ error: err.message || '服务器内部错误' });
  });

  const server = createServer(app);

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const close = () =>
    new Promise((resolve) => {
      server.close(resolve);
    });

  return { app, server, baseUrl, close };
}

// ═══════════════════════════════════════════════════════════════
// GET /health - 健康检查
// ═══════════════════════════════════════════════════════════════

describe('GET /health', () => {
  let ctx;

  beforeEach(async () => {
    ctx = await createTestApp(healthRoutes);
  });

  afterEach(async () => {
    await ctx.close();
  });

  it('应返回 200 状态码', async () => {
    const res = await fetch(`${ctx.baseUrl}/health`);
    expect(res.status).toBe(200);
  });

  it('响应体应包含 status/uptime/version/timestamp 字段', async () => {
    const res = await fetch(`${ctx.baseUrl}/health`);
    const body = await res.json();

    expect(body).toHaveProperty('status', 'ok');
    expect(body).toHaveProperty('uptime');
    expect(body).toHaveProperty('version');
    expect(body).toHaveProperty('timestamp');
  });

  it('uptime 应为正数', async () => {
    const res = await fetch(`${ctx.baseUrl}/health`);
    const body = await res.json();

    expect(typeof body.uptime).toBe('number');
    expect(body.uptime).toBeGreaterThan(0);
  });

  it('timestamp 应为有效的 ISO 8601 格式', async () => {
    const res = await fetch(`${ctx.baseUrl}/health`);
    const body = await res.json();

    const date = new Date(body.timestamp);
    expect(date.toISOString()).toBe(body.timestamp);
  });

  it('Content-Type 应为 application/json', async () => {
    const res = await fetch(`${ctx.baseUrl}/health`);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/jobs - 任务列表
// ═══════════════════════════════════════════════════════════════

describe('GET /api/jobs', () => {
  let ctx;
  const mockJobManager = { cancel: vi.fn(), retry: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    ctx = await createTestApp(jobRoutes, { jobManager: mockJobManager });
  });

  afterEach(async () => {
    await ctx.close();
  });

  it('无参数时应使用默认 limit=50 offset=0', async () => {
    listJobs.mockReturnValue([]);
    countJobs.mockReturnValue(0);

    const res = await fetch(`${ctx.baseUrl}/api/jobs`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty('jobs');
    expect(body).toHaveProperty('total');
    expect(Array.isArray(body.jobs)).toBe(true);
  });

  it('应支持 status 查询参数过滤', async () => {
    listJobs.mockReturnValue([]);
    countJobs.mockReturnValue(0);

    await fetch(`${ctx.baseUrl}/api/jobs?status=done`);

    expect(listJobs).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'done' }),
    );
  });

  it('应支持 limit 和 offset 分页参数', async () => {
    listJobs.mockReturnValue([]);
    countJobs.mockReturnValue(0);

    await fetch(`${ctx.baseUrl}/api/jobs?limit=10&offset=20`);

    expect(listJobs).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10, offset: 20 }),
    );
  });

  it('响应结构应包含 jobs 数组和 total 数值', async () => {
    const mockJobs = [
      { id: 'j-1', status: 'done', printer: 'HP', type: 'html' },
      { id: 'j-2', status: 'printing', printer: 'Canon', type: 'pdf' },
    ];
    listJobs.mockReturnValue(mockJobs);
    countJobs.mockReturnValue(42);

    const res = await fetch(`${ctx.baseUrl}/api/jobs`);
    const body = await res.json();

    expect(body.jobs).toHaveLength(2);
    expect(body.total).toBe(42);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/jobs/:id - 任务详情
// ═══════════════════════════════════════════════════════════════

describe('GET /api/jobs/:id', () => {
  let ctx;
  const mockJobManager = { cancel: vi.fn(), retry: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    ctx = await createTestApp(jobRoutes, { jobManager: mockJobManager });
  });

  afterEach(async () => {
    await ctx.close();
  });

  it('任务存在时应返回 200 + job 对象', async () => {
    const mockJob = { id: 'j-100', status: 'done', printer: 'HP' };
    getJob.mockReturnValue(mockJob);

    const res = await fetch(`${ctx.baseUrl}/api/jobs/j-100`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty('job');
    expect(body.job.id).toBe('j-100');
  });

  it('任务不存在时应返回 404', async () => {
    getJob.mockReturnValue(null);

    const res = await fetch(`${ctx.baseUrl}/api/jobs/nonexistent`);

    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/printers - 打印机列表
// ═══════════════════════════════════════════════════════════════

describe('GET /api/printers', () => {
  let ctx;

  const MOCK_PRINTERS = [
    { name: 'HP_LaserJet', status: 'idle', isDefault: true, location: 'Office A' },
    { name: 'Canon_PIXMA', status: 'idle', isDefault: false, location: '' },
  ];

  beforeEach(async () => {
    const printerAdapter = {
      getPrinters: vi.fn().mockResolvedValue(MOCK_PRINTERS),
    };
    ctx = await createTestApp(printerRoutes, { printerAdapter });
  });

  afterEach(async () => {
    await ctx.close();
  });

  it('应返回 200 + printers 数组', async () => {
    const res = await fetch(`${ctx.baseUrl}/api/printers`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty('printers');
    expect(Array.isArray(body.printers)).toBe(true);
  });

  it('打印机对象应包含 name/status/isDefault/location 字段', async () => {
    const res = await fetch(`${ctx.baseUrl}/api/printers`);
    const body = await res.json();

    const printer = body.printers[0];
    expect(printer).toHaveProperty('name');
    expect(printer).toHaveProperty('status');
    expect(printer).toHaveProperty('isDefault');
    expect(printer).toHaveProperty('location');
  });
});

// ═══════════════════════════════════════════════════════════════
// 打印机 CRUD 路由验证
// ═══════════════════════════════════════════════════════════════

describe('打印机 CRUD 路由', () => {
  let ctx;
  let printerAdmin;

  beforeEach(async () => {
    printerAdmin = {
      add: vi.fn().mockResolvedValue({ ok: true }),
      update: vi.fn().mockResolvedValue({ ok: true }),
      remove: vi.fn().mockResolvedValue({ ok: true }),
      setDefault: vi.fn().mockResolvedValue({ ok: true }),
      enable: vi.fn().mockResolvedValue({ ok: true }),
      disable: vi.fn().mockResolvedValue({ ok: true }),
    };
    const printerAdapter = {
      getPrinters: vi.fn().mockResolvedValue([]),
    };
    ctx = await createTestApp(printerRoutes, { printerAdapter, printerAdmin });
  });

  afterEach(async () => {
    await ctx.close();
  });

  it('POST /api/printers 应调用 printerAdmin.add 并返回 201', async () => {
    const res = await fetch(`${ctx.baseUrl}/api/printers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'TestPrinter', deviceUri: 'ipp://localhost' }),
    });

    expect(res.status).toBe(201);
    expect(printerAdmin.add).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'TestPrinter', deviceUri: 'ipp://localhost' }),
    );
  });

  it('DELETE /api/printers/:name 应调用 printerAdmin.remove', async () => {
    const res = await fetch(`${ctx.baseUrl}/api/printers/TestPrinter`, {
      method: 'DELETE',
    });

    expect(res.status).toBe(200);
    expect(printerAdmin.remove).toHaveBeenCalledWith('TestPrinter');
  });

  it('POST /api/printers/:name/default 应调用 printerAdmin.setDefault', async () => {
    const res = await fetch(`${ctx.baseUrl}/api/printers/HP/default`, {
      method: 'POST',
    });

    expect(res.status).toBe(200);
    expect(printerAdmin.setDefault).toHaveBeenCalledWith('HP');
  });

  it('POST /api/printers/:name/enable 应调用 printerAdmin.enable', async () => {
    const res = await fetch(`${ctx.baseUrl}/api/printers/HP/enable`, {
      method: 'POST',
    });

    expect(res.status).toBe(200);
    expect(printerAdmin.enable).toHaveBeenCalledWith('HP');
  });

  it('POST /api/printers/:name/disable 应调用 printerAdmin.disable', async () => {
    const res = await fetch(`${ctx.baseUrl}/api/printers/HP/disable`, {
      method: 'POST',
    });

    expect(res.status).toBe(200);
    expect(printerAdmin.disable).toHaveBeenCalledWith('HP');
  });
});

// ═══════════════════════════════════════════════════════════════
// 打印机管理功能未启用时返回 501
// ═══════════════════════════════════════════════════════════════

describe('打印机管理未启用（无 printerAdmin）', () => {
  let ctx;

  beforeEach(async () => {
    const printerAdapter = {
      getPrinters: vi.fn().mockResolvedValue([]),
    };
    // printerAdmin 为 undefined 模拟未启用
    ctx = await createTestApp(printerRoutes, { printerAdapter, printerAdmin: undefined });
  });

  afterEach(async () => {
    await ctx.close();
  });

  it('POST /api/printers 应返回 501', async () => {
    const res = await fetch(`${ctx.baseUrl}/api/printers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'X', deviceUri: 'ipp://x' }),
    });

    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error).toMatch(/未启用/);
  });

  it('DELETE /api/printers/:name 应返回 501', async () => {
    const res = await fetch(`${ctx.baseUrl}/api/printers/HP`, { method: 'DELETE' });
    expect(res.status).toBe(501);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/config - 配置脱敏
// ═══════════════════════════════════════════════════════════════

describe('GET /api/config', () => {
  let ctx;

  beforeEach(async () => {
    vi.clearAllMocks();
    ctx = await createTestApp(configRoutes);
  });

  afterEach(async () => {
    await ctx.close();
  });

  it('应返回 200 + 脱敏后的配置', async () => {
    getConfig.mockReturnValue({
      port: 17521,
      adminPort: 17522,
      token: 'my-secret-token',
      transitToken: 'transit-secret',
      admin: {
        username: 'admin',
        password: '$2b$10$hash...',
        sessionSecret: 'super-secret',
      },
      renderConcurrency: 4,
    });

    const res = await fetch(`${ctx.baseUrl}/api/config`);
    const body = await res.json();

    expect(res.status).toBe(200);

    // token 脱敏：前 4 位 + ****
    expect(body.token).toBe('my-s****');

    // transitToken 脱敏
    expect(body.transitToken).toBe('tran****');

    // admin.password 应为空字符串
    expect(body.admin.password).toBe('');

    // admin.sessionSecret 不应返回
    expect(body.admin).not.toHaveProperty('sessionSecret');
  });

  it('应包含 _meta.restartRequired 元数据', async () => {
    getConfig.mockReturnValue({
      port: 17521,
      adminPort: 17522,
      renderConcurrency: 4,
    });

    const res = await fetch(`${ctx.baseUrl}/api/config`);
    const body = await res.json();

    expect(body._meta).toBeDefined();
    expect(body._meta.restartRequired).toEqual(
      expect.arrayContaining(['port', 'adminPort', 'browserPoolSize', 'dbPath', 'allowEIO3']),
    );
  });

  it('token 长度 <= 4 时应完全掩码', async () => {
    getConfig.mockReturnValue({
      token: 'abc',
    });

    const res = await fetch(`${ctx.baseUrl}/api/config`);
    const body = await res.json();

    expect(body.token).toBe('****');
  });

  it('无 admin 配置时不应报错', async () => {
    getConfig.mockReturnValue({
      port: 17521,
      token: '',
    });

    const res = await fetch(`${ctx.baseUrl}/api/config`);
    expect(res.status).toBe(200);
  });
});
