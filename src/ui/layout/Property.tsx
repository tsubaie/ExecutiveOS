import type { ReactNode } from 'react';
import { cn } from '@/ui/cn';
// A property reads label, then value, on one line; the control keeps its own accessible label.
//
// EP-B25: a detail panel is a record before it is a form. `quiet` is what a panel passes to say
// "this is being read": the control drops its chrome and the row reads as a fact until the pointer
// or the keyboard arrives on it. Create forms pass nothing, because there the job is to fill the
// fields in and every one of them should look ready. `empty` mutes a value nobody has set, so the
// eye catches what the record actually says instead of filtering placeholders out of it.
export function Property({
  label,
  children,
  quiet = false,
  empty = false,
}: {
  label: string;
  children: ReactNode;
  quiet?: boolean;
  empty?: boolean;
}) {
  return (
    <div
      className={cn(
        'property grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-3 text-sm',
        quiet && 'property-quiet',
        empty && 'property-empty',
      )}
    >
      <span className="text-text-muted">{label}</span>
      {children}
    </div>
  );
}
