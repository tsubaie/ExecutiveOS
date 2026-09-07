import { execFileSync } from 'node:child_process';
import { request, type FullConfig } from '@playwright/test';
import { credentials } from './fixtures/auth';
// Runs after the web server is up: provisions the browser-test administrator through the real
// first-run setup API when the workspace is empty, otherwise reuses the credentials file.
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL ?? 'http://localhost:3000';
  const state = execFileSync(
    process.execPath,
    ['--conditions=react-server', '--import', 'tsx', 'scripts/db/e2e-account.ts'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
  ).trim();
  if (state !== 'provisioned') return;
  const account = await credentials();
  const api = await request.newContext({
    baseURL,
    extraHTTPHeaders: { Origin: baseURL, 'X-Requested-With': 'ExecutiveOS' },
  });
  const response = await api.post('/api/v1/setup', {
    data: {
      email: account.email,
      password: account.password,
      name: account.name,
      workspaceName: 'E2E Office',
      locale: 'en',
      timezone: 'UTC',
      setupToken: account.setupToken,
      principalName: '',
    },
  });
  if (!response.ok())
    throw new Error(`First-run setup failed: ${response.status()} ${await response.text()}`);
  await api.dispose();
}
