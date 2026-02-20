<template>
  <div class="job-list-view">
    <!-- 标题 + 过滤 -->
    <div class="view-header">
      <h2 class="view-title">任务管理</h2>
      <JobFilter :current="jobStore.filter" @change="handleFilterChange" />
    </div>

    <!-- 桌面表格 -->
    <div class="desktop-view">
      <JobTable
        :jobs="jobStore.jobs"
        @preview="openPreview"
        @cancel="handleCancel"
        @retry="handleRetry"
      />
    </div>

    <!-- 移动端卡片列表（含下拉刷新） -->
    <div class="mobile-view">
      <PullRefresh ref="jobPullRefresh" @refresh="handlePullRefresh">
        <template v-if="jobStore.jobs.length">
          <JobCard
            v-for="job in jobStore.jobs"
            :key="job.id"
            :job="job"
            @preview="openPreview"
            @cancel="handleCancel"
            @retry="handleRetry"
          />
        </template>
        <n-empty v-else description="暂无任务" class="empty-state" />
      </PullRefresh>
    </div>

    <!-- 桌面端空状态 -->
    <n-empty
      v-if="!jobStore.jobs.length"
      description="暂无任务"
      class="empty-state desktop-view"
    />

    <!-- 加载更多 -->
    <div v-if="jobStore.hasMore" class="load-more">
      <n-button :loading="loadingMore" @click="handleLoadMore">
        加载更多
      </n-button>
    </div>

    <!-- 预览弹窗 -->
    <JobPreviewModal
      v-model:visible="previewVisible"
      :job-id="previewJobId"
    />
  </div>
</template>

<script setup>
/**
 * JobListView - 任务列表视图
 *
 * 桌面端表格 + 移动端卡片，支持过滤、分页、预览、取消、重试。
 */
import { ref, onMounted } from 'vue';
import { NButton, NEmpty, useMessage } from 'naive-ui';
import { useJobStore } from '../stores/jobs.js';
import JobFilter from '../components/jobs/JobFilter.vue';
import JobTable from '../components/jobs/JobTable.vue';
import JobCard from '../components/jobs/JobCard.vue';
import JobPreviewModal from '../components/jobs/JobPreviewModal.vue';
import PullRefresh from '../components/common/PullRefresh.vue';

const jobStore = useJobStore();
const message = useMessage();

const loadingMore = ref(false);
const previewVisible = ref(false);
const previewJobId = ref('');
const jobPullRefresh = ref(null);

onMounted(() => {
  jobStore.loadJobs();
});

// 过滤变化时重新加载
function handleFilterChange(val) {
  jobStore.filter = val;
  jobStore.loadJobs();
}

// 移动端下拉刷新
async function handlePullRefresh() {
  try {
    await jobStore.loadJobs();
  } finally {
    jobPullRefresh.value?.done();
  }
}

async function handleLoadMore() {
  loadingMore.value = true;
  try {
    await jobStore.loadMore();
  } finally {
    loadingMore.value = false;
  }
}

function openPreview(id) {
  previewJobId.value = id;
  previewVisible.value = true;
}

async function handleCancel(id) {
  try {
    await jobStore.cancelJob(id);
    message.success('任务已取消');
  } catch (err) {
    message.error(err.message || '取消失败');
  }
}

async function handleRetry(id) {
  try {
    await jobStore.retryJob(id);
    message.success('任务已重新提交');
  } catch (err) {
    message.error(err.message || '重试失败');
  }
}
</script>

<style scoped>
.job-list-view {
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

/* 响应式切换：桌面/移动 */
.desktop-view {
  display: block;
}

.mobile-view {
  display: none;
}

@media (max-width: 768px) {
  .desktop-view {
    display: none;
  }

  .mobile-view {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
}

.load-more {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

.empty-state {
  margin-top: 60px;
}
</style>
