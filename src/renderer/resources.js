/**
 * resources.js - Playwright 页面资源注入
 *
 * 向渲染页面注入条码/二维码生成库和基础样式，
 * 保持与 electron-hiprint 渲染环境的兼容性。
 */

import { getLogger } from '../logger.js';

/** CDN 脚本地址列表 */
const SCRIPT_URLS = [
  'https://cdn.jsdelivr.net/npm/bwip-js@4',
  'https://cdn.jsdelivr.net/npm/jsbarcode@3',
  'https://cdn.jsdelivr.net/npm/nzh@1',
];

/**
 * 获取需要注入的脚本 URL 列表
 * @returns {string[]} CDN 脚本 URL 数组
 */
export function getInjectScripts() {
  return [...SCRIPT_URLS];
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
 * 注入过程采用容错策略：单个 CDN 脚本加载失败不会中断整体流程，
 * 仅记录警告日志并跳过该脚本。
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

  // 逐个注入 CDN 脚本，单个失败不影响其他脚本
  for (const url of SCRIPT_URLS) {
    try {
      await page.addScriptTag({ url });
    } catch (err) {
      log.warn({ err, url }, 'CDN 脚本加载失败，已跳过');
    }
  }
}
