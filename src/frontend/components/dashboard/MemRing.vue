<template>
  <div class="mem-ring-wrap">
    <div class="mem-ring">
      <svg viewBox="0 0 48 48">
        <circle class="mem-ring-bg" cx="24" cy="24" r="20" />
        <circle
          class="mem-ring-fill"
          :class="levelClass"
          cx="24"
          cy="24"
          r="20"
          :stroke-dasharray="circumference"
          :stroke-dashoffset="dashOffset"
        />
      </svg>
      <span class="mem-ring-text tabular-nums">{{ percent }}%</span>
    </div>
    <div class="mem-ring-detail">
      <small>{{ usedLabel }} / {{ totalLabel }}</small>
      <small class="mem-ring-free">{{ freeLabel }} 可用</small>
    </div>
  </div>
</template>

<script setup>
/**
 * MemRing - 内存环形进度条
 *
 * 从旧版 custom.css 的 .mem-ring 结构迁移。
 * SVG 圆环通过 stroke-dashoffset 控制填充量。
 */
import { computed } from 'vue';
import { formatBytes } from '../../utils/format.js';

const props = defineProps({
  /** 内存使用百分比 (0-100) */
  percent: { type: Number, default: 0 },
  /** 总内存（字节） */
  totalMem: { type: Number, default: 0 },
  /** 空闲内存（字节） */
  freeMem: { type: Number, default: 0 },
});

const circumference = 2 * Math.PI * 20; // ~125.66

const dashOffset = computed(() => {
  const p = Math.min(Math.max(props.percent, 0), 100);
  return circumference * (1 - p / 100);
});

const levelClass = computed(() => {
  if (props.percent < 60) return 'mem-low';
  if (props.percent < 85) return 'mem-medium';
  return 'mem-high';
});

const usedLabel = computed(() => {
  const used = props.totalMem - props.freeMem;
  return formatBytes(used > 0 ? used : 0);
});

const totalLabel = computed(() => formatBytes(props.totalMem));
const freeLabel = computed(() => formatBytes(props.freeMem));
</script>

<style scoped>
.mem-ring-wrap {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 12px;
}

.mem-ring {
  position: relative;
  width: 48px;
  height: 48px;
  flex-shrink: 0;
}

.mem-ring svg {
  width: 48px;
  height: 48px;
  transform: rotate(-90deg);
}

.mem-ring-bg {
  fill: none;
  stroke: var(--bg-elevated);
  stroke-width: 4;
}

.mem-ring-fill {
  fill: none;
  stroke-width: 4;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.6s ease, stroke 0.3s ease;
}

.mem-ring-fill.mem-low {
  stroke: var(--color-done);
}
.mem-ring-fill.mem-medium {
  stroke: var(--color-waiting);
}
.mem-ring-fill.mem-high {
  stroke: var(--color-failed);
}

.mem-ring-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.mem-ring-detail {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mem-ring-detail small {
  font-size: 12px;
  color: var(--text-secondary);
}

.mem-ring-free {
  color: var(--text-tertiary) !important;
}

@media (max-width: 767px) {
  .mem-ring-wrap {
    gap: 12px;
  }

  .mem-ring {
    width: 40px;
    height: 40px;
  }

  .mem-ring svg {
    width: 40px;
    height: 40px;
  }

  .mem-ring-text {
    font-size: 10px;
  }
}
</style>
