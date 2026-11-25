import { describe, expect, it } from "vitest";

import { expectNoViolations } from "@testing/a11y";
import { render, screen } from "@testing/render";

import { ConsoleAccessProvider } from "../features/access-control/access-provider";
import { RequirePermission } from "../features/access-control/require-permission";
import { useCanSee } from "../features/access-control/use-can-see";
import { hasRouteAccess } from "../lib/route-access";
import type { ConsoleAuthorizationLabels, PermissionGroupSummary } from "../features/access-control/types";

const LABELS: ConsoleAuthorizationLabels = {
  accessDeniedTitle: "No access",
  accessDeniedDescription: "Ask an admin.",
  loadingLabel: "Checking",
};

const GROUPS: PermissionGroupSummary[] = [
  { id: 1, name: "IAM", routePath: "/iam/users" },
  { id: 2, name: "Audit", routePath: "/audit-logs" },
];

function Gate({ routePath }: { routePath: string }) {
  const canSee = useCanSee(routePath);
  return <span>can:{String(canSee)}</span>;
}

describe("route-access", () => {
  it("matches the owning route exactly", () => {
    expect(hasRouteAccess(GROUPS, "/iam/users")).toBe(true);
    expect(hasRouteAccess(GROUPS, "/iam")).toBe(false);
    expect(hasRouteAccess(GROUPS, "/iam/users/1")).toBe(false);
  });

  it("fails closed without groups", () => {
    expect(hasRouteAccess(undefined, "/iam/users")).toBe(false);
    expect(hasRouteAccess([], "/iam/users")).toBe(false);
  });
});

describe("console-authorization conformance", () => {
  it("exposes the caller's groups to gates", () => {
    render(
      <ConsoleAccessProvider labels={LABELS} groups={GROUPS}>
        <Gate routePath="/audit-logs" />
      </ConsoleAccessProvider>,
    );
    expect(screen.getByText("can:true")).toBeInTheDocument();
  });

  it("renders the denied panel and lets the host override its copy", () => {
    render(
      <ConsoleAccessProvider labels={LABELS} groups={GROUPS}>
        <RequirePermission routePath="/settings">secret</RequirePermission>
      </ConsoleAccessProvider>,
    );
    expect(screen.getByText("No access")).toBeInTheDocument();
    expect(screen.getByText("Ask an admin.")).toBeInTheDocument();
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
  });

  it("prefers the host's title and description when provided", () => {
    render(
      <ConsoleAccessProvider labels={LABELS} groups={[]}>
        <RequirePermission routePath="/iam/users" title="Nope" description="Ask the owner.">
          secret
        </RequirePermission>
      </ConsoleAccessProvider>,
    );
    expect(screen.getByText("Nope")).toBeInTheDocument();
    expect(screen.getByText("Ask the owner.")).toBeInTheDocument();
  });

  it("shows the loading state while the account is pending", () => {
    render(
      <ConsoleAccessProvider labels={LABELS} groups={[]} pending>
        <RequirePermission routePath="/audit-logs">secret</RequirePermission>
      </ConsoleAccessProvider>,
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("No access")).not.toBeInTheDocument();
  });

  it("fails closed without a provider", () => {
    render(<Gate routePath="/iam/users" />);
    expect(screen.getByText("can:false")).toBeInTheDocument();
  });

  it("has no accessibility violations in the denied state", async () => {
    const { container } = render(
      <ConsoleAccessProvider labels={LABELS} groups={[]}>
        <RequirePermission routePath="/iam/users">secret</RequirePermission>
      </ConsoleAccessProvider>,
    );
    await expectNoViolations(container);
  });
});
