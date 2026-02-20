<template>
  <div
    ref="containerRef"
    class="pull-refresh"
    @touchstart.passive="onTouchStart"
    @touchmove.passive="onTouchMove"
    @touchend.passive="onTouchEnd"
  >
    <!-- 下拉指示器 -->
    <div
      class="pull-refresh__indicator"
      :style="{ transform: `translateY(${indicatorOffset}px)` }"
    >
      <svg
        v-if="!refreshing"
        class="pull-refresh__arrow"
        :class="{ 'pull-refresh__arrow--ready': pullReady }"
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="7 13 12 18 17 13" />
        <line x1="12" y1="6" x2="12" y2="18" />
      </svg>
      <svg
        v-else
        class="pull-refresh__spinner"
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      >
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
      <span class="pull-refresh__text">{{ statusText }}</span>
    </div>

    <!-- 内容插槽 -->
    <div
      class="pull-refresh__content"
      :style="{ transform: `translateY(${contentOffset}px)` }"
    >
      <slot />
    </div>
  </div>
</template>

<script setup>
/**
 * PullRefresh - 移动端下拉刷新组件
 *
 * 纯触摸事件驱动，仅在触摸设备上生效。
 * 父组件通过 @refresh 事件提供异步刷新回调。
 */
import { ref, computed } from 'vue';

const props = defineProps({
  /** 触发刷新的下拉距离阈值 (px) */
  threshold: { type: Number, default: 60 },
  /** 刷新中时指示器停留高度 (px) */
  indicatorHeight: { type: Number, default: 48 },
  /** 下拉时的阻尼系数 (0-1)，值越小阻力越大 */
  damping: { type: Number, default: 0.4 },
});

const emit = defineEmits(['refresh']);

const containerRef = ref(null);

// 触摸状态
const startY = ref(0);
const pulling = ref(false);
const pullDistance = ref(0);
const refreshing = ref(false);

/** 是否达到刷新阈值 */
const pullReady = computed(() => pullDistance.value >= props.threshold);

/** 状态提示文本 */
const statusText = computed(() => {
  if (refreshing.value) return '刷新中...';
  if (pullReady.value) return '释放刷新';
  return '下拉刷新';
});

/** 内容区偏移量 */
const contentOffset = computed(() => {
  if (refreshing.value) return props.indicatorHeight;
  return pullDistance.value;
});

/** 指示器偏移量（从 -indicatorHeight 开始，向下滑出） */
const indicatorOffset = computed(() => {
  if (refreshing.value) return 0;
  return pullDistance.value - props.indicatorHeight;
});

/**
 * 检测容器内可滚动区域是否已滚动到顶部
 */
function isScrolledToTop() {
  const el = containerRef.value;
  if (!el) return true;

  // 查找最近的可滚动祖先
  let node = el;
  while (node && node !== document.body) {
    if (node.scrollTop > 0) return false;
    node = node.parentElement;
  }
  return true;
}

function onTouchStart(e) {
  if (refreshing.value) return;
  if (!isScrolledToTop()) return;

  startY.value = e.touches[0].clientY;
  pulling.value = true;
  pullDistance.value = 0;
}

function onTouchMove(e) {
  if (!pulling.value || refreshing.value) return;

  const currentY = e.touches[0].clientY;
  const delta = currentY - startY.value;

  // 仅处理下拉方向
  if (delta <= 0) {
    pullDistance.value = 0;
    return;
  }

  // 非顶部位置时取消拉动
  if (!isScrolledToTop()) {
    pulling.value = false;
    pullDistance.value = 0;
    return;
  }

  // 应用阻尼
  pullDistance.value = Math.round(delta * props.damping);
}

async function onTouchEnd() {
  if (!pulling.value || refreshing.value) return;
  pulling.value = false;

  if (pullReady.value) {
    refreshing.value = true;
    pullDistance.value = 0;

    try {
      await new Promise((resolve, reject) => {
        const result = emit('refresh');
        // 如果 emit 返回 Promise（通过回调模式）
        if (result && typeof result.then === 'function') {
          result.then(resolve, reject);
        } else {
          // 使用回调模式：监听 done 信号
          resolve();
        }
      });
    } catch {
      // 刷新失败也要重置状态
    } finally {
      refreshing.value = false;
    }
  } else {
    pullDistance.value = 0;
  }
}

/**
 * 供父组件通过 ref 调用，手动结束刷新状态。
 * 适用于异步刷新完成后的回调场景。
 */
function done() {
  refreshing.value = false;
}

defineExpose({ done });
</script>

<style scoped>
.pull-refresh {
  position: relative;
  overflow: hidden;
  /* 仅在触摸设备上生效 */
  touch-action: pan-y;
}

.pull-refresh__indicator {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: v-bind('props.indicatorHeight + "px"');
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-tertiary);
  font-size: 13px;
  transition: transform 0s;
  will-change: transform;
}

.pull-refresh__content {
  transition: transform 0s;
  will-change: transform;
}

/* 释放和刷新完成时加过渡动画 */
.pull-refresh:not(:active) .pull-refresh__indicator,
.pull-refresh:not(:active) .pull-refresh__content {
  transition: transform 0.25s ease;
}

.pull-refresh__arrow {
  color: var(--text-quaternary);
  transition: transform var(--transition-fast);
}

.pull-refresh__arrow--ready {
  transform: rotate(180deg);
  color: var(--accent);
}

.pull-refresh__spinner {
  color: var(--accent);
  animation: pull-refresh-spin 0.8s linear infinite;
}

@keyframes pull-refresh-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.pull-refresh__text {
  user-select: none;
}

/* 桌面端隐藏指示器，组件行为退化为透明容器 */
@media (hover: hover) and (pointer: fine) {
  .pull-refresh__indicator {
    display: none;
  }
}
</style>
