import { describe, expect, it, vi } from "vitest";

import { expectNoViolations } from "@testing/a11y";
import { makeLabels } from "@testing/labels";
import { render, screen, userEvent, waitFor } from "@testing/render";
import { ForgotPasswordPage } from "../src/features/forgot-password/forgot-password";
import type { ForgotPasswordLabels, ForgotPasswordPort } from "../src/features/forgot-password/types";

function setup(overrides: Partial<ForgotPasswordPort> = {}, props: { onReset?: () => void } = {}) {
  const port: ForgotPasswordPort = {
    sendResetCode: vi.fn().mockResolvedValue({}),
    resetPassword: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  const labels = makeLabels<ForgotPasswordLabels>();
  const view = render(<ForgotPasswordPage labels={labels} port={port} onReset={props.onReset} />);
  return { port, view, user: userEvent.setup() };
}

describe("forgot-password conformance", () => {
  it("renders the request form from host labels", () => {
    setup();
    expect(screen.getByText("label:forgotTitle")).toBeInTheDocument();
    expect(screen.getByLabelText("label:emailLabel")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "label:forgotGetCode" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "label:resetButton" })).toBeInTheDocument();
  });

  it("blocks an empty submission with validation errors", async () => {
    const { port, user } = setup();
    await user.click(screen.getByRole("button", { name: "label:resetButton" }));
    expect(screen.getByText("label:forgotEmailRequired")).toBeInTheDocument();
    expect(screen.getByText("label:forgotCodeRequired")).toBeInTheDocument();
    expect(screen.getByText("label:forgotPasswordRequired")).toBeInTheDocument();
    expect(port.resetPassword).not.toHaveBeenCalled();
  });

  it("requests a code through the port and starts the cooldown", async () => {
    const { port, user } = setup();
    await user.type(screen.getByLabelText("label:emailLabel"), "user@example.com");
    await user.click(screen.getByRole("button", { name: "label:forgotGetCode" }));
    await waitFor(() => expect(port.sendResetCode).toHaveBeenCalledWith("user@example.com"));
    expect(await screen.findByText("60s")).toBeInTheDocument();
  });

  it("shows the live password checklist once typing starts", async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText("label:newPasswordLabel"), "abc");
    expect(screen.getByText("label:passwordRuleLength")).toBeInTheDocument();
    expect(screen.getByText("label:passwordRuleSymbol")).toBeInTheDocument();
  });

  it("reports a failed reset", async () => {
    const { user } = setup({ resetPassword: vi.fn().mockRejectedValue(new Error("boom")) });
    await user.type(screen.getByLabelText("label:emailLabel"), "user@example.com");
    await user.type(screen.getByLabelText("label:codeLabel"), "123456");
    await user.type(screen.getByLabelText("label:newPasswordLabel"), "Abcdef1!");
    await user.click(screen.getByRole("button", { name: "label:resetButton" }));
    expect(await screen.findByText("label:resetFailed")).toBeInTheDocument();
  });

  it("calls onReset after a successful reset", async () => {
    const onReset = vi.fn();
    const { port, user } = setup({}, { onReset });
    await user.type(screen.getByLabelText("label:emailLabel"), "user@example.com");
    await user.type(screen.getByLabelText("label:codeLabel"), "123456");
    await user.type(screen.getByLabelText("label:newPasswordLabel"), "Abcdef1!");
    await user.click(screen.getByRole("button", { name: "label:resetButton" }));
    await waitFor(() => expect(onReset).toHaveBeenCalledOnce());
    expect(port.resetPassword).toHaveBeenCalledWith({
      email: "user@example.com",
      verificationCode: "123456",
      newPassword: "Abcdef1!",
    });
  });

  it("has no accessibility violations", async () => {
    const { view } = setup();
    await expectNoViolations(view.container);
  });
});
