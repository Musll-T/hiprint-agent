/**
 * 内存队列适配器 -- 基于 p-queue 的单进程队列
 *
 * 默认队列后端，零配置即可使用，适合单实例部署。
 * 将 p-queue 包装为 QueuePort 接口，保持与 BullMQ 适配器的行为一致。
 *
 * @see {import('../queue-factory.js').QueuePort}
 */

import PQueue from 'p-queue';

/** 各队列名称到配置字段的并发度映射 */
const CONCURRENCY_MAP = {
  render: 'renderConcurrency',
  print: 'printConcurrency',
};

/** 各队列名称的默认并发度 */
const DEFAULT_CONCURRENCY = {
  render: 4,
  print: 2,
};

/**
 * 创建内存队列实例
 *
 * @param {'render' | 'print'} name - 队列名称
 * @param {object} config - 应用配置对象
 * @returns {import('../queue-factory.js').QueuePort}
 */
export function createMemoryQueue(name, config) {
  const configKey = CONCURRENCY_MAP[name];
  const concurrency = (configKey && config[configKey]) || DEFAULT_CONCURRENCY[name] || 4;

  const queue = new PQueue({ concurrency });

  return {
    add(fn) {
      return queue.add(fn);
    },

    get size() {
      return queue.size;
    },

    get pending() {
      return queue.pending;
    },

    pause() {
      queue.pause();
    },

    onIdle() {
      return queue.onIdle();
    },

    async close() {
      queue.pause();
      await queue.onIdle();
    },
  };
}
