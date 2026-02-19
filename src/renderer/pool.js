/**
 * pool.js - Playwright 浏览器池管理
 *
 * 管理 Chromium 浏览器实例和页面复用，通过池化降低频繁创建/销毁页面的开销。
 * 使用信号量控制最大并发页面数，使用计数器追踪页面复用次数。
 */

import { chromium } from 'playwright';
import { getLogger } from '../logger.js';
import { config } from '../config.js';

/** 等待获取页面的默认超时时间（毫秒） */
const ACQUIRE_TIMEOUT_MS = 30000;

/**
 * 创建浏览器池
 *
 * @param {object} [options] - 池配置选项
 * @param {number} [options.poolSize] - 最大并发页面数，默认取 config.browserPoolSize
 * @param {number} [options.pageReuseLimit] - 单个页面最大复用次数，默认取 config.pageReuseLimit
 * @returns {object} 浏览器池对象，包含 init / acquirePage / close 方法
 */
export function createBrowserPool(options = {}) {
  const log = getLogger();

  const poolSize = options.poolSize ?? config.browserPoolSize ?? 4;
  const pageReuseLimit = options.pageReuseLimit ?? config.pageReuseLimit ?? 50;

  /** @type {import('playwright').Browser | null} */
  let browser = null;

  /**
   * 页面包装对象
   * @typedef {object} PageEntry
   * @property {import('playwright').Page} page - Playwright 页面实例
   * @property {number} useCount - 已使用次数
   * @property {boolean} idle - 是否处于空闲状态
   */

  /** @type {Set<PageEntry>} */
  const pages = new Set();

  /** 当前正在使用中的页面数 */
  let activeCount = 0;

  /** 等待获取页面的回调队列（信号量实现） */
  const waitQueue = [];

  /**
   * 初始化浏览器实例
   * 使用 headless 模式启动 Chromium，附带安全和性能相关启动参数
   */
  async function init() {
    log.info({ poolSize, pageReuseLimit }, '正在启动 Chromium 浏览器池');

    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    log.info('Chromium 浏览器池启动完成');
  }

  /**
   * 创建新的页面条目
   * @returns {Promise<PageEntry>}
   */
  async function createPageEntry() {
    if (!browser) {
      throw new Error('浏览器未初始化，请先调用 init()');
    }

    const page = await browser.newPage();
    const entry = { page, useCount: 0, idle: true };
    pages.add(entry);
    return entry;
  }

  /**
   * 销毁指定页面条目
   * @param {PageEntry} entry - 待销毁的页面条目
   */
  async function destroyPageEntry(entry) {
    pages.delete(entry);
    try {
      await entry.page.close();
    } catch (err) {
      log.warn({ err }, '关闭页面时出错');
    }
  }

  /**
   * 获取一个可用页面
   *
   * 优先复用空闲且未超过复用上限的页面；若无可用页面且未达并发上限，
   * 则创建新页面；否则进入等待队列直到有页面归还。
   *
   * @returns {Promise<{ page: import('playwright').Page, release: () => void }>}
   *   返回页面实例和释放函数，调用 release() 将页面归还到池中
   */
  async function acquirePage() {
    if (!browser) {
      throw new Error('浏览器未初始化，请先调用 init()');
    }

    // 尝试从池中找到空闲且未超限的页面
    let reusable = null;
    for (const e of pages) {
      if (e.idle && e.useCount < pageReuseLimit) {
        reusable = e;
        break;
      }
    }

    if (reusable) {
      reusable.idle = false;
      reusable.useCount++;
      activeCount++;
      return wrapPageEntry(reusable);
    }

    // 池中无可复用页面，但并发数未满，创建新页面
    if (activeCount < poolSize) {
      const entry = await createPageEntry();
      entry.idle = false;
      entry.useCount++;
      activeCount++;
      return wrapPageEntry(entry);
    }

    // 并发数已满，进入等待队列（带超时保护）
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        // 超时后从队列中移除
        const idx = waitQueue.indexOf(waiter);
        if (idx !== -1) waitQueue.splice(idx, 1);
        reject(new Error(`获取页面超时（${ACQUIRE_TIMEOUT_MS}ms），浏览器池已满`));
      }, ACQUIRE_TIMEOUT_MS);

      const waiter = (result) => {
        clearTimeout(timer);
        resolve(result);
      };
      waitQueue.push(waiter);
    });
  }

  /**
   * 包装页面条目为对外返回的格式，附带 release 函数
   * @param {PageEntry} entry
   * @returns {{ page: import('playwright').Page, release: () => void }}
   */
  function wrapPageEntry(entry) {
    let released = false;

    return {
      page: entry.page,
      release: () => {
        // 防止重复释放
        if (released) return;
        released = true;
        releaseEntry(entry);
      },
    };
  }

  /**
   * 归还页面条目到池中
   *
   * 如果页面使用次数已达上限，销毁并重建；
   * 如果有等待者，直接分配给下一个等待者。
   *
   * @param {PageEntry} entry
   */
  async function releaseEntry(entry) {
    activeCount--;

    // 页面使用次数超限，需要销毁并重建
    if (entry.useCount >= pageReuseLimit) {
      await destroyPageEntry(entry);

      // 如果有等待者，创建新页面分配给它
      if (waitQueue.length > 0) {
        const waiter = waitQueue.shift();
        try {
          const newEntry = await createPageEntry();
          newEntry.idle = false;
          newEntry.useCount++;
          activeCount++;
          waiter(wrapPageEntry(newEntry));
        } catch (err) {
          log.error({ err }, '为等待者创建新页面失败');
        }
      }
      return;
    }

    // 页面仍可复用
    entry.idle = true;

    // 如果有等待者，立即将此页面分配给它
    if (waitQueue.length > 0) {
      const waiter = waitQueue.shift();
      entry.idle = false;
      entry.useCount++;
      activeCount++;
      waiter(wrapPageEntry(entry));
    }
  }

  /**
   * 关闭浏览器池，释放所有资源
   */
  async function close() {
    log.info('正在关闭浏览器池');

    // 清空等待队列（拒绝所有等待者不太友好，这里不处理是因为 close 应该在服务停止时调用）
    waitQueue.length = 0;

    // 关闭所有页面
    for (const entry of pages) {
      try {
        await entry.page.close();
      } catch {
        // 忽略关闭错误
      }
    }
    pages.clear();
    activeCount = 0;

    // 关闭浏览器
    if (browser) {
      try {
        await browser.close();
      } catch (err) {
        log.warn({ err }, '关闭浏览器实例时出错');
      }
      browser = null;
    }

    log.info('浏览器池已关闭');
  }

  return {
    init,
    acquirePage,
    close,
  };
}
