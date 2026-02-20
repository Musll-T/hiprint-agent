<template>
  <aside class="sidebar">
    <!-- Logo -->
    <div class="sidebar-header">
      <div class="sidebar-logo">
        <div class="sidebar-logo-icon">
          <Printer :size="18" color="#fff" />
        </div>
        <div class="sidebar-logo-text">
          <h3>HiPrint Agent</h3>
          <small>ADMIN PANEL</small>
        </div>
      </div>
    </div>

    <!-- 导航 -->
    <nav class="sidebar-nav">
      <button
        v-for="item in navItems"
        :key="item.path"
        class="sidebar-btn"
        :class="{ active: isActive(item.path) }"
        :aria-current="isActive(item.path) ? 'page' : undefined"
        :aria-label="item.label"
        @click="navigate(item.path)"
      >
        <span class="tab-icon" aria-hidden="true">
          <component :is="item.icon" :size="18" />
        </span>
        {{ item.label }}
      </button>
    </nav>

    <!-- 底部 -->
    <div class="sidebar-footer">
      <span class="conn-dot" :class="{ connected: isConnected }"></span>
      <small>{{ isConnected ? '已连接' : '未连接' }}</small>
      <small style="margin-left: auto;">v1.0</small>
      <button class="logout-btn" title="登出" aria-label="登出" @click="handleLogout">
        <LogOut :size="16" />
      </button>
    </div>
  </aside>
</template>

<script setup>
/**
 * Sidebar - 桌面端侧边栏导航
 *
 * 从旧版 index.html 的侧边栏结构迁移。
 * 6 个导航项 + 底部连接状态 + 登出按钮。
 */
import { useRouter, useRoute } from 'vue-router';
import {
  LayoutDashboard,
  Printer,
  FileText,
  Wrench,
  Settings,
  ScrollText,
  LogOut,
} from 'lucide-vue-next';
import { useSocket } from '../../composables/useSocket.js';
import { useAuthStore } from '../../stores/auth.js';

const router = useRouter();
const route = useRoute();
const { isConnected } = useSocket();
const authStore = useAuthStore();

const navItems = [
  { path: '/dashboard', label: '仪表盘', icon: LayoutDashboard },
  { path: '/printers', label: '打印机', icon: Printer },
  { path: '/jobs', label: '任务', icon: FileText },
  { path: '/maintenance', label: '维护', icon: Wrench },
  { path: '/settings', label: '配置', icon: Settings },
  { path: '/logs', label: '日志', icon: ScrollText },
];

function isActive(path) {
  return route.path === path;
}

function navigate(path) {
  router.push(path);
}

function handleLogout() {
  authStore.logout();
}
</script>

<style scoped>
.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: var(--sidebar-width);
  background-color: var(--bg-surface);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  z-index: 100;
}

/* Logo */
.sidebar-header {
  padding: 24px 20px 20px;
  border-bottom: 1px solid var(--border-subtle);
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 12px;
}

.sidebar-logo-icon {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  background: linear-gradient(135deg, var(--accent), #6366f1);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.sidebar-logo-text h3 {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.2;
}

.sidebar-logo-text small {
  color: var(--text-tertiary);
  font-size: 11px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

/* 导航 */
.sidebar-nav {
  flex: 1;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sidebar-btn {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-tertiary);
  font-size: 14px;
  font-family: inherit;
  font-weight: 400;
  cursor: pointer;
  transition: all var(--transition-fast);
  width: 100%;
  text-align: left;
}

.sidebar-btn:hover {
  background-color: var(--bg-elevated);
  color: var(--text-primary);
}

.sidebar-btn.active {
  background-color: var(--accent-soft);
  color: var(--accent);
}

/* 左侧蓝色指示条 */
.sidebar-btn.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 20px;
  background-color: var(--accent);
  border-radius: 1px;
}

.sidebar-btn .tab-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

/* 底部 */
.sidebar-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  gap: 10px;
}

.sidebar-footer small {
  color: var(--text-tertiary);
  font-size: 12px;
}

.conn-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--color-failed);
  flex-shrink: 0;
  transition: background-color var(--transition-base);
}

.conn-dot.connected {
  background-color: var(--color-done);
}

.logout-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.logout-btn:hover {
  background-color: var(--bg-elevated);
  color: var(--text-primary);
}
</style>
