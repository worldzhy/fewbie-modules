import { readFile } from "node:fs/promises";
import path from "node:path";

import { isStrongPassword } from "../packages/modules/password-checklist/src/components/password-checklist";

/**
 * `password-checklist` and `forgot-password` each carry the password policy.
 *
 * The registry admits copy-assemblable items only, so sharing one implementation
 * across two items would force a cross-item import and break that rule. The
 * duplication is therefore accepted; this test is the guard that keeps the two
 * copies from drifting apart (R82-15).
 */

const root = path.resolve(__dirname, "..");

async function forgotPasswordPattern(): Promise<RegExp> {
  const source = await readFile(
    path.join(root, "packages/modules/forgot-password/src/modules/forgot-password/forgot-password.tsx"),
    "utf8",
  );
  const match = source.match(/const PASSWORD_PATTERN = \/(.+)\/;/);
  expect(match).not.toBeNull();
  return new RegExp(match![1]);
}

test("forgot-password enforces the same policy as password-checklist", async () => {
  const pattern = await forgotPasswordPattern();
  const samples = [
    "Abcdef1!",
    "abcdef1!",
    "ABCDEF1!",
    "Abcdefg!",
    "Abcdefg1",
    "Abcdef1",
    "A1!aaaaa",
    "Abcdefg1!",
    "Ab 1!efg",
    "Aa1!",
  ];
  for (const sample of samples) {
    expect({ sample, strong: pattern.test(sample) }).toEqual({ sample, strong: isStrongPassword(sample) });
  }
});
