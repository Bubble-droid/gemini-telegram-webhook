// vite.config.ts
import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import { builtinModules } from 'node:module';

const srcPath = fileURLToPath(new URL('./src', import.meta.url));

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
      input: 'src/server.ts',
      external: [...builtinModules, ...builtinModules.map((m) => `node:${m}`)],
      output: {
        format: 'esm',
        entryFileNames: 'index.js',
        inlineDynamicImports: true,
      },
    },
  },
});
