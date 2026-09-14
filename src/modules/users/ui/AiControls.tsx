'use client';
import { useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { z } from 'zod';
import { AiControls as Controls } from '@/core/config/ai-controls-schema';
import { AiCapability } from '@/core/config/ai-capabilities';
import { useAiControls, useSaveAiControls } from './ai-queries';
import { Button } from '@/ui/primitives/button';
import { Checkbox } from '@/ui/primitives/checkbox';
import { Input } from '@/ui/primitives/input';
import { Field } from '@/ui/layout/Field';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import Loading from '@/ui/layout/Loading';
const labels: Record<z.infer<typeof AiCapability>, 'breakdown' | 'refine' | 'suggestTags'> = { 'tasks.breakdown': 'breakdown', 'notes.refine': 'refine', 'notes.suggest_tags': 'suggestTags' };
export function AiControls() {
  const t = useTranslations('admin');
  const query = useAiControls();
  return <section className="space-y-4 rounded-xl border bg-surface p-6">
    <h2 className="font-medium">{t('aiControls')}</h2>
    {query.isPending ? <Loading /> : query.error ? <ErrorPanel error={query.error} /> : <>
      <ControlForm data={query.data.data} />
      <Usage data={query.data.data} />
    </>}
  </section>;
}
function ControlForm({ data }: { data: z.infer<typeof Controls> }) {
  const t = useTranslations('admin');
  const a = useTranslations('ai');
  const c = useTranslations('common');
  const [enabledCapabilities, setEnabled] = useState(data.enabledCapabilities);
  const [budget, setBudget] = useState(data.monthlyTokenBudget?.toString() ?? '');
  const save = useSaveAiControls();
  return <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); save.mutate({ enabledCapabilities, monthlyTokenBudget: budget.trim() ? Number(budget) : null }); }}>
    <fieldset className="space-y-3"><legend className="mb-2 text-sm font-medium">{t('aiEnabledFeatures')}</legend>
      {AiCapability.options.map((capability) => <label key={capability} className="flex items-center gap-3 text-sm"><Checkbox checked={enabledCapabilities.includes(capability)} onCheckedChange={(checked) => setEnabled(checked ? [...enabledCapabilities, capability] : enabledCapabilities.filter((value) => value !== capability))} />{a(labels[capability])}</label>)}
    </fieldset>
    <Field label={t('aiMonthlyBudget')}>{(control) => <Input {...control} type="number" min={1} step={1} value={budget} onChange={(event) => setBudget(event.target.value)} />}</Field>
    <p className="text-xs text-text-muted">{t('aiBudgetHelp')}</p>
    <Button type="submit" disabled={save.isPending}>{c('save')}</Button>
    {save.isSuccess && <p role="status" className="text-sm text-success">{c('saved')}</p>}
    {save.error && <ErrorPanel error={save.error} />}
  </form>;
}
function Usage({ data }: { data: z.infer<typeof Controls> }) {
  const t = useTranslations('admin');
  const f = useFormatter();
  const total = data.usedTokens + data.reservedTokens;
  return <div className="space-y-3 border-t pt-4 text-sm">
    <h3 className="font-medium">{t('aiUsage')}</h3>
    <p>{t('aiUsageTotals', { used: f.number(data.usedTokens), reserved: f.number(data.reservedTokens) })}</p>
    {data.monthlyTokenBudget !== null && total >= data.monthlyTokenBudget * 0.8 && <p role="status" className="text-danger">{t('aiBudgetWarning')}</p>}
    {data.usage.map((row) => <div key={row.capability} className="space-y-1 rounded-lg border p-3">
      <p><bdi>{row.capability}</bdi></p>
      <p className="text-text-muted">{t('aiUsageRow', { calls: f.number(row.calls), tokens: f.number(row.inputTokens + row.outputTokens + row.cacheTokens), cost: f.number(row.estimatedCostMicros / 1000000, { style: 'currency', currency: 'USD' }) })}</p>
    </div>)}
    <p className="text-xs text-text-muted">{t('aiUsageHelp')}</p>
  </div>;
}
