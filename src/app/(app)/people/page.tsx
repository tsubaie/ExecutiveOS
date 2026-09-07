import { Suspense } from 'react';
import { PeoplePage } from '@/modules/people/ui';
import Loading from '@/ui/layout/Loading';
export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <PeoplePage />
    </Suspense>
  );
}
