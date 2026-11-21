/**
 * Labels double: every key the module reads resolves to `label:<key>`, so a
 * test can assert the module requested a label without listing the whole
 * interface. `scripts/check-contract.mjs` is what proves the interface and the
 * item contract agree.
 */
export function makeLabels<T extends object>(): T {
  return new Proxy({} as T, {
    get: (_target, key) =>
      typeof key === "string" && key !== "toString" && key !== "then" ? `label:${key}` : undefined,
    has: () => true,
  });
}
