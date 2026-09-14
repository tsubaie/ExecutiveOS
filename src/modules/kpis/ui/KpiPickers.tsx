'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/ui/cn';
import type { Direction, KpiPatch, Unit } from '../schema/validation';
import { unitIcons, useKpiLabels } from './use-kpi-labels';
type Save = (patch: Omit<KpiPatch, 'revision'>) => void;
// Which way is good is a two-state fact, so it is one control that states its own state rather than
// a menu of two: the word, the arrow and the colour flip together when it is pressed.
export function DirectionToggle({ value, save }: { value: Direction; save?: Save | undefined }) {
  const t = useTranslations('kpis');
  const [direction, setDirection] = useState(value);
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setDirection(value);
  }
  const higher = direction === 'higher';
  const Arrow = higher ? TrendingUp : TrendingDown;
  return (
    <>
      <input type="hidden" name="direction" value={direction} />
      <button
        type="button"
        aria-label={t('flipDirection')}
        className={cn(
          'inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium',
          higher
            ? 'border-status-good/40 bg-status-good/15 text-status-good-ink'
            : 'border-status-bad/40 bg-status-bad/15 text-status-bad-ink',
        )}
        onClick={() => {
          const next: Direction = higher ? 'lower' : 'higher';
          setDirection(next);
          save?.({ direction: next });
        }}
      >
        <Arrow className="size-4" aria-hidden={true} />
        {t(higher ? 'higherShort' : 'lowerShort')}
      </button>
    </>
  );
}
export function UnitOption({ unit }: { unit: Unit }) {
  const labels = useKpiLabels();
  const Icon = unitIcons[unit];
  return (
    <span className="inline-flex items-center gap-2">
      <Icon className="size-3.5 shrink-0 opacity-70" aria-hidden={true} />
      {labels.unit(unit)}
    </span>
  );
}
