import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Conformance harness for the registry items.
 *
 * `@/components/ui/*` resolves to `harness/components/ui/*` test doubles, so an
 * item is exercised against the fewbie framework surface without pulling
 * Tailwind, Radix or the host design tokens into this repository.
 */
export default defineConfig({
  resolve: {
    alias: {
      // Item-provided lib modules resolve to the items themselves; everything
      // else under `@/` is the framework surface the harness stubs.
      "@/lib/auth": fileURLToPath(new URL("./packages/modules/auth/src/lib/auth.ts", import.meta.url)),
      "@/lib/query-client": fileURLToPath(
        new URL("./packages/modules/query-client/src/lib/query-client.ts", import.meta.url),
      ),
      "next/navigation": fileURLToPath(new URL("./harness/next-navigation.ts", import.meta.url)),
      "next/link": fileURLToPath(new URL("./harness/next-link.tsx", import.meta.url)),
      "@": fileURLToPath(new URL("./harness", import.meta.url)),
    },
  },
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./harness/setup.ts"],
    include: ["packages/modules/*/test/**/*.test.tsx", "test/**/*.test.ts"],
    css: false,
  },
});
