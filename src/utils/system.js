import { hostname, platform, arch, cpus, totalmem, freemem, uptime } from 'node:os';
import { version as nodeVersion } from 'node:process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import machineId from 'node-machine-id';
const { machineIdSync } = machineId;

// 读取 package.json 中的版本号（启动时一次性读取）
const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = resolve(__dirname, '..', '..', 'package.json');
let appVersion = 'unknown';
try {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  appVersion = pkg.version || 'unknown';
} catch {
  // package.json 读取失败时使用默认值
}

/**
 * 获取客户端唯一 ID，与 electron-hiprint 保持一致
 *
 * 来源：
 *   - Windows: HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid
 *   - Linux:   /var/lib/dbus/machine-id 或 /etc/machine-id
 *   - macOS:   IOKit 系统属性
 *
 * @returns {string} 机器唯一 ID，获取失败返回空字符串
 */
export function getMachineId() {
  try {
    return machineIdSync({ original: true });
  } catch {
    // Docker 容器或受限环境中可能无法获取，返回空字符串
    return '';
  }
}

/**
 * 获取当前系统信息摘要（含 machineId）
 */
export function getSystemInfo() {
  const cpuList = cpus();
  return {
    hostname: hostname(),
    version: appVersion,
    platform: platform(),
    arch: arch(),
    machineId: getMachineId(),
    cpuModel: cpuList.length > 0 ? cpuList[0].model : 'unknown',
    cpuCount: cpuList.length,
    totalMem: totalmem(),
    freeMem: freemem(),
    uptime: uptime(),
  };
}
