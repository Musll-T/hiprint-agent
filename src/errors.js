/**
 * 统一错误模型
 *
 * 提供结构化的应用错误类和错误码枚举，
 * 用于全局错误中间件的统一响应格式化。
 */

/**
 * 应用错误基类
 *
 * 携带结构化错误码和 HTTP 状态码，
 * 由全局错误中间件捕获并格式化为 JSON 响应。
 */
export class AppError extends Error {
  /**
   * @param {string} code - 错误码（对应 ErrorCodes 枚举值）
   * @param {number} status - HTTP 状态码
   * @param {string} message - 错误描述信息
   * @param {object} [meta={}] - 附加元数据
   */
  constructor(code, status, message, meta = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = status;
    this.meta = meta;
  }
}

/** 错误码枚举 */
export const ErrorCodes = Object.freeze({
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  CONFLICT: 'CONFLICT',
  INTERNAL: 'INTERNAL_ERROR',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
});
