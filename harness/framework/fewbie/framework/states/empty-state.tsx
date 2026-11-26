import * as React from "react";

/**
 * Minimal empty-state double: title, description and optional action slots.
 */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div>{title}</div>
      {description ? <div>{description}</div> : null}
      {action ? <div>{action}</div> : null}
    </div>
  );
}
