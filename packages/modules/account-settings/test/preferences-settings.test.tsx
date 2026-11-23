import { describe, expect, it, vi } from "vitest";

import { expectNoViolations } from "@testing/a11y";
import { makeLabels } from "@testing/labels";
import { render, screen, userEvent, waitFor } from "@testing/render";
import { PreferencesSettings } from "../src/fewbie/modules/account-settings/features/preferences-settings/preferences-settings";
import type {
  PreferencesSettingsLabels,
  PreferencesSettingsPort,
  PreferencesSettingsValues,
} from "../src/fewbie/modules/account-settings/features/preferences-settings/types";

const VALUES: PreferencesSettingsValues = { language: "en", theme: "LIGHT", timezone: "UTC" };
const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "zh", label: "Chinese" },
];

function setup(overrides: Partial<PreferencesSettingsPort> = {}) {
  const port: PreferencesSettingsPort = {
    saveLanguage: vi.fn().mockResolvedValue(undefined),
    saveTheme: vi.fn().mockResolvedValue(undefined),
    saveTimezone: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  const labels = makeLabels<PreferencesSettingsLabels>();
  const view = render(<PreferencesSettings labels={labels} values={VALUES} languages={LANGUAGES} port={port} />);
  return { port, view, user: userEvent.setup() };
}

describe("preferences-settings conformance", () => {
  it("renders the three preference cards and the current values", () => {
    setup();
    expect(screen.getByRole("heading", { name: "label:languageTitle" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "label:themeTitle" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "label:timezoneTitle" })).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveValue("en");
    expect(screen.getByRole("button", { name: "label:themeLight" })).toHaveAttribute("aria-pressed", "true");
  });

  it("saves a language change through the port", async () => {
    const { port, user } = setup();
    await user.selectOptions(screen.getByRole("combobox"), "zh");
    await waitFor(() => expect(port.saveLanguage).toHaveBeenCalledWith("zh"));
  });

  it("saves a theme change through the port", async () => {
    const { port, user } = setup();
    await user.click(screen.getByRole("button", { name: "label:themeDark" }));
    await waitFor(() => expect(port.saveTheme).toHaveBeenCalledWith("DARK"));
  });

  it("shows the error label when a write fails", async () => {
    const { user } = setup({ saveTimezone: vi.fn().mockRejectedValue(new Error("boom")) });
    await user.click(screen.getByRole("button", { name: "label:saveTimezone" }));
    expect(await screen.findByText("label:updateFailed")).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { view } = setup();
    await expectNoViolations(view.container);
  });
});
