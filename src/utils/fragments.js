/**
 * 分片缓存管理器
 *
 * 用于管理大型打印内容的分片传输。当所有分片到齐后自动合并，
 * 同时通过定时器自动清理过期的未完成分片任务。
 *
 * 安全限制：
 *   - 单片最大字节: maxFragmentBytes (默认 512KB)
 *   - 单任务最大分片数: maxTotalFragments (默认 128)
 *   - 组装后最大字节: maxAssembledBytes (默认 16MB)
 *   - 同时活跃分片组: maxActiveJobs (默认 64)
 */
export class FragmentManager {
  /** @type {Map<string, { total: number, pieces: Map<number, string>, updateTime: number, totalBytes: number }>} */
  #cache = new Map();

  /** @type {ReturnType<typeof setTimeout> | null} */
  #timer = null;

  /** 检查间隔（毫秒） */
  #checkIntervalMs;

  /** 过期时间（毫秒） */
  #expireMs;

  // 容量限制
  #maxFragmentBytes;
  #maxTotalFragments;
  #maxAssembledBytes;
  #maxActiveJobs;

  /**
   * @param {object} [options]
   * @param {number} [options.checkInterval=5] - 过期检查间隔（分钟）
   * @param {number} [options.expire=10] - 分片过期时间（分钟）
   * @param {number} [options.maxFragmentBytes=524288] - 单片最大字节（默认 512KB）
   * @param {number} [options.maxTotalFragments=128] - 单任务最大分片数
   * @param {number} [options.maxAssembledBytes=16777216] - 组装后最大字节（默认 16MB）
   * @param {number} [options.maxActiveJobs=64] - 同时活跃的分片组数量
   */
  constructor({
    checkInterval = 5,
    expire = 10,
    maxFragmentBytes = 512 * 1024,
    maxTotalFragments = 128,
    maxAssembledBytes = 16 * 1024 * 1024,
    maxActiveJobs = 64,
  } = {}) {
    this.#checkIntervalMs = checkInterval * 60 * 1000;
    this.#expireMs = expire * 60 * 1000;
    this.#maxFragmentBytes = maxFragmentBytes;
    this.#maxTotalFragments = maxTotalFragments;
    this.#maxAssembledBytes = maxAssembledBytes;
    this.#maxActiveJobs = maxActiveJobs;
  }

  /**
   * 添加一个分片
   * @param {string} id - 分片任务 ID
   * @param {number} total - 该任务的总分片数
   * @param {number} index - 当前分片索引（从 0 开始）
   * @param {string} htmlFragment - 当前分片的 HTML 内容
   * @returns {{ complete: boolean, html?: string }} 若所有分片到齐返回合并后的 HTML
   * @throws {Error} 违反容量限制时抛出错误
   */
  addFragment(id, total, index, htmlFragment) {
    // 校验 id：限制长度和字符
    if (!id || typeof id !== 'string' || id.length > 128 || !/^[\w\-:.]+$/.test(id)) {
      throw new Error('分片 ID 非法（长度 1-128，仅允许字母/数字/下划线/连字符/冒号/点）');
    }

    // 校验 total 和 index 范围
    if (!Number.isInteger(total) || total < 1 || total > this.#maxTotalFragments) {
      throw new Error(`分片总数超限（允许范围 1-${this.#maxTotalFragments}，收到 ${total}）`);
    }

    if (!Number.isInteger(index) || index < 0 || index >= total) {
      throw new Error(`分片索引越界（允许范围 0-${total - 1}，收到 ${index}）`);
    }

    // 校验单片字节大小
    const fragmentBytes = typeof htmlFragment === 'string' ? Buffer.byteLength(htmlFragment, 'utf-8') : 0;
    if (fragmentBytes > this.#maxFragmentBytes) {
      throw new Error(`单片大小超限（最大 ${this.#maxFragmentBytes} 字节，收到 ${fragmentBytes} 字节）`);
    }

    let entry = this.#cache.get(id);

    if (!entry) {
      // 检查活跃分片组数量上限
      if (this.#cache.size >= this.#maxActiveJobs) {
        throw new Error(`活跃分片组数量超限（最大 ${this.#maxActiveJobs}）`);
      }

      entry = { total, pieces: new Map(), updateTime: Date.now(), totalBytes: 0 };
      this.#cache.set(id, entry);
    }

    // 校验累积字节大小（减去被覆盖分片的旧数据）
    const oldFragment = entry.pieces.get(index);
    const oldBytes = oldFragment ? Buffer.byteLength(oldFragment, 'utf-8') : 0;
    const newTotalBytes = entry.totalBytes - oldBytes + fragmentBytes;

    if (newTotalBytes > this.#maxAssembledBytes) {
      // 清理该分片组，防止攻击者逐步积累
      this.#cache.delete(id);
      throw new Error(`组装数据大小超限（最大 ${this.#maxAssembledBytes} 字节），分片组已清理`);
    }

    entry.pieces.set(index, htmlFragment);
    entry.totalBytes = newTotalBytes;
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
