import * as React from "react";

export function PageShellActions({ actions, children }: { actions: React.ReactNode; children: React.ReactNode }) {
  void actions;
  return <>{children}</>;
}

interface PageShellProps {
  width?: "default" | "wide" | "full";
  inset?: "platform" | "none";
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  headingLevel?: 1 | 2 | 3;
  headerClassName?: string;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Minimal page-shell double: keeps the header slots so a module's page composes
 * against the real contract without pulling the host layout into the harness.
 */
export default function PageShell({ title, subtitle, actions, className, children }: PageShellProps) {
  return (
    <section className={className}>
      {title ? (
        <header>
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
          {actions ? <div>{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}
