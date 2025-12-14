// vite.config.ts
import { builtinModules } from 'node:module';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

const srcPath = fileURLToPath(new URL('./src', import.meta.url));
const externals = Array.from(new Set([...builtinModules, ...builtinModules.map((m) => `node:${m}`)]));

export default defineConfig({
  resolve: {
    alias: {
      '@': srcPath,
    },
  },
  build: {
    ssr: true,
    target: 'esnext',
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    minify: 'esbuild',
    rollupOptions: {
      input: 'src/main.ts',
      external: externals,
      output: {
        format: 'esm',
        entryFileNames: 'index.js',
        inlineDynamicImports: true,
      },
    },
  },
});
