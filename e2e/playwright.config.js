import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4000',
    browserName: 'chromium',
    viewport: { width: 1366, height: 768 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'node node_modules/webpack-cli/bin/cli.js serve',
      cwd: fileURLToPath(new URL('../', import.meta.url)),
      url: 'http://localhost:4000',
      env: { CI: '1' },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'node node_modules/webpack-cli/bin/cli.js serve',
      cwd: fileURLToPath(new URL('../poc/demo-game/', import.meta.url)),
      url: 'http://localhost:4001/remoteEntry.js',
      env: { CI: '1' },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
