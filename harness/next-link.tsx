import type { AnchorHTMLAttributes, ReactNode } from "react";

/** Compile-time stand-in for the app-router `next/link` component. */
export default function Link({
  href,
  children,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) {
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}
