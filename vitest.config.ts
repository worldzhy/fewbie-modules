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
      "@": fileURLToPath(new URL("./harness", import.meta.url)),
    },
  },
  oxc: { jsx: "automatic" },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./harness/setup.ts"],
    include: ["*/test/**/*.test.tsx"],
    css: false,
  },
});
