import { redirect } from 'next/navigation';
import { initialized } from '@/core/db/auth-repo';
import { currentUser } from '@/core/auth/session';
export default async function Page() {
  if (!(await initialized())) redirect('/setup');
  redirect((await currentUser()) ? '/home' : '/login');
}
