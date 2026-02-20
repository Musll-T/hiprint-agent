/**
 * 任务状态机 — 定义合法的状态转换规则
 *
 * 纯函数模块，无副作用、无 IO、无日志。
 * 状态转换规则与 CLAUDE.md 中的状态流转图保持一致。
 */

import { JobStatus, TERMINAL_STATUSES } from './types.js';

/**
 * 合法状态转换映射表
 *
 * key: 当前状态
 * value: 该状态可转换到的目标状态数组
 */
const TRANSITIONS = Object.freeze({
  [JobStatus.RECEIVED]: [JobStatus.RENDERING, JobStatus.PRINTING, JobStatus.CANCELED],
  [JobStatus.RENDERING]: [
    JobStatus.PRINTING,
    JobStatus.FAILED_RENDER,
    JobStatus.TIMEOUT,
    JobStatus.CANCELED,
  ],
  [JobStatus.PRINTING]: [JobStatus.DONE, JobStatus.FAILED_PRINT],
  [JobStatus.DONE]: [],
  [JobStatus.FAILED_RENDER]: [JobStatus.RECEIVED],
  [JobStatus.FAILED_PRINT]: [JobStatus.RECEIVED],
  [JobStatus.CANCELED]: [],
  [JobStatus.TIMEOUT]: [],
});

/**
 * 判断从 fromStatus 到 toStatus 的状态转换是否合法
 *
 * @param {string} fromStatus - 当前状态
 * @param {string} toStatus - 目标状态
 * @returns {boolean}
 */
export function canTransition(fromStatus, toStatus) {
  const allowed = TRANSITIONS[fromStatus];
  if (!allowed) return false;
  return allowed.includes(toStatus);
}

/**
 * 获取当前状态可转换到的所有目标状态
 *
 * @param {string} currentStatus - 当前状态
 * @returns {string[]} 可转换的目标状态数组，无效状态返回空数组
 */
export function getNextStatuses(currentStatus) {
  return TRANSITIONS[currentStatus] ?? [];
}

/**
 * 判断状态是否为终态
 *
 * @param {string} status - 状态值
 * @returns {boolean}
 */
export function isTerminal(status) {
  return TERMINAL_STATUSES.includes(status);
}
