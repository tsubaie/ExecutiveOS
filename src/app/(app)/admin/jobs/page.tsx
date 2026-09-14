import { AdminDataPage } from '@/modules/users/ui';
import { PageBody } from '@/ui/layout/PageTransition';
export default function Page() {
  return (
    <PageBody>
      <AdminDataPage resource="jobs" />
    </PageBody>
  );
}
