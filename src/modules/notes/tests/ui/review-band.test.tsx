// @vitest-environment jsdom
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import type { AiReview } from '@/ui/ai/queries';
import { RefinementOutput } from '../../schema/validation';
import { ReviewActions, ReviewBand, ReviewRail, useReviewSelection } from '../../ui/NoteReviewBand';
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
// The three parts as the expanded view lays them out, sharing one selection.
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
  const [ready, setReady] = useState(false);
  if (!ready) {
    selection.reset(result);
    setReady(true);
  }
  return (
    <>
      <ReviewBand review={review} result={result} />
      <ReviewRail
        review={review}
        result={result}
        currentTags={[]}
        original="old text"
        selection={selection}
      />
      <ReviewActions review={review} result={result} draft={draft} selection={selection} />
    </>
  );
}
describe('review parts', () => {
  it('NOTES-B18 the band names the rewrite and its summary; the rail holds tags, tasks and the original', () => {
    mount(<Review review={fakeReview()} draft={result.refined_content} onDone={vi.fn()} />);
    expect(screen.getByRole('region', { name: 'Suggested rewrite' }).textContent).toContain(
      'Grouped the points under a heading.',
    );
    const rail = screen.getByRole('complementary', { name: 'Suggestions' });
    expect(within(rail).getByRole('button', { name: /planning/ })).toBeTruthy();
    expect(within(rail).getByRole('checkbox', { name: 'Select Call Omar' })).toBeTruthy();
    expect(within(rail).getByText('Original')).toBeTruthy();
    expect(within(rail).getByRole('heading', { name: 'Suggested tasks (1)' })).toBeTruthy();
    expect(within(rail).getByText('Suggested tags')).toBeTruthy();
  });
  it('NOTES-B18 Keep sends the edited draft with the ticked tasks and tags; unticking the tasks makes it Keep rewrite', () => {
    const review = fakeReview();
    mount(<Review review={review} draft={'## Agenda\n\n- one, edited'} onDone={vi.fn()} />);
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
    fireEvent.click(screen.getByRole('button', { name: 'Deselect all' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep rewrite' }));
    expect(apply.mock.calls[1]?.[0]).toMatchObject({ taskIndexes: [], taskTitles: [] });
  });
  it('NOTES-B18 an unedited draft is not sent as content; Discard discards and offers Undo, which restores', async () => {
    const review = fakeReview();
    const onDone = vi.fn();
    mount(<Review review={review} draft={result.refined_content} onDone={onDone} />);
    fireEvent.click(screen.getByRole('button', { name: 'Keep with 1 tasks' }));
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
  it('NOTES-B18 a stale proposal offers Regenerate and Discard only, and hides the tick lists', () => {
    mount(
      <Review
        review={fakeReview({ stale: true })}
        draft={result.refined_content}
        onDone={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /Keep/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Generate a fresh draft' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Discard' })).toBeTruthy();
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
  type Seen = { value: string | undefined; parts: number };
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
            const parts = slots.review
              ? [slots.review.banner, slots.review.aside, slots.review.footer].filter(Boolean)
                  .length
              : 0;
            seen.push({ value: slots.review?.value, parts });
            return <div>{slots.content}</div>;
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
    expect(seen.at(-1)).toEqual({ value: undefined, parts: 0 });
    fireEvent.click(screen.getByRole('button', { name: 'Review refinement' }));
    expect(seen.at(-1)).toEqual({ value: result.refined_content, parts: 3 });
    fireEvent.click(screen.getByRole('button', { name: CLOSE }));
    expect(seen.at(-1)).toEqual({ value: undefined, parts: 0 });
  });
  it('NOTES-B18 review mode survives the render before the URL carries the key', () => {
    state.review = fakeReview();
    const seen: Seen[] = [];
    mount(<Host seen={seen} delay={true} />);
    fireEvent.click(screen.getByRole('button', { name: 'Review refinement' }));
    // The key has been asked for but has not arrived: the mode must not give up.
    expect(seen.at(-1)).toEqual({ value: undefined, parts: 0 });
    fireEvent.click(screen.getByRole('button', { name: ARRIVE }));
    expect(seen.at(-1)).toEqual({ value: result.refined_content, parts: 3 });
  });
  it('NOTES-B18 a proposal with nothing extra says so instead of an empty rail', () => {
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
    mount(
      <ReviewRail
        review={review}
        result={bare}
        currentTags={[]}
        original="old"
        selection={useSelectionStub()}
      />,
    );
    expect(screen.getByText('Nothing extra suggested.')).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
});
function useSelectionStub() {
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
