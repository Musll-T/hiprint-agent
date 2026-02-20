/**
 * Auth Store - 认证状态管理
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { router, resetAuthCache } from '../router/index.js';
import { postJSON } from '../composables/useApi.js';

export const useAuthStore = defineStore('auth', () => {
  // ------------------------------------------------------------------
  // State
  // ------------------------------------------------------------------

  /** 是否已认证 */
  const authenticated = ref(false);

  // ------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------

  /**
   * 登录
   * @param {string} username
   * @param {string} password
   */
  async function login(username, password) {
    await postJSON('/api/login', { username, password });
    authenticated.value = true;
  }

  /** 登出 */
  async function logout() {
    try {
      await postJSON('/api/logout');
    } catch {
      // 即使请求失败也执行跳转
    }
    authenticated.value = false;
    resetAuthCache();
    router.push('/login');
  }

  return {
    authenticated,
    login,
    logout,
  };
});
