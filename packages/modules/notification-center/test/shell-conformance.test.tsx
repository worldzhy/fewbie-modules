import { describe, expect, it, vi } from "vitest";
import { Bell } from "lucide-react";

import { makeLabels } from "@testing/labels";
import { render, screen, userEvent, waitFor } from "@testing/render";
import { NotificationCenterShell } from "../src/widgets/notification-center-shell/notification-center-shell";
import type {
  NotificationCenterShellLabels,
  NotificationCenterShellPort,
} from "../src/widgets/notification-center-shell/types";
import type { NotificationPresentationLabels } from "../src/components/notification-presentation/types";

function setup(overrides: Partial<NotificationCenterShellPort> = {}, notificationsPath?: string) {
  const port: NotificationCenterShellPort = {
    fetchUnreadCount: vi.fn().mockResolvedValue(0),
    fetchUnread: vi.fn().mockResolvedValue([]),
    markRead: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  const onNavigate = vi.fn();
  render(
    <NotificationCenterShell
      labels={makeLabels<NotificationCenterShellLabels>()}
      presentation={{
        labels: makeLabels<NotificationPresentationLabels>(),
        resolveMeta: (key) => ({ label: `meta:${key}`, category: "ops" }),
        categoryVisuals: { ops: { icon: Bell, className: "text-primary" } },
        fallbackVisual: { icon: Bell, className: "text-muted-foreground" },
      }}
      port={port}
      notificationsPath={notificationsPath}
      onNavigate={onNavigate}
      pollIntervalMs={0}
    />,
  );
  return { port, onNavigate, user: userEvent.setup() };
}

describe("notification-center-shell conformance", () => {
  it("opens the notifications page instead of a popover", async () => {
    const { onNavigate, user } = setup();
    await user.click(screen.getByRole("button", { name: "label:bellLabel" }));
    expect(onNavigate).toHaveBeenCalledWith("/notifications");
  });

  it("honours the host notifications path", async () => {
    const { onNavigate, user } = setup({}, "/alerts/inbox");
    await user.click(screen.getByRole("button", { name: "label:bellLabel" }));
    expect(onNavigate).toHaveBeenCalledWith("/alerts/inbox");
  });

  it("shows the unread count and caps the badge at 99+", async () => {
    const { port } = setup({ fetchUnreadCount: vi.fn().mockResolvedValue(120) });
    expect(await screen.findByText("99+")).toBeInTheDocument();
    await waitFor(() => expect(port.fetchUnreadCount).toHaveBeenCalledTimes(1));
  });
});
