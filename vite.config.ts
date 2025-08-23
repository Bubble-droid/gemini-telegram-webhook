// vite.config.ts

import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import path from 'node:path';
import process from 'node:process';
import { builtinModules } from 'node:module';
import alias from '@rollup/plugin-alias';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import cleanup from 'rollup-plugin-cleanup';

const srcPath = fileURLToPath(new URL('./src', import.meta.url));

const viteAlias = {
  '@': srcPath,
};

export default defineConfig({
  resolve: {
    alias: viteAlias,
  },
  build: {
    ssr: true,
    target: ['esnext', 'node24'],
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    sourcemap: true,
    minify: false,
    rollupOptions: {
      input: path.resolve(__dirname, 'src/server.ts'),
      external: [...builtinModules, ...builtinModules.map((m) => `node:${m}`)],
      output: {
        format: 'esm',
        entryFileNames: 'index.js',
        inlineDynamicImports: true,
        exports: 'named',
      },
      plugins: [
        alias({
          entries: Object.entries(viteAlias).map(([find, replacement]) => ({ find, replacement })),
        }),
        nodeResolve({
          preferBuiltins: true,
          browser: false,
          exportConditions: ['node', 'default', 'import', 'module'],
          extensions: ['.mjs', '.js', '.ts', '.json'],
        }),
        cleanup({
          comments: 'none',
          extensions: ['js', 'ts'],
        }),
      ],
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
  },
});
