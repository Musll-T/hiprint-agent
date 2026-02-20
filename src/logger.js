import pino from 'pino';
import { getActiveTraceContext } from './observability/tracing.js';

/** 默认日志配置 */
const DEFAULT_OPTIONS = {
  level: 'info',
};

/**
 * 检测当前是否为开发环境
 * @returns {boolean}
 */
function isDev() {
  return !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
}

/**
 * 创建 pino 日志实例
 *
 * 当 OTel 追踪启用时，通过 mixin 自动将 trace_id/span_id
 * 注入每条日志记录，实现日志与链路追踪关联。
 *
 * @param {object} [config] - 配置对象，需包含 logLevel 字段
 * @param {string} [config.logLevel='info'] - 日志级别：trace/debug/info/warn/error/fatal
 * @returns {import('pino').Logger} pino 日志实例
 */
export function createLogger(config = {}) {
  const level = config.logLevel || DEFAULT_OPTIONS.level;

  const options = {
    level,
    // 统一时间戳格式
    timestamp: pino.stdTimeFunctions.isoTime,
    // OTel trace 上下文注入：每条日志自动附加 trace_id/span_id
    // OTel 未启用时 getActiveTraceContext() 返回空对象，无性能影响
    mixin() {
      return getActiveTraceContext();
    },
  };

  // 开发环境自动启用 pino-pretty 美化输出
  if (isDev()) {
    return pino(options, pino.transport({
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
        ignore: 'pid,hostname',
      },
    }));
  }

  return pino(options);
}

/** 默认日志实例（使用默认配置，启动后可通过 initLogger 重新初始化） */
let logger = createLogger();

/**
 * 使用应用配置重新初始化默认日志实例
 * @param {object} config - 应用配置对象
 * @returns {import('pino').Logger} 初始化后的日志实例
 */
export function initLogger(config) {
  logger = createLogger(config);
  return logger;
}

/**
 * 获取当前默认日志实例
 * @returns {import('pino').Logger}
 */
export function getLogger() {
  return logger;
}

export default logger;
