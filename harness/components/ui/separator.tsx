/** Compile-time stand-in for the shadcn `separator` primitive. */
export function Separator({ className }: { className?: string; orientation?: string }) {
  return <hr className={className} />;
}
