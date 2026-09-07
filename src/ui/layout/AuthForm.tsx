'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocale, useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Command, ArrowRight, ShieldCheck } from 'lucide-react';
import { request } from '@/core/http/client';
import { Locale, defaults } from '@/core/config/defaults';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { NativeSelect, NativeSelectOption } from '@/ui/primitives/native-select';
import { Preferences } from './Preferences';
import { Field } from './Field';
import { ErrorPanel } from './ErrorPanel';
const Form = z.object({
  email: z.email(),
  password: z.string().min(1).max(256),
  name: z.string(),
  workspaceName: z.string(),
  timezone: z.string(),
  locale: Locale,
  setupToken: z.string(),
  principalName: z.string(),
  token: z.string(),
});
type Mode = 'setup' | 'login' | 'recovery';
export function AuthForm({
  mode,
  recoveryEnabled = false,
}: {
  mode: Mode;
  recoveryEnabled?: boolean;
}) {
  const t = useTranslations('auth');
  const c = useTranslations('common');
  const locale = Locale.parse(useLocale());
  const client = useQueryClient();
  const form = useForm({
    resolver: zodResolver(Form),
    defaultValues: {
      email: '',
      password: '',
      name: '',
      workspaceName: defaults.workspaceName,
      timezone: defaults.timezone,
      locale,
      setupToken: '',
      principalName: '',
      token: '',
    },
  });
  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof Form>) => {
      const body =
        mode === 'setup'
          ? { ...values, token: undefined }
          : mode === 'login'
            ? { email: values.email, password: values.password }
            : { email: values.email, password: values.password, token: values.token };
      return request(mode === 'login' ? '/auth/login' : `/${mode}`, z.object({ data: z.json() }), {
        method: 'POST',
        body: z.json().parse(JSON.parse(JSON.stringify(body))),
      });
    },
    onSuccess: () => {
      client.clear();
      location.assign(mode === 'recovery' ? '/login' : '/home');
    },
  });
  const fields = mode === 'setup' ? ['name', 'workspaceName', 'timezone', 'principalName'] : [];
  return (
    <div className="min-h-dvh">
      <header className="flex items-center justify-between px-5 py-5 sm:px-10">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Command className="size-6 text-accent" />
          {c('brand')}
        </Link>
        <Preferences />
      </header>
      <main id="content" className="mx-auto max-w-lg px-5 py-8 sm:py-12">
        <div className="mb-7">
          <p className="mb-3 text-sm text-accent">{c('tagline')}</p>
          <h1 className="text-3xl font-semibold tracking-tight">{t(`${mode}Title`)}</h1>
          <p className="mt-3 text-text-muted">{t(`${mode}Description`)}</p>
        </div>
        <form
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          className="grid gap-5 rounded-xl border bg-surface p-6 sm:p-8"
        >
          {mode === 'setup' && (
            <Field label={t('token')} hint={t('tokenHelp')}>
              <Input autoComplete="off" required {...form.register('setupToken')} />
            </Field>
          )}
          {mode === 'recovery' && (
            <Field label={t('recoveryToken')}>
              <Input autoComplete="off" required {...form.register('token')} />
            </Field>
          )}
          {fields.map((field) => {
            const key = z.enum(['name', 'workspaceName', 'timezone', 'principalName']).parse(field);
            return (
              <Field key={key} label={t(key)}>
                <Input required={key !== 'principalName'} dir="auto" {...form.register(key)} />
              </Field>
            );
          })}
          {mode === 'setup' && (
            <Field label={t('language')}>
              <NativeSelect {...form.register('locale')}>
                {Locale.options.map((item) => (
                  <NativeSelectOption key={item} value={item}>
                    {new Intl.DisplayNames(locale, { type: 'language' }).of(item)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          )}
          <Field label={t('email')} error={form.formState.errors.email?.message}>
            <Input type="email" autoComplete="username" required {...form.register('email')} />
          </Field>
          <Field
            label={t('password')}
            hint={mode === 'login' ? undefined : t('passwordHelp')}
            error={form.formState.errors.password?.message}
          >
            <Input
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={mode === 'login' ? 1 : 12}
              required
              {...form.register('password')}
            />
          </Field>
          {mutation.isError && <ErrorPanel error={mutation.error} />}
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? c('saving') : t(mode)}
            <ArrowRight className="ms-1 size-4 rtl:rotate-180" />
          </Button>
          {mode === 'login' && recoveryEnabled && (
            <Link className="text-center text-sm text-text-muted underline" href="/recovery">
              {t('recoverLink')}
            </Link>
          )}
        </form>
        <p className="mt-7 flex items-center justify-center gap-2 text-xs text-text-muted">
          <ShieldCheck className="size-4" />
          {t('secure')}
        </p>
      </main>
    </div>
  );
}
