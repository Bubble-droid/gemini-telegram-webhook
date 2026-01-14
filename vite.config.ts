// vite.config.ts
import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  base: './',
  mode: 'production',
  plugins: [tsconfigPaths()],
  build: {
    ssr: true,
    target: 'esnext',
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    minify: 'esbuild',
    rollupOptions: {
      input: 'src/main.ts',
      output: {
        format: 'esm',
        entryFileNames: 'index.js',
        inlineDynamicImports: true,
      },

      plugins: [nodeResolve(), commonjs({ extensions: ['cjs', '.mjs', '.ts'] }), typescript()],
    },
  },
  ssr: { noExternal: true, target: 'node' },
});
