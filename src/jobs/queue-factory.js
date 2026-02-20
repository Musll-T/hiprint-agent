/**
 * 队列工厂 -- 根据配置选择队列后端实现
 *
 * 默认使用 p-queue（内存队列），配置 queue.backend 为 'bullmq' 时
 * 使用 BullMQ（需要 Redis），实现水平扩展。
 *
 * 遵循 src/core/ports.js 中的适配器模式：通过 QueuePort 接口
 * 将不同队列实现桥接为统一契约，调用方无需关心底层队列技术。
 */

/**
 * 队列端口接口
 *
 * @typedef {object} QueuePort
 * @property {(fn: () => Promise<void>) => Promise<void>} add - 添加任务到队列
 * @property {number} size - 队列中等待执行的任务数
 * @property {number} pending - 正在执行的任务数
 * @property {() => void} pause - 暂停队列（不再执行新任务）
 * @property {() => Promise<void>} onIdle - 等待所有任务完成（队列清空）
 * @property {() => Promise<void>} close - 关闭队列并释放资源
 */

/**
 * 根据配置创建队列实例
 *
 * @param {'render' | 'print'} name - 队列名称，用于确定并发度
 * @param {object} config - 应用配置对象
 * @returns {Promise<QueuePort>} 队列端口实例
 */
export async function createQueue(name, config) {
  const backend = config.queue?.backend || 'memory';

  if (backend === 'bullmq') {
    const { createBullMQQueue } = await import('./adapters/bullmq-queue.js');
    return createBullMQQueue(name, config);
  }

  const { createMemoryQueue } = await import('./adapters/memory-queue.js');
  return createMemoryQueue(name, config);
}
