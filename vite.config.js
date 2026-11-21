import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig({
  server: { host: '0.0.0.0' },
  build: { rollupOptions: { input: {
    app: resolve(import.meta.dirname, 'index.html'),
    tools: resolve(import.meta.dirname, 'mock-tools.html'),
  } } },
});
