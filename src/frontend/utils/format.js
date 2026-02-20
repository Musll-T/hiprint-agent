/**
 * 格式化工具函数
 *
 * 从原 src/public/js/app.js 提取。
 */

/**
 * 格式化字节数为可读字符串
 * @param {number} bytes - 字节数
 * @returns {string}
 */
export function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '--';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = (bytes / Math.pow(1024, i)).toFixed(1);
  return val + ' ' + units[i];
}

/**
 * 格式化运行时间（秒）
 * @param {number} seconds - 秒数
 * @returns {string}
 */
export function formatUptime(seconds) {
  if (!seconds && seconds !== 0) return '--';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return d + '天 ' + h + '时';
  if (h > 0) return h + '时 ' + m + '分';
  return m + '分';
}

/**
 * 格式化时间戳为本地时间
 * @param {string|number} ts - ISO 时间字符串或时间戳
 * @returns {string}
 */
export function formatTime(ts) {
  if (!ts) return '--';
  try {
    const d = new Date(ts);
    return d.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '--';
  }
}

/**
 * 截取 ID 的前 8 位
 * @param {string} id - 完整 ID
 * @returns {string}
 */
export function shortId(id) {
  if (!id) return '--';
  return id.length > 8 ? id.substring(0, 8) : id;
}

/**
 * 将 printOptions 对象转换为可展示的标签数组
 *
 * @param {object|null} options - 打印参数对象
 * @returns {Array<{label: string, type: string, title?: string}>}
 */
export function formatPrintOptions(options) {
  if (!options || typeof options !== 'object') return [];

  const tags = [];

  if (options.pageSize) {
    tags.push({ label: options.pageSize, type: 'size' });
  }

  if (options.color === true) {
    tags.push({ label: '彩色', type: 'color' });
  } else if (options.color === false) {
    tags.push({ label: '黑白', type: 'mono' });
  }

  if (options.duplex === true || options.duplexMode) {
    const mode = options.duplexMode === 'shortEdge' ? '短边' : '长边';
    tags.push({ label: '双面\u00b7' + mode, type: 'duplex' });
  }

  if (options.landscape === true) {
    tags.push({ label: '横向', type: 'landscape' });
  }

  if (options.copies != null && options.copies > 1) {
    tags.push({ label: '\u00d7' + options.copies, type: 'copies' });
  }

  if (options.pageRanges) {
    const range = String(options.pageRanges);
    const display = range.length > 8 ? range.substring(0, 8) + '...' : range;
    tags.push({
      label: 'P:' + display,
      type: 'range',
      title: range.length > 8 ? range : undefined,
    });
  }

  return tags;
}
