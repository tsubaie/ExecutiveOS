// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { TemplateSelect, pickTemplate } from '../../ui/NoteSelects';
import { templateBody } from '../../schema/validation';
import { mount } from './harness';
const templates = vi.hoisted(() => ({ data: { data: [] as object[] } }));
vi.mock('../../ui/queries', () => ({
  useNoteTemplates: () => templates,
  useNoteTypes: () => ({ data: undefined }),
}));
const meeting = {
  id: 'meeting',
  labels: { en: 'Meeting', ar: 'اجتماع' },
  body: { en: '## Attendees', ar: '## الحضور' },
  enabled: true,
};
const brief = { id: 'brief', labels: { en: 'Brief' }, body: { en: '## Brief' }, enabled: true };
describe('template select', () => {
  it('NOTES-B27 shows the chosen template by its locale label, falling back to English', () => {
    templates.data = { data: [meeting, brief] };
    mount(<TemplateSelect value="meeting" label="Template" onPick={vi.fn()} />, 'ar');
    expect(screen.getByRole('combobox', { name: 'Template' }).textContent).toContain('اجتماع');
    mount(<TemplateSelect value="brief" label="Template" onPick={vi.fn()} />, 'ar');
    expect(screen.getByRole('combobox', { name: 'Template' }).textContent).toContain('Brief');
    mount(<TemplateSelect value="" label="Template" onPick={vi.fn()} />);
    expect(screen.getByRole('combobox', { name: 'Template' }).textContent).toContain('No template');
  });
  it('NOTES-B27 renders nothing without templates', () => {
    templates.data = { data: [] };
    mount(<TemplateSelect value="" label="Template" onPick={vi.fn()} />);
    expect(screen.queryByRole('combobox')).toBeNull();
  });
  it('NOTES-B27 a pick hands back the body for the locale; "No template" and unknown ids hand back nothing', () => {
    expect(pickTemplate([meeting], 'meeting', 'ar')).toBe('## الحضور');
    expect(pickTemplate([meeting], 'meeting', 'en')).toBe('## Attendees');
    expect(pickTemplate([meeting], '', 'en')).toBe('');
    expect(pickTemplate([meeting], 'gone', 'en')).toBe('');
  });
  it('NOTES-B27 the body falls back to English, then to whatever the template carries', () => {
    expect(templateBody(meeting, 'ar')).toBe('## الحضور');
    expect(templateBody({ ...meeting, body: { en: '## Attendees' } }, 'ar')).toBe('## Attendees');
    expect(templateBody({ ...meeting, body: { fr: '## Présents' } }, 'ar')).toBe('## Présents');
    expect(templateBody({ ...meeting, body: {} }, 'en')).toBe('');
  });
});
