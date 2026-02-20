import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  root: resolve(__dirname),
  plugins: [vue()],
  base: '/',
  build: {
    outDir: resolve(__dirname, '..', 'public'),
    emptyOutDir: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'login.html'),
      },
    },
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
