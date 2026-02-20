/**
 * useTheme - Naive UI 主题配置
 *
 * 提供暗色主题，与现有 CSS 变量色板对齐。
 */

import { darkTheme } from 'naive-ui';

export function useTheme() {
  return {
    theme: darkTheme,
  };
}
