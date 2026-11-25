"use client";

import type { ReactNode } from "react";

import { LoadingState } from "@/fewbie/framework/states/loading-state";

import { hasRouteAccess } from "../../lib/route-access";
import { useConsoleAccess } from "./access-provider";

/**
 * Route-level gate driven by permission groups, never by role names.
 *
 * While the account loads it renders a spinner instead of the denied panel, so
 * a slow `/account/me` cannot flash "access denied" at an authorized user. The
 * backend still enforces every request by permission atom; this only decides
 * what the shell renders.
 *
 * `canSee` / `pending` override the provider so a host whose layout already
 * holds the current-user query (nw) can reuse this gate without nesting a
 * second provider. Hosts that do mount the provider pass neither.
 */
export function RequirePermission({
  routePath,
  title,
  description,
  canSee,
  pending,
  children,
}: {
  routePath: string;
  title?: string;
  description?: string;
  canSee?: boolean;
  pending?: boolean;
  children: ReactNode;
}) {
  const context = useConsoleAccess();
  const resolvedCanSee = canSee ?? hasRouteAccess(context.groups, routePath);
  const resolvedPending = pending ?? context.pending;

  if (resolvedPending) {
    return <LoadingState label={context.labels.loadingLabel} className="py-16" />;
  }

  if (!resolvedCanSee) {
    return (
      <div className="rounded-lg border bg-card p-12 text-center">
        <h2 className="mb-2 text-base font-semibold text-foreground">{title ?? context.labels.accessDeniedTitle}</h2>
        <p className="text-sm text-muted-foreground">{description ?? context.labels.accessDeniedDescription}</p>
      </div>
    );
  }

  return <>{children}</>;
}
