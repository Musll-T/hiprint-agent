/**
 * Vue Router 配置
 *
 * 使用 Hash 模式路由，避免 Express 静态服务 history fallback 问题。
 * 登录页通过 meta.guest 标记，路由守卫据此决定是否需要认证检查。
 */

import { createRouter, createWebHashHistory } from 'vue-router';

/** 认证状态缓存，避免每次导航都请求后端 */
let authChecked = false;

const routes = [
  {
    path: '/login',
    component: () => import('../views/LoginView.vue'),
    meta: { guest: true },
  },
  { path: '/', redirect: '/dashboard' },
  {
    path: '/dashboard',
    component: () => import('../views/DashboardView.vue'),
  },
  {
    path: '/printers',
    component: () => import('../views/PrinterListView.vue'),
  },
  {
    path: '/jobs',
    component: () => import('../views/JobListView.vue'),
  },
  {
    path: '/maintenance',
    component: () => import('../views/MaintenanceView.vue'),
  },
  {
    path: '/settings',
    component: () => import('../views/SettingsView.vue'),
  },
  {
    path: '/logs',
    component: () => import('../views/LogsView.vue'),
  },
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

/**
 * 路由守卫：guest 路由直接放行，其他路由首次进入时检测 session 有效性
 */
router.beforeEach(async (to) => {
  if (to.meta.guest) return true;

  if (authChecked) return true;

  try {
    const res = await fetch('/api/status');
    if (res.ok) {
      authChecked = true;
      return true;
    }
    return '/login';
  } catch {
    return '/login';
  }
});

/** 重置认证缓存（供 logout 时调用） */
export function resetAuthCache() {
  authChecked = false;
}
