'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/ui/primitives/dialog';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import type { CreateApi } from '@/ui/entity/types';
import type { Person, PersonCreate } from '../schema/validation';
import { PersonForm, type Values } from './PersonForm';
export function CreatePerson({ api }: { api: CreateApi<PersonCreate, Person> }) {
  const t = useTranslations('people');
  const c = useTranslations('common');
  const [duplicate, setDuplicate] = useState<Values | null>(null);
  const [error, setError] = useState<Error | null>(null);
  async function submit(input: Values, confirmDuplicate = false) {
    try {
      const person = await api.submit({ ...input, confirmDuplicate });
      if (!person) setDuplicate(input);
    } catch (error) {
      setError(error instanceof Error ? error : new Error(c('error')));
    }
  }
  return (
    <div className="p-5">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold">{c('create')}</h2>
        <Button variant="ghost" aria-label={c('close')} onClick={api.cancel}>
          <X className="size-4" />
        </Button>
      </div>
      {error && <ErrorPanel error={error} />}
      <PersonForm submit={(values) => void submit(values)} pending={api.pending} />
      <Dialog
        open={Boolean(duplicate)}
        onOpenChange={(open) => {
          if (!open) setDuplicate(null);
        }}
      >
        <DialogContent>
          <DialogTitle>{t('duplicateTitle')}</DialogTitle>
          <DialogDescription>{t('duplicateDescription')}</DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicate(null)}>
              {c('cancel')}
            </Button>
            <Button
              onClick={() => {
                if (duplicate) void submit(duplicate, true);
              }}
            >
              {t('createAnyway')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
