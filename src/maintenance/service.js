/**
 * 维护服务模块
 *
 * 提供系统维护和故障排查功能：队列清空、CUPS 重启、连通性检测、日志查看、一键诊断。
 */

import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { getLogger } from '../logger.js';
import * as cups from '../printer/cups.js';
import { getJobStats, addAuditLog, listJobs } from '../jobs/store.js';
import { JobStatus } from '../jobs/types.js';

const execFile = promisify(execFileCb);

/**
 * 安全执行外部命令，捕获错误并返回结构化结果
 * @param {string} cmd - 命令名称
 * @param {string[]} args - 命令参数
 * @returns {Promise<{ success: boolean, stdout: string, stderr: string }>}
 */
async function safeExecResult(cmd, args = []) {
  try {
    const { stdout, stderr } = await execFile(cmd, args);
    return { success: true, stdout: stdout || '', stderr: stderr || '' };
  } catch (err) {
    return {
      success: false,
      stdout: err.stdout || '',
      stderr: err.stderr || err.message || '',
    };
  }
}

/**
 * 创建维护服务实例
 *
 * @param {object} deps - 依赖注入
 * @param {object} deps.jobManager - Job Manager 实例
 * @param {object} deps.printerAdapter - 打印适配器实例
 * @param {object} deps.config - 应用配置
 * @returns {object} 维护服务对象
 */
export function createMaintenanceService({ jobManager, printerAdapter, config }) {
  const log = getLogger();

  /**
   * 清空所有队列
   *
   * - CUPS 队列：cancel -a 取消所有 CUPS 打印任务
   * - 内部队列：逐个取消 received/rendering 状态的任务
   *
   * @returns {Promise<{ cupsCleared: boolean, internalCanceled: number }>}
   */
  async function clearAllQueues() {
    log.info('开始清空所有队列');

    // 1. 清空 CUPS 打印队列
    let cupsCleared = false;
    const cupsResult = await safeExecResult('cancel', ['-a']);
    if (cupsResult.success) {
      cupsCleared = true;
      log.info('CUPS 打印队列已清空');
    } else {
      log.warn({ stderr: cupsResult.stderr }, 'CUPS 队列清空失败');
    }

    // 2. 取消内部队列中 received/rendering 状态的任务
    let internalCanceled = 0;
    const stats = getJobStats();
    const cancelableStatuses = [JobStatus.RECEIVED, JobStatus.RENDERING];

    for (const status of cancelableStatuses) {
      if (stats[status] > 0) {
        // 获取该状态下的任务并逐个取消
        // 通过 jobManager.cancel() 实现，内部会更新状态和清理上下文
        const jobs = listJobs({ status, limit: stats[status] + 100 });
        for (const job of jobs) {
          try {
            jobManager.cancel(job.id);
            internalCanceled++;
          } catch {
            // 任务可能已不在可取消状态，忽略
          }
        }
      }
    }

    log.info({ cupsCleared, internalCanceled }, '队列清空完成');
    addAuditLog(null, 'maintenance_clear_queues', `CUPS 清空: ${cupsCleared}, 内部取消: ${internalCanceled}`);

    return { cupsCleared, internalCanceled };
  }

  /**
   * 重启 CUPS 服务
   *
   * 三级回退策略：systemctl -> service -> 直接启动 cupsd（容器环境）。
   *
   * @returns {Promise<{ success: boolean, method: string }>}
   */
  async function restartCupsService() {
    log.info('尝试重启 CUPS 服务');

    // 方法 1: systemctl
    const systemctlResult = await safeExecResult('systemctl', ['restart', 'cups']);
    if (systemctlResult.success) {
      log.info('CUPS 服务已通过 systemctl 重启');
      addAuditLog(null, 'maintenance_restart_cups', '通过 systemctl 重启成功');
      return { success: true, method: 'systemctl' };
    }

    log.debug({ stderr: systemctlResult.stderr }, 'systemctl 重启失败，尝试 service 命令');

    // 方法 2: service
    const serviceResult = await safeExecResult('service', ['cups', 'restart']);
    if (serviceResult.success) {
      log.info('CUPS 服务已通过 service 命令重启');
      addAuditLog(null, 'maintenance_restart_cups', '通过 service 命令重启成功');
      return { success: true, method: 'service' };
    }

    log.debug({ stderr: serviceResult.stderr }, 'service 命令失败，尝试直接启动 cupsd');

    // 方法 3: 直接启动 cupsd（适用于无 systemd/init 的容器环境）
    // 先终止已有 cupsd 进程（失败不影响后续启动）
    await safeExecResult('killall', ['cupsd']);
    const cupsdResult = await safeExecResult('cupsd');
    if (cupsdResult.success) {
      log.info('CUPS 服务已通过直接启动 cupsd 重启');
      addAuditLog(null, 'maintenance_restart_cups', '通过 cupsd 直接启动成功（容器模式）');
      return { success: true, method: 'cupsd' };
    }

    log.error({ stderr: cupsdResult.stderr }, 'CUPS 服务重启失败（所有方法均不可用）');
    return { success: false, method: 'none' };
  }

  /**
   * 检测所有打印机连通性
   *
   * 逐台通过 cups.getPrinterStatus() 检测打印机是否可达。
   *
   * @returns {Promise<Array<{ name: string, reachable: boolean, status: string }>>}
   */
  async function checkPrinterConnectivity() {
    const printers = await cups.listPrinters();

    if (printers.length === 0) {
      log.info('未检测到任何打印机');
      return [];
    }

    const results = [];

    for (const printer of printers) {
      const statusInfo = await cups.getPrinterStatus(printer.name);
      if (statusInfo) {
        results.push({
          name: printer.name,
          reachable: statusInfo.status !== 'stopped',
          status: statusInfo.status,
        });
      } else {
        results.push({
          name: printer.name,
          reachable: false,
          status: 'unreachable',
        });
      }
    }

    log.info({ printerCount: results.length }, '打印机连通性检测完成');
    return results;
  }

  /**
   * 获取 CUPS 错误日志
   *
   * 读取 /var/log/cups/error_log 末尾 N 行。
   *
   * @param {number} [lines=100] - 读取行数
   * @returns {Promise<string>} 日志内容，不存在时返回空字符串
   */
  async function getCupsErrorLog(lines = 100) {
    const result = await safeExecResult('tail', ['-n', String(lines), '/var/log/cups/error_log']);
    if (result.success) {
      return result.stdout;
    }

    // 日志文件可能不存在或无权限
    log.debug({ stderr: result.stderr }, 'CUPS 错误日志读取失败');
    return '';
  }

  /**
   * 一键诊断
   *
   * 综合检查：CUPS 状态 + 打印机状态 + 磁盘空间 + 队列状态。
   * 各项检查并行执行，任一检查失败不影响其他检查结果。
   *
   * @returns {Promise<{ checks: Array<{ name: string, status: 'ok'|'warning'|'error', detail: string|object }>, timestamp: string }>}
   */
  async function runDiagnostics() {
    log.info('开始执行一键诊断');

    const checks = [];

    // 并行执行所有检查
    const [cupsStatusResult, printersResult, diskResult, queueStatsResult] = await Promise.allSettled([
      getCupsStatus(),
      checkPrinterConnectivity(),
      safeExecResult('df', ['-h', '/']),
      Promise.resolve(jobManager.getStats()),
    ]);

    // 1. CUPS 服务状态
    if (cupsStatusResult.status === 'fulfilled') {
      const cupsInfo = cupsStatusResult.value;
      checks.push({
        name: 'CUPS 服务',
        status: cupsInfo.active ? 'ok' : 'error',
        detail: cupsInfo.detail,
      });
    } else {
      checks.push({
        name: 'CUPS 服务',
        status: 'error',
        detail: `检查失败: ${cupsStatusResult.reason?.message || '未知错误'}`,
      });
    }

    // 2. 打印机状态
    if (printersResult.status === 'fulfilled') {
      const printers = printersResult.value;
      if (printers.length === 0) {
        checks.push({
          name: '打印机',
          status: 'warning',
          detail: '未检测到任何打印机',
        });
      } else {
        const unreachable = printers.filter((p) => !p.reachable);
        if (unreachable.length > 0) {
          checks.push({
            name: '打印机',
            status: 'warning',
            detail: `${printers.length} 台打印机，${unreachable.length} 台不可达: ${unreachable.map((p) => p.name).join(', ')}`,
          });
        } else {
          checks.push({
            name: '打印机',
            status: 'ok',
            detail: `${printers.length} 台打印机全部正常`,
          });
        }
      }
    } else {
      checks.push({
        name: '打印机',
        status: 'error',
        detail: `检查失败: ${printersResult.reason?.message || '未知错误'}`,
      });
    }

    // 3. 磁盘空间
    if (diskResult.status === 'fulfilled' && diskResult.value.success) {
      const dfOutput = diskResult.value.stdout;
      // 解析 df 输出中的使用率百分比
      const lines = dfOutput.split('\n');
      let diskStatus = 'ok';
      let diskDetail = dfOutput.trim();

      if (lines.length >= 2) {
        const usageMatch = lines[1].match(/(\d+)%/);
        if (usageMatch) {
          const usagePercent = parseInt(usageMatch[1], 10);
          if (usagePercent >= 90) {
            diskStatus = 'error';
            diskDetail = `磁盘使用率 ${usagePercent}%，空间严重不足`;
          } else if (usagePercent >= 75) {
            diskStatus = 'warning';
            diskDetail = `磁盘使用率 ${usagePercent}%，空间偏紧`;
          } else {
            diskDetail = `磁盘使用率 ${usagePercent}%`;
          }
        }
      }

      checks.push({
        name: '磁盘空间',
        status: diskStatus,
        detail: diskDetail,
      });
    } else {
      checks.push({
        name: '磁盘空间',
        status: 'warning',
        detail: '无法检测磁盘空间',
      });
    }

    // 4. 内部队列状态
    if (queueStatsResult.status === 'fulfilled') {
      const stats = queueStatsResult.value;
      const queueSize = stats.queueSize || 0;
      const maxQueue = config.maxQueueSize || 1000;
      const queueUsage = queueSize / maxQueue;

      let queueStatus = 'ok';
      let queueDetail = `队列负载 ${queueSize}/${maxQueue}`;

      if (queueUsage >= 0.9) {
        queueStatus = 'error';
        queueDetail += '，队列即将满载';
      } else if (queueUsage >= 0.7) {
        queueStatus = 'warning';
        queueDetail += '，队列负载较高';
      }

      checks.push({
        name: '任务队列',
        status: queueStatus,
        detail: queueDetail,
      });
    } else {
      checks.push({
        name: '任务队列',
        status: 'error',
        detail: `检查失败: ${queueStatsResult.reason?.message || '未知错误'}`,
      });
    }

    const result = {
      checks,
      timestamp: new Date().toISOString(),
    };

    log.info({ checksCount: checks.length }, '一键诊断完成');
    addAuditLog(null, 'maintenance_diagnostics', `诊断完成，共 ${checks.length} 项检查`);

    return result;
  }

  /**
   * 获取 CUPS 服务状态
   *
   * 优先使用 systemctl is-active cups，失败则尝试 service cups status。
   *
   * @returns {Promise<{ active: boolean, detail: string }>}
   */
  async function getCupsStatus() {
    // 方法 1: systemctl is-active cups
    const systemctlResult = await safeExecResult('systemctl', ['is-active', 'cups']);
    if (systemctlResult.success) {
      const status = systemctlResult.stdout.trim();
      return {
        active: status === 'active',
        detail: status,
      };
    }

    // 方法 2: service cups status
    const serviceResult = await safeExecResult('service', ['cups', 'status']);
    if (serviceResult.success) {
      const output = serviceResult.stdout.trim();
      // 检查输出中是否包含 running 关键词
      const isRunning = /running/i.test(output);
      return {
        active: isRunning,
        detail: output.substring(0, 200), // 截断过长输出
      };
    }

    // 两种方式均失败，CUPS 可能未安装
    return {
      active: false,
      detail: 'CUPS 服务状态检测失败（systemctl 和 service 命令均不可用）',
    };
  }

  return {
    clearAllQueues,
    restartCupsService,
    checkPrinterConnectivity,
    getCupsErrorLog,
    runDiagnostics,
    getCupsStatus,
  };
}
