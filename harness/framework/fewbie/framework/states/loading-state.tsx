/**
 * Minimal loading-state double: keeps the status role and visible label so a
 * module's loading surface stays assertable in the harness.
 */
export function LoadingState({
  label,
  variant: _variant,
  className,
}: {
  label?: string;
  variant?: "block" | "overlay";
  className?: string;
}) {
  return (
    <div role="status" aria-live="polite" className={className}>
      {label ? <span>{label}</span> : null}
    </div>
  );
}
