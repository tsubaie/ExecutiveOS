import type { ReactNode } from 'react';
// A property reads label, then value, on one line; the control keeps its own accessible label.
export function Property({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-3 text-sm">
      <span className="text-text-muted">{label}</span>
      {children}
    </div>
  );
}
