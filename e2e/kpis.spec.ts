import { test, expect, type Page } from '@playwright/test';
import { loginAs } from './fixtures/auth';
import en from '../src/core/i18n/messages/en.json' with { type: 'json' };
import ar from '../src/core/i18n/messages/ar.json' with { type: 'json' };
const quarterOfMonth = (month: number) => Math.floor(month / 3) + 1;
async function createKpi(page: Page, m: typeof en, name: string) {
  await page.goto(`/kpis?view=all&q=${encodeURIComponent(name)}`);
  await page.getByRole('button', { name: m.common.create, exact: true }).click();
  await page.getByLabel(m.kpis.name, { exact: true }).fill(name);
  await page.getByLabel(m.kpis.unit, { exact: true }).fill('pts');
  await page.getByRole('button', { name: m.common.create, exact: true }).last().click();
  await expect(page).toHaveURL(/id=/);
  return {
    detail: page.locator('aside.entity-detail'),
    id: new URL(page.url()).searchParams.get('id') ?? '',
  };
}
// Writes that a unit scenario already covers go through the API here, so a browser scenario spends
// its time on what it is about: whether the page recomputes what it shows.
const send = (page: Page, path: string, method: string, body: object) =>
  page.evaluate(
    async (call: { url: string; verb: string; payload: string }) => {
      await fetch(`/api/v1${call.url}`, {
        method: call.verb,
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'ExecutiveOS',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: call.payload,
      });
    },
    { url: path, verb: method, payload: JSON.stringify(body) },
  );
const addReading = (page: Page, id: string, day: string, value: number) =>
  send(page, `/kpis/${id}/readings`, 'POST', { readingDate: day, value, note: '' });
function setTarget(page: Page, id: string, targetValue: number) {
  const now = new Date();
  return send(page, `/kpis/${id}/targets`, 'PUT', {
    items: [
      {
        year: now.getUTCFullYear(),
        quarter: quarterOfMonth(now.getUTCMonth()),
        targetValue,
      },
    ],
  });
}
const today = () => new Date().toISOString().slice(0, 10);
for (const locale of ['en', 'ar']) {
  const m = locale === 'ar' ? ar : en;
  test(`KPIS-A01 KPIS-A05 a reading and a target move a KPI from no data to a scored status ${locale}`, async ({
    page,
  }) => {
    await loginAs(page, locale);
    const name = `KPI ${crypto.randomUUID()}`;
    const { detail, id } = await createKpi(page, m, name);
    // A measure with nothing recorded against it says so rather than scoring zero.
    await expect(detail.getByText(m.kpis.no_data, { exact: true }).first()).toBeVisible();
    await detail.getByRole('tab', { name: m.kpis.readings, exact: true }).click();
    await detail.getByLabel(m.kpis.reading, { exact: true }).first().fill('90');
    await detail.getByRole('button', { name: m.kpis.addReading, exact: true }).click();
    // A reading without a target is measured against nothing, and the page says which.
    await expect(detail.getByText(m.kpis.no_target, { exact: true }).first()).toBeVisible();
    await setTarget(page, id, 100);
    await page.reload();
    const panel = page.locator('aside.entity-detail');
    await expect(panel.getByText(m.kpis.near_target, { exact: true }).first()).toBeVisible();
    await page.goto(`/kpis?view=near_target&q=${encodeURIComponent(name)}`);
    await expect(page.getByText(name, { exact: true })).toBeVisible();
  });
  test(`KPIS-A04 a future reading is flagged and leaves the current value alone ${locale}`, async ({
    page,
  }) => {
    await loginAs(page, locale);
    const name = `KPI ${crypto.randomUUID()}`;
    const { id } = await createKpi(page, m, name);
    await addReading(page, id, today(), 10);
    await addReading(
      page,
      id,
      new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10),
      999,
    );
    await page.reload();
    const panel = page.locator('aside.entity-detail');
    await panel.getByRole('tab', { name: m.kpis.readings, exact: true }).click();
    await expect(panel.getByText(m.kpis.futureReading, { exact: true })).toBeVisible();
    // The future reading is listed, but the current value is still the one that has happened.
    await expect(panel.getByText(m.kpis.currentReading, { exact: true })).toBeVisible();
    await expect(panel.getByText('10 pts', { exact: true }).first()).toBeVisible();
  });
}
test('KPIS-A06 changing the workspace thresholds changes statuses across the list', async ({
  page,
}) => {
  await loginAs(page, 'en');
  const name = `KPI ${crypto.randomUUID()}`;
  const { id } = await createKpi(page, en, name);
  await addReading(page, id, today(), 90);
  await setTarget(page, id, 100);
  await page.goto(`/kpis?view=near_target&q=${encodeURIComponent(name)}`);
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  await setThresholds(page, '{"higher":{"on":0.9,"near":0.5},"lower":{"on":1.01,"near":1.18}}');
  await page.goto(`/kpis?view=on_target&q=${encodeURIComponent(name)}`);
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  await setThresholds(page, '{"higher":{"on":0.99,"near":0.85},"lower":{"on":1.01,"near":1.18}}');
});
async function setThresholds(page: Page, value: string) {
  await page.goto('/admin/settings');
  const field = page.getByLabel('kpis.status_thresholds', { exact: true });
  await field.fill(value);
  await field
    .locator('xpath=ancestor::div[.//button][1]')
    .getByRole('button', { name: en.common.save, exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: en.common.save, exact: true }).first(),
  ).toBeEnabled();
}
