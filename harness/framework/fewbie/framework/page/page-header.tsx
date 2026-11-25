import * as React from "react";

/**
 * Minimal page-header double: the heading slots a module page passes through.
 */
export default function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  headingLevel?: 1 | 2 | 3;
  className?: string;
}) {
  return (
    <header className={className}>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
      {actions ? <div>{actions}</div> : null}
    </header>
  );
}
