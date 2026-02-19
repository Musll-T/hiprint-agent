import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// 项目根目录（package.json 所在目录）
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

/** 默认配置文件路径 */
const DEFAULT_CONFIG_PATH = resolve(PROJECT_ROOT, 'config.json');

/** 当前生效的配置对象 */
let _config = null;

/** 当前配置文件路径 */
let _configPath = DEFAULT_CONFIG_PATH;

/**
 * 校验配置项合法性
 * @param {object} cfg - 待校验的配置对象
 * @throws {Error} 校验失败时抛出错误
 */
function validateConfig(cfg) {
  const errors = [];

  // 端口范围校验
  if (cfg.port !== undefined) {
    if (!Number.isInteger(cfg.port) || cfg.port < 1024 || cfg.port > 65535) {
      errors.push(`port 必须为 1024-65535 之间的整数，当前值: ${cfg.port}`);
    }
  }
  if (cfg.adminPort !== undefined) {
    if (!Number.isInteger(cfg.adminPort) || cfg.adminPort < 1024 || cfg.adminPort > 65535) {
      errors.push(`adminPort 必须为 1024-65535 之间的整数，当前值: ${cfg.adminPort}`);
    }
  }

  // 并发数校验
  if (cfg.renderConcurrency !== undefined) {
    if (!Number.isInteger(cfg.renderConcurrency) || cfg.renderConcurrency < 1 || cfg.renderConcurrency > 20) {
      errors.push(`renderConcurrency 必须为 1-20 之间的整数，当前值: ${cfg.renderConcurrency}`);
    }
  }
  if (cfg.printConcurrency !== undefined) {
    if (!Number.isInteger(cfg.printConcurrency) || cfg.printConcurrency < 1 || cfg.printConcurrency > 20) {
      errors.push(`printConcurrency 必须为 1-20 之间的整数，当前值: ${cfg.printConcurrency}`);
    }
  }
  if (cfg.browserPoolSize !== undefined) {
    if (!Number.isInteger(cfg.browserPoolSize) || cfg.browserPoolSize < 1 || cfg.browserPoolSize > 20) {
      errors.push(`browserPoolSize 必须为 1-20 之间的整数，当前值: ${cfg.browserPoolSize}`);
    }
  }

  // 预览目录校验
  if (cfg.previewDir !== undefined) {
    if (typeof cfg.previewDir !== 'string') {
      errors.push(`previewDir 必须为字符串类型，当前值: ${cfg.previewDir}`);
    }
  }

  // 队列大小校验
  if (cfg.maxQueueSize !== undefined) {
    if (!Number.isInteger(cfg.maxQueueSize) || cfg.maxQueueSize < 1 || cfg.maxQueueSize > 10000) {
      errors.push(`maxQueueSize 必须为 1-10000 之间的整数，当前值: ${cfg.maxQueueSize}`);
    }
  }

  // 中转客户端配置校验
  if (cfg.connectTransit !== undefined && typeof cfg.connectTransit !== 'boolean') {
    errors.push(`connectTransit 必须为 boolean 类型，当前值: ${cfg.connectTransit}`);
  }
  if (cfg.connectTransit === true) {
    if (!cfg.transitUrl || typeof cfg.transitUrl !== 'string') {
      errors.push('connectTransit 启用时 transitUrl 必须为非空字符串');
    } else {
      try {
        const url = new URL(cfg.transitUrl);
        const allowed = new Set(['http:', 'https:', 'ws:', 'wss:']);
        if (!allowed.has(url.protocol)) {
          errors.push(`transitUrl 协议不支持: ${url.protocol}，仅允许 http/https/ws/wss`);
        }
      } catch {
        errors.push(`transitUrl 格式非法: ${cfg.transitUrl}`);
      }
    }
    if (!cfg.transitToken || typeof cfg.transitToken !== 'string') {
      errors.push('connectTransit 启用时 transitToken 必须为非空字符串');
    }
  }

  // Admin 认证配置校验（可选，不存在时禁用认证）
  if (cfg.admin !== undefined) {
    if (typeof cfg.admin !== 'object' || cfg.admin === null || Array.isArray(cfg.admin)) {
      errors.push('admin 必须为对象类型');
    } else {
      if (!cfg.admin.username || typeof cfg.admin.username !== 'string') {
        errors.push('admin.username 必须为非空字符串');
      }
      if (!cfg.admin.password || typeof cfg.admin.password !== 'string') {
        errors.push('admin.password 必须为非空字符串');
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`配置校验失败:\n  - ${errors.join('\n  - ')}`);
  }
}

/**
 * 加载配置文件
 * @param {string} [configPath] - 配置文件路径，默认为项目根目录下的 config.json
 * @returns {object} 加载后的配置对象
 */
export function loadConfig(configPath) {
  _configPath = configPath ? resolve(configPath) : DEFAULT_CONFIG_PATH;

  const raw = readFileSync(_configPath, 'utf-8');
  const parsed = JSON.parse(raw);

  validateConfig(parsed);

  _config = parsed;
  return getConfig();
}

/**
 * 获取当前配置快照（深拷贝，防止外部意外修改内部状态）
 * @returns {object} 配置对象的深拷贝
 */
export function getConfig() {
  if (!_config) {
    throw new Error('配置尚未加载，请先调用 loadConfig()');
  }
  return JSON.parse(JSON.stringify(_config));
}

/**
 * 合并更新配置并写入文件
 * @param {object} partial - 需要更新的配置项（浅合并）
 * @returns {object} 更新后的配置快照
 */
export function updateConfig(partial) {
  if (!_config) {
    throw new Error('配置尚未加载，请先调用 loadConfig()');
  }

  // 先校验待合并的部分
  validateConfig(partial);

  // 浅合并（cors 等嵌套对象需要单独处理）
  const merged = { ..._config };
  for (const [key, value] of Object.entries(partial)) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      // 嵌套对象做一层合并
      merged[key] = { ...(merged[key] || {}), ...value };
    } else {
      merged[key] = value;
    }
  }

  // 对合并结果做全量校验
  validateConfig(merged);

  _config = merged;
  writeFileSync(_configPath, JSON.stringify(_config, null, 2), 'utf-8');

  return getConfig();
}

/** 导出配置单例（只读代理，访问时自动转发到内部 _config） */
export const config = new Proxy(
  {},
  {
    get(_target, prop) {
      if (!_config) {
        throw new Error('配置尚未加载，请先调用 loadConfig()');
      }
      return _config[prop];
    },
    set() {
      throw new Error('禁止直接修改 config，请使用 updateConfig()');
    },
    ownKeys() {
      if (!_config) return [];
      return Reflect.ownKeys(_config);
    },
    getOwnPropertyDescriptor(_target, prop) {
      if (!_config) return undefined;
      if (prop in _config) {
        return { configurable: true, enumerable: true, value: _config[prop] };
      }
      return undefined;
    },
  }
);
