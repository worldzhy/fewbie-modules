import { describe, expect, it, vi } from "vitest";

import { expectNoViolations } from "@testing/a11y";
import { deferred } from "@testing/deferred";
import { makeLabels } from "@testing/labels";
import { render, screen, userEvent, waitFor } from "@testing/render";
import { SecuritySettings } from "../features/security-settings/security-settings";
import type {
  SecuritySession,
  SecuritySettingsLabels,
  SecuritySettingsPort,
} from "../features/security-settings/types";

const SESSIONS: SecuritySession[] = [
  {
    id: 1,
    browser: "Chrome",
    operatingSystem: "macOS",
    isCurrentSession: true,
    ipAddress: "127.0.0.1",
    city: "Shanghai",
    countryCode: "CN",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  { id: 2, browser: "Firefox", operatingSystem: "Linux", createdAt: "2026-01-02T00:00:00.000Z" },
];

function setup(overrides: Partial<SecuritySettingsPort> = {}, twoFactorEnabled = false) {
  const port: SecuritySettingsPort = {
    listSessions: vi.fn().mockResolvedValue({ records: SESSIONS }),
    revokeSession: vi.fn().mockResolvedValue(undefined),
    setupTwoFactor: vi.fn().mockResolvedValue({ qrCodeDataUrl: "data:image/png;base64,AAAA", secret: "SECRET" }),
    enableTwoFactor: vi.fn().mockResolvedValue(undefined),
    disableTwoFactor: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  const labels = makeLabels<SecuritySettingsLabels>();
  const onSessionsChanged = vi.fn();
  const onTwoFactorChanged = vi.fn();
  const view = render(
    <SecuritySettings
      labels={labels}
      twoFactorEnabled={twoFactorEnabled}
      port={port}
      onSessionsChanged={onSessionsChanged}
      onTwoFactorChanged={onTwoFactorChanged}
      formatDateTime={() => "2026-01-01"}
    />,
  );
  return { port, view, onSessionsChanged, onTwoFactorChanged, user: userEvent.setup() };
}

describe("security-settings conformance", () => {
  it("shows the loading state until sessions resolve", async () => {
    const pending = deferred<{ records: SecuritySession[] }>();
    setup({ listSessions: vi.fn().mockReturnValue(pending.promise) });
    expect(screen.getByText("label:loadingSessions")).toBeInTheDocument();
    pending.resolve({ records: SESSIONS });
    expect(await screen.findByText("Chrome · macOS")).toBeInTheDocument();
  });

  it("renders the empty state when the host has no sessions", async () => {
    setup({ listSessions: vi.fn().mockResolvedValue({ records: [] }) });
    expect(await screen.findByText("label:noSessions")).toBeInTheDocument();
  });

  it("renders the error state and retries through the port", async () => {
    const listSessions = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValue({ records: SESSIONS });
    const { user } = setup({ listSessions });
    expect(await screen.findByText("label:loadSessionsFailed")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "label:retry" }));
    expect(await screen.findByText("Chrome · macOS")).toBeInTheDocument();
    expect(listSessions).toHaveBeenCalledTimes(2);
  });

  it("revokes a non-current session and reports back to the host", async () => {
    const { port, onSessionsChanged, user } = setup();
    await screen.findByText("Chrome · macOS");
    await user.click(screen.getByRole("button", { name: "label:signOutSession" }));
    await waitFor(() => expect(port.revokeSession).toHaveBeenCalledWith(2));
    expect(onSessionsChanged).toHaveBeenCalled();
  });

  it("enrolls an authenticator app through the port", async () => {
    const { port, onTwoFactorChanged, user } = setup();
    await screen.findByText("Chrome · macOS");
    await user.click(screen.getByRole("button", { name: "label:setupWithApp" }));
    expect(await screen.findByAltText("label:qrAlt")).toBeInTheDocument();
    await user.type(screen.getByLabelText("label:enterCode"), "123456");
    await user.click(screen.getByRole("button", { name: "label:confirmEnable" }));
    await waitFor(() => expect(port.enableTwoFactor).toHaveBeenCalledWith("123456"));
    expect(onTwoFactorChanged).toHaveBeenCalled();
  });

  it("has no accessibility violations with a session list", async () => {
    const { view } = setup();
    await screen.findByText("Chrome · macOS");
    await expectNoViolations(view.container);
  });
});
