import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  root: resolve(__dirname),
  plugins: [vue()],
  base: '/',
  resolve: {
    alias: {
      '@': resolve(__dirname),
    },
  },
  build: {
    outDir: resolve(__dirname, '..', 'public'),
    emptyOutDir: false,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:17522',
      '/admin-ws': {
        target: 'http://localhost:17522',
        ws: true,
      },
    },
  },
});
