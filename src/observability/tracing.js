/**
 * OpenTelemetry 追踪初始化与工具函数
 *
 * 在 config.otel.enabled 为 true 时初始化 OTel SDK，
 * 配置 OTLP HTTP 导出器和自动 instrumentation。
 * 未启用时完全无开销（不导入任何 OTel 模块）。
 *
 * 提供 withSpan / getActiveTraceContext 等辅助函数，
 * OTel 未启用时自动退化为零开销直通调用。
 */

/** @type {import('@opentelemetry/api').Tracer | null} */
let tracer = null;

/** @type {import('@opentelemetry/sdk-node').NodeSDK | null} */
let sdk = null;

/** @type {typeof import('@opentelemetry/api') | null} */
let api = null;

/**
 * 初始化 OpenTelemetry 追踪
 *
 * 必须在其他模块初始化之前调用，以确保自动 instrumentation
 * 能正确拦截 HTTP/Express/Socket.IO 等模块。
 *
 * @param {object} config - 应用配置对象
 * @param {object} [config.otel] - OTel 配置
 * @param {boolean} [config.otel.enabled=false] - 是否启用追踪
 * @param {string} [config.otel.endpoint] - OTLP HTTP 导出端点
 * @param {number} [config.otel.samplingRate] - 采样率（0-1）
 * @param {string} [config.otel.serviceName] - 服务名称
 */
export async function initTracing(config) {
  if (!config.otel?.enabled) return;

  // 动态导入，避免未启用时加载 OTel SDK
  const { NodeSDK } = await import('@opentelemetry/sdk-node');
  const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');
  const { getNodeAutoInstrumentations } = await import(
    '@opentelemetry/auto-instrumentations-node'
  );
  api = await import('@opentelemetry/api');

  const serviceName = config.otel.serviceName || 'hiprint-agent';

  const exporter = new OTLPTraceExporter({
    url: config.otel.endpoint || 'http://localhost:4318/v1/traces',
  });

  sdk = new NodeSDK({
    traceExporter: exporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        // 禁用文件系统 instrumentation，避免大量低价值 span
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
    serviceName,
  });

  sdk.start();
  tracer = api.trace.getTracer(serviceName);

  // 注册关闭钩子，确保 span 在进程退出前刷新
  process.on('SIGTERM', () => shutdown());
}

/**
 * 获取全局 Tracer 实例
 *
 * 未启用 OTel 时返回 null，调用方应做空值检查。
 *
 * @returns {import('@opentelemetry/api').Tracer | null}
 */
export function getTracer() {
  return tracer;
}

/**
 * 在 span 上下文中执行异步函数
 *
 * OTel 未启用时直接执行 fn，零开销。
 * 启用时创建指定名称的 span，自动记录错误并设置状态。
 *
 * @param {string} name - span 名称
 * @param {Record<string, string|number|boolean>} [attributes] - span 属性
 * @param {() => Promise<T>} fn - 待执行的异步函数
 * @returns {Promise<T>}
 * @template T
 */
export async function withSpan(name, attributes, fn) {
  if (!tracer || !api) {
    return fn();
  }

  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: api.SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.setStatus({ code: api.SpanStatusCode.ERROR, message: err.message });
      span.recordException(err);
      throw err;
    } finally {
      span.end();
    }
  });
}

/**
 * 在 span 上下文中执行同步函数
 *
 * OTel 未启用时直接执行 fn，零开销。
 *
 * @param {string} name - span 名称
 * @param {Record<string, string|number|boolean>} [attributes] - span 属性
 * @param {() => T} fn - 待执行的同步函数
 * @returns {T}
 * @template T
 */
export function withSpanSync(name, attributes, fn) {
  if (!tracer || !api) {
    return fn();
  }

  return tracer.startActiveSpan(name, { attributes }, (span) => {
    try {
      const result = fn(span);
      span.setStatus({ code: api.SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.setStatus({ code: api.SpanStatusCode.ERROR, message: err.message });
      span.recordException(err);
      throw err;
    } finally {
      span.end();
    }
  });
}

/**
 * 获取当前活跃的 trace 上下文信息（trace_id / span_id）
 *
 * 用于日志关联：pino mixin 调用此函数将 trace 信息注入每条日志。
 * OTel 未启用时返回空对象，不污染日志。
 *
 * @returns {{ trace_id?: string, span_id?: string }}
 */
export function getActiveTraceContext() {
  if (!api) return {};

  const span = api.trace.getActiveSpan();
  if (!span) return {};

  const ctx = span.spanContext();
  // 仅在有效采样时注入（避免无效的全零 trace_id）
  if (!ctx || !(ctx.traceFlags & api.TraceFlags.SAMPLED)) return {};

  return {
    trace_id: ctx.traceId,
    span_id: ctx.spanId,
  };
}

/**
 * 关闭 OTel SDK，刷新待发送的 span
 *
 * @returns {Promise<void>}
 */
export async function shutdown() {
  if (sdk) {
    await sdk.shutdown();
    sdk = null;
    tracer = null;
    api = null;
  }
}
