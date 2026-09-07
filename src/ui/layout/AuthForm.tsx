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
import { routes } from '@/core/routes';
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
type FormValues = z.infer<typeof Form>;
type Mode = 'setup' | 'login' | 'recovery';
const setupFields = z.enum(['name', 'workspaceName', 'timezone', 'principalName']);
function authBody(mode: Mode, values: FormValues) {
  if (mode === 'login') return { email: values.email, password: values.password };
  if (mode === 'recovery')
    return { email: values.email, password: values.password, token: values.token };
  const { token, ...setup } = values;
  void token;
  return setup;
}
function useAuthState(mode: Mode) {
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
    mutationFn: (values: FormValues) =>
      request(mode === 'login' ? '/auth/login' : `/${mode}`, z.object({ data: z.json() }), {
        method: 'POST',
        body: authBody(mode, values),
      }),
    onSuccess: () => {
      client.clear();
      location.assign(mode === 'recovery' ? routes.login() : routes.home());
    },
  });
  return { mode, locale, form, mutation };
}
type AuthState = ReturnType<typeof useAuthState>;
export function AuthForm({
  mode,
  recoveryEnabled = false,
}: {
  mode: Mode;
  recoveryEnabled?: boolean;
}) {
  const t = useTranslations('auth');
  const c = useTranslations('common');
  const state = useAuthState(mode);
  return (
    <div className="min-h-dvh">
      <header className="flex items-center justify-between px-5 py-5 sm:px-10">
        <Link href={routes.root()} className="flex items-center gap-2 font-semibold">
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
          onSubmit={state.form.handleSubmit((values) => state.mutation.mutate(values))}
          className="grid gap-5 rounded-xl border bg-surface p-6 sm:p-8"
        >
          {mode === 'setup' && <SetupFields state={state} />}
          {mode === 'recovery' && <RecoveryTokenField state={state} />}
          <CredentialFields state={state} />
          {state.mutation.isError && <ErrorPanel error={state.mutation.error} />}
          <Button type="submit" disabled={state.mutation.isPending}>
            {state.mutation.isPending ? c('saving') : t(mode)}
            <ArrowRight className="ms-1 size-4 rtl:rotate-180" />
          </Button>
          {mode === 'login' && recoveryEnabled && (
            <Link
              className="text-center text-sm text-text-muted underline"
              href={routes.recovery()}
            >
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
function SetupFields({ state }: { state: AuthState }) {
  const t = useTranslations('auth');
  const names = new Intl.DisplayNames(state.locale, { type: 'language' });
  return (
    <>
      <Field label={t('token')} hint={t('tokenHelp')}>
        <Input autoComplete="off" required {...state.form.register('setupToken')} />
      </Field>
      {setupFields.options.map((key) => (
        <Field key={key} label={t(key)}>
          <Input required={key !== 'principalName'} dir="auto" {...state.form.register(key)} />
        </Field>
      ))}
      <Field label={t('language')}>
        <NativeSelect {...state.form.register('locale')}>
          {Locale.options.map((item) => (
            <NativeSelectOption key={item} value={item}>
              {names.of(item)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
    </>
  );
}
function RecoveryTokenField({ state }: { state: AuthState }) {
  const t = useTranslations('auth');
  return (
    <Field label={t('recoveryToken')}>
      <Input autoComplete="off" required {...state.form.register('token')} />
    </Field>
  );
}
function CredentialFields({ state }: { state: AuthState }) {
  const t = useTranslations('auth');
  const login = state.mode === 'login';
  const errors = state.form.formState.errors;
  return (
    <>
      <Field label={t('email')} error={errors.email?.message}>
        <Input type="email" autoComplete="username" required {...state.form.register('email')} />
      </Field>
      <Field
        label={t('password')}
        hint={login ? undefined : t('passwordHelp')}
        error={errors.password?.message}
      >
        <Input
          type="password"
          autoComplete={login ? 'current-password' : 'new-password'}
          minLength={login ? 1 : 12}
          required
          {...state.form.register('password')}
        />
      </Field>
    </>
  );
}
