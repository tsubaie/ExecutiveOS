import { Suspense } from 'react';
import { PeoplePage } from '@/modules/people/ui';
import { PageBody } from '@/ui/layout/PageTransition';
import Loading from '@/ui/layout/Loading';
export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <PageBody>
        <PeoplePage />
      </PageBody>
    </Suspense>
  );
}
