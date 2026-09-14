'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { Field } from '@/ui/layout/Field';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import { useObjectives, useObjectiveMutations, useObjectiveOrder } from './queries';
import type { Objective } from '../schema/validation';
// KPIS-B06: the short list a scorecard is organised by. Order is the plan's order, so it is set by
// hand rather than sorted; deleting one keeps its KPIs, which then read as belonging to an
// archived objective instead of losing their place.
export function ObjectivesAdmin() {
  const t = useTranslations('kpis');
  const c = useTranslations('common');
  const query = useObjectives();
  const mutations = useObjectiveMutations();
  const reorder = useObjectiveOrder();
  const rows = query.data?.data ?? [];
  const remove = useMutation({
    mutationFn: (row: Objective) => mutations.remove(row.id, row.revision),
  });
  const move = useMutation({
    mutationFn: (next: Objective[]) =>
      reorder(next.map((row) => ({ id: row.id, revision: row.revision }))),
  });
  function shift(index: number, by: number) {
    const next = [...rows];
    const [row] = next.splice(index, 1);
    if (row) next.splice(index + by, 0, row);
    move.mutate(next);
  }
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{t('objectives')}</h2>
        <p className="text-sm text-text-muted">{t('objectivesIntro')}</p>
      </div>
      {query.error && <ErrorPanel error={query.error} />}
      {remove.error && <ErrorPanel error={remove.error} />}
      {move.error && <ErrorPanel error={move.error} />}
      <ObjectiveForm />
      {query.isPending && <p role="status">{c('loading')}</p>}
      {!query.isPending && rows.length === 0 && (
        <p className="text-sm text-text-muted">{t('noObjectives')}</p>
      )}
      <ul className="grid gap-2">
        {rows.map((row, index) => (
          <li key={row.id}>
            <ObjectiveRow
              row={row}
              first={index === 0}
              last={index === rows.length - 1}
              move={(by) => shift(index, by)}
              remove={() => remove.mutate(row)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
function ObjectiveForm() {
  const t = useTranslations('kpis');
  const c = useTranslations('common');
  const mutations = useObjectiveMutations();
  const [draft, setDraft] = useState('');
  const create = useMutation({
    mutationFn: () => mutations.create({ name: draft.trim(), description: '' }),
    onSuccess: () => setDraft(''),
  });
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (draft.trim()) create.mutate();
      }}
    >
      <div className="flex flex-wrap items-end gap-3">
        <Field label={t('newObjective')}>
          {(control) => (
            <Input
              {...control}
              dir="auto"
              required
              maxLength={500}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
          )}
        </Field>
        <Button type="submit" disabled={create.isPending}>
          {c('create')}
        </Button>
      </div>
      {create.error && <ErrorPanel error={create.error} />}
    </form>
  );
}
function ObjectiveRow({
  row,
  first,
  last,
  move,
  remove,
}: {
  row: Objective;
  first: boolean;
  last: boolean;
  move: (by: number) => void;
  remove: () => void;
}) {
  const t = useTranslations('kpis');
  const mutations = useObjectiveMutations();
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2">
      <Input
        aria-label={t('name')}
        dir="auto"
        maxLength={500}
        defaultValue={row.name}
        className="min-w-0 flex-1"
        onBlur={(event) => {
          const name = event.target.value.trim();
          if (name && name !== row.name)
            void mutations.patch(row.id, { name, revision: row.revision });
        }}
      />
      <span className="text-xs text-text-muted">{t('kpiCount', { count: row.kpiCount })}</span>
      <Button
        variant="ghost"
        size="sm"
        disabled={first}
        aria-label={t('moveUp', { name: row.name })}
        onClick={() => move(-1)}
      >
        <ChevronUp className="size-4" aria-hidden={true} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={last}
        aria-label={t('moveDown', { name: row.name })}
        onClick={() => move(1)}
      >
        <ChevronDown className="size-4" aria-hidden={true} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="text-danger"
        aria-label={t('deleteObjective', { name: row.name })}
        onClick={remove}
      >
        <Trash2 className="size-4" aria-hidden={true} />
      </Button>
    </div>
  );
}
