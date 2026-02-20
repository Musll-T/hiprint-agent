/**
 * 轻量级数据库迁移器
 *
 * 在 schema_versions 表中记录已执行的迁移版本，
 * 启动时遍历迁移注册表并执行未运行的迁移。
 * 零外部依赖，完全基于 better-sqlite3 同步 API。
 */

import { getLogger } from '../logger.js';

/**
 * 执行数据库迁移
 *
 * 遍历迁移注册表，跳过已执行的迁移，在事务中执行新迁移并记录版本号。
 *
 * @param {import('better-sqlite3').Database} db - 数据库实例
 * @param {Array<{ version: string, up: (db: import('better-sqlite3').Database) => void }>} migrations - 迁移注册表
 */
export function runMigrations(db, migrations) {
  const log = getLogger();

  // 创建 schema_versions 表（如不存在）
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_versions (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  // 获取已执行的迁移版本
  const applied = new Set(
    db
      .prepare('SELECT version FROM schema_versions')
      .all()
      .map((r) => r.version)
  );

  // 预编译版本记录语句
  const stmtRecord = db.prepare(
    'INSERT INTO schema_versions (version, applied_at) VALUES (?, ?)'
  );

  // 逐个执行新迁移
  for (const { version, up } of migrations) {
    if (applied.has(version)) {
      continue;
    }

    log.info({ version }, '执行数据库迁移...');

    if (typeof up !== 'function') {
      throw new Error(`迁移 ${version} 缺少 up() 函数`);
    }

    // 在事务中执行迁移 + 记录版本号
    const migrate = db.transaction(() => {
      up(db);
      stmtRecord.run(version, new Date().toISOString());
    });
    migrate();

    log.info({ version }, '数据库迁移完成');
  }
}
