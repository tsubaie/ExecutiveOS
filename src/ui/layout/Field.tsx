import { type ReactNode } from 'react';
export function Field({
  label,
  children,
  error,
  hint,
}: {
  label: string;
  children: ReactNode;
  error?: string | undefined;
  hint?: string | undefined;
}) {
  return (
    <div className="grid gap-2">
      <label className="grid gap-2 text-sm font-medium">
        {label}
        {children}
      </label>
      {hint && <span className="text-xs font-normal text-text-muted">{hint}</span>}
      {error && (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      )}
    </div>
  );
}
