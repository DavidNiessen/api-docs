import { defineConfig } from '@playwright/test';
import { randomBytes } from 'node:crypto';
if (!process.env.TEST_DATABASE_URL)
  throw new Error('TEST_DATABASE_URL is required for studio browser tests');
process.env.TEST_ROOT_TOKEN ??= randomBytes(32).toString('base64url');
export default defineConfig({
  testDir: './tests/studio',
  workers: 1,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:8082',
    launchOptions: {
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
        : {}),
      args: ['--no-sandbox'],
    },
  },
  webServer: {
    command: 'node apps/server/dist/main.js',
    url: 'http://127.0.0.1:8082/health/ready',
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL,
      ROOT_TOKEN: process.env.TEST_ROOT_TOKEN,
      PUBLIC_URL: 'http://127.0.0.1:8082',
      INSECURE_DEVELOPMENT: 'true',
      PORT: '8082',
      ARTIFACT_ROOT: '.api-docs/studio-test/artifacts',
    },
    reuseExistingServer: false,
  },
});
