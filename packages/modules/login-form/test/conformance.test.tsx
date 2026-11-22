import { beforeEach, describe, expect, it, vi } from "vitest";

import { expectNoViolations } from "@testing/a11y";
import { deferred } from "@testing/deferred";
import { makeLabels } from "@testing/labels";
import { render, screen, userEvent, waitFor } from "@testing/render";

import { LoginForm } from "../src/features/login-form/login-form";
import type { LoginFormLabels } from "../src/features/login-form/types";

const { loginMock } = vi.hoisted(() => ({ loginMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ login: loginMock }));

const labels = makeLabels<LoginFormLabels>();

function setup(overrides: { redirectPath?: string; formatError?: (error: unknown) => string } = {}) {
  const onLoggedIn = vi.fn();
  const view = render(<LoginForm labels={labels} onLoggedIn={onLoggedIn} redirectPath="/dashboard" {...overrides} />);
  return { view, onLoggedIn, user: userEvent.setup() };
}

beforeEach(() => {
  loginMock.mockReset();
});

describe("login-form conformance", () => {
  it("renders every label the host supplies", () => {
    setup();
    expect(screen.getByText("label:title")).toBeInTheDocument();
    expect(screen.getByText("label:description")).toBeInTheDocument();
    expect(screen.getByLabelText("label:account")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("label:accountPlaceholder")).toBeInTheDocument();
    expect(screen.getByLabelText("label:password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "label:submit" })).toBeInTheDocument();
  });

  it("submits the credentials and hands navigation back to the host", async () => {
    loginMock.mockResolvedValue({ token: "t" });
    const { onLoggedIn, user } = setup();
    await user.type(screen.getByLabelText("label:account"), "ada");
    await user.type(screen.getByLabelText("label:password"), "secret");
    await user.click(screen.getByRole("button", { name: "label:submit" }));
    await waitFor(() => expect(onLoggedIn).toHaveBeenCalledWith("/dashboard"));
    expect(loginMock).toHaveBeenCalledWith({ account: "ada", password: "secret" });
  });

  it("shows the loading state while signing in", async () => {
    const pending = deferred<{ token: string }>();
    loginMock.mockReturnValue(pending.promise);
    const { user } = setup();
    await user.type(screen.getByLabelText("label:account"), "ada");
    await user.type(screen.getByLabelText("label:password"), "secret");
    await user.click(screen.getByRole("button", { name: "label:submit" }));
    await waitFor(() => expect(screen.getByRole("button")).toBeDisabled());
    pending.resolve({ token: "t" });
    await waitFor(() => expect(screen.getByRole("button", { name: "label:submit" })).toBeEnabled());
  });

  it("falls back to the loginFailed label when no formatter is supplied", async () => {
    loginMock.mockRejectedValue(new Error("invalid credentials"));
    const { onLoggedIn, user } = setup();
    await user.type(screen.getByLabelText("label:account"), "ada");
    await user.type(screen.getByLabelText("label:password"), "wrong");
    await user.click(screen.getByRole("button", { name: "label:submit" }));
    expect(await screen.findByText("label:loginFailed")).toBeInTheDocument();
    expect(screen.queryByText(/invalid credentials/)).not.toBeInTheDocument();
    expect(onLoggedIn).not.toHaveBeenCalled();
  });

  it("routes failures through the host formatter when supplied", async () => {
    loginMock.mockRejectedValue(new Error("invalid credentials"));
    const formatError = vi.fn(() => "mapped error");
    const { user } = setup({ formatError });
    await user.type(screen.getByLabelText("label:account"), "ada");
    await user.type(screen.getByLabelText("label:password"), "wrong");
    await user.click(screen.getByRole("button", { name: "label:submit" }));
    expect(await screen.findByText("mapped error")).toBeInTheDocument();
    expect(formatError).toHaveBeenCalledWith(expect.any(Error));
  });

  it("has no accessibility violations", async () => {
    const { view } = setup();
    await expectNoViolations(view.container);
  });
});
