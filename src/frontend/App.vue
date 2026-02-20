<template>
  <n-config-provider :theme="theme">
    <n-message-provider>
      <MainLayout />
    </n-message-provider>
  </n-config-provider>
</template>

<script setup>
/**
 * App - 根组件
 *
 * 集成 Naive UI 主题配置和消息通知，
 * 将路由和布局委托给 MainLayout。
 */
import { NConfigProvider, NMessageProvider } from 'naive-ui';
import { useTheme } from './composables/useTheme.js';
import MainLayout from './components/layout/MainLayout.vue';

const { theme } = useTheme();
</script>
