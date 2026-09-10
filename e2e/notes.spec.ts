import { test, expect, type Page } from '@playwright/test';
import { loginAs } from './fixtures/auth';
import { selectView } from './fixtures/views';
import en from '../src/core/i18n/messages/en.json' with { type: 'json' };
import ar from '../src/core/i18n/messages/ar.json' with { type: 'json' };
type Body = { data?: { id: string; revision: number } };
const created = new WeakMap<Page, { resource: string; id: string }[]>();
test.beforeEach(({ page }) => {
  const records: { resource: string; id: string }[] = [];
  created.set(page, records);
  page.on('response', (response) => {
    const match = /\/api\/v1\/(notes|tasks|people)$/u.exec(new URL(response.url()).pathname);
    if (response.status() === 201 && match?.[1])
      void response.json().then((body: Body) => {
        if (body.data?.id) records.push({ resource: String(match[1]), id: body.data.id });
      });
  });
});
test.afterEach(async ({ page }) => {
  for (const { resource, id } of (created.get(page) ?? []).reverse()) {
    const current = await api(page, resource, `/${id}`);
    if (current.status === 200)
      await api(page, resource, `/${id}`, 'DELETE', { revision: current.body.data.revision });
  }
});
async function api(
  page: Page,
  resource: string,
  path: string,
  method = 'GET',
  body?: object,
  key?: string,
) {
  return page.evaluate(
    async ({ resource, path, method, body, key }) => {
      const response = await fetch(`/api/v1/${resource}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'ExecutiveOS',
          'Idempotency-Key': key ?? crypto.randomUUID(),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return {
        status: response.status,
        body:
          response.status === 204
            ? { opId: response.headers.get('x-op-id') }
            : await response.json(),
      };
    },
    { resource, path, method, body, key },
  );
}
const note = async (page: Page, title: string, fields: object = {}) =>
  (await api(page, 'notes', '', 'POST', { title, ...fields })).body.data;
const detail = (page: Page) => page.locator('aside.entity-detail');
const rows = (page: Page) => page.locator('[data-row-id]');
for (const locale of ['en', 'ar']) {
  const m = locale === 'ar' ? ar : en;
  test(`NOTES-A01 NOTES-A03 create a note, add a task from it and complete it ${locale}`, async ({
    page,
  }) => {
    await loginAs(page, locale);
    const title = `Note ${crypto.randomUUID()}`;
    await page.goto(`/notes?view=all&q=${encodeURIComponent(title)}`);
    await page.getByRole('button', { name: m.common.create, exact: true }).click();
    await page.getByLabel(m.notes.title, { exact: true }).fill(title);
    await page.getByRole('button', { name: m.common.create, exact: true }).last().click();
    await expect(page).toHaveURL(/id=/);
    await expect(detail(page).getByLabel(m.notes.title, { exact: true })).toHaveValue(title);
    await expect(detail(page).getByText(m.notes.board_meeting)).toBeVisible();
    const taskTitle = `Task ${crypto.randomUUID()}`;
    await detail(page).getByLabel(m.notes.taskTitle, { exact: true }).fill(taskTitle);
    await detail(page).getByLabel(m.notes.taskTitle, { exact: true }).press('Enter');
    const line = detail(page).getByRole('link', { name: taskTitle });
    await expect(line).toBeVisible();
    await detail(page)
      .getByRole('checkbox', { name: m.notes.completeNamed.replace('{name}', taskTitle) })
      .click();
    await expect(
      detail(page).getByText(m.notes.taskCountsShort.replace('{open}', '0').replace('{done}', '1')),
    ).toBeVisible();
    await page.goto(`/notes?view=all&q=${encodeURIComponent(title)}`);
    await expect(rows(page)).toHaveCount(1);
    await expect(page.getByText(m.notes.today, { exact: true }).first()).toBeVisible();
    await expect(rows(page).first().getByText('0/1')).toBeVisible();
  });
}
test('NOTES-A02 NOTES-B08 participants with quick-create appear on the row and on the person page', async ({
  page,
}) => {
  await loginAs(page, 'en');
  const title = `Participants ${crypto.randomUUID()}`;
  const known = (
    await api(page, 'people', '', 'POST', {
      fullName: `Known ${crypto.randomUUID()}`,
      kind: 'external',
      isAssignable: false,
      tags: [],
      email: null,
      phone: null,
      notes: null,
      displayName: null,
      honorific: null,
      organization: null,
      roleTitle: null,
      userId: null,
      confirmDuplicate: true,
    })
  ).body.data;
  const created = await note(page, title);
  await page.goto(`/notes?view=all&q=${encodeURIComponent(title)}&id=${created.id}`);
  await detail(page).getByRole('combobox', { name: en.notes.addParticipant }).click();
  await page.getByLabel(en.notes.participantSearch).fill(known.fullName);
  await page.getByRole('option', { name: known.fullName }).click();
  await expect(
    detail(page).getByRole('button', {
      name: en.notes.removeParticipant.replace('{name}', known.fullName),
    }),
  ).toBeVisible();
  const fresh = `New Person ${crypto.randomUUID().slice(0, 8)}`;
  await detail(page).getByRole('combobox', { name: en.notes.addParticipant }).click();
  await page.getByLabel(en.notes.participantSearch).fill(fresh);
  await page.getByRole('option', { name: en.notes.addPerson.replace('{name}', fresh) }).click();
  await expect(
    detail(page).getByRole('button', { name: en.notes.removeParticipant.replace('{name}', fresh) }),
  ).toBeVisible();
  await expect(rows(page).first().getByText(fresh)).toBeAttached();
  const person = (await api(page, 'people', `?view=all&q=${encodeURIComponent(fresh)}`)).body
    .data[0];
  expect(person.isAssignable).toBe(false);
  await page.goto(`/people?view=all&id=${person.id}`);
  await expect(
    page.locator('aside.entity-detail').getByRole('link', { name: title }),
  ).toBeVisible();
});
test('NOTES-A04 attach an existing unlinked task; a task linked elsewhere is not offered', async ({
  page,
}) => {
  await loginAs(page, 'en');
  const first = await note(page, `First ${crypto.randomUUID()}`);
  const second = await note(page, `Second ${crypto.randomUUID()}`);
  const loose = (await api(page, 'tasks', '', 'POST', { title: `Loose ${crypto.randomUUID()}` }))
    .body.data;
  const taken = (
    await api(page, 'tasks', '', 'POST', {
      title: `Taken ${crypto.randomUUID()}`,
      sourceNoteId: second.id,
    })
  ).body.data;
  await page.goto(`/notes?view=all&id=${first.id}`);
  await detail(page).getByRole('button', { name: en.notes.attachTask, exact: true }).click();
  const picker = detail(page).getByRole('combobox', { name: en.notes.attachTask });
  await picker.click();
  await expect(page.getByRole('option', { name: taken.title })).toHaveCount(0);
  await page.getByRole('option', { name: loose.title }).click();
  await expect(detail(page).getByRole('link', { name: loose.title })).toBeVisible();
  await page.goto(`/tasks?view=all&id=${loose.id}`);
  await expect(
    page.locator('aside.entity-detail').getByRole('link', { name: first.title }),
  ).toBeVisible();
});
test('NOTES-A05 NOTES-A06 archive from the bulk bar, find it by search, and tag two notes at once', async ({
  page,
}) => {
  await loginAs(page, 'en');
  const prefix = `Bulk ${crypto.randomUUID()}`;
  const notes = [];
  for (const suffix of ['One', 'Two', 'Three']) notes.push(await note(page, `${prefix} ${suffix}`));
  await page.goto(`/notes?view=all&q=${encodeURIComponent(prefix)}`);
  await expect(rows(page)).toHaveCount(3);
  await page.getByRole('button', { name: en.common.select, exact: true }).click();
  for (const item of notes)
    await page.getByRole('checkbox', { name: `Select ${item.title}`, exact: true }).click();
  await page.getByRole('button', { name: en.notes.archive, exact: true }).click();
  await page.getByRole('button', { name: en.common.confirm, exact: true }).click();
  await expect(rows(page)).toHaveCount(3);
  await expect(rows(page).first().getByText(en.notes.archivedChip)).toBeVisible();
  await page.goto('/notes?view=all');
  await expect(rows(page).filter({ hasText: prefix })).toHaveCount(0);
  await selectView(page, 'en', new RegExp(en.notes.archived));
  await expect(rows(page).filter({ hasText: prefix })).toHaveCount(3);
  await page.getByRole('button', { name: en.common.select, exact: true }).click();
  for (const item of notes.slice(0, 2))
    await page.getByRole('checkbox', { name: `Select ${item.title}`, exact: true }).click();
  await page.getByRole('button', { name: en.notes.addTag, exact: true }).click();
  const tag = `tag${crypto.randomUUID().slice(0, 6)}`;
  await page.getByRole('dialog').getByLabel(en.notes.tagName, { exact: true }).fill(tag);
  await page
    .getByRole('dialog')
    .getByRole('button', { name: en.notes.addTag, exact: true })
    .click();
  await expect(page.getByRole('dialog')).toBeHidden();
  for (const item of notes.slice(0, 2))
    expect((await api(page, 'notes', `/${item.id}`)).body.data.tags).toEqual([tag]);
  expect((await api(page, 'notes', `/${notes[2].id}`)).body.data.tags).toEqual([]);
});
test('NOTES-A07 NOTES-A10 trash keeps linked tasks, restore brings them back, AI routes refuse', async ({
  page,
}) => {
  await loginAs(page, 'en');
  const created = await note(page, `Trash ${crypto.randomUUID()}`);
  const task = (
    await api(page, 'tasks', '', 'POST', {
      title: `Linked ${crypto.randomUUID()}`,
      sourceNoteId: created.id,
    })
  ).body.data;
  await page.goto(`/notes?view=all&id=${created.id}`);
  await expect(detail(page).getByRole('button', { name: /refine|suggest/iu })).toHaveCount(0);
  expect((await api(page, 'notes', `/${created.id}/refine`, 'POST', { revision: 1 })).status).toBe(
    503,
  );
  await detail(page).getByRole('button', { name: en.common.delete, exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: en.common.delete, exact: true })
    .click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await selectView(page, 'en', new RegExp(en.notes.trash));
  await rows(page).filter({ hasText: created.title }).click();
  await expect(detail(page).getByRole('link', { name: task.title })).toBeVisible();
  await detail(page).getByRole('button', { name: en.common.restore, exact: true }).click();
  await page.goto(`/notes?view=all&id=${created.id}`);
  await expect(detail(page).getByRole('link', { name: task.title })).toBeVisible();
  expect((await api(page, 'tasks', `/${task.id}`)).body.data.sourceNote.id).toBe(created.id);
});
test('NOTES-A08 NOTES-A09 Arabic search finds normalized content, a tag and a participant; preview lays Arabic out RTL', async ({
  page,
}) => {
  await loginAs(page, 'ar');
  const marker = crypto.randomUUID().slice(0, 8);
  const person = (
    await api(page, 'people', '', 'POST', {
      fullName: `سامر ${marker}`,
      kind: 'external',
      isAssignable: false,
      tags: [],
      email: null,
      phone: null,
      notes: null,
      displayName: null,
      honorific: null,
      organization: null,
      roleTitle: null,
      userId: null,
      confirmDuplicate: true,
    })
  ).body.data;
  const created = await note(page, `إِعداد الميزانية ${marker}`, {
    content: '# جدول الأعمال\n\nنقاط النقاش',
    tags: [`مُتابعة${marker}`],
    participantIds: [person.id],
  });
  for (const q of [`اعداد الميزانية ${marker}`, `متابعة${marker}`, `سامر ${marker}`]) {
    await page.goto(`/notes?view=all&q=${encodeURIComponent(q)}`);
    await expect(rows(page)).toHaveCount(1);
  }
  await page.goto(`/notes?view=all&id=${created.id}`);
  await detail(page).getByRole('button', { name: ar.common.preview, exact: true }).click();
  const heading = detail(page).getByRole('heading', { name: 'جدول الأعمال' });
  await expect(heading).toBeVisible();
  expect(await heading.evaluate((element) => getComputedStyle(element).direction)).toBe('rtl');
});
test('NOTES-A11 HOME-B01 home lists recent notes and collapses the section when empty', async ({
  page,
}) => {
  await loginAs(page, 'en');
  const title = `Recent ${crypto.randomUUID()}`;
  const created = await note(page, title);
  await page.goto('/home');
  await expect(page.getByRole('link', { name: title })).toBeVisible();
  await api(page, 'notes', `/${created.id}/archive`, 'POST', { revision: created.revision });
  await page.goto('/home');
  await expect(page.getByRole('link', { name: title })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: en.home.notes })).toBeVisible();
});
