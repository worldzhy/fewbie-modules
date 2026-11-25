import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { expectNoViolations } from "@testing/a11y";
import { render, screen, userEvent, waitFor, within } from "@testing/render";

import { IamPermissionsPage } from "../features/iam-permissions/iam-permissions-page";
import type { IamPermissionsLabels, IamPermissionsPort } from "../features/iam-permissions/types";
import type { IamPermission } from "../lib/iam-types";

const LABELS: IamPermissionsLabels = {
  permTitle: "Permissions",
  permSubtitle: "Grants.",
  permLoading: "Loading grants",
  permErrorTitle: "Could not load permissions",
  permRetry: "Retry",
  permEmptyTitle: "No grants found",
  permEmptyDescription: "Adjust the filter.",
  permResourceFilter: "Filter by resource",
  permAllResources: "All resources",
  permCreate: "New permission",
  permCreateTitle: "Grant permission",
  permCreateDescription: "Grant one action on one resource.",
  permColResource: "Resource",
  permColAction: "Action",
  permColScope: "Granted to",
  permColCreatedAt: "Created",
  permColActions: "Actions",
  permGrantedToRole: (role) => `Role: ${role}`,
  permGrantedToUser: (id) => `User: ${id}`,
  permResource: "Resource",
  permAction: "Action",
  permRole: "Role",
  permRolePlaceholder: "No role",
  permTrustedUserId: "Trusted user id",
  permTrustedUserHint: "Used when no role is selected.",
  permValidationResourceRequired: "Select a resource",
  permValidationActionRequired: "Select an action",
  permValidationTargetRequired: "Select a role or enter a trusted user id",
  permDeleteTitle: "Revoke permission",
  permDeleteDescription: (resource, action) => `Revoke ${action} on ${resource}?`,
  permActionFailed: "The change could not be saved",
  permCancel: "Cancel",
  permDelete: "Delete",
  permPrevious: "Previous",
  permNext: "Next",
  permPageOf: (page, totalPages) => `Page ${page} of ${totalPages}`,
  permRecordCount: (total) => `${total} grants`,
};

const PERMISSIONS: IamPermission[] = [
  { id: 1, resource: "Project", action: "List", roleId: 2, createdAt: "2026-01-01T00:00:00.000Z" },
  { id: 2, resource: "Task", action: "Update", trustedUserId: "u-9" },
];

const ROLES = [
  { id: 2, name: "MEMBER", isBuiltin: false, userCount: 3 },
  { id: 1, name: "ADMIN", isBuiltin: true, userCount: 1 },
];

function port(overrides: Partial<IamPermissionsPort> = {}): IamPermissionsPort {
  return {
    listPermissions: vi.fn().mockResolvedValue({ records: PERMISSIONS, total: 2 }),
    listRoles: vi.fn().mockResolvedValue(ROLES),
    listResources: vi.fn().mockResolvedValue(["Project", "Task"]),
    listActions: vi.fn().mockResolvedValue(["List", "Get", "Create", "Update", "Delete"]),
    createPermission: vi.fn().mockResolvedValue(undefined),
    deletePermission: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function setup(api: IamPermissionsPort) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const user = userEvent.setup();
  const view = render(
    <QueryClientProvider client={client}>
      <IamPermissionsPage labels={LABELS} port={api} formatDateTime={(iso) => `t:${iso}`} />
    </QueryClientProvider>,
  );
  return { ...view, user };
}

describe("console-iam permissions conformance", () => {
  it("renders grants with their scope and creation time", async () => {
    setup(port());

    const table = await screen.findByRole("table");
    expect(within(table).getByText("Project")).toBeInTheDocument();
    expect(within(table).getByText("Role: MEMBER")).toBeInTheDocument();
    expect(within(table).getByText("User: u-9")).toBeInTheDocument();
    expect(within(table).getByText("t:2026-01-01T00:00:00.000Z")).toBeInTheDocument();
    expect(screen.getByText("2 grants")).toBeInTheDocument();
  });

  it("shows the empty state", async () => {
    setup(port({ listPermissions: vi.fn().mockResolvedValue({ records: [], total: 0 }) }));

    expect(await screen.findByText(LABELS.permEmptyTitle)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("creates a grant from the dialog", async () => {
    const createPermission = vi.fn<IamPermissionsPort["createPermission"]>().mockResolvedValue(undefined);
    const { user } = setup(port({ createPermission }));

    await screen.findByRole("table");
    await user.click(screen.getByRole("button", { name: LABELS.permCreate }));
    const dialog = screen.getByRole("dialog");

    await user.selectOptions(within(dialog).getByLabelText(LABELS.permResource), "Task");
    await user.selectOptions(within(dialog).getByLabelText(LABELS.permAction), "Create");
    await user.selectOptions(within(dialog).getByLabelText(LABELS.permRole), "2");
    await user.click(within(dialog).getByRole("button", { name: LABELS.permCreate }));

    await waitFor(() =>
      expect(createPermission).toHaveBeenCalledWith({
        resource: "Task",
        action: "Create",
        roleId: 2,
        trustedUserId: undefined,
      }),
    );
  });

  it("deletes a grant after the confirmation resolves", async () => {
    const deletePermission = vi.fn<IamPermissionsPort["deletePermission"]>().mockResolvedValue(undefined);
    const { user } = setup(port({ deletePermission }));

    await screen.findByRole("table");
    await user.click(screen.getAllByRole("button", { name: LABELS.permDelete })[0]);

    await waitFor(() => expect(deletePermission).toHaveBeenCalledWith(1));
  });

  it("has no accessibility violations in the ready state", async () => {
    const { container } = setup(port());

    await screen.findByRole("table");
    await expectNoViolations(container);
  });
});
