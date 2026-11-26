/**
 * Route rule and resolver for the copilot host-context.
 *
 * A rule maps a pathname to a canonical copilot route label. Each host
 * supplies its own rule table (the labels are host business vocabulary —
 * "projects", "tasks", "crewmates" vary by host), but all hosts must resolve
 * routes through `resolveCopilotRoute` so the "unknown route returns
 * undefined" semantics stay consistent. The backend treats an undefined
 * route as "General page": only skills that declared General-page eligibility
 * enter the catalog, and recommended prompts fall back to the generic set.
 */

export type CopilotRouteRule =
  /** Concise form — a static pathname prefix. Matches with `startsWith`. */
  | { prefix: string; route: string }
  /** Flexible form — any pathname predicate. Use for RegExp checks, segment
   *  comparisons, or dynamic-slot normalization that `startsWith` cannot
   *  express (e.g. UUID segments collapsing to `[projectId]`). */
  | { match: (pathname: string) => boolean; route: string };

/**
 * Resolve a Next.js pathname to its canonical copilot route label.
 * Iterates the rule table in order (first match wins) and returns the
 * rule's route; returns undefined when no rule matches.
 */
export function resolveCopilotRoute(pathname: string, rules: readonly CopilotRouteRule[]): string | undefined {
  for (const rule of rules) {
    const matches = "prefix" in rule ? pathname.startsWith(rule.prefix) : rule.match(pathname);
    if (matches) return rule.route;
  }
  return undefined;
}
