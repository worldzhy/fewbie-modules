import { describe, expect, it, vi } from "vitest";
import { Bell } from "lucide-react";

import { deferred } from "@testing/deferred";
import { makeLabels } from "@testing/labels";
import { render, screen, userEvent, waitFor } from "@testing/render";
import { NotificationBell } from "../src/components/notification-center/notification-bell";
import { NotificationCenterProvider } from "../src/components/notification-center/notification-center";
import type {
  NotificationCenterLabels,
  NotificationCenterPort,
  NotificationRecord,
} from "../src/components/notification-center/types";

const RECORD: NotificationRecord = {
  id: "n1",
  notificationKey: "sample.key",
  title: "\u{1F534} Disk full",
  detail: "Volume crossed the threshold",
  severity: "critical",
  status: "firing",
  read: false,
  link: "/storage",
  createdAt: "2026-01-01T00:00:00.000Z",
};

function setup(overrides: Partial<NotificationCenterPort> = {}) {
  const port: NotificationCenterPort = {
    fetchUnreadCount: vi.fn().mockResolvedValue(0),
    fetchRecent: vi.fn().mockResolvedValue([]),
    fetchUnread: vi.fn().mockResolvedValue([]),
    markAllRead: vi.fn().mockResolvedValue(0),
    markRead: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  const onOpenLink = vi.fn();
  const onNavigate = vi.fn();
  const onMarkedRead = vi.fn();
  render(
    <NotificationCenterProvider
      labels={makeLabels<NotificationCenterLabels>()}
      port={port}
      resolveMeta={(key) => ({ label: `meta:${key}`, category: "ops" })}
      categoryVisuals={{ ops: { icon: Bell, className: "text-primary" } }}
      fallbackVisual={{ icon: Bell, className: "text-muted-foreground" }}
      onOpenLink={onOpenLink}
      onNavigate={onNavigate}
      onMarkedRead={onMarkedRead}
      pollIntervalMs={0}
    >
      <NotificationBell />
    </NotificationCenterProvider>,
  );
  return { port, onOpenLink, onNavigate, onMarkedRead, user: userEvent.setup() };
}

describe("notification-center conformance", () => {
  it("shows the loading copy until the recent list resolves", async () => {
    const pending = deferred<NotificationRecord[]>();
    setup({ fetchRecent: vi.fn().mockReturnValue(pending.promise) });
    expect(screen.getByText("label:loading")).toBeInTheDocument();
    pending.resolve([]);
    expect(await screen.findByText("label:empty")).toBeInTheDocument();
  });

  it("shows the empty copy when there are no notifications", async () => {
    setup();
    expect(await screen.findByText("label:empty")).toBeInTheDocument();
  });

  it("strips the status marker and opens the link after marking the record read", async () => {
    const { port, onOpenLink, user } = setup({ fetchRecent: vi.fn().mockResolvedValue([RECORD]) });
    const title = await screen.findByText("Disk full");
    await user.click(title);
    await waitFor(() => expect(port.markRead).toHaveBeenCalledWith("n1"));
    expect(onOpenLink).toHaveBeenCalledWith("/storage");
  });

  it("marks every notification read and reports the count to the host", async () => {
    const markAllRead = vi.fn().mockResolvedValue(2);
    const { onMarkedRead, user } = setup({
      fetchUnreadCount: vi.fn().mockResolvedValue(2),
      fetchRecent: vi.fn().mockResolvedValue([RECORD]),
      markAllRead,
    });
    await screen.findByText("Disk full");
    await user.click(screen.getByRole("button", { name: "label:markAllRead" }));
    await waitFor(() => expect(markAllRead).toHaveBeenCalledTimes(1));
    expect(onMarkedRead).toHaveBeenCalledWith(2);
  });
});
