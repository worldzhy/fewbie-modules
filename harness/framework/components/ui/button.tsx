import * as React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: string;
  size?: string;
  asChild?: boolean;
}

/**
 * Minimal button double: keeps type/disabled/onClick semantics and the
 * `asChild` contract, drops the variant classes the harness does not style.
 */
export function Button({ variant: _variant, size: _size, asChild, ...props }: ButtonProps) {
  if (asChild && React.isValidElement(props.children)) {
    const { children, ...rest } = props;
    return React.cloneElement(children as React.ReactElement<Record<string, unknown>>, rest);
  }
  return <button {...props} />;
}
