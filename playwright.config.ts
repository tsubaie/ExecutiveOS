import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // Reuses a running preview on :3000; otherwise serves the production build for CI.
  webServer: {
    command: 'node .next/standalone/server.js',
    url: 'http://localhost:3000/api/v1/health',
    reuseExistingServer: true,
    timeout: 120000,
    env: { PORT: '3000', HOSTNAME: '127.0.0.1' },
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile',
      // Scenarios tagged @desktop exercise controls that only exist beside an open detail panel.
      grepInvert: /@desktop/u,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
