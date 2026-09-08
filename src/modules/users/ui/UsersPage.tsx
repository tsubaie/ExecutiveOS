'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { User, UserCreate } from '../schema/validation';
import { z } from 'zod';
import { useUsers, useCreateUser, useUpdateUser } from './queries';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { NativeSelect, NativeSelectOption } from '@/ui/primitives/native-select';
import { Dialog, DialogContent, DialogTitle } from '@/ui/primitives/dialog';
import { Field } from '@/ui/layout/Field';
import { ErrorPanel } from '@/ui/layout/ErrorPanel';
import Loading from '@/ui/layout/Loading';
type Member = z.infer<typeof User>;
function EditMember({ user }: { user: Member }) {
  const t = useTranslations('admin');
  const c = useTranslations('common');
  const mutation = useUpdateUser();
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState(user.role);
  const [active, setActive] = useState(user.isActive);
  return (
    <div className="grid gap-4">
      <Field label={t('name')}>
        {(control) => <Input {...control} value={name} onChange={(e) => setName(e.target.value)} />}
      </Field>
      <Field label={t('role')}>
        {(control) => (
          <NativeSelect
            {...control}
            value={role}
            onChange={(e) => setRole(User.shape.role.parse(e.target.value))}
          >
            <NativeSelectOption value="member">{t('member')}</NativeSelectOption>
            <NativeSelectOption value="admin">{t('admin')}</NativeSelectOption>
          </NativeSelect>
        )}
      </Field>
      <Button variant="outline" onClick={() => setActive(!active)}>
        {active ? c('active') : c('inactive')}
      </Button>
      {mutation.isError && <ErrorPanel error={mutation.error} />}
      <Button
        disabled={mutation.isPending}
        onClick={() =>
          mutation.mutate({
            id: user.id,
            input: { name, role, isActive: active, revision: user.revision },
          })
        }
      >
        {mutation.isPending ? c('saving') : c('save')}
      </Button>
      {mutation.isSuccess && <p role="status">{c('saved')}</p>}
    </div>
  );
}
function NewMember() {
  const t = useTranslations('admin');
  const a = useTranslations('auth');
  const c = useTranslations('common');
  const mutation = useCreateUser();
  const form = useForm({
    resolver: zodResolver(UserCreate),
    defaultValues: { name: '', email: '', role: User.shape.role.enum.member },
  });
  if (mutation.data)
    return (
      <div className="grid gap-3">
        <p>{t('temporaryPassword')}</p>
        <code className="break-all rounded-lg bg-surface-raised p-4" dir="ltr">
          {mutation.data.meta.temporaryPassword}
        </code>
      </div>
    );
  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
      <Field label={t('name')}>
        {(control) => <Input required {...control} {...form.register('name')} />}
      </Field>
      <Field label={a('email')}>
        {(control) => <Input type="email" required {...control} {...form.register('email')} />}
      </Field>
      <Field label={t('role')}>
        {(control) => (
          <NativeSelect {...control} {...form.register('role')}>
            <NativeSelectOption value="member">{t('member')}</NativeSelectOption>
            <NativeSelectOption value="admin">{t('admin')}</NativeSelectOption>
          </NativeSelect>
        )}
      </Field>
      {mutation.isError && <ErrorPanel error={mutation.error} />}
      <Button disabled={mutation.isPending} type="submit">
        {mutation.isPending ? c('saving') : t('addUser')}
      </Button>
    </form>
  );
}
function UsersList({ users, onEdit }: { users: Member[]; onEdit: (id: string) => void }) {
  const t = useTranslations('admin');
  const c = useTranslations('common');
  return (
    <ul className="divide-y rounded-xl border bg-surface">
      {users.map((user) => (
        <li key={user.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="min-w-0">
            <p dir="auto" className="font-medium">
              {user.name}
            </p>
            <p className="mt-1 break-all text-sm text-text-muted">
              <bdi>{user.email}</bdi>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-muted">
              {t(user.role)} · {user.isActive ? c('active') : c('inactive')}
            </span>
            <Button variant="outline" onClick={() => onEdit(user.id)}>
              {c('edit')}
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
export function UsersPage() {
  const t = useTranslations('admin');
  const c = useTranslations('common');
  const query = useUsers();
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const user = query.data?.data.find((user) => user.id === selected);
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-muted">{t('usersDescription')}</p>
        <Button onClick={() => setAdding(true)}>{t('addUser')}</Button>
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorPanel error={query.error} />
      ) : (
        <UsersList users={query.data.data} onEdit={setSelected} />
      )}
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent>
          <DialogTitle>{t('addUser')}</DialogTitle>
          <NewMember />
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent>
          <DialogTitle>{c('edit')}</DialogTitle>
          {user && <EditMember key={user.id} user={user} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
