'use client';
import { PagePlaceholder } from '@/ui/layout/PageTransition';
import { EntityListSkeleton } from './EntityStates';
// EP-B30: what a module shows while its route arrives. It used to be a centred spinner, which meant
// opening Tasks went spinner → placeholder rows → rows: three screens for one navigation, and the
// first of them looked nothing like the other two. A route that is about to render a list shows the
// shape of that list instead, so the page appears at once and fills in, rather than appearing to
// load twice. The rail and bar are drawn as empty surfaces because their content is per module and
// a guess at it would be a fourth thing that changes.
export default function EntityPlaceholder() {
  return (
    <PagePlaceholder>
      <section className="entity-page min-w-0">
        <div className="entity-workspace flex min-h-0 flex-1 overflow-hidden lg:gap-3 lg:p-3">
          <aside className="entity-rail hidden w-[208px] shrink-0 rounded-xl border bg-surface xl:block" />
          <div className="min-w-0 flex-1 overflow-hidden bg-surface lg:rounded-xl lg:border">
            <div className="h-[104px] border-b bg-surface" />
            <EntityListSkeleton />
          </div>
        </div>
      </section>
    </PagePlaceholder>
  );
}
