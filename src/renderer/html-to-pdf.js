/**
 * html-to-pdf.js - HTML 转 PDF 渲染
 *
 * 使用 Playwright 将 HTML 内容渲染为 PDF Buffer。
 * 支持页面尺寸、边距、横向、缩放等选项，对齐 electron-hiprint 的 printToPDF 功能。
 */

import { getLogger } from '../logger.js';
import { injectResources } from './resources.js';

/**
 * 条码/二维码渲染等待策略：
 * 优先等待网络空闲后检测 bwip-js/JsBarcode 渲染完成（最多 RENDER_SETTLE_MAX_MS），
 * 最少等待 RENDER_SETTLE_MIN_MS 以覆盖简单 canvas 绘制场景。
 */
const RENDER_SETTLE_MIN_MS = 50;
const RENDER_SETTLE_MAX_MS = 500;

/**
 * 将 pageSize 字符串或对象映射为 Playwright pdf() 的 format / width+height 参数
 *
 * @param {string | { width: number|string, height: number|string }} pageSize
 * @returns {object} 包含 format 或 width/height 的对象
 */
function resolvePageSize(pageSize) {
  if (!pageSize) {
    return { format: 'A4' };
  }

  // 对象形式：直接透传 width/height
  if (typeof pageSize === 'object' && pageSize.width && pageSize.height) {
    return { width: pageSize.width, height: pageSize.height };
  }

  // 字符串形式：标准纸张格式
  const KNOWN_FORMATS = [
    'Letter', 'Legal', 'Tabloid', 'Ledger',
    'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6',
  ];

  const normalized = String(pageSize);
  const matched = KNOWN_FORMATS.find(
    (f) => f.toLowerCase() === normalized.toLowerCase()
  );

  return { format: matched || 'A4' };
}

/**
 * 将 margins 选项映射为 Playwright pdf() 的 margin 参数
 *
 * @param {object} [margins] - 边距配置
 * @param {number|string} [margins.top=0]
 * @param {number|string} [margins.bottom=0]
 * @param {number|string} [margins.left=0]
 * @param {number|string} [margins.right=0]
 * @returns {object} Playwright margin 参数
 */
function resolveMargins(margins) {
  if (!margins) {
    return { top: '0px', bottom: '0px', left: '0px', right: '0px' };
  }

  const normalize = (val) => {
    if (val === undefined || val === null) return '0px';
    if (typeof val === 'number') return `${val}px`;
    return String(val);
  };

  return {
    top: normalize(margins.top),
    bottom: normalize(margins.bottom),
    left: normalize(margins.left),
    right: normalize(margins.right),
  };
}

/**
 * 渲染 HTML 为 PDF
 *
 * @param {object} pool - 由 createBrowserPool() 创建的浏览器池实例
 * @param {string} html - 待渲染的 HTML 内容
 * @param {object} [options] - 渲染选项
 * @param {string|object} [options.pageSize='A4'] - 页面尺寸，字符串格式名或 { width, height }
 * @param {object} [options.margins] - 页面边距 { top, bottom, left, right }
 * @param {boolean} [options.landscape=false] - 是否横向
 * @param {number} [options.scale=1] - 缩放比例（0.1-2）
 * @param {boolean} [options.printBackground=true] - 是否打印背景
 * @param {string} [options.headerTemplate] - 页眉 HTML 模板
 * @param {string} [options.footerTemplate] - 页脚 HTML 模板
 * @returns {Promise<{ buffer: Buffer, duration: number }>} PDF Buffer 和渲染耗时（毫秒）
 */
export async function renderPDF(pool, html, options = {}) {
  const log = getLogger();
  const startTime = Date.now();

  const { page, release } = await pool.acquirePage();

  try {
    // 设置 HTML 内容，等待网络空闲
    await page.setContent(html, { waitUntil: 'networkidle' });

    // 注入条码/二维码等依赖资源
    await injectResources(page);

    // 等待条码/二维码等异步渲染完成（智能等待：检测 canvas/svg 元素渲染就绪）
    await page.waitForFunction(
      () => {
        // 检测所有 canvas 元素是否已有内容（bwip-js/JsBarcode 渲染到 canvas）
        const canvases = document.querySelectorAll('canvas');
        for (const c of canvases) {
          if (c.width === 0 || c.height === 0) return false;
        }
        return true;
      },
      { timeout: RENDER_SETTLE_MAX_MS }
    ).catch(() => {
      // 超时不中断，继续生成 PDF
    });
    // 最少等待一小段时间确保简单 canvas 绘制完成
    await page.waitForTimeout(RENDER_SETTLE_MIN_MS);

    // 构建 Playwright pdf() 参数
    const pageSizeOpts = resolvePageSize(options.pageSize);
    const marginOpts = resolveMargins(options.margins);

    const pdfOptions = {
      ...pageSizeOpts,
      margin: marginOpts,
      landscape: options.landscape ?? false,
      scale: Math.max(0.1, Math.min(2, options.scale ?? 1)),
      printBackground: options.printBackground ?? true,
    };

    // 页眉页脚（需要同时提供 displayHeaderFooter 才生效）
    if (options.headerTemplate || options.footerTemplate) {
      pdfOptions.displayHeaderFooter = true;
      pdfOptions.headerTemplate = options.headerTemplate || '<span></span>';
      pdfOptions.footerTemplate = options.footerTemplate || '<span></span>';
    }

    const buffer = await page.pdf(pdfOptions);
    const duration = Date.now() - startTime;

    log.debug({ duration, size: buffer.length }, 'PDF 渲染完成');

    return { buffer, duration };
  } catch (err) {
    log.error({ err }, 'PDF 渲染失败');
    throw err;
  } finally {
    release();
  }
}
