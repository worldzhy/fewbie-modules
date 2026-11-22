import { describe, expect, it } from "vitest";

import { expectNoViolations } from "@testing/a11y";
import { makeLabels } from "@testing/labels";
import { render, screen, within } from "@testing/render";

import { PasswordChecklist } from "../src/features/password-checklist/password-checklist";
import type { PasswordChecklistLabels } from "../src/features/password-checklist/types";

const labels = makeLabels<PasswordChecklistLabels>();

describe("password-checklist conformance", () => {
  it("renders nothing until the host supplies a password", () => {
    const { container } = render(<PasswordChecklist labels={labels} password="" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists every rule under the host-supplied accessible name", () => {
    render(<PasswordChecklist labels={labels} password="abc" />);
    const list = screen.getByRole("list", { name: "label:requirements" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(5);
    for (const key of ["ruleLength", "ruleLowercase", "ruleUppercase", "ruleNumber", "ruleSymbol"]) {
      expect(screen.getByText(`label:${key}`)).toBeInTheDocument();
    }
  });

  it("marks exactly the satisfied rules", () => {
    const { container } = render(<PasswordChecklist labels={labels} password="abcdefg1" />);
    // length, lowercase and number pass; uppercase and symbol do not.
    expect(container.querySelectorAll(".lucide-check")).toHaveLength(3);
    expect(container.querySelectorAll(".lucide-x")).toHaveLength(2);
  });

  it("marks every rule when the password satisfies the backend policy", () => {
    const { container } = render(<PasswordChecklist labels={labels} password="Abcdefg1!" />);
    expect(container.querySelectorAll(".lucide-check")).toHaveLength(5);
    expect(container.querySelectorAll(".lucide-x")).toHaveLength(0);
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<PasswordChecklist labels={labels} password="Abcdefg1!" />);
    await expectNoViolations(container);
  });
});
