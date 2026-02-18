/**
 * CUPS 命令封装模块
 *
 * 通过 lpstat / lp / cancel 等命令与 CUPS 打印系统交互。
 * 所有函数均为异步，在 CUPS 不可用时优雅降级（返回空结果 + 警告日志）。
 */

import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { getLogger } from '../logger.js';

const execFile = promisify(execFileCb);

/**
 * 安全执行外部命令，捕获错误并记录警告
 * @param {string} cmd - 命令名称
 * @param {string[]} args - 命令参数
 * @returns {Promise<string>} 命令标准输出，失败时返回空字符串
 */
async function safeExec(cmd, args = []) {
  const log = getLogger();
  try {
    const { stdout } = await execFile(cmd, args);
    return stdout || '';
  } catch (err) {
    // ENOENT 表示命令不存在（CUPS 未安装）
    if (err.code === 'ENOENT') {
      log.warn({ cmd }, '命令不存在，可能未安装 CUPS');
    } else {
      log.warn({ cmd, args, message: err.message }, 'CUPS 命令执行失败');
    }
    return '';
  }
}

/**
 * 解析 lpstat -p 输出中的单台打印机信息
 * @param {string} line - lpstat 输出行
 * @returns {{ name: string, status: string, description: string } | null}
 */
function parsePrinterLine(line) {
  // 格式: "printer <name> is idle. ..."
  //        "printer <name> disabled since ..."
  //        "printer <name> now printing <job>. ..."
  const match = line.match(/^printer\s+(\S+)\s+(.*)/);
  if (!match) return null;

  const name = match[1];
  const rest = match[2];

  let status = 'idle';
  let description = rest;

  if (/disabled/i.test(rest)) {
    status = 'stopped';
  } else if (/printing/i.test(rest)) {
    status = 'printing';
  } else if (/idle/i.test(rest)) {
    status = 'idle';
  }

  return { name, status, description: description.trim() };
}

/**
 * 列出所有可用打印机
 * @returns {Promise<Array<{ name: string, status: string, isDefault: boolean, description: string }>>}
 */
export async function listPrinters() {
  const output = await safeExec('lpstat', ['-p', '-d']);
  if (!output) return [];

  const lines = output.split('\n');
  const printers = [];
  let defaultPrinter = null;

  for (const line of lines) {
    // 提取系统默认打印机
    const defaultMatch = line.match(/system default destination:\s*(\S+)/);
    if (defaultMatch) {
      defaultPrinter = defaultMatch[1];
      continue;
    }

    const printer = parsePrinterLine(line);
    if (printer) {
      printers.push(printer);
    }
  }

  // 标记默认打印机
  return printers.map((p) => ({
    ...p,
    isDefault: p.name === defaultPrinter,
  }));
}

/**
 * 获取指定打印机的状态
 * @param {string} name - 打印机名称
 * @returns {Promise<{ name: string, status: string, description: string } | null>}
 */
export async function getPrinterStatus(name) {
  if (!name) return null;

  const output = await safeExec('lpstat', ['-p', name]);
  if (!output) return null;

  const lines = output.split('\n');
  for (const line of lines) {
    const printer = parsePrinterLine(line);
    if (printer) return printer;
  }

  return null;
}

/**
 * 获取打印队列中的任务
 * @param {string} [printer] - 可选，指定打印机名称；不传则列出所有任务
 * @returns {Promise<Array<{ jobId: string, printer: string, user: string, size: number }>>}
 */
export async function getQueueJobs(printer) {
  const args = printer ? ['-o', printer] : ['-o'];
  const output = await safeExec('lpstat', args);
  if (!output) return [];

  const jobs = [];
  const lines = output.split('\n');

  for (const line of lines) {
    // 格式: "<printer>-<id> <user> <size> <date...>"
    // 例如: "HP_LaserJet-123 root 1024 Mon Jan 01 12:00:00 2024"
    const match = line.match(/^(\S+)-(\d+)\s+(\S+)\s+(\d+)\s+/);
    if (match) {
      jobs.push({
        jobId: `${match[1]}-${match[2]}`,
        printer: match[1],
        user: match[3],
        size: parseInt(match[4], 10),
      });
    }
  }

  return jobs;
}

/**
 * 提交文件到打印机
 * @param {string} filePath - 待打印文件的绝对路径
 * @param {string} printer - 目标打印机名称
 * @param {string[]} [options=[]] - lp 命令的附加选项数组
 * @returns {Promise<{ jobId: string }>}
 * @throws {Error} 提交失败时抛出
 */
export async function printFile(filePath, printer, options = []) {
  const log = getLogger();

  if (!filePath || !printer) {
    throw new Error('filePath 和 printer 参数不能为空');
  }

  // 构建参数: lp -d <printer> [options...] <file>
  const args = ['-d', printer, ...options, filePath];

  let stdout;
  try {
    const result = await execFile('lp', args);
    stdout = result.stdout || '';
  } catch (err) {
    log.error({ printer, filePath, message: err.message }, '打印任务提交失败');
    throw new Error(`打印任务提交失败: ${err.message}`);
  }

  // 从 lp 输出中解析 job ID
  // 格式: "request id is <printer>-<number> (1 file(s))"
  const idMatch = stdout.match(/request id is (\S+)/);
  const jobId = idMatch ? idMatch[1] : 'unknown';

  log.info({ jobId, printer, filePath }, '打印任务已提交');
  return { jobId };
}

/**
 * 取消打印任务
 * @param {string} jobId - 任务 ID（如 "HP_LaserJet-123"）
 * @returns {Promise<{ success: boolean }>}
 */
export async function cancelJob(jobId) {
  const log = getLogger();

  if (!jobId) {
    return { success: false };
  }

  try {
    await execFile('cancel', [jobId]);
    log.info({ jobId }, '打印任务已取消');
    return { success: true };
  } catch (err) {
    log.warn({ jobId, message: err.message }, '取消打印任务失败');
    return { success: false };
  }
}
