import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ZodError } from 'zod';
import { ConfigSchema } from './schemas/config.schema.js';

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
 * 校验配置项合法性（基于 Zod Schema）
 * @param {object} cfg - 待校验的配置对象
 * @throws {Error} 校验失败时抛出错误，错误信息兼容旧格式
 */
function validateConfig(cfg) {
  try {
    return ConfigSchema.parse(cfg);
  } catch (err) {
    if (err instanceof ZodError) {
      const messages = err.errors.map((e) => `${e.path.join('.')} ${e.message}`);
      const error = new Error(`配置校验失败:\n  - ${messages.join('\n  - ')}`);
      error.statusCode = 400;
      throw error;
    }
    throw err;
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

  _config = validateConfig(parsed);
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

  // partial 是部分更新，字段可能不完整，仅对合并后的完整配置做校验
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
  _config = validateConfig(merged);

  // 原子写盘：先写临时文件再 rename，防止崩溃损坏 config.json
  const tmpPath = _configPath + '.tmp';
  writeFileSync(tmpPath, JSON.stringify(_config, null, 2), 'utf-8');
  renameSync(tmpPath, _configPath);

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
  },
);
