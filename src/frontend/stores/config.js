/**
 * Config Store - 系统配置管理
 *
 * 完整迁移 app.js 中所有配置相关状态和操作。
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { fetchJSON, putJSON } from '../composables/useApi.js';

export const useConfigStore = defineStore('config', () => {
  // ------------------------------------------------------------------
  // State
  // ------------------------------------------------------------------

  /** 配置表单数据 */
  const config = ref(null);

  /** 原始配置（用于脏检查） */
  const original = ref(null);

  /** 配置加载中 */
  const loading = ref(false);

  /** 配置保存中 */
  const saving = ref(false);

  /** 配置校验错误 */
  const errors = ref({});

  /** 需要重启的字段列表（从 API 返回） */
  const restartRequiredKeys = ref([]);

  /** 密码修改表单 */
  const passwordForm = ref({ newPassword: '', confirmPassword: '' });

  /** 是否展开密码修改区域 */
  const showPasswordSection = ref(false);

  // ------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------

  /** 加载系统配置 */
  async function loadConfig() {
    if (loading.value) return;
    loading.value = true;
    errors.value = {};
    try {
      const data = await fetchJSON('/api/config');
      // 提取元数据
      if (data._meta) {
        restartRequiredKeys.value = data._meta.restartRequired || [];
        delete data._meta;
      }
      // 确保嵌套对象存在
      if (!data.cors) data.cors = { origin: '*', methods: ['GET', 'POST'] };
      if (!data.admin) data.admin = { username: '', password: '' };
      if (!data.ipWhitelist) data.ipWhitelist = [];

      config.value = data;
      original.value = JSON.parse(JSON.stringify(data));
      // 重置密码表单
      passwordForm.value = { newPassword: '', confirmPassword: '' };
      showPasswordSection.value = false;
    } catch (err) {
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 前端校验配置
   * @returns {boolean} 是否通过
   */
  function validateConfig() {
    const errs = {};
    const cfg = config.value;

    if (cfg.port !== undefined && cfg.port !== '') {
      const p = Number(cfg.port);
      if (!Number.isInteger(p) || p < 1024 || p > 65535) {
        errs.port = '端口范围 1024-65535';
      }
    }
    if (cfg.adminPort !== undefined && cfg.adminPort !== '') {
      const p = Number(cfg.adminPort);
      if (!Number.isInteger(p) || p < 1024 || p > 65535) {
        errs.adminPort = '端口范围 1024-65535';
      }
    }
    if (cfg.renderConcurrency !== undefined && cfg.renderConcurrency !== '') {
      const v = Number(cfg.renderConcurrency);
      if (!Number.isInteger(v) || v < 1 || v > 20) {
        errs.renderConcurrency = '范围 1-20';
      }
    }
    if (cfg.printConcurrency !== undefined && cfg.printConcurrency !== '') {
      const v = Number(cfg.printConcurrency);
      if (!Number.isInteger(v) || v < 1 || v > 20) {
        errs.printConcurrency = '范围 1-20';
      }
    }
    if (cfg.browserPoolSize !== undefined && cfg.browserPoolSize !== '') {
      const v = Number(cfg.browserPoolSize);
      if (!Number.isInteger(v) || v < 1 || v > 20) {
        errs.browserPoolSize = '范围 1-20';
      }
    }
    if (cfg.maxQueueSize !== undefined && cfg.maxQueueSize !== '') {
      const v = Number(cfg.maxQueueSize);
      if (!Number.isInteger(v) || v < 1 || v > 10000) {
        errs.maxQueueSize = '范围 1-10000';
      }
    }

    // 密码校验
    if (showPasswordSection.value && passwordForm.value.newPassword) {
      if (passwordForm.value.newPassword.length < 6) {
        errs.newPassword = '密码长度至少 6 个字符';
      }
      if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
        errs.confirmPassword = '两次输入的密码不一致';
      }
    }

    errors.value = errs;
    return Object.keys(errs).length === 0;
  }

  /**
   * 保存配置
   * @returns {Promise<{needRestart: boolean}>}
   */
  async function saveConfig() {
    if (saving.value) return;
    saving.value = true;

    try {
      // 构造 partial 更新对象
      const payload = JSON.parse(JSON.stringify(config.value));

      // 处理密码
      if (showPasswordSection.value && passwordForm.value.newPassword) {
        if (!payload.admin) payload.admin = {};
        payload.admin.password = passwordForm.value.newPassword;
      } else {
        if (payload.admin) {
          delete payload.admin.password;
        }
      }

      const data = await putJSON('/api/config', payload);

      // 刷新配置
      if (data.config) {
        const cfg = data.config;
        if (!cfg.cors) cfg.cors = { origin: '*', methods: ['GET', 'POST'] };
        if (!cfg.admin) cfg.admin = { username: '', password: '' };
        if (!cfg.ipWhitelist) cfg.ipWhitelist = [];
        config.value = cfg;
        original.value = JSON.parse(JSON.stringify(cfg));
      }

      // 重置密码表单
      passwordForm.value = { newPassword: '', confirmPassword: '' };
      showPasswordSection.value = false;

      return { needRestart: !!data.needRestart };
    } finally {
      saving.value = false;
    }
  }

  /**
   * 判断字段是否需要重启
   * @param {string} key - 配置字段名
   * @returns {boolean}
   */
  function isRestartRequired(key) {
    return restartRequiredKeys.value.includes(key);
  }

  return {
    config,
    original,
    loading,
    saving,
    errors,
    restartRequiredKeys,
    passwordForm,
    showPasswordSection,
    loadConfig,
    validateConfig,
    saveConfig,
    isRestartRequired,
  };
});
