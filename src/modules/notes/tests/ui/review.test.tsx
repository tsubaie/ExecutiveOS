// @vitest-environment jsdom
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import type { AiReview } from '@/ui/ai/queries';
import { RefinementOutput } from '../../schema/validation';
import {
  ReviewActions,
  ReviewHeader,
  useReviewSelection,
  type ReviewView,
} from '../../ui/NoteReview';
import { ReviewAlsoCreate } from '../../ui/NoteReviewCard';
import { NoteAi } from '../../ui/NoteAi';
import { mount } from './harness';
const toast = vi.hoisted(() => vi.fn());
vi.mock('@/ui/layout/toast/use-undo-toast', () => ({ useUndoToast: () => toast }));
vi.mock('@/ui/primitives/toast', () => ({ useToastManager: () => ({ add: vi.fn() }) }));
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
      priority: 'high',
      due_date: null,
      owner_name: null,
      source_snippet: 'call Omar about the deck',
    },
    {
      title: 'Send the deck',
      description: null,
      status: 'inbox',
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
// The surface's parts as the expanded view lays them out, sharing one selection.
function Review({
  review,
  draft,
  onDone,
}: {
  review: AiReview;
  draft: string;
  onDone: () => void;
}) {
  const selection = useReviewSelection(review, onDone);
  const [view, setView] = useState<ReviewView>('rewrite');
  const [ready, setReady] = useState(false);
  if (!ready) {
    selection.reset(result);
    setReady(true);
  }
  return (
    <>
      <ReviewHeader review={review} result={result} view={view} setView={setView} />
      <p>{view}</p>
      <ReviewAlsoCreate review={review} result={result} currentTags={[]} selection={selection} />
      <ReviewActions review={review} result={result} draft={draft} selection={selection} />
    </>
  );
}
describe('review surface', () => {
  it('NOTES-B18 the header switches the view, stays silent while the proposal can be kept, and opens the summary on More', () => {
    mount(<Review review={fakeReview()} draft={result.refined_content} onDone={vi.fn()} />);
    const views = screen.getByRole('group', { name: 'View' });
    expect(
      within(views).getByRole('button', { name: 'Suggested rewrite' }).getAttribute('aria-pressed'),
    ).toBe('true');
    fireEvent.click(within(views).getByRole('button', { name: 'Original' }));
    expect(screen.getByText('original')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
    const more = screen.getByRole('button', { name: /More/ });
    expect(more.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(more);
    expect(screen.getByRole('button', { name: /Less/ }).getAttribute('aria-expanded')).toBe('true');
  });
  it('NOTES-B18 the card lists tasks with a master checkbox, editable titles, chips, a source toggle and the tags', () => {
    mount(<Review review={fakeReview()} draft={result.refined_content} onDone={vi.fn()} />);
    const card = screen.getByRole('region', { name: 'Also create' });
    expect(within(card).getByRole('heading', { name: 'Also create' })).toBeTruthy();
    expect(within(card).getByText('2 of 2 selected')).toBeTruthy();
    const master = within(card).getByRole('checkbox', { name: 'Select all tasks' });
    expect(master.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(within(card).getByRole('checkbox', { name: 'Select Send the deck' }));
    expect(
      within(card).getByRole('checkbox', { name: 'Select all tasks' }).getAttribute('aria-checked'),
    ).toBe('mixed');
    expect(within(card).getByText('1 of 2 selected')).toBeTruthy();
    fireEvent.click(within(card).getByRole('button', { name: 'Source' }));
    expect(within(card).getByText('call Omar about the deck')).toBeTruthy();
    expect(within(card).getByRole('button', { name: /planning/ })).toBeTruthy();
    fireEvent.change(within(card).getByRole('textbox', { name: 'Task 1 title' }), {
      target: { value: 'Call Omar today' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Use rewrite and create 1 tasks' }));
  });
  it('NOTES-B18 Keep sends the edited draft with the ticked tasks and tags; unticking all makes it Keep rewrite', () => {
    const review = fakeReview();
    mount(<Review review={review} draft={'## Agenda\n\n- one, edited'} onDone={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Use rewrite and create 2 tasks' }));
    const apply = review.apply.mutate as ReturnType<typeof vi.fn>;
    expect(apply.mock.calls[0]?.[0]).toEqual({
      jobId: 'job-1',
      acceptContent: true,
      content: '## Agenda\n\n- one, edited',
      taskIndexes: [0, 1],
      tagIndexes: [0],
      taskTitles: [
        { index: 0, title: 'Call Omar' },
        { index: 1, title: 'Send the deck' },
      ],
    });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all tasks' }));
    fireEvent.click(screen.getByRole('button', { name: 'Use rewrite' }));
    expect(apply.mock.calls[1]?.[0]).toMatchObject({ taskIndexes: [], taskTitles: [] });
  });
  it('NOTES-B18 an unedited draft is not sent as content; Discard discards and offers Undo, which restores', async () => {
    const review = fakeReview();
    const onDone = vi.fn();
    mount(<Review review={review} draft={result.refined_content} onDone={onDone} />);
    fireEvent.click(screen.getByRole('button', { name: 'Use rewrite and create 2 tasks' }));
    expect((review.apply.mutate as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).not.toHaveProperty(
      'content',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
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
  it('NOTES-B18 a stale proposal says the note changed, drops the card, and offers Regenerate and Discard only', () => {
    mount(
      <Review
        review={fakeReview({ stale: true })}
        draft={result.refined_content}
        onDone={vi.fn()}
      />,
    );
    expect(screen.getByRole('status').textContent).toBe('The note changed since this rewrite');
    expect(screen.queryByRole('region', { name: 'Also create' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Use rewrite/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Generate a fresh draft' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Discard' })).toBeTruthy();
  });
  it('NOTES-B18 a proposal with nothing extra says so in the card', () => {
    const bare = RefinementOutput.parse({ ...result, suggested_tasks: [], suggested_tags: [] });
    const review = fakeReview({
      job: {
        id: 'job-2',
        status: 'succeeded',
        revision: 3,
        result: { output: bare, warnings: [] },
        originalContent: 'old',
      },
    });
    mount(<ReviewAlsoCreate review={review} result={bare} currentTags={[]} selection={stub()} />);
    expect(screen.getByText('Nothing extra suggested.')).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
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
  const ARRIVE = 'arrive';
  type Seen = { value: string | undefined; mode: string | undefined };
  function Host({ seen, delay }: { seen: Seen[]; delay: boolean }) {
    const [key, setKey] = useState('');
    const [asked, setAsked] = useState<string | null>(null);
    return (
      <>
        {/* cast: the fixture holds the fields the wrapper reads */}
        <NoteAi
          note={note as never}
          focus={{ key, set: (next) => (delay ? setAsked(next ?? '') : setKey(next ?? '')) }}
        >
          {(slots) => {
            seen.push({ value: slots.review?.value, mode: slots.review?.review.mode });
            return (
              <div>
                {slots.content}
                {slots.contentNotice}
              </div>
            );
          }}
        </NoteAi>
        <button type="button" onClick={() => setKey(asked ?? '')}>
          {ARRIVE}
        </button>
        <button type="button" onClick={() => setKey('')}>
          {CLOSE}
        </button>
      </>
    );
  }
  it('NOTES-B18 Review opens the expanded view on the content with the rewrite as the draft; closing the view ends the review', () => {
    state.review = fakeReview();
    const seen: Seen[] = [];
    mount(<Host seen={seen} delay={false} />);
    expect(seen.at(-1)).toEqual({ value: undefined, mode: undefined });
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    expect(seen.at(-1)).toEqual({ value: result.refined_content, mode: 'rewrite' });
    fireEvent.click(screen.getByRole('button', { name: CLOSE }));
    expect(seen.at(-1)).toEqual({ value: undefined, mode: undefined });
  });
  it('NOTES-B18 review mode survives the render before the URL carries the key', () => {
    state.review = fakeReview();
    const seen: Seen[] = [];
    mount(<Host seen={seen} delay={true} />);
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    expect(seen.at(-1)).toEqual({ value: undefined, mode: undefined });
    fireEvent.click(screen.getByRole('button', { name: ARRIVE }));
    expect(seen.at(-1)).toEqual({ value: result.refined_content, mode: 'rewrite' });
  });
});
function stub() {
  return {
    tasks: [],
    tags: [],
    titles: [],
    busy: false,
    invalidTitles: false,
    keep: vi.fn(),
    discard: vi.fn(),
    reset: vi.fn(),
    setTasks: vi.fn(),
    setTags: vi.fn(),
    setTitle: vi.fn(),
  };
}
describe('AI row', () => {
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
  function Row() {
    return (
      // cast: the fixture holds the fields the wrapper reads
      <NoteAi note={note as never} focus={{ key: '', set: vi.fn() }}>
        {(slots) => (
          <div>
            {slots.content}
            {slots.contentNotice}
          </div>
        )}
      </NoteAi>
    );
  }
  it('NOTES-B22 idle is one named icon; refining is a muted line with Cancel; a failure is a muted line with Retry', () => {
    state.review = fakeReview({ job: null });
    mount(<Row />);
    expect(screen.getByRole('button', { name: 'Refine with AI' })).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
    state.review = fakeReview({
      pending: true,
      job: { id: 'j', status: 'running' },
      requestCancel: vi.fn(),
      cancelling: false,
      progressStartedAt: Date.now(),
    });
    mount(<Row />);
    expect(screen.getByRole('status').textContent).toContain('Refining…');
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    state.review = fakeReview({ job: { id: 'j', status: 'failed', error: 'timeout' } });
    mount(<Row />);
    expect(screen.getByText('Couldn’t refine')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
