// vite.config.ts

import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'url';
import path from 'path';
import { nodeResolve } from '@rollup/plugin-node-resolve'; // 导入

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    ssr: true,
    target: ['esnext', 'node24'],
    outDir: 'dist', // 输出到 dist 目录
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: path.resolve(__dirname, 'src/server.ts'), // 本地服务器入口
      },
      output: {
        entryFileNames: '[name].js', // 输出文件名为 server.js
        format: 'esm', // 统一为 ES Modules 格式
      },
      plugins: [
        nodeResolve({
          browser: false, // 明确不是为浏览器构建
          preferBuiltins: true, // 优先使用 Node.js 内置模块
        }),
      ],
    },
    minify: true,
  },
  ssr: {
    noExternal: true,
  },
});
