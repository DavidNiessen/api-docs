import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/integration/**'],
    testTimeout: 15_000,
    passWithNoTests: false,
    maxWorkers: 2,
  },
});
