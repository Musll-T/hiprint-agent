<template>
  <div class="app-shell">
    <!-- 桌面端侧边栏 -->
    <Sidebar v-if="!isMobile" />

    <!-- 主内容区 -->
    <main class="main-content" :class="{ 'with-sidebar': !isMobile }">
      <!-- 移动端顶部标题栏 -->
      <div v-if="isMobile" class="mobile-header">
        <h4>{{ currentTitle }}</h4>
        <span class="conn-dot" :class="{ connected: isConnected }"></span>
      </div>

      <router-view />

      <!-- 移动端底部留白（避免被底部导航遮挡） -->
      <div v-if="isMobile" class="bottom-spacer"></div>
    </main>

    <!-- 移动端底部导航 -->
    <MobileNav v-if="isMobile" />
  </div>
</template>

<script setup>
/**
 * MainLayout - 主布局容器
 *
 * 桌面端：左侧 Sidebar + 右侧 router-view
 * 移动端：顶部标题 + router-view + 底部 MobileNav
 *
 * 负责初始化 WebSocket 连接并绑定事件到各 Pinia store。
 */
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';

import Sidebar from './Sidebar.vue';
import MobileNav from './MobileNav.vue';
import { useSocket } from '../../composables/useSocket.js';
import { useSystemStore } from '../../stores/system.js';
import { usePrinterStore } from '../../stores/printers.js';
import { useJobStore } from '../../stores/jobs.js';

const route = useRoute();
const { isConnected, on, off } = useSocket();
const systemStore = useSystemStore();
const printerStore = usePrinterStore();
const jobStore = useJobStore();

// ------------------------------------------------------------------
// 响应式断点
// ------------------------------------------------------------------

const isMobile = ref(window.innerWidth < 768);
let resizeHandler = null;

// ------------------------------------------------------------------
// 页面标题映射（移动端顶部显示）
// ------------------------------------------------------------------

const titleMap = {
  '/dashboard': '仪表盘',
  '/printers': '打印机',
  '/jobs': '任务',
  '/maintenance': '维护',
  '/settings': '配置',
  '/logs': '日志',
};

const currentTitle = computed(() => titleMap[route.path] || 'HiPrint Agent');

// ------------------------------------------------------------------
// WebSocket 事件处理
// ------------------------------------------------------------------

function onSysStats(stats) {
  systemStore.updateStats(stats);
}

function onJobUpdate(job) {
  jobStore.updateJob(job);
}

function onPrinterUpdate(data) {
  if (data && Array.isArray(data.printers)) {
    printerStore.setPrinters(data.printers);
  }
}

// ------------------------------------------------------------------
// 生命周期
// ------------------------------------------------------------------

onMounted(() => {
  // 响应式监听
  resizeHandler = () => {
    isMobile.value = window.innerWidth < 768;
  };
  window.addEventListener('resize', resizeHandler);

  // 绑定 WebSocket 事件到 stores
  on('sys:stats', onSysStats);
  on('job:update', onJobUpdate);
  on('printer:update', onPrinterUpdate);

  // 初始加载系统状态
  systemStore.loadStatus();
});

onUnmounted(() => {
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
  }
  off('sys:stats', onSysStats);
  off('job:update', onJobUpdate);
  off('printer:update', onPrinterUpdate);
});
</script>

<style scoped>
.app-shell {
  display: flex;
  min-height: 100vh;
  width: 100%;
}

.main-content {
  flex: 1;
  padding: 32px;
  min-width: 0;
  box-sizing: border-box;
}

.main-content.with-sidebar {
  margin-left: var(--sidebar-width);
}

/* 移动端标题栏 */
.mobile-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 20px;
  margin-bottom: 20px;
}

.mobile-header h4 {
  font-size: 18px;
  font-weight: 600;
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

.bottom-spacer {
  height: calc(var(--bottom-nav-height) + 20px);
}

@media (max-width: 767px) {
  .main-content {
    padding: 20px 16px;
  }
}
</style>
