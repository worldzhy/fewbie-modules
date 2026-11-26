import * as React from "react";

// Options accepted by the imperative confirm() call; the harness only needs the
// fields a module passes through.
export interface ConfirmOptions {
  title?: React.ReactNode;
  description?: React.ReactNode;
  content?: React.ReactNode;
  confirmationText?: string;
  cancellationText?: string;
  hideCancelButton?: boolean;
  destructive?: boolean;
  disableConfirmButton?: boolean;
  disableCloseOnDismiss?: boolean;
  requireText?: { expected: string; label: React.ReactNode; placeholder?: string };
}

/**
 * Minimal confirm double: the provider is a pass-through, and `confirm()`
 * resolves so a module's post-confirm path stays exercisable without Radix.
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function useConfirm(): (options: ConfirmOptions) => Promise<void> {
  return React.useCallback(async (_options: ConfirmOptions) => {}, []);
}
