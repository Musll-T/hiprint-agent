/**
 * BullMQ 队列适配器 -- 基于 Redis 的分布式队列
 *
 * 需要 Redis 服务器。支持任务持久化、分布式处理、自动重试。
 * 通过 config.queue 配置项控制 Redis 连接和队列行为。
 *
 * 架构说明：
 * BullMQ 的 Worker 处理器只能接收可序列化的 job data，无法直接传递
 * 函数引用。本适配器通过内存 Map 保存回调函数引用，以自增 ID 作为
 * BullMQ job data 的关联键，Worker 执行时从 Map 取出并调用。
 * 这意味着此适配器仅支持单进程场景下的函数传递，跨进程分布式执行
 * 需要上层 JobManager 配合改造任务序列化方案。
 *
 * @see {import('../queue-factory.js').QueuePort}
 */

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
 * 创建 BullMQ 队列实例
 *
 * @param {'render' | 'print'} name - 队列名称
 * @param {object} config - 应用配置对象
 * @returns {Promise<import('../queue-factory.js').QueuePort>}
 * @throws {Error} bullmq 未安装时抛出错误
 */
export async function createBullMQQueue(name, config) {
  // 动态导入 bullmq，未安装时（optionalDependencies）给出清晰错误
  let Queue, Worker;
  try {
    const bullmq = await import('bullmq');
    Queue = bullmq.Queue;
    Worker = bullmq.Worker;
  } catch {
    throw new Error(
      'BullMQ 未安装。请运行 npm install bullmq ioredis 后重试，' +
        '或将 config.queue.backend 设为 "memory" 使用内存队列。'
    );
  }

  const redisConnection = {
    host: config.queue?.redis?.host || 'localhost',
    port: config.queue?.redis?.port || 6379,
    ...(config.queue?.redis?.password ? { password: config.queue.redis.password } : {}),
  };

  const configKey = CONCURRENCY_MAP[name];
  const concurrency = (configKey && config[configKey]) || DEFAULT_CONCURRENCY[name] || 4;

  const queueName = `hiprint:${name}`;

  const queue = new Queue(queueName, { connection: redisConnection });

  /**
   * 内存中的回调函数映射
   * BullMQ Worker 通过 processorId 从此 Map 取出实际待执行的函数
   * @type {Map<number, () => Promise<void>>}
   */
  const processors = new Map();
  let processorId = 0;

  const worker = new Worker(
    queueName,
    async (job) => {
      const fn = processors.get(job.data.processorId);
      if (fn) {
        try {
          await fn();
        } finally {
          processors.delete(job.data.processorId);
        }
      }
    },
    { connection: redisConnection, concurrency }
  );

  /** Worker 是否已暂停 */
  let paused = false;

  return {
    async add(fn) {
      const id = ++processorId;
      processors.set(id, fn);
      await queue.add('task', { processorId: id });
    },

    get size() {
      // 内存中等待处理的回调数量近似队列等待数
      // 精确值需异步调用 queue.getWaitingCount()，此处用同步近似值
      return Math.max(0, processors.size - concurrency);
    },

    get pending() {
      // 使用 Worker 内部并发度的近似值
      return Math.min(processors.size, concurrency);
    },

    pause() {
      if (!paused) {
        paused = true;
        worker.pause();
      }
    },

    async onIdle() {
      // 轮询等待所有处理器完成
      while (processors.size > 0) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    },

    async close() {
      await worker.close();
      await queue.close();
      processors.clear();
    },
  };
}
