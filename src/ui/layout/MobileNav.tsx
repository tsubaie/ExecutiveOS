'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Ellipsis } from 'lucide-react';
import { navigation } from '@/core/modules/client';
import type { NavEntry } from '@/core/modules/manifest';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/ui/primitives/dialog';
// ADMIN-B19: the bar carries four destinations and a way to the rest. Seven entries were drawn as
// seven 44 px slots with no gap between them while their labels ran to 84 px, so at every width a
// phone offers the labels overlapped — "People" and "Committees" read as one word and
// "Administration" left the screen. Four fits: the widest of the four is 43 px in a 78 px slot on
// a 390 px screen, and 64 px on a 320 px one. Administration keeps its place in the bar, which is
// what ADMIN-B19 asks for; what changed is that the bar's last slot is a door rather than a
// seventh label nobody could read.
const CARRIED = 4;
// A menu holding one entry is worse than the entry, so the door only appears once it saves a slot.
function split(entries: NavEntry[]): { bar: NavEntry[]; behind: NavEntry[] } {
  if (entries.length <= CARRIED + 1) return { bar: entries, behind: [] };
  return { bar: entries.slice(0, CARRIED), behind: entries.slice(CARRIED) };
}
function isCurrent(path: string, href: string) {
  return path.startsWith(href.split('/').slice(0, 2).join('/'));
}
export function MobileNav({ role }: { role: string }) {
  const t = useTranslations('common');
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const { bar, behind } = split(navigation(role));
  const elsewhere = behind.some((entry) => isCurrent(path, entry.href));
  return (
    <>
      {bar.map((entry) => (
        <BarLink key={entry.href} entry={entry} path={path} />
      ))}
      {behind.length > 0 && (
        <>
          <button
            type="button"
            aria-expanded={open}
            aria-current={elsewhere ? 'page' : undefined}
            className="group/nav flex min-h-11 items-center gap-3 rounded-lg px-3 text-text-muted hover:bg-surface-raised hover:text-text aria-[current=page]:bg-surface-raised aria-[current=page]:text-accent"
            onClick={() => setOpen(true)}
          >
            <Ellipsis className="size-5" aria-hidden={true} />
            <span className="min-w-0 truncate">{t('navMore')}</span>
          </button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent sheet className="max-h-[85dvh] overflow-y-auto">
              <DialogTitle>{t('navMore')}</DialogTitle>
              <DialogDescription>{t('navMoreDescription')}</DialogDescription>
              <nav className="grid gap-1">
                {behind.map((entry) => (
                  <SheetLink
                    key={entry.href}
                    entry={entry}
                    path={path}
                    close={() => setOpen(false)}
                  />
                ))}
              </nav>
            </DialogContent>
          </Dialog>
        </>
      )}
    </>
  );
}
// In the bar an entry is an icon over its name; the column layout is in tokens.css, which is also
// why a growing label would stretch rather than sit beside the icon.
function BarLink({ entry, path }: { entry: NavEntry; path: string }) {
  const t = useTranslations('common');
  const Icon = entry.icon;
  return (
    <Link
      href={entry.href}
      aria-current={isCurrent(path, entry.href) ? 'page' : undefined}
      className="group/nav flex min-h-11 items-center gap-3 rounded-lg px-3 text-text-muted hover:bg-surface-raised hover:text-text aria-[current=page]:bg-surface-raised aria-[current=page]:text-accent"
    >
      <Icon className="size-5" aria-hidden={true} />
      <span className="min-w-0 truncate">{t(entry.key)}</span>
    </Link>
  );
}
// Behind the door there is width for a row, so the entry reads as the rail's does: icon, name, and
// its own live figure where it carries one (TASKS-B17).
function SheetLink({
  entry,
  path,
  close,
}: {
  entry: NavEntry;
  path: string;
  close: () => void;
}) {
  const t = useTranslations('common');
  const Icon = entry.icon;
  const Badge = entry.badge;
  return (
    <Link
      href={entry.href}
      onClick={close}
      aria-current={isCurrent(path, entry.href) ? 'page' : undefined}
      className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-text-muted hover:bg-surface-raised hover:text-text aria-[current=page]:bg-surface-raised aria-[current=page]:text-accent"
    >
      <Icon className="size-5 shrink-0" aria-hidden={true} />
      <span className="min-w-0 flex-1 truncate">{t(entry.key)}</span>
      {Badge && <Badge />}
    </Link>
  );
}
