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
    sourcemap: 'inline',
    minify: 'esbuild',
    rollupOptions: {
      input: 'src/main.ts',
      output: {
        format: 'esm',
        entryFileNames: 'index.mjs',
        inlineDynamicImports: true,
      },
    },
  },
  ssr: {
    noExternal: true,
    target: 'node',
  },
});
