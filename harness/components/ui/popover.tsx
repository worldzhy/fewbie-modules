import type { ReactNode } from "react";

/** Compile-time stand-in for the shadcn `popover` primitive. */
export function Popover({
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
}) {
  return <>{children}</>;
}

export function PopoverTrigger({ children }: { asChild?: boolean; children?: ReactNode }) {
  return <>{children}</>;
}

export function PopoverContent({ children, ...props }: { children?: ReactNode; align?: string; className?: string }) {
  return <div {...props}>{children}</div>;
}
