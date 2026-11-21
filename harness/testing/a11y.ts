import axe from "axe-core";
import { expect } from "vitest";

/**
 * Assert the rendered container has no axe-core violations. Rules that need a
 * real layout engine (`color-contrast`) cannot run under jsdom, so they are
 * disabled rather than silently passing.
 */
export async function expectNoViolations(container: HTMLElement): Promise<void> {
  const results = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
  expect(results.violations).toEqual([]);
}
