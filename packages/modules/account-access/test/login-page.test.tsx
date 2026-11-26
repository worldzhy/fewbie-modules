import { describe, expect, it, vi } from "vitest";

import { expectNoViolations } from "@testing/a11y";
import { deferred } from "@testing/deferred";
import { makeLabels } from "@testing/labels";
import { render, screen, userEvent, waitFor } from "@testing/render";
import { LoginPage } from "../features/login-page/login-page";
import { LoginShell } from "../features/login-page/login-shell";
import type { LoginLabels, LoginPort } from "../features/login-page/types";

function setup(
  overrides: Partial<LoginPort> = {},
  props: {
    onSignedIn?: () => void;
    onError?: (message: string) => void;
    onForgotPassword?: (email: string) => void;
  } = {},
) {
  const port: LoginPort = {
    signIn: vi.fn().mockResolvedValue({ ok: true }),
    sendVerificationCode: vi.fn().mockResolvedValue({ ok: true }),
    ...overrides,
  };
  const labels = makeLabels<LoginLabels>();
  const view = render(
    <LoginPage
      labels={labels}
      port={port}
      onSignedIn={props.onSignedIn}
      onError={props.onError}
      onForgotPassword={props.onForgotPassword}
    />,
  );
  return { port, labels, view, user: userEvent.setup() };
}

async function fillPasswordForm(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.type(screen.getByLabelText("label:email"), "user@example.com");
  await user.type(screen.getByLabelText("label:password"), "correct-horse");
}

describe("login-page conformance", () => {
  it("renders the idle state from host labels", () => {
    setup();
    expect(screen.getByText("label:title")).toBeInTheDocument();
    expect(screen.getByText("label:description")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "label:submit" })).toBeEnabled();
  });

  it("reports validation errors before calling the port", async () => {
    const { port, user } = setup();
    await user.click(screen.getByRole("button", { name: "label:submit" }));
    expect(screen.getByText("label:emailRequired")).toBeInTheDocument();
    expect(screen.getByText("label:passwordRequired")).toBeInTheDocument();
    expect(port.signIn).not.toHaveBeenCalled();
  });

  it("disables the submit button while the port is pending", async () => {
    const pending = deferred<{ ok: boolean }>();
    const { user } = setup({ signIn: vi.fn().mockReturnValue(pending.promise) });
    await fillPasswordForm(user);
    const submit = screen.getByRole("button", { name: "label:submit" });
    await user.click(submit);
    await waitFor(() => expect(submit).toBeDisabled());
    pending.resolve({ ok: true });
    await waitFor(() => expect(submit).toBeEnabled());
  });

  it("surfaces rejected credentials as an error state", async () => {
    const { user } = setup({ signIn: vi.fn().mockResolvedValue({ ok: false, invalidCredentials: true }) });
    await fillPasswordForm(user);
    await user.click(screen.getByRole("button", { name: "label:submit" }));
    expect(await screen.findByText("label:invalidCredentials")).toBeInTheDocument();
  });

  it("calls onSignedIn on a successful sign-in", async () => {
    const onSignedIn = vi.fn();
    const { port, user } = setup({}, { onSignedIn });
    await fillPasswordForm(user);
    await user.click(screen.getByRole("button", { name: "label:submit" }));
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledOnce());
    expect(port.signIn).toHaveBeenCalledWith({ account: "user@example.com", password: "correct-horse" });
  });

  it("navigates to password recovery with the typed email", async () => {
    const onForgotPassword = vi.fn();
    const { user } = setup({}, { onForgotPassword });
    await user.type(screen.getByLabelText("label:email"), "user@example.com");
    await user.click(screen.getByRole("button", { name: "label:forgotPassword" }));
    expect(onForgotPassword).toHaveBeenCalledWith("user@example.com");
  });

  it("hands failures to the host when onError is provided", async () => {
    const onError = vi.fn();
    const { user } = setup({ signIn: vi.fn().mockResolvedValue({ ok: false, invalidCredentials: true }) }, { onError });
    await fillPasswordForm(user);
    await user.click(screen.getByRole("button", { name: "label:submit" }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith("label:invalidCredentials"));
    expect(screen.queryByText("label:invalidCredentials")).not.toBeInTheDocument();
  });

  it("has no accessibility violations in the idle state", async () => {
    const { view } = setup();
    await expectNoViolations(view.container);
  });
});

describe("login-shell palette", () => {
  it("renders the night palette by default", () => {
    const { container } = render(<LoginShell>sign-in</LoginShell>);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.getPropertyValue("--login-backdrop")).toBe("#070c17");
    expect(root.style.getPropertyValue("--primary")).toBe("#3b82f6");
  });

  it("overrides only the keys a host passes", () => {
    const { container } = render(<LoginShell palette={{ "--primary": "#ff0000" }}>sign-in</LoginShell>);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.getPropertyValue("--primary")).toBe("#ff0000");
    expect(root.style.getPropertyValue("--card")).toBe("#151b24");
  });
});
