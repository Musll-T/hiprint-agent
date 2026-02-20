/**
 * Ports 抽象层 — 定义核心业务依赖的外部能力接口
 *
 * 通过 JSDoc 类型声明定义 Port 契约，配合适配器工厂函数
 * 将现有基础设施实现桥接为统一的 Port 接口。
 *
 * JobManager 仅依赖 Port 接口，不直接耦合具体渲染/打印实现。
 */

import { renderPDF } from '../renderer/html-to-pdf.js';
import { renderJPEG } from '../renderer/html-to-jpeg.js';

/**
 * 渲染能力端口
 *
 * @typedef {object} RendererPort
 * @property {(html: string, options: object, signal?: AbortSignal) => Promise<{buffer: Buffer, duration: number, pageNum?: number}>} renderPdf
 * @property {(html: string, options: object, signal?: AbortSignal) => Promise<{buffer: Buffer, duration: number}>} renderJpeg
 */

/**
 * 打印能力端口
 *
 * @typedef {object} PrinterPort
 * @property {(pdfPath: string, printer: string, options: object) => Promise<{jobId: string, printer: string}>} print
 * @property {() => Promise<Array>} getPrinters
 */

/**
 * 将浏览器池适配为 RendererPort
 *
 * @param {object} browserPool - createBrowserPool() 返回的浏览器池实例
 * @returns {RendererPort}
 */
export function createRendererAdapter(browserPool) {
  return {
    renderPdf(html, options, signal) {
      return renderPDF(browserPool, html, options, signal);
    },
    renderJpeg(html, options, signal) {
      return renderJPEG(browserPool, html, options, signal);
    },
  };
}

/**
 * 将打印适配器适配为 PrinterPort
 *
 * 当前 printerAdapter 接口与 PrinterPort 已对齐，直接转发。
 *
 * @param {object} printerAdapter - createPrinterAdapter() 返回的打印适配器
 * @returns {PrinterPort}
 */
export function createPrinterPortAdapter(printerAdapter) {
  return {
    print(pdfPath, printer, options) {
      return printerAdapter.print(pdfPath, printer, options);
    },
    getPrinters() {
      return printerAdapter.getPrinters();
    },
  };
}
