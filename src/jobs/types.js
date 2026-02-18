/**
 * 打印任务状态与类型定义
 *
 * 本模块定义了打印任务的生命周期状态枚举、任务类型枚举，
 * 以及任务数据结构的 JSDoc 类型定义，供 store.js 和上层调度模块使用。
 */

/** 任务状态枚举 */
export const JobStatus = Object.freeze({
  /** 已接收，等待渲染 */
  RECEIVED: 'received',
  /** 渲染中 */
  RENDERING: 'rendering',
  /** 打印中 */
  PRINTING: 'printing',
  /** 完成 */
  DONE: 'done',
  /** 渲染失败 */
  FAILED_RENDER: 'failed_render',
  /** 打印失败 */
  FAILED_PRINT: 'failed_print',
  /** 已取消 */
  CANCELED: 'canceled',
  /** 超时 */
  TIMEOUT: 'timeout',
});

/** 终态集合（不可再变更的状态） */
export const TERMINAL_STATUSES = Object.freeze([
  JobStatus.DONE,
  JobStatus.FAILED_RENDER,
  JobStatus.FAILED_PRINT,
  JobStatus.CANCELED,
  JobStatus.TIMEOUT,
]);

/** 任务类型枚举 */
export const JobType = Object.freeze({
  /** 直接 HTML 内容打印 */
  HTML: 'html',
  /** 本地 PDF 文件打印 */
  PDF: 'pdf',
  /** 通过 URL 下载 PDF 打印 */
  URL_PDF: 'url_pdf',
  /** 二进制 Blob PDF 打印 */
  BLOB_PDF: 'blob_pdf',
  /** 渲染模板为 JPEG 截图 */
  RENDER_JPEG: 'render_jpeg',
  /** 渲染模板为 PDF */
  RENDER_PDF: 'render_pdf',
  /** 渲染模板并直接打印 */
  RENDER_PRINT: 'render_print',
});

/**
 * 打印任务数据结构
 *
 * @typedef {object} Job
 * @property {string} id - 任务唯一标识（UUID v7）
 * @property {string} status - 任务状态，取值见 JobStatus 枚举
 * @property {string} printer - 目标打印机名称
 * @property {string} templateId - 模板 ID
 * @property {string} type - 任务类型，取值见 JobType 枚举
 * @property {string} clientId - 来源客户端的 socketId
 * @property {string} tenantId - 租户标识（token 分组）
 * @property {string} createdAt - 创建时间（ISO 8601 格式）
 * @property {string} updatedAt - 最后更新时间（ISO 8601 格式）
 * @property {number|null} renderDuration - 渲染耗时（毫秒），未完成时为 null
 * @property {number|null} printDuration - 打印耗时（毫秒），未完成时为 null
 * @property {string|null} errorMsg - 错误信息，正常时为 null
 * @property {string|null} htmlHash - HTML 内容哈希，用于去重判断
 * @property {number} retryCount - 重试次数
 * @property {number|null} pageNum - 页数
 */

/**
 * 审计日志数据结构
 *
 * @typedef {object} AuditLog
 * @property {number} id - 自增主键
 * @property {string} jobId - 关联的任务 ID
 * @property {string} action - 操作类型（如 status_change / create / cancel）
 * @property {string} detail - 操作详情（JSON 字符串或纯文本）
 * @property {string} createdAt - 记录时间（ISO 8601 格式）
 */
