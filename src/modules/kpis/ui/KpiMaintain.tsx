'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ListOrdered, Target } from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/ui/primitives/dialog';
import { KpiReadings } from './KpiReadings';
import { KpiTargets } from './KpiTargets';
import type { KpiDetail } from '../schema/validation';
type Task = 'readings' | 'targets' | null;
// KPIS-B08: what a KPI is maintained from is work, not reading. The history and the year's targets
// are opened by their owner a few times a quarter, and each is a table wider than the record column
// they were folded into — twelve monthly target inputs wrapped into three cramped rows there.
//
// So they leave the record and become two tasks it offers: a dialog is entered, finished and left,
// which is the shape of the job, and it has the width the tables need. The record keeps the answer
// and the evidence — the sentence, the arc, the note and the trend — and says on the face of each
// button how much sits behind it, so nothing has to be opened to find out whether it is empty.
export function KpiMaintenance({ kpi, editable }: { kpi: KpiDetail; editable: boolean }) {
  const t = useTranslations('kpis');
  const [task, setTask] = useState<Task>(null);
  return (
    <section className="mt-6 flex flex-wrap gap-2 border-t pt-4">
      <Button variant="outline" size="sm" onClick={() => setTask('readings')}>
        <ListOrdered className="size-4" aria-hidden={true} />
        {t('readings')}
        <span className="text-text-muted">
          · {t('readingCount', { count: kpi.readings.length })}
        </span>
      </Button>
      <Button variant="outline" size="sm" onClick={() => setTask('targets')}>
        <Target className="size-4" aria-hidden={true} />
        {t('targets')}
        <span className="text-text-muted">· {t('targetCount', { count: kpi.targets.length })}</span>
      </Button>
      <Dialog open={task !== null} onOpenChange={(open) => !open && setTask(null)}>
        {/* A phone takes it as a sheet from the bottom edge and a desk as a centred dialog with the
            width the tables want. Only the body scrolls: the title and the close stay put, so a long
            history never scrolls its own way out of the reader's reach. */}
        <DialogContent
          sheet
          className="max-h-[85dvh] grid-rows-[auto_auto_minmax(0,1fr)] lg:max-w-3xl"
        >
          <DialogTitle>{t(task === 'targets' ? 'targets' : 'readings')}</DialogTitle>
          <DialogDescription dir="auto">
            {t(task === 'targets' ? 'targetsIntro' : 'readingsIntro', { name: kpi.name })}
          </DialogDescription>
          <div className="min-h-0 overflow-y-auto">
            {task === 'targets' ? (
              <KpiTargets kpi={kpi} editable={editable} />
            ) : (
              <KpiReadings kpi={kpi} editable={editable} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
