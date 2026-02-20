/**
 * Printers Store - 打印机列表管理
 *
 * 完整迁移 app.js 中所有打印机相关状态和操作。
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { fetchJSON, postJSON, putJSON, deleteJSON } from '../composables/useApi.js';

export const usePrinterStore = defineStore('printers', () => {
  // ------------------------------------------------------------------
  // State
  // ------------------------------------------------------------------

  /** 打印机列表 */
  const printers = ref([]);

  // ------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------

  /** 加载打印机列表 */
  async function loadPrinters() {
    try {
      const data = await fetchJSON('/api/printers');
      printers.value = data.printers || [];
    } catch (err) {
      console.error('加载打印机列表失败:', err);
    }
  }

  /**
   * 添加打印机
   * @param {object} form - { name, deviceUri, model?, description?, location? }
   */
  async function addPrinter(form) {
    await postJSON('/api/printers', {
      name: form.name.trim(),
      deviceUri: form.deviceUri.trim(),
      model: form.model?.trim() || undefined,
      description: form.description?.trim() || undefined,
      location: form.location?.trim() || undefined,
    });
    await loadPrinters();
  }

  /**
   * 修改打印机配置
   * @param {string} name - 打印机名称
   * @param {object} body - { description?, location?, deviceUri? }
   */
  async function updatePrinter(name, body) {
    await putJSON('/api/printers/' + encodeURIComponent(name), body);
    await loadPrinters();
  }

  /**
   * 删除打印机
   * @param {string} name - 打印机名称
   */
  async function deletePrinter(name) {
    await deleteJSON('/api/printers/' + encodeURIComponent(name));
    await loadPrinters();
  }

  /**
   * 设为默认打印机
   * @param {string} name - 打印机名称
   */
  async function setDefault(name) {
    await postJSON('/api/printers/' + encodeURIComponent(name) + '/default');
    await loadPrinters();
  }

  /**
   * 启用打印机
   * @param {string} name - 打印机名称
   */
  async function enable(name) {
    await postJSON('/api/printers/' + encodeURIComponent(name) + '/enable');
    await loadPrinters();
  }

  /**
   * 停用打印机
   * @param {string} name - 打印机名称
   */
  async function disable(name) {
    await postJSON('/api/printers/' + encodeURIComponent(name) + '/disable');
    await loadPrinters();
  }

  /**
   * 直接更新打印机列表（由 WebSocket printer:update 事件触发）
   * @param {Array} list - 打印机列表
   */
  function setPrinters(list) {
    printers.value = list;
  }

  return {
    printers,
    loadPrinters,
    addPrinter,
    updatePrinter,
    deletePrinter,
    setDefault,
    enable,
    disable,
    setPrinters,
  };
});
