import { redirect } from 'next/navigation';
import { initialized } from '@/core/db/auth-repo';
import { env } from '@/core/config/env';
import { AuthForm } from '@/ui/layout/AuthForm';
import { routes } from '@/core/routes';
export default async function Page() {
  if (!(await initialized())) redirect(routes.setup());
  return <AuthForm mode="login" recoveryEnabled={Boolean(env().RECOVERY_TOKEN)} />;
}
