import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    // Migrate once, then run the files one after another: they share one database.
    globalSetup: ['test/global-setup.ts'],
    fileParallelism: false,
  },
});
