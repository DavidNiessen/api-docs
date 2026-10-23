import { readFileSync } from 'node:fs';
import { defineConfig } from '@playwright/test';
const site = JSON.parse(readFileSync('.api-docs/pages-demo/site.json', 'utf8'));
export default defineConfig({
  testDir: './tests/pages',
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-pages-report', open: 'never' }],
  ],
  use: {
    baseURL: `http://127.0.0.1:4180${site.config.basePath}/`,
    browserName: 'chromium',
    launchOptions: {
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
        : {}),
      args: ['--no-sandbox'],
    },
    trace: 'retain-on-failure',
    serviceWorkers: 'block',
  },
  webServer: {
    command: 'node scripts/pages-demo-browser-fixture.mjs',
    url: `http://127.0.0.1:4180${site.config.basePath}/`,
    reuseExistingServer: false,
  },
});
