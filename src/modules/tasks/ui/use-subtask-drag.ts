'use client';
import { useRef, useState, type PointerEvent } from 'react';
import type { TaskDetail } from '../schema/validation';
import { useTaskMutations } from './queries';
import { useTaskOperation } from './use-task-operation';
// Pointer-driven reordering for the subtask checklist: press the grip, move over another row,
// release. Works with mouse, pen and touch (the grip sets `touch-action: none`); the dialog's
// arrow buttons remain the keyboard route (TASKS-B08).
// Drag state plus the reorder mutation for a parent task's active subtasks.
export function useSubtaskReorder(task: TaskDetail) {
  const mutations = useTaskMutations();
  const operation = useTaskOperation();
  const active = task.subtasks.filter((child) => !child.deletedAt);
  const drag = useSubtaskDrag(
    active.map((child) => child.id),
    (ordered) =>
      void operation.run(() =>
        mutations.reorder(
          task.id,
          ordered,
          Object.fromEntries(active.map((child) => [child.id, child.revision])),
        ),
      ),
  );
  // Keyboard alternative to dragging: move one step from the grip.
  const nudge = (id: string, direction: -1 | 1) => {
    const ids = active.map((child) => child.id);
    const index = ids.indexOf(id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) return;
    const next = [...ids];
    next.splice(index, 1);
    next.splice(target, 0, id);
    void operation.run(() =>
      mutations.reorder(
        task.id,
        next,
        Object.fromEntries(active.map((child) => [child.id, child.revision])),
      ),
    );
  };
  return { ...drag, active, nudge, error: operation.error, state: operation.state };
}
export function useSubtaskDrag(ids: string[], commit: (ordered: string[]) => void) {
  const [order, setOrder] = useState<string[] | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const rows = useRef(new Map<string, HTMLElement>());
  const current = order ?? ids;
  const register = (id: string) => (element: HTMLElement | null) => {
    if (element) rows.current.set(id, element);
    else rows.current.delete(id);
  };
  const start = (id: string) => (event: PointerEvent<HTMLElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(id);
    setOrder(ids);
  };
  const move = (event: PointerEvent<HTMLElement>) => {
    if (!dragging) return;
    const over = [...rows.current.entries()].find(([, element]) => {
      const box = element.getBoundingClientRect();
      return event.clientY >= box.top && event.clientY <= box.bottom;
    })?.[0];
    if (!over || over === dragging) return;
    setOrder((list) => {
      const next = (list ?? ids).filter((entry) => entry !== dragging);
      next.splice((list ?? ids).indexOf(over), 0, dragging);
      return next;
    });
  };
  const end = () => {
    if (order && dragging && order.join() !== ids.join()) commit(order);
    setDragging(null);
    setOrder(null);
  };
  return { order: current, dragging, register, start, move, end };
}
