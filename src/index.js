import { loadConfig, config } from './config.js';
import { buildRuntime } from './bootstrap.js';

let runtime = null;

/**
 * 应用主启动函数
 */
async function main() {
  loadConfig();
  runtime = await buildRuntime(config);
  await runtime.start();
}

/**
 * 优雅关闭处理
 * 接收到 SIGINT/SIGTERM 信号时，按逆序释放资源
 */
async function shutdown(signal) {
  // 动态导入避免在模块顶层引入 logger（此时可能尚未初始化）
  const { getLogger } = await import('./logger.js');
  const log = getLogger();
  log.info('收到 %s 信号，开始优雅关闭...', signal);

  try {
    if (runtime) await runtime.stop();
    process.exit(0);
  } catch (err) {
    log.error({ err }, '关闭过程中发生错误');
    process.exit(1);
  }
}

// 注册信号处理
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// 未捕获异常兜底（尝试优雅关闭后退出）
process.on('uncaughtException', async (err) => {
  try {
    const { getLogger } = await import('./logger.js');
    const log = getLogger();
    log.fatal({ err }, '未捕获的异常');
  } catch {
    console.error('未捕获的异常:', err);
  }
  // 尝试有限时间内的优雅关闭
  try {
    if (runtime) await Promise.race([runtime.stop(), new Promise(r => setTimeout(r, 5000))]);
  } catch {
    // 忽略关闭错误
  }
  process.exit(1);
});

process.on('unhandledRejection', async (reason) => {
  try {
    const { getLogger } = await import('./logger.js');
    const log = getLogger();
    log.fatal({ err: reason }, '未处理的 Promise 拒绝');
  } catch {
    console.error('未处理的 Promise 拒绝:', reason);
  }
  // 尝试有限时间内的优雅关闭
  try {
    if (runtime) await Promise.race([runtime.stop(), new Promise(r => setTimeout(r, 5000))]);
  } catch {
    // 忽略关闭错误
  }
  process.exit(1);
});

// 启动应用
main().catch((err) => {
  console.error('启动失败:', err);
  process.exit(1);
});
