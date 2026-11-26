/**
 * Labels double: unoverridden keys resolve to `label:<key>`, so a test can
 * assert the module requested a label without listing the whole interface.
 * Function-valued labels use explicit overrides. `scripts/check-contract.mjs`
 * proves the interface and the item contract agree.
 */
export function makeLabels<T extends object>(overrides: Partial<T> = {}): T {
  return new Proxy(overrides as T, {
    get: (target, key) => {
      if (key in target) return Reflect.get(target, key);
      return typeof key === "string" && key !== "toString" && key !== "then" ? `label:${key}` : undefined;
    },
    has: () => true,
  });
}
