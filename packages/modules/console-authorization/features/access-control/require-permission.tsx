"use client";

import type { ReactNode } from "react";

import { LoadingState } from "@/fewbie/framework/states/loading-state";

import { useConsoleAccess } from "./access-provider";
import { useCanSee } from "./use-can-see";

/**
 * Route-level gate driven by permission groups, never by role names.
 *
 * While the account loads it renders a spinner instead of the denied panel, so
 * a slow `/account/me` cannot flash "access denied" at an authorized user. The
 * backend still enforces every request by permission atom; this only decides
 * what the shell renders.
 */
export function RequirePermission({
  routePath,
  title,
  description,
  children,
}: {
  routePath: string;
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  const { pending, labels } = useConsoleAccess();
  const canSee = useCanSee(routePath);

  if (pending) {
    return <LoadingState label={labels.loadingLabel} className="py-16" />;
  }

  if (!canSee) {
    return (
      <div className="rounded-lg border bg-card p-12 text-center">
        <h2 className="mb-2 text-base font-semibold text-foreground">{title ?? labels.accessDeniedTitle}</h2>
        <p className="text-sm text-muted-foreground">{description ?? labels.accessDeniedDescription}</p>
      </div>
    );
  }

  return <>{children}</>;
}
