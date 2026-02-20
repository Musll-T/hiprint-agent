/**
 * html-to-jpeg.js - HTML 转 JPEG 截图
 *
 * 使用 Playwright 将 HTML 内容渲染为 JPEG 图片 Buffer。
 * 支持自定义视口尺寸和图片质量，对齐 electron-hiprint 的 capturePage 功能。
 */

import { getLogger } from '../logger.js';
import { withSpan } from '../observability/tracing.js';
import { injectResources } from './resources.js';

/** 等待条码/二维码渲染的延迟时间（毫秒） */
const RENDER_SETTLE_DELAY = 200;

/**
 * 渲染 HTML 为 JPEG 图片
 *
 * @param {object} pool - 由 createBrowserPool() 创建的浏览器池实例
 * @param {string} html - 待渲染的 HTML 内容
 * @param {object} [options] - 渲染选项
 * @param {number} [options.width=1200] - 视口宽度（像素）
 * @param {number} [options.height=800] - 视口高度（像素）
 * @param {number} [options.quality=90] - JPEG 质量（1-100）
 * @param {AbortSignal} [signal] - 可选的中止信号，超时时主动关闭页面
 * @returns {Promise<{ buffer: Buffer, duration: number }>} JPEG Buffer 和渲染耗时（毫秒）
 */
export async function renderJPEG(pool, html, options = {}, signal) {
  return withSpan('render.jpeg', { 'render.type': 'jpeg' }, async (span) => {
    const log = getLogger();
    const startTime = Date.now();

    // 若已中止则直接抛错
    if (signal?.aborted) {
      throw new Error('渲染在开始前已被中止');
    }

    const { page, release } = await pool.acquirePage();

    // abort 事件监听器：强制关闭页面以终止 Playwright 操作
    let aborted = false;
    const onAbort = () => {
      aborted = true;
      page.close().catch(() => {});
    };
    signal?.addEventListener('abort', onAbort, { once: true });

    try {
      // 设置视口尺寸
      await page.setViewportSize({
        width: options.width || 1200,
        height: options.height || 800,
      });

      // 设置 HTML 内容，等待网络空闲
      await page.setContent(html, { waitUntil: 'networkidle' });

      // 注入条码/二维码等依赖资源
      await injectResources(page);

      // 等待条码/二维码等异步渲染完成
      await page.waitForTimeout(RENDER_SETTLE_DELAY);

      // 全页截图为 JPEG
      const buffer = await page.screenshot({
        type: 'jpeg',
        quality: Math.max(1, Math.min(100, options.quality || 90)),
        fullPage: true,
      });

      const duration = Date.now() - startTime;

      // 记录 span 属性
      span?.setAttribute('render.duration_ms', duration);
      span?.setAttribute('render.output_bytes', buffer.length);

      log.debug({ duration, size: buffer.length }, 'JPEG 截图完成');

      return { buffer, duration };
    } catch (err) {
      log.error({ err }, 'JPEG 截图失败');
      throw err;
    } finally {
      signal?.removeEventListener('abort', onAbort);
      // 被 abort 的页面已被 close，不可回收，需销毁
      release({ destroy: aborted });
    }
  });
}
