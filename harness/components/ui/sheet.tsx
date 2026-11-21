import type { HTMLAttributes, ReactNode } from "react";

/** Compile-time stand-in for the shadcn `sheet` primitive. */
export function Sheet({ children }: { open?: boolean; onOpenChange?: (open: boolean) => void; children?: ReactNode }) {
  return <>{children}</>;
}

export function SheetContent({ children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props}>{children}</div>;
}

export function SheetHeader({ children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props}>{children}</div>;
}

export function SheetTitle({ children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 {...props}>{children}</h2>;
}

export function SheetDescription({ children, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <div {...props}>{children}</div>;
}

export function SheetFooter({ children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props}>{children}</div>;
}
