import { hostname, platform, arch, cpus, totalmem, freemem, uptime } from 'node:os';
import { version as nodeVersion } from 'node:process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { v4 as uuidv4 } from 'uuid';
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
 * 检测当前是否运行在 Docker 容器内
 * @returns {boolean}
 */
function isRunningInDocker() {
  try {
    // 方式 1：/.dockerenv 文件是 Docker 容器的标志
    if (existsSync('/.dockerenv')) return true;
    // 方式 2：cgroup 中包含 docker / containerd / kubepods 标识
    const cgroup = readFileSync('/proc/1/cgroup', 'utf-8');
    return /docker|containerd|kubepods/.test(cgroup);
  } catch {
    return false;
  }
}

/**
 * 获取持久化的 machine-id 文件路径
 * 存放在 data 目录下（Docker 部署时通过 volume 挂载持久化）
 */
function getPersistentIdPath() {
  // 优先使用 config.json 中配置的 dbPath 所在目录，保证与数据目录一致
  const projectRoot = resolve(__dirname, '..', '..');
  const dataDir = resolve(projectRoot, 'data');
  return resolve(dataDir, 'machine-id');
}

/**
 * 从持久化文件读取或生成 machine-id（用于 Docker 等容器环境）
 * @returns {string} UUID 格式的唯一 ID
 */
function getOrCreatePersistentId() {
  const idPath = getPersistentIdPath();

  // 尝试读取已有的持久化 ID
  try {
    const existing = readFileSync(idPath, 'utf-8').trim();
    if (existing) return existing;
  } catch {
    // 文件不存在，继续生成
  }

  // 生成新 UUID 并写入
  const newId = uuidv4();
  try {
    const dir = dirname(idPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(idPath, newId, 'utf-8');
  } catch {
    // 写入失败（只读文件系统等），仍返回生成的 ID（本次进程内有效）
  }
  return newId;
}

/**
 * 获取客户端唯一 ID
 *
 * 非容器环境下与 electron-hiprint 保持一致，读取系统 machine-id：
 *   - Windows: HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid
 *   - Linux:   /var/lib/dbus/machine-id 或 /etc/machine-id
 *   - macOS:   IOKit 系统属性
 *
 * Docker 容器环境下，由于所有容器共享镜像层的 /etc/machine-id，
 * 回退为持久化到 data/machine-id 的 UUID，通过 volume 挂载保证唯一性和持久性。
 *
 * @returns {string} 机器唯一 ID，获取失败返回空字符串
 */
export function getMachineId() {
  try {
    // Docker 容器内不信任系统 machine-id（镜像层共享导致所有容器相同）
    if (isRunningInDocker()) {
      return getOrCreatePersistentId();
    }
    return machineIdSync({ original: true });
  } catch {
    // 兜底：尝试持久化 ID
    try {
      return getOrCreatePersistentId();
    } catch {
      return '';
    }
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
