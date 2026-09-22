// @vitest-environment jsdom
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import type { AiReview } from '@/ui/ai/queries';
import { RefinementOutput } from '../../schema/validation';
import { NoteReviewBand } from '../../ui/NoteReviewBand';
import { NoteAi } from '../../ui/NoteAi';
import { mount } from './harness';
const toast = vi.hoisted(() => vi.fn());
vi.mock('@/ui/layout/toast/use-undo-toast', () => ({ useUndoToast: () => toast }));
const state = vi.hoisted(() => ({ review: {} as object }));
vi.mock('@/ui/ai/queries', () => ({ useAiReview: () => state.review }));
vi.mock('../../ui/NoteTagAi', () => ({ NoteTagAi: () => null }));
const result = RefinementOutput.parse({
  refined_content: '## Agenda\n\n- one',
  suggested_tasks: [
    {
      title: 'Call Omar',
      description: null,
      status: 'next_action',
      priority: null,
      due_date: null,
      owner_name: null,
      source_snippet: null,
    },
  ],
  suggested_tags: ['planning'],
  summary_of_changes: 'Grouped the points under a heading.',
});
function fakeReview(overrides: object = {}): AiReview {
  return {
    enabled: true,
    pending: false,
    stale: false,
    error: null,
    job: {
      id: 'job-1',
      status: 'succeeded',
      revision: 3,
      result: { output: result, warnings: [] },
      originalContent: 'old text',
    },
    apply: { mutate: vi.fn(), isPending: false },
    discard: { mutate: vi.fn(), isPending: false },
    restore: { mutateAsync: vi.fn().mockResolvedValue(undefined) },
    start: { mutate: vi.fn(), isPending: false },
    ...overrides,
  } as never;
}
describe('review band', () => {
  it('NOTES-B18 Keep applies the edited draft with the ticked tasks and tags, and Keep without tasks leaves the tasks out', () => {
    const review = fakeReview();
    const onDone = vi.fn();
    mount(
      <NoteReviewBand
        review={review}
        result={result}
        currentTags={[]}
        draft={'## Agenda\n\n- one, edited'}
        original={false}
        setOriginal={vi.fn()}
        onDone={onDone}
      />,
    );
    expect(screen.getByText('Grouped the points under a heading.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Keep with 1 tasks' }));
    const apply = review.apply.mutate as ReturnType<typeof vi.fn>;
    expect(apply.mock.calls[0]?.[0]).toEqual({
      jobId: 'job-1',
      acceptContent: true,
      content: '## Agenda\n\n- one, edited',
      taskIndexes: [0],
      tagIndexes: [0],
      taskTitles: [{ index: 0, title: 'Call Omar' }],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Keep without tasks' }));
    expect(apply.mock.calls[1]?.[0]).toMatchObject({ taskIndexes: [], taskTitles: [] });
  });
  it('NOTES-B18 an unedited draft is not sent as content; Discard discards and offers Undo, which restores', async () => {
    const review = fakeReview();
    const onDone = vi.fn();
    mount(
      <NoteReviewBand
        review={review}
        result={result}
        currentTags={[]}
        draft={result.refined_content}
        original={false}
        setOriginal={vi.fn()}
        onDone={onDone}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Keep with 1 tasks' }));
    expect((review.apply.mutate as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).not.toHaveProperty(
      'content',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Discard suggestions' }));
    const discard = review.discard.mutate as ReturnType<typeof vi.fn>;
    expect(discard).toHaveBeenCalledTimes(1);
    discard.mock.calls[0]?.[1].onSuccess();
    expect(onDone).toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Suggested rewrite discarded.' }),
    );
    await toast.mock.calls[0]?.[0].undo();
    expect(review.restore.mutateAsync).toHaveBeenCalledWith('job-1');
  });
  it('NOTES-B18 a stale proposal offers only Regenerate and Discard, and the original toggle reports both ways', () => {
    const review = fakeReview({ stale: true });
    const setOriginal = vi.fn();
    mount(
      <NoteReviewBand
        review={review}
        result={result}
        currentTags={[]}
        draft={result.refined_content}
        original={false}
        setOriginal={setOriginal}
        onDone={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /Keep/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Generate a fresh draft' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show original' }));
    expect(setOriginal).toHaveBeenCalledWith(true);
  });
});
describe('review mode', () => {
  const note = {
    id: 'n1',
    revision: 3,
    title: 'Plan',
    content: 'old text',
    type: null,
    noteDate: null,
    tags: [],
    participants: [],
    tasks: [],
    committeeId: null,
    archivedAt: null,
    deletedAt: null,
    deletedOpId: null,
    createdAt: '',
    updatedAt: '',
    createdBy: 'u',
    updatedBy: 'u',
  };
  const CLOSE = 'close';
  function Host({ seen }: { seen: { value: string | undefined; hasBanner: boolean }[] }) {
    const [key, setKey] = useState('');
    return (
      <>
        {/* cast: the fixture holds the fields the wrapper reads */}
        <NoteAi note={note as never} focus={{ key, set: (next) => setKey(next ?? '') }}>
          {(slots) => {
            seen.push({ value: slots.review?.value, hasBanner: Boolean(slots.review?.banner) });
            return <div>{slots.content}</div>;
          }}
        </NoteAi>
        <button type="button" onClick={() => setKey('')}>
          {CLOSE}
        </button>
      </>
    );
  }
  it('NOTES-B18 Review opens the expanded view on the content with the rewrite as the draft; closing the view ends the review', () => {
    state.review = fakeReview();
    const seen: { value: string | undefined; hasBanner: boolean }[] = [];
    mount(<Host seen={seen} />);
    expect(seen.at(-1)).toEqual({ value: undefined, hasBanner: false });
    fireEvent.click(screen.getByRole('button', { name: 'Review refinement' }));
    expect(seen.at(-1)).toEqual({ value: result.refined_content, hasBanner: true });
    fireEvent.click(screen.getByRole('button', { name: CLOSE }));
    expect(seen.at(-1)).toEqual({ value: undefined, hasBanner: false });
  });
});
