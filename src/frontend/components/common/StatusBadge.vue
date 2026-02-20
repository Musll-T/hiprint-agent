<template>
  <n-tag :type="tagType" :bordered="false" size="small" round>
    {{ label }}
  </n-tag>
</template>

<script setup>
/**
 * StatusBadge - 通用状态标签
 *
 * 将任务/打印机状态映射为 Naive UI Tag 类型和中文标签。
 */
import { computed } from 'vue';
import { NTag } from 'naive-ui';

const props = defineProps({
  /** 状态值 */
  status: { type: String, default: '' },
});

/** 状态 -> { label, type } 映射表 */
const STATUS_MAP = {
  // 任务状态
  done: { label: '完成', type: 'success' },
  printing: { label: '打印中', type: 'info' },
  rendering: { label: '渲染中', type: 'info' },
  received: { label: '已接收', type: 'warning' },
  failed_render: { label: '渲染失败', type: 'error' },
  failed_print: { label: '打印失败', type: 'error' },
  canceled: { label: '已取消', type: 'default' },
  timeout: { label: '超时', type: 'error' },
  // 打印机状态
  idle: { label: '就绪', type: 'success' },
  stopped: { label: '已停用', type: 'default' },
};

const resolved = computed(() => {
  const s = props.status?.toLowerCase() || '';

  // 精确匹配
  if (STATUS_MAP[s]) return STATUS_MAP[s];

  // 模糊匹配（打印机状态可能包含多个词）
  if (s.includes('idle')) return STATUS_MAP.idle;
  if (s.includes('printing') || s.includes('processing'))
    return { label: '打印中', type: 'info' };

  return { label: s || '未知', type: 'default' };
});

const tagType = computed(() => resolved.value.type);
const label = computed(() => resolved.value.label);
</script>
