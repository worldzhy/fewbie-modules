import type { TextareaHTMLAttributes } from "react";

/** Compile-time stand-in for the shadcn `textarea` primitive. */
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} />;
}
