/**
 * 应用组合根 — 集中管理所有依赖的创建与组装
 *
 * 将原 index.js 中的初始化逻辑提取为独立的 buildRuntime() 函数，
 * 返回包含所有服务实例和生命周期方法的 runtime 对象。
 */

import { initTracing } from './observability/tracing.js';
import { initLogger, getLogger } from './logger.js';
import { initDB, closeDB, cleanOldJobs } from './jobs/store.js';
import { createBrowserPool } from './renderer/pool.js';
import { createPrinterAdapter } from './printer/adapter.js';
import { createPrinterAdmin } from './printer/admin.js';
import { createMaintenanceService } from './maintenance/service.js';
import { createJobManager } from './jobs/manager.js';
import { createGateway } from './gateway/server.js';
import { createAdminWeb } from './web/server.js';
import { getMachineId } from './utils/system.js';
import { createRendererAdapter, createPrinterPortAdapter } from './core/ports.js';

/**
 * 构建应用运行时
 *
 * 按顺序初始化所有子系统，返回统一的生命周期控制对象。
 *
 * @param {object} config - 应用配置对象（由 loadConfig() 加载）
 * @returns {Promise<{ services: object, start: () => Promise<void>, stop: () => Promise<void> }>}
 */
export async function buildRuntime(config) {
  // 0. 初始化 OpenTelemetry（必须最先执行，早于其他模块导入）
  await initTracing(config);

  // 1. 初始化日志
  const log = initLogger(config);
  log.info('配置加载完成，端口: %d，管理端口: %d', config.port, config.adminPort);
  log.info('设备编号 (machineId): %s', getMachineId() || '(无法获取)');
  log.info('日志系统就绪，级别: %s', config.logLevel);

  // 2. 初始化数据库
  initDB(config.dbPath);
  log.info('数据库初始化完成');

  // 3. 创建浏览器池
  const browserPool = createBrowserPool({
    poolSize: config.browserPoolSize,
    pageReuseLimit: config.pageReuseLimit,
  });
  await browserPool.init();
  log.info('渲染引擎初始化完成');

  // 4. 创建打印适配器
  const printerAdapter = createPrinterAdapter({
    defaultPrinter: config.defaultPrinter,
  });
  log.info('打印适配器初始化完成');

  // 5. 创建打印机管理服务
  const printerAdmin = createPrinterAdmin();
  log.info('打印机管理服务初始化完成');

  // 6. 通过 Port 适配层桥接基础设施
  const renderer = createRendererAdapter(browserPool);
  const printer = createPrinterPortAdapter(printerAdapter);

  // 7. 创建 Job Manager（注入 Port 接口）
  const jobManager = createJobManager({ renderer, printer, config });
  log.info('Job Manager 初始化完成');

  // 8. 创建维护服务
  const maintenanceService = createMaintenanceService({
    jobManager,
    printerAdapter,
    config,
  });
  log.info('维护服务初始化完成');

  // 9. 创建 Gateway
  const gateway = await createGateway({
    config,
    jobManager,
    printerAdapter,
  });
  log.info('Socket Gateway 启动完成');

  // 10. 创建中转客户端（可选）
  let transitClient = null;
  if (config.connectTransit && config.transitUrl && config.transitToken) {
    const { createTransitClient } = await import('./gateway/transit-client.js');
    transitClient = createTransitClient({
      config,
      jobManager,
      printerAdapter,
      systemInfo: gateway.systemInfo,
    });
    log.info('中转客户端已启动，目标: %s', config.transitUrl);
  } else if (config.connectTransit) {
    log.warn('connectTransit 已启用但 transitUrl 或 transitToken 未配置，跳过中转客户端');
  }

  // 11. 创建 Admin Web
  const adminWeb = await createAdminWeb({
    config,
    jobManager,
    printerAdapter,
    printerAdmin,
    maintenanceService,
    gatewayIo: gateway.io,
    transitClient,
  });
  log.info('Admin Web 启动完成');

  // ── 定时清理状态 ──
  let jobCleanupTimer = null;

  return {
    services: {
      browserPool,
      printerAdapter,
      printerAdmin,
      jobManager,
      maintenanceService,
      gateway,
      transitClient,
      adminWeb,
    },

    /** 启动定时任务 */
    async start() {
      const retentionDays = config.jobRetentionDays || 30;
      const previewDir = config.previewDir || './data/preview';
      const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;

      // 启动时立即执行一次清理
      try {
        cleanOldJobs(retentionDays, previewDir);
      } catch (err) {
        log.warn({ err }, '启动时清理过期任务失败');
      }

      jobCleanupTimer = setInterval(() => {
        try {
          const result = cleanOldJobs(retentionDays, previewDir);
          if (result.deletedJobs > 0) {
            log.info(result, '定时清理过期任务完成');
          }
        } catch (err) {
          log.warn({ err }, '定时清理过期任务失败');
        }
      }, CLEANUP_INTERVAL_MS);

      log.info('hiprint-agent v1.0.0 启动完成');
    },

    /** 逆序关闭所有子系统 */
    async stop() {
      if (adminWeb) {
        await adminWeb.close();
        log.info('Admin Web 已关闭');
      }

      if (transitClient) {
        transitClient.close();
        log.info('中转客户端已关闭');
      }

      if (gateway) {
        await gateway.close();
        log.info('Socket Gateway 已关闭');
      }

      if (jobManager) {
        await jobManager.shutdown();
        log.info('Job Manager 已关闭');
      }

      if (browserPool) {
        await browserPool.close();
        log.info('渲染引擎已关闭');
      }

      if (jobCleanupTimer) {
        clearInterval(jobCleanupTimer);
        jobCleanupTimer = null;
      }

      closeDB();
      log.info('数据库已关闭');

      log.info('所有子系统已关闭，进程退出');
    },
  };
}
