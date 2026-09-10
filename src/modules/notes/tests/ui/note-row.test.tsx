// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import ar from '@/core/i18n/messages/ar.json';
import { NoteDetail } from '../../schema/validation';
import { NoteRow } from '../../ui/NoteRow';
import { mount } from './harness';
const note = NoteDetail.parse({
  id: '01a08a9f-1991-760a-b73a-568f6f86653b',
  revision: 3,
  title: 'Budget review',
  content: '',
  type: 'board_meeting',
  noteDate: '2026-09-10',
  tags: ['Budget', 'Q3', 'Risk', 'Extra'],
  archivedAt: '2026-09-10T08:00:00.000Z',
  createdAt: '2026-09-10T07:00:00.000Z',
  updatedAt: '2026-09-10T08:00:00.000Z',
  createdBy: null,
  updatedBy: null,
  deletedAt: null,
  deletedOpId: null,
  participants: [
    { id: '01a08a9f-1991-760a-b73a-568f6f86653c', name: 'Leila Haddad', kind: 'internal' },
    { id: '01a08a9f-1991-760a-b73a-568f6f86653d', name: 'Omar Nasser', kind: 'internal' },
    { id: '01a08a9f-1991-760a-b73a-568f6f86653e', name: 'Maya Faris', kind: 'external' },
    { id: '01a08a9f-1991-760a-b73a-568f6f86653f', name: 'Daniel Rowan', kind: 'external' },
  ],
  openTaskCount: 2,
  doneTaskCount: 1,
  band: 'today',
});
describe('note row', () => {
  it('NOTES-B02 NOTES-A05 shows the type, the archived chip, three tags plus a count, participants and task counts', () => {
    mount(<NoteRow note={note} />);
    expect(screen.getByText('Board meeting')).toBeTruthy();
    expect(screen.getByText('Archived')).toBeTruthy();
    expect(screen.getAllByText('+1')).toHaveLength(2);
    expect(screen.queryByText('Extra', { exact: true })).toBeNull();
    expect(screen.getByText('Q3')).toBeTruthy();
    expect(screen.getByText('2/1')).toBeTruthy();
    expect(screen.getByTitle('2 open, 1 done')).toBeTruthy();
    expect(screen.getByText('Leila Haddad')).toBeTruthy();
    expect(screen.getByText('Today')).toBeTruthy();
  });
  it('NOTES-A01 renders the Arabic labels in the Arabic view', () => {
    mount(<NoteRow note={note} />, 'ar');
    expect(screen.getByText(ar.notes.board_meeting)).toBeTruthy();
    expect(screen.getByText(ar.notes.today)).toBeTruthy();
  });
});
