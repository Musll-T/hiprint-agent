<template>
  <n-config-provider :theme="theme">
    <n-message-provider>
      <router-view v-if="route.meta.guest" />
      <MainLayout v-else />
    </n-message-provider>
  </n-config-provider>
</template>

<script setup>
/**
 * App - 根组件
 *
 * 集成 Naive UI 主题配置和消息通知。
 * guest 路由（登录页）直接渲染 router-view，其他路由委托给 MainLayout。
 */
import { NConfigProvider, NMessageProvider } from 'naive-ui';
import { useRoute } from 'vue-router';
import { useTheme } from './composables/useTheme.js';
import MainLayout from './components/layout/MainLayout.vue';

const { theme } = useTheme();
const route = useRoute();
</script>
