import { useId, type ReactNode } from 'react';
import { cn } from '@/ui/cn';
// EP-B19: a visible message beside a control is not announced on its own. The control, its hint
// and its error carry stable ids and the relationships between them, so assistive technology can
// say which field failed and why. Children are a render prop because the control belongs to the
// consumer; the field only owns the identifiers.
export type FieldControl = {
  id: string;
  'aria-describedby': string | undefined;
  'aria-errormessage': string | undefined;
  'aria-invalid': true | undefined;
};
// EP-B25: `quiet` is what a detail panel passes to say "this is being read". A field is a form
// row and keeps its label above the control, but inside a record it should still read as written
// text rather than as an input waiting to be filled.
export function Field({
  label,
  children,
  error,
  hint,
  quiet = false,
  empty = false,
}: {
  label: string;
  children: (control: FieldControl) => ReactNode;
  error?: string | undefined;
  hint?: string | undefined;
  quiet?: boolean;
  empty?: boolean;
}) {
  const base = useId();
  const controlId = `${base}-control`;
  const hintId = `${base}-hint`;
  const errorId = `${base}-error`;
  return (
    <div className={cn('grid gap-2', quiet && 'property-quiet', empty && 'property-empty')}>
      <label htmlFor={controlId} className="text-sm font-medium">
        {label}
      </label>
      {children({
        id: controlId,
        'aria-describedby': hint ? hintId : undefined,
        'aria-errormessage': error ? errorId : undefined,
        'aria-invalid': error ? true : undefined,
      })}
      {hint && (
        <span id={hintId} className="text-xs font-normal text-text-muted">
          {hint}
        </span>
      )}
      {error && (
        <span id={errorId} role="alert" className="text-xs text-danger">
          {error}
        </span>
      )}
    </div>
  );
}
