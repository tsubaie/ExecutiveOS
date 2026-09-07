import { redirect } from 'next/navigation';
import { initialized } from '@/core/db/auth-repo';
import { currentUser } from '@/core/auth/session';
import { routes } from '@/core/routes';
export default async function Page() {
  if (!(await initialized())) redirect(routes.setup());
  redirect((await currentUser()) ? routes.home() : routes.login());
}
