/**
 * Vue Router 配置
 *
 * 使用 Hash 模式路由，避免 Express 静态服务 history fallback 问题。
 */

import { createRouter, createWebHashHistory } from 'vue-router';

const routes = [
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
