import type { ReactNode } from "react";

/** Compile-time stand-in for the shadcn `tooltip` primitive. */
export function Tooltip({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

export function TooltipTrigger({ children }: { asChild?: boolean; children?: ReactNode }) {
  return <>{children}</>;
}

export function TooltipContent({ children, ...props }: { children?: ReactNode; side?: string; className?: string }) {
  return <span {...props}>{children}</span>;
}
