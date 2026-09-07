import { defineConfig } from '@playwright/test';
import { lookup } from 'node:dns/promises';
const { address } = await lookup('app');
export default defineConfig({
  testDir: '../e2e',
  globalSetup: '../e2e/global-setup.ts',
  workers: 1,
  timeout: 60000,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    launchOptions: { args: [`--host-resolver-rules=MAP localhost ${address}`] },
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
