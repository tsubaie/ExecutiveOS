import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { expect, type Page } from '@playwright/test';
import en from '../../src/core/i18n/messages/en.json' with { type: 'json' };
import ar from '../../src/core/i18n/messages/ar.json' with { type: 'json' };
export const credentialsFile = 'e2e/.auth/credentials.json';
export const Credentials = z.object({
  email: z.string(),
  password: z.string(),
  name: z.string(),
  setupToken: z.string().optional(),
});
export async function credentials() {
  return Credentials.parse(JSON.parse(await readFile(credentialsFile, 'utf8')));
}
export async function loginAs(page: Page, locale: string) {
  const account = await credentials();
  await page
    .context()
    .addCookies([{ name: 'eos_locale', value: locale, url: 'http://localhost:3000' }]);
  const messages = locale === 'ar' ? ar : en;
  await page.goto('/login');
  await page.getByLabel(messages.auth.email).fill(account.email);
  await page.getByLabel(messages.auth.password).fill(account.password);
  await page.getByRole('button', { name: messages.auth.login, exact: true }).click();
  await expect(page).toHaveURL(/home/);
}
