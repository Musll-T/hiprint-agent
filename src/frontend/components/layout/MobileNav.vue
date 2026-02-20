<template>
  <nav class="bottom-nav">
    <button
      v-for="item in mobileNavItems"
      :key="item.path"
      class="bottom-nav-btn"
      :class="{ active: isActive(item.path) }"
      @click="navigate(item.path)"
    >
      <span class="tab-icon">
        <component :is="item.icon" :size="20" />
      </span>
      <small>{{ item.label }}</small>
    </button>
  </nav>
</template>

<script setup>
/**
 * MobileNav - 移动端底部导航
 *
 * 从旧版 index.html 的 bottom-nav 迁移。
 * 显示 5 个最重要的导航项（去掉日志）。
 */
import { useRouter, useRoute } from 'vue-router';
import {
  LayoutDashboard,
  Printer,
  FileText,
  Wrench,
  Settings,
} from 'lucide-vue-next';

const router = useRouter();
const route = useRoute();

const mobileNavItems = [
  { path: '/dashboard', label: '仪表盘', icon: LayoutDashboard },
  { path: '/printers', label: '打印机', icon: Printer },
  { path: '/jobs', label: '任务', icon: FileText },
  { path: '/maintenance', label: '维护', icon: Wrench },
  { path: '/settings', label: '配置', icon: Settings },
];

function isActive(path) {
  return route.path === path;
}

function navigate(path) {
  router.push(path);
}
</script>

<style scoped>
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: var(--bottom-nav-height);
  background-color: var(--bg-surface);
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: space-around;
  align-items: center;
  z-index: 100;
  /* iOS safe area */
  padding-bottom: env(safe-area-inset-bottom, 0);
}

.bottom-nav-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border: none;
  background: transparent;
  color: var(--text-quaternary);
  cursor: pointer;
  transition: color var(--transition-fast);
  font-family: inherit;
  -webkit-tap-highlight-color: transparent;
  min-width: 44px;
}

.bottom-nav-btn .tab-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
}

.bottom-nav-btn.active {
  color: var(--accent);
}

.bottom-nav-btn small {
  font-size: 10px;
  font-weight: 500;
}
</style>
