/**
 * Route rule and resolver for the copilot host-context.
 *
 * A route rule maps a Next.js pathname prefix to a canonical copilot route
 * label. Each host supplies its own rule table (the labels are host business
 * vocabulary — "projects", "tasks", "crewmates" vary by host), but both
 * hosts must resolve routes through this shared pure function so the
 * "unknown route returns undefined" semantics stay consistent.
 */

/** One host-declared route rule: pathname prefix → canonical copilot route. */
export interface CopilotRouteRule {
  /** Next.js pathname prefix, e.g. "/projects/[projectId]". */
  prefix: string;
  /** Copilot route label, must be in the host's skill whitelist. */
  route: string;
}

/**
 * Resolve a Next.js pathname to its canonical copilot route label.
 * Iterates the rule table in order (first match wins) and returns the
 * rule's route; returns undefined when no rule matches.
 */
export function resolveCopilotRoute(pathname: string, rules: readonly CopilotRouteRule[]): string | undefined {
  for (const rule of rules) {
    if (pathname.startsWith(rule.prefix)) {
      return rule.route;
    }
  }
  return undefined;
}
