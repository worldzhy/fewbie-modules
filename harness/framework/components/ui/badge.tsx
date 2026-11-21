import * as React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: string;
}

export function Badge({ variant: _variant, ...props }: BadgeProps) {
  return <span {...props} />;
}
