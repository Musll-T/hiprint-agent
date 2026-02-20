import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // 未使用变量警告（下划线前缀参数忽略）
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // 禁止 console（保留 error 和 warn）
      'no-console': ['warn', { allow: ['error', 'warn'] }],
      // 优先使用 const
      'prefer-const': 'error',
      // 禁止 var
      'no-var': 'error',
      // 严格相等
      'eqeqeq': ['error', 'always'],
      // 多行代码块必须加花括号
      'curly': ['error', 'multi-line'],
      // 禁止 throw 字面量
      'no-throw-literal': 'error',
    },
  },
  // 前端浏览器脚本：添加 browser globals，放宽 no-console
  {
    files: ['src/public/js/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
  {
    ignores: ['src/public/vendor/**', 'node_modules/**', 'data/**', 'logs/**'],
  },
];
