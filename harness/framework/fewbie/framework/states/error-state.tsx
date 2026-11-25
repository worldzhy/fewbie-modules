import * as React from "react";

/**
 * Minimal error-state double: keeps the retry affordance a module wires up.
 */
export function ErrorState({
  title,
  description,
  retryLabel,
  onRetry,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  retryLabel?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div role="alert" className={className}>
      <div>{title}</div>
      {description ? <div>{description}</div> : null}
      {onRetry ? (
        <button type="button" onClick={onRetry}>
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
