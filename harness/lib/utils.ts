/** Compile-time stand-in for the framework's `cn` helper (`@/lib/utils`). */
export function cn(...values: unknown[]): string {
  return values.filter(Boolean).join(" ");
}
