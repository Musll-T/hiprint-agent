/**
 * resources.js - Playwright 页面资源注入
 *
 * 向渲染页面注入条码/二维码生成库和基础样式，
 * 保持与 electron-hiprint 渲染环境的兼容性。
 *
 * 注意：脚本优先从本地加载（安全且无网络依赖），
 * 本地不存在时降级到 CDN（开发/快速部署场景）。
 */

import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLogger } from '../logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * 脚本资源定义
 * localPath: 本地文件路径（相对于 src/renderer/）
 * cdnUrl: CDN 降级地址
 */
const SCRIPT_RESOURCES = [
  {
    name: 'bwip-js',
    localPath: resolve(__dirname, '..', 'public', 'vendor', 'bwip-js.min.js'),
    cdnUrl: 'https://cdn.jsdelivr.net/npm/bwip-js@4',
  },
  {
    name: 'jsbarcode',
    localPath: resolve(__dirname, '..', 'public', 'vendor', 'JsBarcode.all.min.js'),
    cdnUrl: 'https://cdn.jsdelivr.net/npm/jsbarcode@3',
  },
  {
    name: 'nzh',
    localPath: resolve(__dirname, '..', 'public', 'vendor', 'nzh.min.js'),
    cdnUrl: 'https://cdn.jsdelivr.net/npm/nzh@1',
  },
];

/**
 * 获取需要注入的脚本资源列表
 * @returns {Array<{ name: string, localPath: string, cdnUrl: string }>}
 */
export function getInjectScripts() {
  return [...SCRIPT_RESOURCES];
}

/**
 * 获取需要注入的基础样式
 * 包含 CJK 字体声明和打印相关样式
 * @returns {string} CSS 样式字符串
 */
export function getInjectStyles() {
  return `
/* CJK 字体声明 - 优先使用系统已安装的 Noto Sans CJK */
@font-face {
  font-family: 'Noto Sans CJK SC';
  src: local('Noto Sans CJK SC'),
       local('Noto Sans SC'),
       local('Source Han Sans SC');
  font-weight: normal;
  font-style: normal;
}

@font-face {
  font-family: 'Noto Sans CJK SC';
  src: local('Noto Sans CJK SC Bold'),
       local('Noto Sans SC Bold'),
       local('Source Han Sans SC Bold');
  font-weight: bold;
  font-style: normal;
}

/* 基础打印样式 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Noto Sans CJK SC', 'Microsoft YaHei', 'SimSun', sans-serif;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

/* 打印媒体查询 */
@media print {
  body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
`.trim();
}

/**
 * 向 Playwright 页面注入所有资源（脚本 + 样式）
 *
 * 脚本加载策略：优先从本地文件加载（安全、离线可用），
 * 本地文件不存在时降级到 CDN（记录警告日志）。
 * 单个脚本加载失败不会中断整体流程。
 *
 * @param {import('playwright').Page} page - Playwright 页面实例
 */
export async function injectResources(page) {
  const log = getLogger();

  // 注入基础样式
  try {
    await page.addStyleTag({ content: getInjectStyles() });
  } catch (err) {
    log.warn({ err }, '注入基础样式失败');
  }

  // 逐个注入脚本，优先本地文件，降级到 CDN
  for (const resource of SCRIPT_RESOURCES) {
    try {
      if (existsSync(resource.localPath)) {
        await page.addScriptTag({ path: resource.localPath });
      } else {
        log.warn(
          { name: resource.name, localPath: resource.localPath },
          '本地脚本不存在，降级使用 CDN（建议下载到本地以消除供应链风险）'
        );
        await page.addScriptTag({ url: resource.cdnUrl });
      }
    } catch (err) {
      log.warn({ err, name: resource.name }, '脚本加载失败，已跳过');
    }
  }
}
