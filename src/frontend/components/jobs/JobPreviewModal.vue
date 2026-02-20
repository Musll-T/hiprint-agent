<template>
  <n-modal
    :show="visible"
    preset="card"
    title="任务预览"
    style="max-width: 900px; width: 95vw"
    @update:show="handleClose"
  >
    <div class="preview-container">
      <n-spin v-if="loading" class="preview-spin" />
      <iframe
        v-show="!loading"
        ref="iframeRef"
        :src="previewUrl"
        class="preview-iframe"
        @load="loading = false"
        @error="handleError"
      />
      <n-empty
        v-if="error"
        description="预览加载失败"
        class="preview-error"
      />
    </div>
  </n-modal>
</template>

<script setup>
/**
 * JobPreviewModal - 任务 HTML 预览弹窗
 *
 * 通过 iframe 加载 /api/jobs/:id/preview
 */
import { ref, computed, watch } from 'vue';
import { NModal, NSpin, NEmpty } from 'naive-ui';

const props = defineProps({
  visible: { type: Boolean, default: false },
  jobId: { type: String, default: '' },
});

const emit = defineEmits(['update:visible']);

const loading = ref(true);
const error = ref(false);
const iframeRef = ref(null);

const previewUrl = computed(() => {
  if (!props.jobId) return '';
  return '/api/jobs/' + props.jobId + '/preview';
});

watch(() => props.visible, (val) => {
  if (val) {
    loading.value = true;
    error.value = false;
  }
});

function handleClose(val) {
  if (!val) emit('update:visible', false);
}

function handleError() {
  loading.value = false;
  error.value = true;
}
</script>

<style scoped>
.preview-container {
  position: relative;
  min-height: 400px;
}

.preview-spin {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.preview-iframe {
  width: 100%;
  height: 70vh;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: #fff;
}

.preview-error {
  padding: 40px 0;
}
</style>
