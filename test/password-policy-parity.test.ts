import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  checkPasswordPolicy,
  isStrongPassword,
} from "../packages/modules/password-checklist/src/items/password-checklist/components/password-checklist/password-checklist";

/**
 * Truth table for the backend policy: `validator.isStrongPassword` with its
 * default options (R84-01). Expected values come from running the installed
 * validator against the same samples; the frontend predicate must agree on
 * every row, including the Symbol set boundaries.
 */
const PASSWORD_POLICY_TRUTH_TABLE: ReadonlyArray<{ password: string; strong: boolean; why: string }> = [
  { password: "Abcdefg1!", strong: true, why: "ASCII symbol" },
  { password: "Abcdefg1_", strong: true, why: "underscore is in validator's symbol set" },
  { password: "Abcdefg1 ", strong: true, why: "space is in validator's symbol set" },
  { password: "Abcdefg1£", strong: true, why: "pound sign is in validator's symbol set" },
  { password: "Abcdefg1€", strong: false, why: "euro sign is outside validator's symbol set" },
  { password: "Abcdefg1§", strong: false, why: "section sign is outside validator's symbol set" },
  { password: "Abcdefg1", strong: false, why: "no symbol" },
  { password: "abcdefg1!", strong: false, why: "no uppercase" },
  { password: "ABCDEFG1!", strong: false, why: "no lowercase" },
  { password: "Abcdefgh!", strong: false, why: "no digit" },
  { password: "Abcdefg1💥", strong: false, why: "astral code points are never symbols" },
  { password: "Abcdefg1\n", strong: false, why: "newline is not a symbol" },
  { password: "Abcdef!", strong: false, why: "under 8 UTF-16 code units" },
  { password: "Abcd1!ef", strong: true, why: "exactly 8 UTF-16 code units" },
];

test.each(PASSWORD_POLICY_TRUTH_TABLE)("isStrongPassword agrees with the backend: $why", ({ password, strong }) => {
  expect(isStrongPassword(password)).toBe(strong);
});

test("checkPasswordPolicy reports each rule separately", () => {
  expect(checkPasswordPolicy("Abcdefg1_")).toEqual({
    length: true,
    lowercase: true,
    uppercase: true,
    number: true,
    symbol: true,
  });
  expect(checkPasswordPolicy("Abcdefg1€").symbol).toBe(false);
  expect(checkPasswordPolicy("Abcdef").length).toBe(false);
});

test("forgot-password reuses the shared predicate instead of a local mirror", async () => {
  const source = await readFile(
    path.resolve(
      __dirname,
      "../packages/modules/account-access/src/items/account-access/features/forgot-password/forgot-password.tsx",
    ),
    "utf8",
  );
  expect(source).toContain('from "@/items/password-checklist/components/password-checklist"');
  expect(source).not.toContain("PASSWORD_PATTERN");
  expect(source).not.toContain("[^\\w\\s]");
});
