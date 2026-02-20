<template>
  <div class="stat-card" :class="{ mini: mini }">
    <div v-if="!mini" class="stat-card-header">
      <span class="stat-icon" :class="iconClass">
        <component :is="icon" :size="14" />
        {{ label }}
      </span>
    </div>
    <div class="stat-body">
      <p class="stat-value tabular-nums" :class="{ 'stat-value-animated': animated }">
        {{ value }}
      </p>
      <p v-if="subLabel" class="stat-label">{{ subLabel }}</p>
      <div v-if="$slots.detail" class="stat-detail">
        <slot name="detail" />
      </div>
      <slot />
    </div>
  </div>
</template>

<script setup>
/**
 * StatCard - 通用统计卡片
 *
 * 从旧版 custom.css 的 .stat-card 结构迁移。
 * 支持带图标标题的标准模式和紧凑 mini 模式。
 */
defineProps({
  /** Lucide 图标组件 */
  icon: { type: [Object, Function], default: null },
  /** 图标样式 class（如 stat-icon-cpu） */
  iconClass: { type: String, default: '' },
  /** 标题标签 */
  label: { type: String, default: '' },
  /** 主数值 */
  value: { type: [String, Number], default: '--' },
  /** 副标签 */
  subLabel: { type: String, default: '' },
  /** 紧凑模式 */
  mini: { type: Boolean, default: false },
  /** 悬浮缩放动画 */
  animated: { type: Boolean, default: false },
});
</script>

<style scoped>
.stat-card {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 20px;
  transition: border-color var(--transition-fast);
  overflow: hidden;
}

.stat-card:hover {
  border-color: var(--bg-hover);
}

.stat-card.mini {
  text-align: center;
  padding: 16px 20px;
}

.stat-card.mini .stat-body {
  padding: 0;
}

.stat-card-header {
  margin-bottom: 12px;
}

.stat-card-header .stat-icon {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  padding: 4px 10px;
  border-radius: 6px;
  gap: 6px;
}

/* 图标色彩标识 */
:deep(.stat-icon-cpu) {
  background: rgba(59, 130, 246, 0.12);
  color: var(--color-printing);
}

:deep(.stat-icon-mem) {
  background: rgba(168, 85, 247, 0.12);
  color: var(--color-rendering);
}

:deep(.stat-icon-jobs) {
  background: rgba(34, 197, 94, 0.12);
  color: var(--color-done);
}

:deep(.stat-icon-uptime) {
  background: rgba(245, 158, 11, 0.12);
  color: var(--color-waiting);
}

:deep(.stat-icon-conn) {
  background: rgba(59, 130, 246, 0.12);
  color: var(--color-printing);
}

:deep(.stat-icon-device) {
  background: rgba(113, 113, 122, 0.12);
  color: var(--text-tertiary);
}

:deep(.stat-icon-transit) {
  background: rgba(168, 85, 247, 0.12);
  color: var(--color-rendering);
}

.stat-body {
  padding: 0;
}

.stat-value {
  margin: 0 0 4px;
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.5px;
  line-height: 1.2;
}

.stat-value-animated {
  transition: transform 0.3s ease;
}

.stat-value-animated:hover {
  transform: scale(1.05);
}

.stat-label {
  margin: 0;
  font-size: 13px;
  color: var(--text-tertiary);
  font-weight: 400;
  line-height: 1.4;
}

.stat-detail {
  margin-top: 12px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

@media (max-width: 767px) {
  .stat-card {
    padding: 14px;
  }

  .stat-value {
    font-size: 20px;
  }
}
</style>
