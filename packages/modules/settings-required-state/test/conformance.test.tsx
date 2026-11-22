import { describe, expect, it, vi } from "vitest";

import { expectNoViolations } from "@testing/a11y";
import { makeLabels } from "@testing/labels";
import { render, screen, userEvent } from "@testing/render";

import { SettingsRequiredState } from "../src/features/settings-required-state/settings-required-state";
import type { SettingsRequiredStateLabels } from "../src/features/settings-required-state/types";

const labels = makeLabels<SettingsRequiredStateLabels>();

describe("settings-required-state conformance", () => {
  it("renders the host title, description and action label", () => {
    render(
      <SettingsRequiredState
        labels={labels}
        title="AWS credential required"
        description={<span>Configure an access key to continue.</span>}
        settingsHref="/settings/aws"
        onOpenSettings={vi.fn()}
      />,
    );
    expect(screen.getByRole("heading", { name: "AWS credential required" })).toBeInTheDocument();
    expect(screen.getByText("Configure an access key to continue.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "label:actionLabel" })).toBeInTheDocument();
  });

  it("navigates through the host callback with the settings href", async () => {
    const onOpenSettings = vi.fn();
    render(
      <SettingsRequiredState
        labels={labels}
        title="Missing"
        settingsHref="/settings/aws"
        onOpenSettings={onOpenSettings}
      />,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: "label:actionLabel" }));
    expect(onOpenSettings).toHaveBeenCalledWith("/settings/aws");
  });

  it("prefers the in-place action over the settings link", async () => {
    const onAction = vi.fn();
    const onOpenSettings = vi.fn();
    render(
      <SettingsRequiredState
        labels={labels}
        title="Missing"
        settingsHref="/settings/aws"
        onOpenSettings={onOpenSettings}
        onAction={onAction}
      />,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: "label:actionLabel" }));
    expect(onAction).toHaveBeenCalledOnce();
    expect(onOpenSettings).not.toHaveBeenCalled();
  });

  it("disables the action and shows a spinner while pending", () => {
    render(<SettingsRequiredState labels={labels} title="Missing" onAction={vi.fn()} actionPending />);
    expect(screen.getByRole("button", { name: "label:actionLabel" })).toBeDisabled();
    expect(document.querySelector(".lucide-loader-circle")).not.toBeNull();
  });

  it("renders no action when the host supplies neither callback", () => {
    render(<SettingsRequiredState labels={labels} title="Missing" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <SettingsRequiredState labels={labels} title="Missing" settingsHref="/settings/aws" onOpenSettings={vi.fn()} />,
    );
    await expectNoViolations(container);
  });
});
