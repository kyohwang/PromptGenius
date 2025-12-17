import { defineConfig } from 'vite';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: {
        content: resolve(__dirname, 'src/content/index.ts'),
        serviceWorker: resolve(__dirname, 'src/background/serviceWorker.ts'),
        options: resolve(__dirname, 'src/options/main.ts')
      },
      output: {
        entryFileNames: (chunk) => `assets/${chunk.name}.js`,
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
        format: 'iife',
        inlineDynamicImports: false
      }
    }
  }
});
