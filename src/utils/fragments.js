/**
 * 分片缓存管理器
 *
 * 用于管理大型打印内容的分片传输。当所有分片到齐后自动合并，
 * 同时通过定时器自动清理过期的未完成分片任务。
 */
export class FragmentManager {
  /** @type {Map<string, { total: number, pieces: Map<number, string>, updateTime: number }>} */
  #cache = new Map();

  /** @type {ReturnType<typeof setTimeout> | null} */
  #timer = null;

  /** 检查间隔（毫秒） */
  #checkIntervalMs;

  /** 过期时间（毫秒） */
  #expireMs;

  /**
   * @param {object} [options]
   * @param {number} [options.checkInterval=5] - 过期检查间隔（分钟）
   * @param {number} [options.expire=10] - 分片过期时间（分钟）
   */
  constructor({ checkInterval = 5, expire = 10 } = {}) {
    this.#checkIntervalMs = checkInterval * 60 * 1000;
    this.#expireMs = expire * 60 * 1000;
  }

  /**
   * 添加一个分片
   * @param {string} id - 分片任务 ID
   * @param {number} total - 该任务的总分片数
   * @param {number} index - 当前分片索引（从 0 开始）
   * @param {string} htmlFragment - 当前分片的 HTML 内容
   * @returns {{ complete: boolean, html?: string }} 若所有分片到齐返回合并后的 HTML
   */
  addFragment(id, total, index, htmlFragment) {
    let entry = this.#cache.get(id);

    if (!entry) {
      entry = { total, pieces: new Map(), updateTime: Date.now() };
      this.#cache.set(id, entry);
    }

    entry.pieces.set(index, htmlFragment);
    entry.updateTime = Date.now();

    // 启动过期清理定时器（懒启动）
    this.#ensureTimer();

    // 检查是否所有分片已到齐
    if (entry.pieces.size >= entry.total) {
      // 按索引顺序合并 HTML
      const sorted = Array.from(entry.pieces.entries())
        .sort((a, b) => a[0] - b[0]);
      const html = sorted.map(([, fragment]) => fragment).join('');

      // 清除已完成的缓存
      this.#cache.delete(id);

      return { complete: true, html };
    }

    return { complete: false };
  }

  /**
   * 手动清除指定 ID 的分片缓存
   * @param {string} id - 分片任务 ID
   */
  clear(id) {
    this.#cache.delete(id);
  }

  /**
   * 销毁管理器，清理定时器并释放所有缓存
   */
  destroy() {
    if (this.#timer !== null) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
    this.#cache.clear();
  }

  /**
   * 确保过期清理定时器已启动
   */
  #ensureTimer() {
    if (this.#timer !== null) return;
    this.#timer = setTimeout(() => this.#sweep(), this.#checkIntervalMs);
  }

  /**
   * 扫描并清除过期的分片任务
   */
  #sweep() {
    this.#timer = null;
    const now = Date.now();

    for (const [id, entry] of this.#cache) {
      if (now - entry.updateTime > this.#expireMs) {
        this.#cache.delete(id);
      }
    }

    // 仍有未完成的任务时继续监测
    if (this.#cache.size > 0) {
      this.#timer = setTimeout(() => this.#sweep(), this.#checkIntervalMs);
    }
  }
}
