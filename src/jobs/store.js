/**
 * SQLite 存储层
 *
 * 基于 better-sqlite3 封装任务（Job）和审计日志（AuditLog）的持久化操作。
 * 所有数据库操作均为同步 API，使用 prepared statement 防止 SQL 注入。
 * 启用 WAL 模式以提升并发读写性能。
 */

import { mkdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import Database from 'better-sqlite3';
import dayjs from 'dayjs';
import { v7 as uuidv7 } from 'uuid';
import { getLogger } from '../logger.js';
import { runMigrations } from './migrator.js';
import { up as migration001 } from './migrations/001_add_print_options.js';
import { JobStatus, TERMINAL_STATUSES } from './types.js';

// 迁移注册表（新增迁移时在此追加）
const MIGRATIONS = [
  { version: '001_add_print_options', up: migration001 },
];

/** @type {import('better-sqlite3').Database | null} */
let db = null;

// ============================================================
// 预编译 SQL 语句缓存（initDB 后赋值）
// ============================================================
let stmtInsertJob = null;
let stmtUpdateStatus = null;
let stmtGetJob = null;
let stmtInsertAudit = null;
let stmtGetStats = null;
let stmtListJobs = null;
let stmtListJobsByStatus = null;
let stmtCountAll = null;
let stmtCountByStatus = null;
let stmtGetRecoverableJobs = null;

// ============================================================
// 内部工具函数
// ============================================================

/**
 * 将数据库行（snake_case）映射为 Job 对象（camelCase）
 * @param {object} row - 数据库返回行
 * @returns {import('./types.js').Job}
 */
function rowToJob(row) {
  if (!row) return null;
  let printOptions = null;
  if (row.print_options) {
    try {
      printOptions = JSON.parse(row.print_options);
    } catch {
      // JSON 解析失败时忽略，保持 null
    }
  }
  return {
    id: row.id,
    status: row.status,
    printer: row.printer,
    templateId: row.template_id,
    type: row.type,
    clientId: row.client_id,
    tenantId: row.tenant_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    renderDuration: row.render_duration,
    printDuration: row.print_duration,
    errorMsg: row.error_msg,
    htmlHash: row.html_hash,
    retryCount: row.retry_count,
    pageNum: row.page_num,
    printOptions,
  };
}

/**
 * 将审计日志行映射为 AuditLog 对象
 * @param {object} row
 * @returns {import('./types.js').AuditLog}
 */
function rowToAuditLog(row) {
  if (!row) return null;
  return {
    id: row.id,
    jobId: row.job_id,
    action: row.action,
    detail: row.detail,
    createdAt: row.created_at,
  };
}

/**
 * 确保数据库已初始化
 * @throws {Error} 数据库未初始化时抛出错误
 */
function ensureDB() {
  if (!db) {
    throw new Error('数据库未初始化，请先调用 initDB()');
  }
}

// ============================================================
// 公共 API
// ============================================================

/**
 * 初始化数据库
 *
 * 创建数据目录、打开 SQLite 数据库、启用 WAL 模式、
 * 创建表和索引、预编译常用 SQL 语句。
 *
 * @param {string} dbPath - 数据库文件路径
 * @returns {{ db: import('better-sqlite3').Database }} 封装对象
 */
export function initDB(dbPath) {
  const log = getLogger();

  // 自动创建数据目录
  const dir = dirname(dbPath);
  mkdirSync(dir, { recursive: true });

  // 创建/打开数据库
  db = new Database(dbPath);
  log.info({ dbPath }, '数据库已打开');

  // 启用 WAL 模式
  db.pragma('journal_mode = WAL');

  // 创建 jobs 表
  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'received',
      printer TEXT,
      template_id TEXT,
      type TEXT,
      client_id TEXT,
      tenant_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      render_duration INTEGER,
      print_duration INTEGER,
      error_msg TEXT,
      html_hash TEXT,
      retry_count INTEGER DEFAULT 0,
      page_num INTEGER,
      print_options TEXT
    )
  `);

  // 创建 audit_log 表
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT,
      action TEXT NOT NULL,
      detail TEXT,
      created_at TEXT NOT NULL
    )
  `);

  // 创建索引（IF NOT EXISTS 避免重复创建报错）
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
    CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
    CREATE INDEX IF NOT EXISTS idx_jobs_template_id ON jobs(template_id);
    CREATE INDEX IF NOT EXISTS idx_audit_log_job_id ON audit_log(job_id);
  `);

  // 执行数据库迁移
  runMigrations(db, MIGRATIONS);

  // 预编译常用 SQL 语句
  stmtInsertJob = db.prepare(`
    INSERT INTO jobs (id, status, printer, template_id, type, client_id, tenant_id,
                      created_at, updated_at, render_duration, print_duration,
                      error_msg, html_hash, retry_count, page_num, print_options)
    VALUES (@id, @status, @printer, @template_id, @type, @client_id, @tenant_id,
            @created_at, @updated_at, @render_duration, @print_duration,
            @error_msg, @html_hash, @retry_count, @page_num, @print_options)
  `);

  stmtUpdateStatus = db.prepare(`
    UPDATE jobs SET status = @status, updated_at = @updated_at,
                    error_msg = CASE WHEN @has_error_msg = 1 THEN @error_msg ELSE error_msg END,
                    render_duration = COALESCE(@render_duration, render_duration),
                    print_duration = COALESCE(@print_duration, print_duration),
                    retry_count = COALESCE(@retry_count, retry_count),
                    page_num = COALESCE(@page_num, page_num)
    WHERE id = @id
  `);

  stmtGetJob = db.prepare('SELECT * FROM jobs WHERE id = ?');

  stmtInsertAudit = db.prepare(`
    INSERT INTO audit_log (job_id, action, detail, created_at)
    VALUES (@job_id, @action, @detail, @created_at)
  `);

  stmtGetStats = db.prepare(`
    SELECT status, COUNT(*) as count FROM jobs GROUP BY status
  `);

  // listJobs 预编译语句（默认排序 created_at DESC）
  stmtListJobs = db.prepare('SELECT * FROM jobs ORDER BY created_at DESC LIMIT ? OFFSET ?');
  stmtListJobsByStatus = db.prepare('SELECT * FROM jobs WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?');

  // countJobs 预编译语句
  stmtCountAll = db.prepare('SELECT COUNT(*) as total FROM jobs');
  stmtCountByStatus = db.prepare('SELECT COUNT(*) as total FROM jobs WHERE status = ?');

  // 可恢复任务查询（非终态 + 非取消）
  stmtGetRecoverableJobs = db.prepare(
    "SELECT * FROM jobs WHERE status IN ('received', 'rendering', 'printing') ORDER BY created_at ASC"
  );

  log.info('数据库表和索引已就绪');

  return { db };
}

/**
 * 创建打印任务
 *
 * 自动生成 UUID v7 作为主键，设置初始状态为 received，
 * 记录创建时间，并写入审计日志。
 *
 * @param {Partial<import('./types.js').Job>} job - 任务数据（id/status/createdAt/updatedAt 可省略）
 * @returns {import('./types.js').Job} 插入后的完整任务对象
 */
export function createJob(job) {
  ensureDB();

  const now = dayjs().toISOString();
  const record = {
    id: job.id || uuidv7(),
    status: job.status || JobStatus.RECEIVED,
    printer: job.printer || null,
    template_id: job.templateId || null,
    type: job.type || null,
    client_id: job.clientId || null,
    tenant_id: job.tenantId || null,
    created_at: job.createdAt || now,
    updated_at: job.updatedAt || now,
    render_duration: job.renderDuration ?? null,
    print_duration: job.printDuration ?? null,
    error_msg: job.errorMsg || null,
    html_hash: job.htmlHash || null,
    retry_count: job.retryCount ?? 0,
    page_num: job.pageNum ?? null,
    print_options: job.printOptions || null,
  };

  stmtInsertJob.run(record);

  // 审计日志
  addAuditLog(record.id, 'create', `任务创建，类型: ${record.type || 'unknown'}`);

  return rowToJob(stmtGetJob.get(record.id));
}

/**
 * 更新任务状态
 *
 * 同时更新 updatedAt 时间戳，支持附加字段（errorMsg / renderDuration / printDuration 等）。
 * 状态变更会自动写入审计日志。
 *
 * @param {string} id - 任务 ID
 * @param {string} status - 新状态（JobStatus 枚举值）
 * @param {object} [extra] - 附加更新字段
 * @param {string} [extra.errorMsg] - 错误信息
 * @param {number} [extra.renderDuration] - 渲染耗时（ms）
 * @param {number} [extra.printDuration] - 打印耗时（ms）
 * @param {number} [extra.retryCount] - 重试次数
 * @param {number} [extra.pageNum] - 页数
 * @returns {import('./types.js').Job|null} 更新后的任务对象，任务不存在时返回 null
 */
export function updateJobStatus(id, status, extra = {}) {
  ensureDB();

  const hasErrorMsg = 'errorMsg' in extra;
  const now = dayjs().toISOString();
  const params = {
    id,
    status,
    updated_at: now,
    has_error_msg: hasErrorMsg ? 1 : 0,
    error_msg: hasErrorMsg ? (extra.errorMsg ?? null) : null,
    render_duration: extra.renderDuration ?? null,
    print_duration: extra.printDuration ?? null,
    retry_count: extra.retryCount ?? null,
    page_num: extra.pageNum ?? null,
  };

  const result = stmtUpdateStatus.run(params);

  if (result.changes === 0) {
    return null;
  }

  // 审计日志
  const detail = extra.errorMsg
    ? `状态变更 -> ${status}，错误: ${extra.errorMsg}`
    : `状态变更 -> ${status}`;
  addAuditLog(id, 'status_change', detail);

  return rowToJob(stmtGetJob.get(id));
}

/**
 * 查询单个任务
 *
 * @param {string} id - 任务 ID
 * @returns {import('./types.js').Job|null} 任务对象，不存在时返回 null
 */
export function getJob(id) {
  ensureDB();
  return rowToJob(stmtGetJob.get(id));
}

/**
 * 分页查询任务列表
 *
 * @param {object} [options] - 查询参数
 * @param {string} [options.status] - 按状态过滤
 * @param {number} [options.limit=50] - 每页条数
 * @param {number} [options.offset=0] - 偏移量
 * @param {string} [options.orderBy='created_at DESC'] - 排序字段（仅允许白名单字段）
 * @returns {import('./types.js').Job[]} 任务列表
 */
export function listJobs(options = {}) {
  ensureDB();

  const { status, limit = 50, offset = 0, orderBy = 'created_at DESC' } = options;

  // 默认排序使用预编译语句（性能优化）
  if (orderBy === 'created_at DESC') {
    const rows = status
      ? stmtListJobsByStatus.all(status, limit, offset)
      : stmtListJobs.all(limit, offset);
    return rows.map(rowToJob);
  }

  // 非默认排序，排序白名单防止 SQL 注入
  const ALLOWED_ORDER = [
    'created_at DESC',
    'created_at ASC',
    'updated_at DESC',
    'updated_at ASC',
    'status ASC',
    'status DESC',
  ];
  const safeOrder = ALLOWED_ORDER.includes(orderBy) ? orderBy : 'created_at DESC';

  let sql = 'SELECT * FROM jobs';
  const params = [];

  if (status) {
    sql += ' WHERE status = ?';
    params.push(status);
  }

  sql += ` ORDER BY ${safeOrder} LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const rows = db.prepare(sql).all(...params);
  return rows.map(rowToJob);
}

/**
 * 统计任务总数
 *
 * @param {object} [options] - 查询参数
 * @param {string} [options.status] - 按状态过滤
 * @returns {number} 任务总数
 */
export function countJobs(options = {}) {
  ensureDB();
  const { status } = options;
  if (status) {
    return stmtCountByStatus.get(status).total;
  }
  return stmtCountAll.get().total;
}

/**
 * 统计各状态的任务数量
 *
 * 使用 2 秒缓存减少频繁 GROUP BY 全表扫描的开销（Admin WebSocket 每 5 秒调用一次）。
 *
 * @returns {Record<string, number>} 以状态为键、数量为值的对象
 */
let _statsCache = null;
let _statsCacheTime = 0;
const STATS_CACHE_TTL_MS = 2000;

export function getJobStats() {
  ensureDB();

  const now = Date.now();
  if (_statsCache && now - _statsCacheTime < STATS_CACHE_TTL_MS) {
    return _statsCache;
  }

  // 初始化所有状态为 0
  const stats = {};
  for (const s of Object.values(JobStatus)) {
    stats[s] = 0;
  }

  const rows = stmtGetStats.all();
  for (const row of rows) {
    stats[row.status] = row.count;
  }

  _statsCache = stats;
  _statsCacheTime = now;

  return stats;
}

/**
 * 查询所有可恢复的任务（非终态中间状态）
 *
 * 用于服务重启后恢复处理中断的任务。
 * 返回状态为 received/rendering/printing 的任务，按创建时间升序排列。
 *
 * @returns {import('./types.js').Job[]} 可恢复任务列表
 */
export function getRecoverableJobs() {
  ensureDB();
  return stmtGetRecoverableJobs.all().map(rowToJob);
}

/**
 * 清理过期任务
 *
 * 删除 N 天前处于终态（done / failed_render / failed_print / canceled / timeout）的任务及其审计日志。
 *
 * @param {number} days - 保留天数，删除此天数之前的记录
 * @returns {{ deletedJobs: number, deletedLogs: number }} 删除的记录数
 */
export function cleanOldJobs(days, previewDir) {
  ensureDB();
  const log = getLogger();

  const cutoff = dayjs().subtract(days, 'day').toISOString();
  const placeholders = TERMINAL_STATUSES.map(() => '?').join(', ');

  // 在删除之前，先查询要删除的 job id，用于同步清理预览文件
  if (previewDir) {
    const selectSQL = `SELECT id FROM jobs WHERE created_at < ? AND status IN (${placeholders})`;
    const jobIds = db.prepare(selectSQL).all(cutoff, ...TERMINAL_STATUSES);
    for (const { id } of jobIds) {
      try {
        unlinkSync(join(previewDir, `${id}.html`));
      } catch {
        // 文件不存在则忽略
      }
    }
  }

  // 先删除关联的审计日志
  const deleteLogsSQL = `
    DELETE FROM audit_log WHERE job_id IN (
      SELECT id FROM jobs WHERE created_at < ? AND status IN (${placeholders})
    )
  `;
  const logsResult = db.prepare(deleteLogsSQL).run(cutoff, ...TERMINAL_STATUSES);

  // 再删除任务
  const deleteJobsSQL = `
    DELETE FROM jobs WHERE created_at < ? AND status IN (${placeholders})
  `;
  const jobsResult = db.prepare(deleteJobsSQL).run(cutoff, ...TERMINAL_STATUSES);

  log.info(
    { days, cutoff, deletedJobs: jobsResult.changes, deletedLogs: logsResult.changes },
    '过期任务清理完成'
  );

  return {
    deletedJobs: jobsResult.changes,
    deletedLogs: logsResult.changes,
  };
}

/**
 * 记录审计日志
 *
 * @param {string} jobId - 关联的任务 ID
 * @param {string} action - 操作类型（如 create / status_change / cancel）
 * @param {string} [detail=''] - 操作详情
 */
export function addAuditLog(jobId, action, detail = '') {
  ensureDB();
  const now = dayjs().toISOString();
  stmtInsertAudit.run({
    job_id: jobId,
    action,
    detail,
    created_at: now,
  });
}

/**
 * 关闭数据库连接
 *
 * 应在进程退出前调用，确保所有数据写入磁盘。
 */
export function closeDB() {
  if (db) {
    const log = getLogger();
    db.close();
    db = null;

    // 清空预编译语句引用
    stmtInsertJob = null;
    stmtUpdateStatus = null;
    stmtGetJob = null;
    stmtInsertAudit = null;
    stmtGetStats = null;
    stmtListJobs = null;
    stmtListJobsByStatus = null;
    stmtCountAll = null;
    stmtCountByStatus = null;
    stmtGetRecoverableJobs = null;

    log.info('数据库连接已关闭');
  }
}
