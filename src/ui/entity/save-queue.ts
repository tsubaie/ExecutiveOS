import { ApiError } from '@/core/http/client';
import type { Entity, SaveState } from './types';
type Writer<T, P> = (id: string, revision: number, input: P, key: string) => Promise<T>;
class SaveQueue<T extends Entity, P extends object> {
  constructor(
    private patch: Writer<T, P>,
    private notify: (state: SaveState, error: Error | null) => void,
  ) {}
  private q: {
    pending: P | null;
    failed: P | null;
    current: T | undefined;
    running: Promise<void> | null;
    key: string | null;
    conflict: boolean;
  } = {
    pending: null,
    failed: null,
    current: undefined,
    running: null,
    key: null,
    conflict: false,
  };
  private drain = async () => {
    const q = this.q;
    if (q.running) return q.running;
    if (!q.current || !q.pending) return;
    const current = q.current;
    const payload = q.pending;
    q.pending = null;
    q.key ??= crypto.randomUUID();
    this.notify('saving', null);
    q.running = this.patch(current.id, current.revision, payload, q.key)
      .then(
        (next) => {
          q.current = next;
          q.failed = null;
          q.key = null;
          q.conflict = false;
          this.notify('saved', null);
        },
        (error) => {
          q.failed = payload;
          q.conflict = error instanceof ApiError && error.code === 'conflict';
          this.notify(
            q.conflict ? 'conflict' : 'error',
            error instanceof Error ? error : new Error('save_failed'),
          );
        },
      )
      .finally(() => {
        q.running = null;
      });
    await q.running;
    if (!q.failed && q.pending) await this.drain();
  };
  save = (entity: T | undefined, input: P) => {
    const q = this.q;
    if (!q.running && !q.failed && (!q.current || (entity && entity.revision > q.current.revision)))
      q.current = entity;
    q.pending = { ...q.pending, ...input };
    if (!q.failed) void this.drain();
  };
  retry = async (reload?: () => Promise<T | undefined>) => {
    const q = this.q;
    if (q.conflict && reload) {
      try {
        const latest = await reload();
        if (!latest) return;
        q.current = latest;
        q.key = null;
      } catch (error) {
        this.notify('conflict', error instanceof Error ? error : new Error('reload_failed'));
        return;
      }
    }
    q.pending = q.pending && q.failed ? { ...q.failed, ...q.pending } : (q.pending ?? q.failed);
    q.failed = null;
    await this.drain();
  };
  discard = () => {
    const q = this.q;
    q.failed = null;
    q.pending = null;
    q.key = null;
    q.conflict = false;
    this.notify('idle', null);
  };
  latest = () => this.q.current;
  settle = async () => {
    const q = this.q;
    while (q.running) await q.running;
    return !q.failed && !q.pending;
  };
}

export function createSaveQueue<T extends Entity, P extends object>(
  patch: Writer<T, P>,
  notify: (state: SaveState, error: Error | null) => void,
) {
  return new SaveQueue(patch, notify);
}
