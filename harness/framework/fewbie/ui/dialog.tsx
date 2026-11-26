import * as React from "react";

/**
 * Dialog double: Radix renders through a portal and manages focus, neither of
 * which the item's contract may depend on. The double keeps the `open` contract
 * and the dialog role so a module that shows detail content stays assertable.
 */

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

export function Dialog({ open = true, children }: DialogProps) {
  if (!open) return null;
  return <>{children}</>;
}

export function DialogTrigger({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...props}>
      {children}
    </button>
  );
}

export function DialogClose({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...props}>
      {children}
    </button>
  );
}

export function DialogContent({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div role="dialog" {...props}>
      {children}
    </div>
  );
}

export function DialogHeader({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props}>{children}</div>;
}

export function DialogFooter({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props}>{children}</div>;
}

export function DialogTitle({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 {...props}>{children}</h2>;
}

export function DialogDescription({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p {...props}>{children}</p>;
}
