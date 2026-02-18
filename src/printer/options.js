/**
 * 打印选项映射模块
 *
 * 将 hiprint 前端传递的打印参数映射为 lp 命令行选项数组。
 */

/**
 * 纸张尺寸名称到 CUPS media 值的映射表
 * hiprint 前端使用的尺寸名称可能不完全遵循 CUPS 标准，在此做规范化。
 */
const PAGE_SIZE_MAP = {
  A3: 'A3',
  A4: 'A4',
  A5: 'A5',
  A6: 'A6',
  B4: 'B4',
  B5: 'B5',
  Letter: 'Letter',
  letter: 'Letter',
  Legal: 'Legal',
  legal: 'Legal',
  Tabloid: 'Tabloid',
  tabloid: 'Tabloid',
};

/**
 * 将 hiprint 打印参数映射为 lp 命令选项数组
 *
 * 支持的参数字段：
 * - copies {number}       - 打印份数
 * - duplex {boolean}      - 启用双面打印（默认长边翻转）
 * - duplexMode {string}   - 双面模式：'longEdge' | 'shortEdge'
 * - landscape {boolean}   - 横向打印
 * - pageSize {string}     - 纸张尺寸（A4、Letter 等）
 * - color {boolean}       - false 表示灰度打印
 * - pageRanges {string}   - 打印页范围，如 "1-5,8"
 *
 * @param {object} printData - hiprint 打印参数对象
 * @returns {string[]} lp 命令选项数组，如 ['-n', '2', '-o', 'sides=two-sided-long-edge']
 */
export function mapOptions(printData) {
  if (!printData || typeof printData !== 'object') {
    return [];
  }

  const args = [];

  // 打印份数
  if (printData.copies != null && Number.isInteger(printData.copies) && printData.copies > 0) {
    args.push('-n', String(printData.copies));
  }

  // 双面打印
  if (printData.duplex === true || printData.duplexMode) {
    const mode = printData.duplexMode;
    if (mode === 'shortEdge') {
      args.push('-o', 'sides=two-sided-short-edge');
    } else {
      // 默认长边翻转（duplex: true 或 duplexMode: 'longEdge'）
      args.push('-o', 'sides=two-sided-long-edge');
    }
  }

  // 横向打印
  if (printData.landscape === true) {
    args.push('-o', 'landscape');
  }

  // 纸张尺寸
  if (printData.pageSize) {
    const cupsSize = PAGE_SIZE_MAP[printData.pageSize] || printData.pageSize;
    args.push('-o', `media=${cupsSize}`);
  }

  // 灰度打印
  if (printData.color === false) {
    args.push('-o', 'ColorModel=Gray');
  }

  // 打印页范围
  if (printData.pageRanges && typeof printData.pageRanges === 'string') {
    // 基本格式校验：只允许数字、连字符、逗号
    const sanitized = printData.pageRanges.replace(/[^0-9,\-]/g, '');
    if (sanitized) {
      args.push('-o', `page-ranges=${sanitized}`);
    }
  }

  return args;
}
