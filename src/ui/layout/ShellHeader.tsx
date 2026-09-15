'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import { SearchPalette } from './SearchPalette';
import { AccountMenu } from './AccountMenu';
import { NotificationBell } from '@/modules/notifications/ui';
// 05 § Layout shell: the header carries three things and no fourth — search, notifications and the
// account. It used to carry the workspace name, which the sidebar foot already says in a heavier
// weight on the same screen, and two loose preference toggles. A band that spans every page at
// every width has to earn it.
export function ShellHeader({ user }: { user: { name: string; email: string } }) {
  const t = useTranslations('common');
  const [searching, setSearching] = useState(false);
  const apple = useApplePlatform();
  useSearchShortcut(() => setSearching(true));
  return (
    <header className="flex min-h-14 shrink-0 items-center gap-2 border-b px-4 lg:px-8">
      {/* SEARCH-B08: a button, not an input. The palette owns the text, so there is one place it is
          typed and no state to hand over when it opens. */}
      <Button
        variant="outline"
        className="w-full max-w-md justify-start gap-2 font-normal text-text-muted"
        onClick={() => setSearching(true)}
      >
        <Search aria-hidden={true} className="size-4" />
        <span className="flex-1 truncate text-start">{t('searchPlaceholder')}</span>
        <kbd
          translate="no"
          aria-hidden={true}
          className="hidden shrink-0 rounded border px-1.5 py-0.5 text-[11px] tabular-nums sm:inline"
        >
          {t(apple ? 'searchShortcutMac' : 'searchShortcut')}
        </kbd>
      </Button>
      <div className="ms-auto flex shrink-0 items-center gap-1">
        <NotificationBell />
        <AccountMenu user={user} />
      </div>
      <SearchPalette open={searching} onOpenChange={setSearching} />
    </header>
  );
}
// SEARCH-B08: ⌘K on a Mac, Ctrl+K elsewhere. It is ignored while a field has focus for the same
// reason the entity framework's own shortcuts are (EP-B06), except that this one is a modifier
// chord and therefore cannot be typed by accident — so only a text field that would swallow it
// needs the guard.
function useSearchShortcut(open: () => void) {
  // The chord has to work wherever focus is, which is what a global palette shortcut means.
  // sync: external system — the document's key events.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'k' || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      open();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
}
// The hint names the key the reader actually presses. The user agent is an external store that
// never changes and has no value on the server, so it is read through the primitive that exists
// for exactly that (the same reasoning EP-B29 gives for the remembered layout) rather than
// corrected by an effect a frame after paint. Ctrl is the server's honest answer.
const subscribe = () => () => {};
const isApple = () => /mac|iphone|ipad/i.test(navigator.userAgent);
function useApplePlatform() {
  return useSyncExternalStore(subscribe, isApple, () => false);
}
