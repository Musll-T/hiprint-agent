<template>
  <n-data-table
    :columns="columns"
    :data="jobs"
    :row-key="rowKey"
    :bordered="false"
    size="small"
    striped
    class="job-table"
  />
</template>

<script setup>
/**
 * JobTable - 桌面端任务表格
 *
 * 使用 n-data-table 展示任务列表，含状态徽章、打印参数标签、操作按钮。
 */
import { h } from 'vue';
import { NDataTable, NButton, NSpace, NTag } from 'naive-ui';
import StatusBadge from '../common/StatusBadge.vue';
import { formatTime, shortId, formatPrintOptions } from '../../utils/format.js';

const props = defineProps({
  jobs: { type: Array, default: () => [] },
});

const emit = defineEmits(['preview', 'cancel', 'retry']);

function rowKey(row) {
  return row.id;
}

/**
 * 打印参数标签颜色
 * @param {string} type
 * @returns {string}
 */
function optTagType(type) {
  const map = {
    size: 'info',
    color: 'success',
    mono: 'default',
    duplex: 'warning',
    landscape: 'info',
    copies: 'warning',
    range: 'info',
  };
  return map[type] || 'default';
}

/**
 * 格式化耗时
 * @param {object} row
 * @returns {string}
 */
function formatDuration(row) {
  const r = row.render_duration;
  const p = row.print_duration;
  if (!r && !p) return '--';
  const parts = [];
  if (r) parts.push(r + 'ms');
  if (p) parts.push(p + 'ms');
  return parts.join(' / ');
}

const columns = [
  {
    title: 'ID',
    key: 'id',
    width: 100,
    render(row) {
      return h(
        'span',
        {
          class: 'cell-id',
          onClick: () => emit('preview', row.id),
        },
        shortId(row.id)
      );
    },
  },
  {
    title: '状态',
    key: 'status',
    width: 100,
    render(row) {
      return h(StatusBadge, { status: row.status });
    },
  },
  {
    title: '类型',
    key: 'type',
    width: 110,
    render(row) {
      return row.type || '--';
    },
  },
  {
    title: '打印机',
    key: 'printer',
    width: 130,
    ellipsis: { tooltip: true },
    render(row) {
      return row.printer || '--';
    },
  },
  {
    title: '打印参数',
    key: 'print_options',
    width: 200,
    render(row) {
      const tags = formatPrintOptions(row.print_options);
      if (!tags.length) return '--';
      return h(
        NSpace,
        { size: 4, wrap: true },
        () =>
          tags.map((tag, i) =>
            h(
              NTag,
              {
                key: i,
                type: optTagType(tag.type),
                size: 'tiny',
                bordered: false,
                round: true,
                title: tag.title,
              },
              () => tag.label
            )
          )
      );
    },
  },
  {
    title: '耗时',
    key: 'duration',
    width: 130,
    render(row) {
      return h('span', { class: 'tabular-nums' }, formatDuration(row));
    },
  },
  {
    title: '创建时间',
    key: 'created_at',
    width: 150,
    render(row) {
      return formatTime(row.created_at);
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: 140,
    fixed: 'right',
    render(row) {
      const buttons = [];

      buttons.push(
        h(
          NButton,
          {
            size: 'tiny',
            quaternary: true,
            type: 'info',
            onClick: () => emit('preview', row.id),
          },
          () => '预览'
        )
      );

      if (['received', 'rendering'].includes(row.status)) {
        buttons.push(
          h(
            NButton,
            {
              size: 'tiny',
              quaternary: true,
              type: 'warning',
              onClick: () => emit('cancel', row.id),
            },
            () => '取消'
          )
        );
      }

      if (['failed_render', 'failed_print'].includes(row.status)) {
        buttons.push(
          h(
            NButton,
            {
              size: 'tiny',
              quaternary: true,
              type: 'info',
              onClick: () => emit('retry', row.id),
            },
            () => '重试'
          )
        );
      }

      return h(NSpace, { size: 4 }, () => buttons);
    },
  },
];
</script>

<style scoped>
.job-table :deep(.cell-id) {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 13px;
  color: var(--accent);
  cursor: pointer;
}

.job-table :deep(.cell-id:hover) {
  text-decoration: underline;
}
</style>
