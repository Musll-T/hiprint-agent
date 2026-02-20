/**
 * Socket.IO 事件注册模块
 *
 * 将所有客户端->服务端的事件监听器注册到指定 socket 上。
 * 结果路由由全局 globalRouter（进程级单例）处理，不再 per-socket 创建监听器。
 *
 * 事件命名完全对齐 electron-hiprint，确保 vue-plugin-hiprint 无缝兼容。
 *
 * 事件处理逻辑由 event-dispatcher.js 统一提供，
 * 本模块仅负责将 socket 事件绑定到 dispatcher。
 */

import { getLogger } from '../logger.js';
import { enrichPrinterList } from './event-dispatcher.js';

// 重新导出 enrichPrinterList，保持外部导入兼容
export { enrichPrinterList };

/**
 * 在指定 socket 上注册所有事件监听器
 *
 * @param {import('socket.io').Socket} socket - 客户端 socket 连接实例
 * @param {object} deps - 依赖对象
 * @param {object} deps.dispatcher - 事件分派器实例（全局共享）
 * @param {object} deps.globalRouter - 全局结果路由器（提供 trackReplyId）
 * @param {import('../utils/fragments.js').FragmentManager} deps.fragmentManager - 分片管理器
 * @param {object} deps.systemInfo - 预采集的系统信息（含 hostname、version、ip 等）
 */
export function registerEvents(socket, { dispatcher, globalRouter, fragmentManager, systemInfo }) {
  const log = getLogger();

  log.info({ socketId: socket.id }, '新客户端连接');

  // socket 作为 emitter 直接使用（具有 emit 方法）
  const emitter = socket;

  // ------------------------------------------------------------------
  // 连接后自动推送打印机列表和客户端信息
  // ------------------------------------------------------------------
  dispatcher.handleRefreshPrinterList(emitter);
  emitter.emit('clientInfo', systemInfo);

  // ------------------------------------------------------------------
  // 客户端->服务端事件
  // ------------------------------------------------------------------

  socket.on('getClientInfo', () => {
    log.debug({ socketId: socket.id }, 'getClientInfo');
    dispatcher.handleGetClientInfo(emitter);
  });

  socket.on('refreshPrinterList', () => {
    log.debug({ socketId: socket.id }, 'refreshPrinterList');
    dispatcher.handleRefreshPrinterList(emitter);
  });

  socket.on('news', (data) => {
    const job = dispatcher.handleNews(data, socket.id, emitter);
    if (job) globalRouter.trackReplyId(job.id, data?.replyId);
  });

  socket.on('printByFragments', (data) => {
    const job = dispatcher.handlePrintByFragments(data, socket.id, emitter, fragmentManager);
    if (job) globalRouter.trackReplyId(job.id, data?.replyId);
  });

  socket.on('render-print', (data) => {
    const job = dispatcher.handleRenderPrint(data, socket.id, emitter);
    if (job) globalRouter.trackReplyId(job.id, data?.replyId);
  });

  socket.on('render-jpeg', (data) => {
    const job = dispatcher.handleRenderJpeg(data, socket.id, emitter);
    if (job) globalRouter.trackReplyId(job.id, data?.replyId);
  });

  socket.on('render-pdf', (data) => {
    const job = dispatcher.handleRenderPdf(data, socket.id, emitter);
    if (job) globalRouter.trackReplyId(job.id, data?.replyId);
  });

  socket.on('ippPrint', (data) => {
    dispatcher.handleIppPrint(data, emitter);
  });

  socket.on('ippRequest', (data) => {
    dispatcher.handleIppRequest(data, emitter);
  });

  socket.on('disconnect', (reason) => {
    log.info({ socketId: socket.id, reason }, '客户端断开连接');
    // 全局路由模式下无需 per-socket detach
  });
}
