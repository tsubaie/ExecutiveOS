import { notFound } from 'next/navigation';
import { env } from '@/core/config/env';
import { AuthForm } from '@/ui/layout/AuthForm';
export default function Page() {
  if (!env().RECOVERY_TOKEN) notFound();
  return <AuthForm mode="recovery" />;
}
