'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
export function useLinkGuard(navigate: (action: () => void) => Promise<void>) {
  const router = useRouter();
  // sync: keep shared shell and owner links from unmounting a pending editor.
  useEffect(() => {
    const click = (event: MouseEvent) => {
      if (ignoreLinkClick(event)) return;
      const anchor = event.target instanceof Element ? event.target.closest('a') : null;
      if (
        !anchor ||
        anchor.target ||
        anchor.download ||
        anchor.origin !== location.origin ||
        anchor.hash
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      const href = anchor.pathname + anchor.search;
      void navigate(() => router.push(href));
    };
    document.addEventListener('click', click, true);
    return () => document.removeEventListener('click', click, true);
  }, [navigate, router]);
}

function ignoreLinkClick(event: MouseEvent) {
  return (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}
