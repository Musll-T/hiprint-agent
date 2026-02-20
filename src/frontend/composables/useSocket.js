/**
 * useSocket - 单例模式 Socket.IO 连接管理
 *
 * 从原 src/public/js/app.js 的 initSocket() 迁移。
 * 连接 /admin-ws 路径，监听 job:update / printer:update / sys:stats 事件，
 * 分发到对应的 Pinia store。
 */

import { ref, onUnmounted } from 'vue';
import { io } from 'socket.io-client';

/** 单例 socket 实例 */
let socket = null;

/** 连接状态 */
const isConnected = ref(false);

/** 已注册的事件回调集合（用于组件级别绑定/解绑） */
const listeners = new Map();

/**
 * 初始化 Socket.IO 连接（幂等，仅首次调用时创建）
 */
function init() {
  if (socket) return;

  socket = io({
    path: '/admin-ws',
    transports: ['websocket', 'polling'],
    auth: {
      adminToken: 'session',
    },
  });

  socket.on('connect', () => {
    isConnected.value = true;
  });

  socket.on('disconnect', () => {
    isConnected.value = false;
  });
}

/**
 * 注册事件监听
 * @param {string} event - 事件名
 * @param {Function} handler - 回调函数
 */
function on(event, handler) {
  init();
  socket.on(event, handler);

  // 记录以便组件卸载时清理
  if (!listeners.has(event)) {
    listeners.set(event, new Set());
  }
  listeners.get(event).add(handler);
}

/**
 * 取消事件监听
 * @param {string} event - 事件名
 * @param {Function} handler - 回调函数
 */
function off(event, handler) {
  if (!socket) return;
  socket.off(event, handler);
  if (listeners.has(event)) {
    listeners.get(event).delete(handler);
  }
}

/**
 * 断开连接
 */
function disconnect() {
  if (socket) {
    socket.disconnect();
    socket = null;
    isConnected.value = false;
    listeners.clear();
  }
}

/**
 * useSocket composable
 *
 * 提供 Socket.IO 连接管理和事件监听接口。
 * 调用时自动初始化连接。
 */
export function useSocket() {
  init();

  return {
    isConnected,
    on,
    off,
    disconnect,
    /** 获取底层 socket 实例（高级用法） */
    getSocket: () => socket,
  };
}
