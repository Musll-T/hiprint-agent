<template>
  <div class="printer-list-view">
    <!-- 标题栏 -->
    <div class="view-header">
      <h2 class="view-title">打印机管理</h2>
      <n-button type="primary" @click="openAddModal">
        添加打印机
      </n-button>
    </div>

    <!-- 打印机网格（含移动端下拉刷新） -->
    <PullRefresh ref="printerPullRefresh" @refresh="handlePullRefresh">
      <div v-if="printerStore.printers.length" class="printer-grid">
        <PrinterCard
          v-for="p in printerStore.printers"
          :key="p.name"
          :printer="p"
          :action-loading="getActionLoading(p.name)"
          @edit="openEditModal"
          @delete="confirmDelete"
          @set-default="handleSetDefault"
          @enable="handleEnable"
          @disable="handleDisable"
        />
      </div>

      <!-- 空状态 -->
      <n-empty
        v-else
        description="暂无打印机，请点击上方按钮添加"
        class="empty-state"
      />
    </PullRefresh>

    <!-- 添加/编辑弹窗 -->
    <PrinterModal
      v-model:visible="modalVisible"
      :mode="modalMode"
      :printer="editingPrinter"
      @saved="handleSaved"
    />
  </div>
</template>

<script setup>
/**
 * PrinterListView - 打印机列表视图
 *
 * 展示打印机网格卡片，支持 CRUD + 启停 + 默认设置。
 */
import { ref, reactive, onMounted } from 'vue';
import { NButton, NEmpty, useMessage, useDialog } from 'naive-ui';
import { usePrinterStore } from '../stores/printers.js';
import PrinterCard from '../components/printers/PrinterCard.vue';
import PrinterModal from '../components/printers/PrinterModal.vue';
import PullRefresh from '../components/common/PullRefresh.vue';

const printerStore = usePrinterStore();
const message = useMessage();
const dialog = useDialog();

// 追踪操作中状态: Map<printerName, actionType>
const processingState = reactive(new Map());
const printerPullRefresh = ref(null);

function getActionLoading(printerName) {
  return processingState.get(printerName) || '';
}

// 弹窗状态
const modalVisible = ref(false);
const modalMode = ref('add');
const editingPrinter = ref(null);

onMounted(() => {
  printerStore.loadPrinters();
});

// 移动端下拉刷新
async function handlePullRefresh() {
  try {
    await printerStore.loadPrinters();
  } finally {
    printerPullRefresh.value?.done();
  }
}

function openAddModal() {
  modalMode.value = 'add';
  editingPrinter.value = null;
  modalVisible.value = true;
}

function openEditModal(printer) {
  modalMode.value = 'edit';
  editingPrinter.value = printer;
  modalVisible.value = true;
}

function handleSaved() {
  // PrinterModal 内部已调用 store 方法刷新列表
}

function confirmDelete(name) {
  dialog.warning({
    title: '确认删除',
    content: '确定要删除打印机 "' + name + '" 吗？此操作不可撤销。',
    positiveText: '删除',
    negativeText: '取消',
    onPositive: async () => {
      processingState.set(name, 'delete');
      try {
        await printerStore.deletePrinter(name);
        message.success('打印机已删除');
      } catch (err) {
        message.error(err.message || '删除失败');
      } finally {
        processingState.delete(name);
      }
    },
  });
}

async function handleSetDefault(name) {
  processingState.set(name, 'setDefault');
  try {
    await printerStore.setDefault(name);
    message.success('已设为默认打印机');
  } catch (err) {
    message.error(err.message || '操作失败');
  } finally {
    processingState.delete(name);
  }
}

async function handleEnable(name) {
  processingState.set(name, 'enable');
  try {
    await printerStore.enable(name);
    message.success('打印机已启用');
  } catch (err) {
    message.error(err.message || '操作失败');
  } finally {
    processingState.delete(name);
  }
}

async function handleDisable(name) {
  processingState.set(name, 'disable');
  try {
    await printerStore.disable(name);
    message.success('打印机已停用');
  } catch (err) {
    message.error(err.message || '操作失败');
  } finally {
    processingState.delete(name);
  }
}
</script>

<style scoped>
.printer-list-view {
  padding: 0;
}

.view-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
}

.view-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.printer-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.empty-state {
  margin-top: 60px;
}

@media (max-width: 640px) {
  .printer-grid {
    grid-template-columns: 1fr;
  }
}
</style>
