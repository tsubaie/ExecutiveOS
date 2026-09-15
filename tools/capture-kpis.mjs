import { chromium } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
// Bilingual, two-viewport screenshots of the KPI scorecard and one KPI record, using fictional
// measures that are trashed afterwards. Run against a preview app on localhost:3000.
await mkdir('tmp/screenshots', { recursive: true });
const viewports = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };
const today = new Date();
const day = (back) => new Date(Date.now() - back * 86400000).toISOString().slice(0, 10);
const period = Math.floor(today.getUTCMonth() / 3) + 1;
// One of each state the list has to tell apart, so the screenshots show the scorecard doing its job.
const measures = [
  {
    name: 'Board decisions implemented',
    unit: 'percent',
    category: 'Governance',
    readings: [72, 78, 84, 91],
    target: 90,
  },
  {
    name: 'Average days to close an action',
    unit: 'count',
    category: 'Delivery',
    direction: 'lower',
    readings: [21, 18, 16, 14],
    target: 12,
  },
  {
    name: 'Strategic budget committed',
    unit: 'percent',
    category: 'Finance',
    readings: [41, 44, 46, 48],
    target: 75,
  },
  { name: 'Partner satisfaction', unit: 'points', category: 'External', readings: [], target: 8 },
  {
    name: 'Regional coverage',
    unit: 'count',
    category: 'Delivery',
    readings: [12],
    stale: true,
    target: 20,
  },
];
const browser = await chromium.launch();
const account = JSON.parse(await readFile('e2e/.auth/credentials.json', 'utf8'));
const context = await browser.newContext({ viewport: viewports.desktop });
const page = await context.newPage();
await page.goto('http://localhost:3000/login');
await page.getByLabel('Email').fill(account.email);
await page.getByLabel('Password').fill(account.password);
await page.getByRole('button', { name: 'Sign in', exact: true }).click();
await page.waitForURL(/home/);
async function api(path, method = 'GET', body) {
  return page.evaluate(
    async (call) => {
      const response = await fetch(`/api/v1${call.path}`, {
        method: call.method,
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'ExecutiveOS',
          'Idempotency-Key': crypto.randomUUID(),
        },
        ...(call.body ? { body: call.body } : {}),
      });
      return response.status === 204 ? null : response.json();
    },
    { path, method, body: body ? JSON.stringify(body) : null },
  );
}
await page.goto('http://localhost:3000/kpis?view=all');
const objective = await api('/objectives', 'POST', {
  name: 'Deliver the 2026 strategy',
  description: '',
});
const created = [];
for (const measure of measures) {
  const kpi = await api('/kpis', 'POST', {
    name: measure.name,
    unit: measure.unit,
    category: measure.category,
    direction: measure.direction ?? 'higher',
    frequency: 'quarterly',
    objectiveId: objective?.data?.id ?? null,
    ownerId: null,
    notes: '',
  });
  const id = kpi?.data?.id;
  if (!id) continue;
  created.push(kpi.data);
  for (const [index, value] of measure.readings.entries())
    await api(`/kpis/${id}/readings`, 'POST', {
      readingDate: day(measure.stale ? 260 : (measure.readings.length - index) * 21),
      value,
      note: '',
    });
  await api(`/kpis/${id}/targets`, 'PUT', {
    items: [1, 2, 3, 4]
      .filter((each) => each <= period)
      .map((each) => ({ year: today.getUTCFullYear(), period: each, targetValue: measure.target })),
  });
}
const record = created[0];
for (const locale of ['en', 'ar']) {
  await context.addCookies([{ name: 'eos_locale', value: locale, url: 'http://localhost:3000' }]);
  for (const [size, viewport] of Object.entries(viewports)) {
    await page.setViewportSize(viewport);
    await page.goto('http://localhost:3000/kpis?view=all');
    await page.waitForTimeout(700);
    await page.screenshot({ path: `tmp/screenshots/kpis-list-${locale}-${size}.png` });
    if (!record) continue;
    await page.goto(`http://localhost:3000/kpis?view=all&id=${record.id}`);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `tmp/screenshots/kpis-detail-${locale}-${size}.png` });
  }
}
for (const kpi of created) {
  const current = await api(`/kpis/${kpi.id}`);
  await api(`/kpis/${kpi.id}`, 'DELETE', { revision: current?.data?.revision ?? kpi.revision });
}
if (objective?.data?.id)
  await api(`/objectives/${objective.data.id}`, 'DELETE', { revision: objective.data.revision });
await browser.close();
process.stdout.write('captured\n');
