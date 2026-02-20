<template>
  <div v-if="logs" class="cups-log-container">
    <pre ref="logPre" class="cups-log-pre">{{ logs }}</pre>
  </div>
  <n-empty v-else description="点击「获取日志」查看 CUPS 日志" />
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';
import { NEmpty } from 'naive-ui';

const props = defineProps({
  logs: {
    type: String,
    default: '',
  },
});

const logPre = ref(null);

watch(
  () => props.logs,
  async () => {
    if (props.logs && logPre.value) {
      await nextTick();
      logPre.value.scrollTop = logPre.value.scrollHeight;
    }
  },
);
</script>

<style scoped>
.cups-log-container {
  max-height: 400px;
  overflow: auto;
  border-radius: var(--radius-sm);
  background: var(--bg-base);
}

.cups-log-pre {
  margin: 0;
  padding: 12px 16px;
  font-size: 12px;
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  line-height: 1.6;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
