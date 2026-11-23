import { describe, expect, it, vi } from "vitest";

import { expectNoViolations } from "@testing/a11y";
import { makeLabels } from "@testing/labels";
import { render, screen, userEvent, waitFor } from "@testing/render";
import { ProfileSettings } from "../src/features/profile-settings/profile-settings";
import type { ProfileSettingsLabels, ProfileSettingsValues } from "../src/features/profile-settings/types";

const PROFILE: ProfileSettingsValues = {
  name: "Ada Lovelace",
  firstName: "Ada",
  middleName: "",
  lastName: "Lovelace",
  email: "ada@example.com",
};

function setup(onSave = vi.fn().mockResolvedValue(undefined)) {
  const labels = makeLabels<ProfileSettingsLabels>();
  const view = render(<ProfileSettings labels={labels} profile={PROFILE} onSave={onSave} />);
  return { view, onSave, user: userEvent.setup() };
}

describe("profile-settings conformance", () => {
  it("renders the profile values supplied by the host", () => {
    setup();
    expect(screen.getByText("label:personalInfo")).toBeInTheDocument();
    expect(screen.getByLabelText("label:firstName")).toHaveValue("Ada");
    expect(screen.getByLabelText("label:displayName")).toHaveValue("Ada Lovelace");
    expect(screen.getByText(/ada@example\.com/)).toBeInTheDocument();
  });

  it("saves the edited values through the port", async () => {
    const { onSave, user } = setup();
    await user.clear(screen.getByLabelText("label:displayName"));
    await user.type(screen.getByLabelText("label:displayName"), "Ada L.");
    await user.click(screen.getByRole("button", { name: "label:saveChanges" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ ...PROFILE, name: "Ada L." }));
  });

  it("shows the error label when saving fails", async () => {
    const { user } = setup(vi.fn().mockRejectedValue(new Error("boom")));
    await user.click(screen.getByRole("button", { name: "label:saveChanges" }));
    expect(await screen.findByText("label:saveFailed")).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { view } = setup();
    await expectNoViolations(view.container);
  });
});
