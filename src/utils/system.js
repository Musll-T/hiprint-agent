import { hostname, platform, arch, cpus, totalmem, freemem, uptime } from 'node:os';
import { version as nodeVersion } from 'node:process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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
 * 获取当前系统信息摘要
 * @returns {{
 *   hostname: string,
 *   version: string,
 *   platform: string,
 *   arch: string,
 *   cpuModel: string,
 *   cpuCount: number,
 *   totalMem: number,
 *   freeMem: number,
 *   uptime: number
 * }} 系统信息对象
 */
export function getSystemInfo() {
  const cpuList = cpus();
  return {
    hostname: hostname(),
    version: appVersion,
    platform: platform(),
    arch: arch(),
    cpuModel: cpuList.length > 0 ? cpuList[0].model : 'unknown',
    cpuCount: cpuList.length,
    totalMem: totalmem(),
    freeMem: freemem(),
    uptime: uptime(),
  };
}
