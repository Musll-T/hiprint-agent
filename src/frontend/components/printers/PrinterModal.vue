<template>
  <n-modal
    :show="visible"
    preset="card"
    :title="mode === 'add' ? '添加打印机' : '编辑打印机'"
    style="max-width: 480px; width: 90vw"
    :mask-closable="!submitting"
    :closable="!submitting"
    @update:show="handleClose"
  >
    <n-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-placement="left"
      label-width="80"
    >
      <n-form-item label="名称" path="name">
        <n-input
          v-if="mode === 'add'"
          v-model:value="form.name"
          placeholder="打印机名称"
          :disabled="submitting"
        />
        <span v-else class="readonly-value">{{ form.name }}</span>
      </n-form-item>

      <n-form-item label="URI" path="deviceUri">
        <n-input
          v-model:value="form.deviceUri"
          placeholder="如: ipp://192.168.1.100:631/printers/HP"
          :disabled="submitting"
        />
      </n-form-item>

      <n-form-item label="型号" path="model">
        <n-input
          v-if="mode === 'add'"
          v-model:value="form.model"
          placeholder="可选"
          :disabled="submitting"
        />
        <span v-else class="readonly-value">{{ form.model || '--' }}</span>
      </n-form-item>

      <n-form-item label="描述" path="description">
        <n-input
          v-model:value="form.description"
          placeholder="可选"
          :disabled="submitting"
        />
      </n-form-item>

      <n-form-item label="位置" path="location">
        <n-input
          v-model:value="form.location"
          placeholder="可选，如: 3楼办公区"
          :disabled="submitting"
        />
      </n-form-item>
    </n-form>

    <template #action>
      <n-space justify="end">
        <n-button :disabled="submitting" @click="handleClose(false)">
          取消
        </n-button>
        <n-button
          type="primary"
          :loading="submitting"
          @click="handleSubmit"
        >
          {{ mode === 'add' ? '添加' : '保存' }}
        </n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup>
/**
 * PrinterModal - 添加/编辑打印机弹窗
 *
 * 添加模式: name + deviceUri 必填
 * 编辑模式: deviceUri + description + location 可修改
 */
import { ref, watch } from 'vue';
import { NModal, NForm, NFormItem, NInput, NButton, NSpace, useMessage } from 'naive-ui';
import { usePrinterStore } from '../../stores/printers.js';

const props = defineProps({
  visible: { type: Boolean, default: false },
  mode: { type: String, default: 'add' },
  printer: { type: Object, default: null },
});

const emit = defineEmits(['update:visible', 'saved']);

const printerStore = usePrinterStore();
const message = useMessage();

const formRef = ref(null);
const submitting = ref(false);

const form = ref({
  name: '',
  deviceUri: '',
  model: '',
  description: '',
  location: '',
});

const rules = {
  name: [
    { required: true, message: '请输入打印机名称', trigger: 'blur' },
  ],
  deviceUri: [
    { required: true, message: '请输入设备 URI', trigger: 'blur' },
  ],
};

// 打开弹窗时初始化表单
watch(() => props.visible, (val) => {
  if (!val) return;
  if (props.mode === 'edit' && props.printer) {
    form.value = {
      name: props.printer.name || '',
      deviceUri: props.printer.deviceUri || '',
      model: props.printer.model || '',
      description: props.printer.description || '',
      location: props.printer.location || '',
    };
  } else {
    form.value = {
      name: '',
      deviceUri: '',
      model: '',
      description: '',
      location: '',
    };
  }
});

function handleClose(val) {
  if (submitting.value) return;
  if (!val) emit('update:visible', false);
}

async function handleSubmit() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  submitting.value = true;
  try {
    if (props.mode === 'add') {
      await printerStore.addPrinter(form.value);
      message.success('打印机已添加');
    } else {
      await printerStore.updatePrinter(form.value.name, {
        deviceUri: form.value.deviceUri?.trim() || undefined,
        description: form.value.description?.trim() || undefined,
        location: form.value.location?.trim() || undefined,
      });
      message.success('打印机已更新');
    }
    emit('saved');
    emit('update:visible', false);
  } catch (err) {
    message.error(err.message || '操作失败');
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.readonly-value {
  color: var(--text-secondary);
  font-size: 14px;
}
</style>
