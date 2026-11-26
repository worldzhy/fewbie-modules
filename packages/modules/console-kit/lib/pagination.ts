/**
 * Canonicalize page index: floor to a non-negative integer.
 *
 * List-page ports all treat an absent or negative page as page 0 and refuse
 * negative indices downstream, so this clamp sits between the host's query
 * object and the port's DB call. Kept here rather than in each consumer.
 */
export function clampPage(queryPage?: number): number {
  return Math.max(0, Math.trunc(queryPage ?? 0));
}
