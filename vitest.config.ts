import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Conformance harness for the registry modules.
 *
 * `@` resolves to `harness/framework`, the double of the host surface, so an item
 * is exercised against the fewbie framework without pulling Tailwind, Radix or
 * the host design tokens into this repository. `@testing` is this repository's
 * own test toolkit and never looks like a framework module to an item.
 */
export default defineConfig({
  resolve: {
    alias: {
      // Item-provided lib modules resolve to the modules themselves; everything
      // else under `@/` is the framework surface the harness stubs.
      "@/fewbie/modules/account-access/lib/auth": fileURLToPath(
        new URL("./packages/modules/account-access/lib/auth.ts", import.meta.url),
      ),
      "@/fewbie/modules/query-client/lib/query-client": fileURLToPath(
        new URL("./packages/modules/query-client/lib/query-client.ts", import.meta.url),
      ),
      "@/fewbie/modules/sse-stream/lib/sse-stream": fileURLToPath(
        new URL("./packages/modules/sse-stream/lib/sse-stream.ts", import.meta.url),
      ),
      // Cross-item imports go through the item's public entry (forgot-password
      // reuses password-checklist's predicate).
      "@/fewbie/modules/password-checklist/components/password-checklist": fileURLToPath(
        new URL("./packages/modules/password-checklist/components/password-checklist/index.ts", import.meta.url),
      ),
      "@/fewbie/modules/notification-center/components/notification-presentation": fileURLToPath(
        new URL(
          "./packages/modules/notification-center/components/notification-presentation/index.ts",
          import.meta.url,
        ),
      ),
      "@testing": fileURLToPath(new URL("./harness/testing", import.meta.url)),
      "@": fileURLToPath(new URL("./harness/framework", import.meta.url)),
    },
  },
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./harness/testing/setup.ts"],
    include: ["packages/modules/*/test/**/*.test.{ts,tsx}", "test/**/*.test.ts"],
    css: false,
  },
});
