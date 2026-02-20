/**
 * 迁移 001: 为 jobs 表添加 print_options 列
 *
 * 从 store.js 内联 ALTER TABLE 迁出为正式迁移。
 * 幂等：检查列是否已存在后再执行 ALTER。
 */

/**
 * @param {import('better-sqlite3').Database} db
 */
export function up(db) {
  const columns = (db.pragma('table_info(jobs)'));
  if (!columns.some((col) => col.name === 'print_options')) {
    db.exec('ALTER TABLE jobs ADD COLUMN print_options TEXT');
  }
}
