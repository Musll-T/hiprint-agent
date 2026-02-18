import { loadConfig, config } from './config.js';
import { initLogger, getLogger } from './logger.js';
import { initDB, closeDB } from './jobs/store.js';
import { createBrowserPool } from './renderer/pool.js';
import { createPrinterAdapter } from './printer/adapter.js';
import { createJobManager } from './jobs/manager.js';
import { createGateway } from './gateway/server.js';
import { createAdminWeb } from './web/server.js';

let browserPool = null;
let jobManager = null;
let gateway = null;
let adminWeb = null;

/**
 * 应用主启动函数
 * 按顺序初始化各子系统，完成后开始接收请求
 */
async function main() {
  // 1. 加载配置
  loadConfig();
  const log = initLogger(config);

  log.info('配置加载完成，端口: %d，管理端口: %d', config.port, config.adminPort);

  // 2. 初始化日志（已在上方完成）
  log.info('日志系统就绪，级别: %s', config.logLevel);

  // 3. 初始化数据库
  initDB(config.dbPath);
  log.info('数据库初始化完成');

  // 4. 初始化渲染引擎（Playwright 浏览器池）
  browserPool = createBrowserPool({
    poolSize: config.browserPoolSize,
    pageReuseLimit: config.pageReuseLimit,
  });
  await browserPool.init();
  log.info('渲染引擎初始化完成');

  // 5. 初始化打印适配器（CUPS）
  const printerAdapter = createPrinterAdapter({
    defaultPrinter: config.defaultPrinter,
  });
  log.info('打印适配器初始化完成');

  // 6. 初始化 Job Manager（任务调度器）
  jobManager = createJobManager({
    rendererPool: browserPool,
    printerAdapter,
    config,
  });
  log.info('Job Manager 初始化完成');

  // 7. 启动 Socket Gateway (:17521)
  gateway = await createGateway({
    config,
    jobManager,
    printerAdapter,
  });
  log.info('Socket Gateway 启动完成');

  // 8. 启动 Admin Web (:17522)
  adminWeb = await createAdminWeb({
    config,
    jobManager,
    printerAdapter,
    gatewayIo: gateway.io,
  });
  log.info('Admin Web 启动完成');

  // 9. 启动完成
  log.info('hiprint-agent v1.0.0 启动完成');
}

/**
 * 优雅关闭处理
 * 接收到 SIGINT/SIGTERM 信号时，按逆序释放资源
 */
async function shutdown(signal) {
  const log = getLogger();
  log.info('收到 %s 信号，开始优雅关闭...', signal);

  try {
    // 逆序关闭各子系统
    if (adminWeb) {
      await adminWeb.close();
      log.info('Admin Web 已关闭');
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

    // 打印适配器无状态，无需关闭

    closeDB();
    log.info('数据库已关闭');

    log.info('所有子系统已关闭，进程退出');
    process.exit(0);
  } catch (err) {
    log.error({ err }, '关闭过程中发生错误');
    process.exit(1);
  }
}

// 注册信号处理
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// 未捕获异常兜底
process.on('uncaughtException', (err) => {
  const log = getLogger();
  log.fatal({ err }, '未捕获的异常');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  const log = getLogger();
  log.fatal({ err: reason }, '未处理的 Promise 拒绝');
  process.exit(1);
});

// 启动应用
main().catch((err) => {
  console.error('启动失败:', err);
  process.exit(1);
});
