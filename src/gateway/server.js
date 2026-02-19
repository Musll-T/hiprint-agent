/**
 * Socket Gateway 服务
 *
 * 创建 HTTP 服务器并挂载 Socket.IO，对外提供 :17521 端口的实时通信服务。
 * 完全兼容 vue-plugin-hiprint 的 socket.io-client 连接协议。
 *
 * 职责：
 *   1. 创建并配置 Socket.IO Server（支持 EIO3 兼容、CORS、大缓冲区）
 *   2. 注册认证与 IP 白名单中间件
 *   3. 管理 FragmentManager 生命周期
 *   4. 采集系统信息供 clientInfo 事件使用
 *   5. 每个新连接注册完整的事件处理器
 */

import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { getLogger } from '../logger.js';
import { createAuthMiddleware, createIpFilter } from './auth.js';
import { registerEvents } from './events.js';
import { FragmentManager } from '../utils/fragments.js';
import { getSystemInfo } from '../utils/system.js';
import { getAllAddresses } from '../utils/network.js';

/**
 * 创建 Socket Gateway 实例
 *
 * @param {object} deps - 依赖注入
 * @param {object} deps.config - 应用配置对象
 * @param {number} deps.config.port - 监听端口（默认 17521）
 * @param {string} [deps.config.token] - 认证 Token
 * @param {string[]} [deps.config.ipWhitelist] - IP 白名单
 * @param {boolean} [deps.config.allowEIO3] - 是否允许 EIO3 协议
 * @param {object} [deps.config.cors] - CORS 配置
 * @param {object} deps.jobManager - Job Manager 实例
 * @param {object} deps.printerAdapter - 打印适配器实例
 * @returns {Promise<{ io: import('socket.io').Server, httpServer: import('http').Server, close: () => Promise<void> }>}
 */
export async function createGateway({ config, jobManager, printerAdapter }) {
  const log = getLogger();

  // ------------------------------------------------------------------
  // 1. 创建 HTTP 服务器
  // ------------------------------------------------------------------
  const httpServer = createServer();

  // ------------------------------------------------------------------
  // 2. 创建 Socket.IO Server
  // ------------------------------------------------------------------
  const io = new Server(httpServer, {
    // 兼容 socket.io v2.x 客户端（EIO3 协议）
    allowEIO3: config.allowEIO3 !== undefined ? config.allowEIO3 : true,
    // CORS 配置
    cors: config.cors || { origin: '*', methods: ['GET', 'POST'] },
    // 最大 HTTP 缓冲区大小：100MB，支持大型打印内容传输
    maxHttpBufferSize: 100 * 1024 * 1024,
  });

  // ------------------------------------------------------------------
  // 3. 注册中间件
  // ------------------------------------------------------------------
  io.use(createAuthMiddleware(config));
  io.use(createIpFilter(config.ipWhitelist || []));

  // ------------------------------------------------------------------
  // 4. 创建分片管理器
  // ------------------------------------------------------------------
  const fragmentManager = new FragmentManager({
    checkInterval: 5,  // 每 5 分钟检查过期分片
    expire: 10,        // 分片 10 分钟后过期
  });

  // ------------------------------------------------------------------
  // 5. 采集系统信息（一次性采集，连接时直接返回）
  // ------------------------------------------------------------------
  const sysInfo = getSystemInfo();
  const addresses = await getAllAddresses();
  const port = config.port || 17521;

  const systemInfo = {
    hostname: sysInfo.hostname,
    version: sysInfo.version,
    platform: sysInfo.platform,
    arch: sysInfo.arch,
    mac: addresses.mac,
    ip: addresses.ip,
    ipv6: addresses.ipv6,
    clientUrl: `http://${addresses.ip}:${port}`,
    machineId: sysInfo.machineId,
  };

  // ------------------------------------------------------------------
  // 6. 注册连接事件处理器
  // ------------------------------------------------------------------
  io.on('connection', (socket) => {
    registerEvents(socket, {
      jobManager,
      printerAdapter,
      fragmentManager,
      systemInfo,
    });
  });

  // ------------------------------------------------------------------
  // 7. 启动 HTTP 服务监听
  // ------------------------------------------------------------------
  await new Promise((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(port, () => {
      httpServer.removeListener('error', reject);
      log.info({ port }, 'Socket Gateway 已启动，监听端口: %d', port);
      resolve();
    });
  });

  // ------------------------------------------------------------------
  // 8. 返回实例和关闭方法
  // ------------------------------------------------------------------
  return {
    io,
    httpServer,
    systemInfo,

    /**
     * 优雅关闭 Gateway
     *
     * 按顺序：销毁分片管理器 → 断开所有连接 → 关闭 Socket.IO → 关闭 HTTP Server
     */
    async close() {
      log.info('Socket Gateway 正在关闭...');

      // 销毁分片管理器（清理定时器和缓存）
      fragmentManager.destroy();

      // 断开所有已连接的 socket
      io.disconnectSockets(true);

      // 关闭 Socket.IO 服务
      await new Promise((resolve) => {
        io.close(() => resolve());
      });

      // 关闭底层 HTTP 服务器
      await new Promise((resolve, reject) => {
        httpServer.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      log.info('Socket Gateway 已关闭');
    },
  };
}
