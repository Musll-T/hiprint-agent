/**
 * 打印机管理服务
 *
 * 提供打印机增删改操作的安全封装，包含输入校验、审计日志。
 * 面向 API 路由层使用。
 */

import * as cups from './cups.js';
import { addAuditLog } from '../jobs/store.js';
import { getLogger } from '../logger.js';

/** 打印机名称合法性正则：字母、数字、下划线、短横线，1-127 字符 */
const PRINTER_NAME_RE = /^[a-zA-Z0-9_-]{1,127}$/;

/** 允许的 URI 协议白名单 */
const ALLOWED_URI_PROTOCOLS = new Set([
  'ipp',
  'ipps',
  'socket',
  'lpd',
  'usb',
  'http',
  'https',
]);

/**
 * 校验打印机名称
 * @param {string} name
 * @throws {Error} 名称不合法时抛出
 */
function validatePrinterName(name) {
  if (!name || typeof name !== 'string') {
    throw new Error('打印机名称不能为空');
  }
  if (!PRINTER_NAME_RE.test(name)) {
    throw new Error(
      '打印机名称只能包含字母、数字、下划线和短横线，长度 1-127'
    );
  }
}

/**
 * 校验设备 URI
 * @param {string} uri
 * @throws {Error} URI 不合法时抛出
 */
function validateDeviceUri(uri) {
  if (!uri || typeof uri !== 'string') {
    throw new Error('设备 URI 不能为空');
  }
  try {
    const parsed = new URL(uri);
    const protocol = parsed.protocol.replace(':', '');
    if (!ALLOWED_URI_PROTOCOLS.has(protocol)) {
      throw new Error(
        `不支持的 URI 协议: ${protocol}，允许: ${[...ALLOWED_URI_PROTOCOLS].join(', ')}`
      );
    }
  } catch (err) {
    // 区分自定义的协议校验错误与 URL 解析错误
    if (err.message.includes('不支持的 URI')) throw err;
    throw new Error(`设备 URI 格式无效: ${uri}`);
  }
}

/**
 * 创建打印机管理服务实例
 *
 * @returns {{ add, update, remove, setDefault, enable, disable }}
 */
export function createPrinterAdmin() {
  const log = getLogger();

  /**
   * 添加打印机
   * @param {{ name: string, deviceUri: string, model?: string, description?: string, location?: string }} params
   * @returns {Promise<{ success: boolean }>}
   */
  async function add({ name, deviceUri, model, description, location }) {
    validatePrinterName(name);
    validateDeviceUri(deviceUri);

    const result = await cups.addPrinter({
      name,
      deviceUri,
      model,
      description,
      location,
      enabled: true,
    });

    log.info({ name, deviceUri }, '打印机已添加');
    addAuditLog(null, 'printer_add', `添加打印机: ${name}, URI: ${deviceUri}`);
    return result;
  }

  /**
   * 更新打印机配置
   * @param {string} name - 打印机名称
   * @param {{ description?: string, location?: string, deviceUri?: string }} params
   * @returns {Promise<{ success: boolean }>}
   */
  async function update(name, params) {
    validatePrinterName(name);
    if (params.deviceUri) {
      validateDeviceUri(params.deviceUri);
    }

    const result = await cups.modifyPrinter(name, params);

    log.info({ name, params }, '打印机已更新');
    addAuditLog(null, 'printer_update', `更新打印机: ${name}`);
    return result;
  }

  /**
   * 删除打印机
   * @param {string} name - 打印机名称
   * @returns {Promise<{ success: boolean }>}
   */
  async function remove(name) {
    validatePrinterName(name);

    const result = await cups.removePrinter(name);

    log.info({ name }, '打印机已删除');
    addAuditLog(null, 'printer_remove', `删除打印机: ${name}`);
    return result;
  }

  /**
   * 设置默认打印机
   * @param {string} name - 打印机名称
   * @returns {Promise<{ success: boolean }>}
   */
  async function setDefault(name) {
    validatePrinterName(name);

    const result = await cups.setDefaultPrinter(name);

    log.info({ name }, '已设为默认打印机');
    addAuditLog(null, 'printer_default', `设置默认打印机: ${name}`);
    return result;
  }

  /**
   * 启用打印机
   * @param {string} name - 打印机名称
   * @returns {Promise<{ success: boolean }>}
   */
  async function enable(name) {
    validatePrinterName(name);

    const result = await cups.enablePrinter(name);

    log.info({ name }, '打印机已启用');
    addAuditLog(null, 'printer_enable', `启用打印机: ${name}`);
    return result;
  }

  /**
   * 停用打印机
   * @param {string} name - 打印机名称
   * @returns {Promise<{ success: boolean }>}
   */
  async function disable(name) {
    validatePrinterName(name);

    const result = await cups.disablePrinter(name);

    log.info({ name }, '打印机已停用');
    addAuditLog(null, 'printer_disable', `停用打印机: ${name}`);
    return result;
  }

  return { add, update, remove, setDefault, enable, disable };
}
