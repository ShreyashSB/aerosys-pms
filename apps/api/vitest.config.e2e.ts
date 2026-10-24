import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // The seed test loads the web app's demo generator, which imports with "@/…".
  resolve: { alias: { '@': fileURLToPath(new URL('../web/src', import.meta.url)) } },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    // Migrate once, then run the files one after another: they share one database.
    globalSetup: ['test/global-setup.ts'],
    fileParallelism: false,
  },
});
