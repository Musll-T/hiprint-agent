/**
 * 中转客户端模块
 *
 * 作为 Socket.IO 客户端连接 node-hiprint-transit 中转服务，
 * 接收远程打印任务并通过 jobManager 调度本地 Playwright + CUPS 执行。
 *
 * 通信流程：Web/Mobile -> node-hiprint-transit -> hiprint-agent(transit-client) -> Printer
 *
 * 事件命名完全对齐 electron-hiprint 的 initClientEvent()，
 * 确保 node-hiprint-transit 无需任何修改即可兼容。
 *
 * 事件处理和结果路由逻辑由 event-dispatcher.js 统一提供，
 * 本模块仅负责中转通道特有的连接生命周期管理。
 */

import { io } from 'socket.io-client';
import { getLogger } from '../logger.js';
import { FragmentManager } from '../utils/fragments.js';
import { getMachineId } from '../utils/system.js';
import { createEventDispatcher } from './event-dispatcher.js';

/** 中转客户端提交的 job 使用的 clientId 前缀 */
const TRANSIT_CLIENT_PREFIX = 'transit:';

/**
 * 创建中转客户端实例
 *
 * @param {object} deps
 * @param {object} deps.config - 应用配置（含 transitUrl, transitToken）
 * @param {object} deps.jobManager - Job Manager 实例
 * @param {object} deps.printerAdapter - 打印适配器
 * @param {object} deps.systemInfo - 系统信息（hostname, version, ip, mac 等）
 * @returns {{ client: import('socket.io-client').Socket, close: () => void, isConnected: () => boolean }}
 */
export function createTransitClient({ config, jobManager, printerAdapter, systemInfo }) {
  const log = getLogger();

  // 稳定标识：优先使用配置的 agentId，回退到 machineId
  const stableClientId = config.agentId || getMachineId() || undefined;

  // 中转客户端独立的分片管理器（与 Server 模式隔离）
  const fragmentManager = new FragmentManager({
    checkInterval: 5,
    expire: 10,
  });

  // 为中转通道构建专用的 systemInfo，确保 agentId 使用 stableClientId
  // 这样 enrichPrinterList 和 clientInfo 推送都使用统一的标识
  const transitSystemInfo = {
    ...systemInfo,
    agentId: stableClientId || '',
  };

  const dispatcher = createEventDispatcher({
    jobManager,
    printerAdapter,
    systemInfo: transitSystemInfo,
  });

  const client = io(config.transitUrl, {
    transports: ['websocket'],
    // 使用 "electron-hiprint" 标识；携带稳定 clientId 供中转服务路由
    query: {
      client: 'electron-hiprint',
      ...(stableClientId ? { clientId: stableClientId } : {}),
    },
    auth: { token: config.transitToken },
    reconnection: true,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 30000,
  });

  // 用于精确匹配回调路由的唯一标识
  const transitClientId = () => `${TRANSIT_CLIENT_PREFIX}${client.id}`;

  // ------------------------------------------------------------------
  // 结果路由器（通过 dispatcher 统一创建）
  // ------------------------------------------------------------------
  const resultRouter = dispatcher.createResultRouter(
    (event, data) => client.emit(event, data),
    (job) => job.clientId?.startsWith(TRANSIT_CLIENT_PREFIX),
  );

  // ------------------------------------------------------------------
  // 中转服务 -> Agent 事件
  // ------------------------------------------------------------------

  client.on('connect', async () => {
    log.info({ socketId: client.id, stableClientId, url: config.transitUrl }, '已连接中转服务');

    // 连接后更新 agentId：stableClientId 为空时回退到 client.id（保持原始行为）
    transitSystemInfo.agentId = stableClientId || client.id;

    // 推送打印机列表（通过 dispatcher 统一注入 agent 来源标识）
    await dispatcher.handleRefreshPrinterList(client);

    // 推送客户端信息（携带稳定标识）
    client.emit('clientInfo', transitSystemInfo);

    // 注册 jobManager 事件监听（先移除旧监听器，防止重连时重复注册）
    resultRouter.detach();
    resultRouter.attach();
  });

  client.on('getClientInfo', () => {
    log.debug({ socketId: client.id }, '中转服务请求: getClientInfo');
    dispatcher.handleGetClientInfo(client);
  });

  client.on('refreshPrinterList', async () => {
    log.debug({ socketId: client.id }, '中转服务请求: refreshPrinterList');
    await dispatcher.handleRefreshPrinterList(client);
  });

  client.on('news', (data) => {
    const job = dispatcher.handleNews(data, transitClientId(), client);
    if (job) resultRouter.registerJob(job.id, data?.replyId);
  });

  client.on('printByFragments', (data) => {
    const job = dispatcher.handlePrintByFragments(data, transitClientId(), client, fragmentManager);
    if (job) resultRouter.registerJob(job.id, data?.replyId);
  });

  client.on('render-print', (data) => {
    const job = dispatcher.handleRenderPrint(data, transitClientId(), client);
    if (job) resultRouter.registerJob(job.id, data?.replyId);
  });

  client.on('render-jpeg', (data) => {
    const job = dispatcher.handleRenderJpeg(data, transitClientId(), client);
    if (job) resultRouter.registerJob(job.id, data?.replyId);
  });

  client.on('render-pdf', (data) => {
    const job = dispatcher.handleRenderPdf(data, transitClientId(), client);
    if (job) resultRouter.registerJob(job.id, data?.replyId);
  });

  // IPP -- Phase 2 预留
  client.on('ippPrint', (data) => {
    dispatcher.handleIppPrint(data, client);
  });

  client.on('ippRequest', (data) => {
    dispatcher.handleIppRequest(data, client);
  });

  // ------------------------------------------------------------------
  // 连接生命周期事件
  // ------------------------------------------------------------------

  client.on('connect_error', (err) => {
    const msg = `${err?.message || ''} ${err?.data?.message || ''}`.toLowerCase();

    // 鉴权失败时停止重连，防止无限重试冲击中转服务
    if (msg.includes('auth') || msg.includes('token') || msg.includes('unauthorized') || msg.includes('forbidden')) {
      log.fatal({ err }, '中转服务鉴权失败，停止重连。请检查 transitToken 配置');
      client.io.opts.reconnection = false;
      client.disconnect();
      return;
    }

    log.warn({ err }, '中转服务连接失败，等待重连...');
  });

  client.on('disconnect', (reason) => {
    log.info({ reason }, '与中转服务断开连接');

    // 移除 jobManager 事件监听器，防止向已断开的 socket 发送数据
    resultRouter.detach();
  });

  // ------------------------------------------------------------------
  // 公共接口
  // ------------------------------------------------------------------

  return {
    client,

    isConnected() {
      return client.connected;
    },

    close() {
      resultRouter.detach();
      fragmentManager.destroy();
      client.disconnect();
      log.info('中转客户端已关闭');
    },
  };
}
