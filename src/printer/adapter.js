/**
 * 打印适配器模块
 *
 * 面向 Job Manager 的高级打印接口，封装 CUPS 命令和选项映射，
 * 并提供兼容 electron-hiprint 格式的打印机列表。
 */

import * as cups from './cups.js';
import { mapOptions } from './options.js';
import { getLogger } from '../logger.js';

/**
 * 将 CUPS 状态字符串映射为 electron-hiprint 兼容的数字状态码
 * @param {string} status - CUPS 状态：'idle' | 'printing' | 'stopped'
 * @returns {number} 0=就绪, 1=打印中, 2=已停止, 3=未知
 */
function mapStatusToNumber(status) {
  switch (status) {
    case 'idle':
      return 0;
    case 'printing':
      return 1;
    case 'stopped':
      return 2;
    default:
      return 3;
  }
}

/**
 * 创建打印适配器实例
 *
 * @param {object} [adapterConfig={}] - 适配器配置
 * @param {string} [adapterConfig.defaultPrinter] - 默认打印机名称，未指定时使用系统默认
 * @returns {{ print, getPrinters, getPrinterStatus, cancelJob }} 适配器对象
 */
export function createPrinterAdapter(adapterConfig = {}) {
  const log = getLogger();

  /**
   * 提交打印任务
   * @param {string} pdfPath - 待打印 PDF 文件的绝对路径
   * @param {string} [printer] - 目标打印机名称，不传则使用配置中的默认打印机
   * @param {object} [printOptions={}] - hiprint 打印参数
   * @returns {Promise<{ jobId: string, printer: string }>}
   */
  async function print(pdfPath, printer, printOptions = {}) {
    // 确定目标打印机：参数指定 > 配置默认 > 系统默认
    let targetPrinter = printer;

    if (!targetPrinter) {
      targetPrinter = adapterConfig.defaultPrinter;
    }

    if (!targetPrinter) {
      // 尝试获取系统默认打印机
      const printers = await cups.listPrinters();
      const defaultOne = printers.find((p) => p.isDefault);
      if (defaultOne) {
        targetPrinter = defaultOne.name;
      }
    }

    if (!targetPrinter) {
      throw new Error('未指定打印机且未找到系统默认打印机');
    }

    // 生成 lp 命令选项
    const lpOptions = mapOptions(printOptions);

    log.debug({ pdfPath, printer: targetPrinter, lpOptions }, '准备提交打印任务');

    const result = await cups.printFile(pdfPath, targetPrinter, lpOptions);

    return {
      jobId: result.jobId,
      printer: targetPrinter,
    };
  }

  /**
   * 获取所有打印机列表，格式兼容 electron-hiprint
   * @returns {Promise<Array<{
   *   name: string,
   *   displayName: string,
   *   isDefault: boolean,
   *   status: number,
   *   description: string,
   *   options: object
   * }>>}
   */
  async function getPrinters() {
    const cupsPrinters = await cups.listPrinters();

    return cupsPrinters.map((p) => ({
      name: p.name,
      displayName: p.name,
      isDefault: p.isDefault,
      status: mapStatusToNumber(p.status),
      description: p.description,
      location: p.location || '',
      options: {},
    }));
  }

  /**
   * 获取指定打印机的标准化状态
   * @param {string} name - 打印机名称
   * @returns {Promise<{ name: string, status: number, statusText: string, description: string } | null>}
   */
  async function getPrinterStatus(name) {
    const result = await cups.getPrinterStatus(name);
    if (!result) return null;

    return {
      name: result.name,
      status: mapStatusToNumber(result.status),
      statusText: result.status,
      description: result.description,
    };
  }

  /**
   * 取消打印任务
   * @param {string} jobId - 任务 ID
   * @returns {Promise<{ success: boolean }>}
   */
  async function cancelJob(jobId) {
    return cups.cancelJob(jobId);
  }

  return {
    print,
    getPrinters,
    getPrinterStatus,
    cancelJob,
  };
}
