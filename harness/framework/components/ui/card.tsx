import * as React from "react";

type DivProps = React.HTMLAttributes<HTMLDivElement>;

export function Card(props: DivProps) {
  return <div {...props} />;
}

export function CardHeader(props: DivProps) {
  return <div {...props} />;
}

export function CardTitle({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 {...props}>{children}</h3>;
}

export function CardDescription(props: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p {...props} />;
}

export function CardContent(props: DivProps) {
  return <div {...props} />;
}

export function CardFooter(props: DivProps) {
  return <div {...props} />;
}
