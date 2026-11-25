import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { expectNoViolations } from "@testing/a11y";
import { render, screen, userEvent, waitFor, within } from "@testing/render";

import { IamPermissionGroupDetailPage } from "../features/iam-permission-groups/iam-permission-group-detail-page";
import { IamPermissionGroupsPage } from "../features/iam-permission-groups/iam-permission-groups-page";
import type { IamPermissionGroupsLabels, IamPermissionGroupsPort } from "../features/iam-permission-groups/types";
import type { IamPermissionGroup, IamPermissionGroupDetail } from "../lib/iam-types";

const LABELS: IamPermissionGroupsLabels = {
  groupTitle: "Permission groups",
  groupSubtitle: "Console sections.",
  groupLoading: "Loading permission groups",
  groupErrorTitle: "Could not load permission groups",
  groupRetry: "Retry",
  groupEmptyTitle: "No permission groups yet",
  groupEmptyDescription: "Create a group.",
  groupCreate: "New group",
  groupCreateTitle: "Create permission group",
  groupEditTitle: "Edit permission group",
  groupColName: "Name",
  groupColRoute: "Route",
  groupColNav: "Navigation",
  groupColType: "Type",
  groupColActions: "Actions",
  groupBuiltin: "Built-in",
  groupCustom: "Custom",
  groupBuiltinHint: "Built-in groups are seeded.",
  groupBuiltinNoDelete: "Built-in groups cannot be deleted.",
  groupPlacementNone: "Hidden",
  groupMoveUp: "Move up",
  groupMoveDown: "Move down",
  groupManage: "Manage permissions",
  groupName: "Name",
  groupDescription: "Description",
  groupRoutePath: "Route path",
  groupRoutePathPlaceholder: "/reports",
  groupNavLabel: "Navigation label",
  groupNavIcon: "Navigation icon",
  groupNavIconPlaceholder: "chart-bar",
  groupNavPlacement: "Navigation placement",
  groupPlacementHeader: "Header navigation",
  groupValidationNameRequired: "Name is required",
  groupValidationRouteRequired: "Route path is required",
  groupValidationNavLabelRequired: "Navigation label is required",
  groupSave: "Save",
  groupCancel: "Cancel",
  groupDelete: "Delete",
  groupEdit: "Edit",
  groupCreateAction: "Create",
  groupDeleteTitle: "Delete permission group",
  groupDeleteDescription: (name) => `Delete ${name}?`,
  groupPermissionsTitle: "Permissions",
  groupPermissionsDescription: "Grant or revoke pairs.",
  groupGrant: "Grant",
  groupResource: "Resource",
  groupAction: "Action",
  groupPermissionsEmpty: "No grants yet",
  groupRemovePermissionTitle: "Revoke permission",
  groupRemovePermissionDescription: (resource, action) => `Revoke ${action} on ${resource}?`,
  groupValidationResourceRequired: "Select a resource",
  groupValidationActionRequired: "Select an action",
  groupActionFailed: "The change could not be saved",
  groupRecordCount: (total) => `${total} groups`,
};

const GROUPS: IamPermissionGroup[] = [
  {
    id: 10,
    name: "IAM",
    routePath: "/iam",
    navPlacement: "HEADER_NAVIGATION",
    navOrder: 1,
    navLabel: "IAM",
    isBuiltin: false,
  },
  {
    id: 11,
    name: "Audit",
    routePath: "/audit-logs",
    navPlacement: "HEADER_NAVIGATION",
    navOrder: 2,
    navLabel: "Audit",
    isBuiltin: true,
  },
  {
    id: 12,
    name: "Hidden",
    routePath: "/hidden",
    navPlacement: "NONE",
    navOrder: 3,
    navLabel: "Hidden",
    isBuiltin: false,
  },
];

const DETAIL: IamPermissionGroupDetail = {
  ...GROUPS[0],
  permissions: [{ id: 100, resource: "Project", action: "List" }],
};

function port(overrides: Partial<IamPermissionGroupsPort> = {}): IamPermissionGroupsPort {
  return {
    listGroups: vi.fn().mockResolvedValue(GROUPS),
    getGroup: vi.fn().mockResolvedValue(DETAIL),
    listResources: vi.fn().mockResolvedValue(["Project", "Task"]),
    listActions: vi.fn().mockResolvedValue(["List", "Get", "Create", "Update", "Delete"]),
    createGroup: vi.fn().mockResolvedValue(undefined),
    updateGroup: vi.fn().mockResolvedValue(undefined),
    deleteGroup: vi.fn().mockResolvedValue(undefined),
    reorderGroups: vi.fn().mockResolvedValue(undefined),
    replaceGroupPermissions: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function setupList(api: IamPermissionGroupsPort) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const user = userEvent.setup();
  const view = render(
    <QueryClientProvider client={client}>
      <IamPermissionGroupsPage labels={LABELS} port={api} />
    </QueryClientProvider>,
  );
  return { ...view, user };
}

function setupDetail(api: IamPermissionGroupsPort) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const user = userEvent.setup();
  const view = render(
    <QueryClientProvider client={client}>
      <IamPermissionGroupDetailPage labels={LABELS} port={api} groupId={10} />
    </QueryClientProvider>,
  );
  return { ...view, user };
}

describe("console-iam permission groups conformance", () => {
  it("renders one row per group and disables deleting a builtin", async () => {
    setupList(port());

    expect(await screen.findByText("IAM")).toBeInTheDocument();
    expect(screen.getByText("Audit")).toBeInTheDocument();
    expect(screen.getByText(LABELS.groupRecordCount(3))).toBeInTheDocument();

    const deleteButtons = screen.getAllByRole("button", { name: LABELS.groupDelete });
    expect(deleteButtons[1]).toBeDisabled();
    expect(deleteButtons[0]).toBeEnabled();
  });

  it("shows the empty state", async () => {
    setupList(port({ listGroups: vi.fn().mockResolvedValue([]) }));

    expect(await screen.findByText(LABELS.groupEmptyTitle)).toBeInTheDocument();
  });

  it("submits the reordered header ids", async () => {
    const reorderGroups = vi.fn<IamPermissionGroupsPort["reorderGroups"]>().mockResolvedValue(undefined);
    const { user } = setupList(port({ reorderGroups }));

    await screen.findByText("IAM");
    await user.click(screen.getAllByRole("button", { name: LABELS.groupMoveDown })[0]);

    await waitFor(() => expect(reorderGroups).toHaveBeenCalledWith([11, 10]));
  });

  it("creates a group from the dialog", async () => {
    const createGroup = vi.fn<IamPermissionGroupsPort["createGroup"]>().mockResolvedValue(undefined);
    const { user } = setupList(port({ createGroup }));

    await screen.findByText("IAM");
    await user.click(screen.getByRole("button", { name: LABELS.groupCreate }));
    const dialog = screen.getByRole("dialog");

    await user.type(within(dialog).getByLabelText(LABELS.groupName), "Reports");
    await user.type(within(dialog).getByLabelText(LABELS.groupRoutePath), "/reports");
    await user.type(within(dialog).getByLabelText(LABELS.groupNavLabel), "Reports");
    await user.click(within(dialog).getByRole("button", { name: LABELS.groupCreateAction }));

    await waitFor(() =>
      expect(createGroup).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Reports", routePath: "/reports", navLabel: "Reports" }),
      ),
    );
  });

  it("grants a permission by replacing the set", async () => {
    const replaceGroupPermissions = vi
      .fn<IamPermissionGroupsPort["replaceGroupPermissions"]>()
      .mockResolvedValue(undefined);
    const { user } = setupDetail(port({ replaceGroupPermissions }));

    await screen.findByRole("table");
    await user.selectOptions(screen.getByLabelText(LABELS.groupResource), "Task");
    await user.selectOptions(screen.getByLabelText(LABELS.groupAction), "Create");
    await user.click(screen.getByRole("button", { name: LABELS.groupGrant }));

    await waitFor(() =>
      expect(replaceGroupPermissions).toHaveBeenCalledWith(10, [
        { resource: "Project", action: "List" },
        { resource: "Task", action: "Create" },
      ]),
    );
  });

  it("revokes a permission after the confirmation resolves", async () => {
    const replaceGroupPermissions = vi
      .fn<IamPermissionGroupsPort["replaceGroupPermissions"]>()
      .mockResolvedValue(undefined);
    const { user } = setupDetail(port({ replaceGroupPermissions }));

    await screen.findByRole("table");
    await user.click(screen.getByRole("button", { name: LABELS.groupDelete }));

    await waitFor(() => expect(replaceGroupPermissions).toHaveBeenCalledWith(10, []));
  });

  it("has no accessibility violations in the ready state", async () => {
    const { container } = setupList(port());

    await screen.findByText("IAM");
    await expectNoViolations(container);
  });
});
