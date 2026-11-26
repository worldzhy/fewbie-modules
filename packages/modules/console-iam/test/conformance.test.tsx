import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { expectNoViolations } from "@testing/a11y";
import { render, screen, userEvent, waitFor, within } from "@testing/render";

import { IamRolesPage } from "../features/iam-roles/iam-roles-page";
import type { IamRolesLabels, IamRolesPort } from "../features/iam-roles/types";
import { IamUsersPage } from "../features/iam-users/iam-users-page";
import type { IamUsersLabels, IamUsersPort } from "../features/iam-users/types";
import type { IamRole, IamRoleDetail, IamPermissionGroupOption, IamUser } from "../lib/iam-types";

const USERS_LABELS: IamUsersLabels = {
  usersTitle: "Users",
  usersSubtitle: "Accounts and roles.",
  usersSearchPlaceholder: "Search by name",
  usersStatusFilter: "Filter by status",
  usersStatusAll: "All statuses",
  usersStatusActive: "Active",
  usersStatusInactive: "Inactive",
  usersStatusPending: "Pending approval",
  usersLoading: "Loading accounts",
  usersErrorTitle: "Could not load accounts",
  usersRetry: "Retry",
  usersEmptyTitle: "No accounts found",
  usersEmptyDescription: "Adjust the filter.",
  usersColUser: "User",
  usersColRoles: "Roles",
  usersColStatus: "Status",
  usersColLastLogin: "Last login",
  usersColActions: "Actions",
  usersCreate: "New user",
  usersCreateTitle: "Create user",
  usersEditTitle: "Edit user",
  usersDeleteTitle: "Delete user",
  usersDeleteDescription: (name) => `Delete ${name}?`,
  usersCannotDeleteSelf: "You cannot delete yourself",
  usersApprove: "Approve",
  usersApproveTitle: "Approve account",
  usersApproveDescription: (name) => `Approve ${name}?`,
  usersApproveRolesHint: "The account is activated with the selected roles.",
  usersReject: "Reject",
  usersRejectTitle: "Reject application",
  usersRejectDescription: (name) => `Reject ${name}?`,
  usersBuiltin: "Builtin",
  usersName: "Display name",
  usersFirstName: "First name",
  usersMiddleName: "Middle name",
  usersLastName: "Last name",
  usersEmail: "Email",
  usersPhone: "Phone",
  usersPassword: "Password",
  usersPasswordHint: "Optional",
  usersRoles: "Roles",
  usersStatus: "Status",
  usersNoRoles: "No roles available",
  usersValidationEmailRequired: "Email is required",
  usersValidationEmailInvalid: "Enter a valid email",
  usersValidationNameRequired: "Enter a name",
  usersValidationRolesRequired: "Select at least one role",
  usersActionFailed: "The change could not be saved",
  usersCancel: "Cancel",
  usersSave: "Save",
  usersEdit: "Edit",
  usersDelete: "Delete",
  usersPrevious: "Previous",
  usersNext: "Next",
  usersPageOf: (page, totalPages) => `Page ${page} of ${totalPages}`,
  usersRecordCount: (total) => `${total} accounts`,
};

const ROLES_LABELS: IamRolesLabels = {
  rolesTitle: "Roles",
  rolesSubtitle: "Roles and bindings.",
  rolesLoading: "Loading roles",
  rolesErrorTitle: "Could not load roles",
  rolesRetry: "Retry",
  rolesEmptyTitle: "No roles yet",
  rolesEmptyDescription: "Create a role.",
  rolesCreate: "New role",
  rolesCreateTitle: "Create role",
  rolesEditTitle: (name) => `Edit ${name}`,
  rolesColName: "Name",
  rolesColDescription: "Description",
  rolesColUsers: "Users",
  rolesColType: "Type",
  rolesColActions: "Actions",
  rolesBuiltin: "Builtin",
  rolesCustom: "Custom",
  rolesBuiltinHint: "Builtin bindings are managed by the seed.",
  rolesBuiltinNoRename: "Builtin roles cannot be renamed.",
  rolesBuiltinNoDelete: "Builtin roles cannot be deleted.",
  rolesName: "Name",
  rolesNamePlaceholder: "e.g. MEMBER",
  rolesDescription: "Description",
  rolesDescriptionPlaceholder: "What this role is for",
  rolesValidationNameRequired: "Name is required",
  rolesDeleteTitle: "Delete role",
  rolesDeleteDescription: (name) => `Delete ${name}?`,
  rolesCancel: "Cancel",
  rolesSave: "Save",
  rolesEdit: "Edit",
  rolesDelete: "Delete",
  rolesPermissionGroups: "Permission groups",
  rolesPermissionGroupsHint: "A role grants access only through its groups.",
  rolesSaveGroups: "Save bindings",
  rolesNoGroups: "No permission groups available",
  rolesNoGroupsBound: "No permission groups bound",
  rolesGroupsLoadError: "Could not load the bindings",
  rolesActionFailed: "The change could not be saved",
  rolesRecordCount: (total) => `${total} roles`,
};

const ROLES: IamRole[] = [
  { id: 1, name: "ADMIN", isBuiltin: true, userCount: 1 },
  { id: 2, name: "MEMBER", isBuiltin: false, userCount: 3, description: "Base role" },
];

const GROUPS: IamPermissionGroupOption[] = [
  { id: 10, name: "IAM", routePath: "/iam", navLabel: "IAM" },
  { id: 11, name: "Audit", routePath: "/audit-logs", navLabel: "Audit" },
];

const MEMBER_DETAIL: IamRoleDetail = {
  ...ROLES[1],
  permissionGroups: [GROUPS[0]],
};

const USERS: IamUser[] = [
  {
    id: "u-1",
    name: "Alice",
    email: "alice@example.com",
    roles: ["ADMIN"],
    status: "ACTIVE",
    lastLoginAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "u-2",
    email: "bob@example.com",
    roles: [],
    status: "PENDING_APPROVAL",
  },
];

function usersPort(overrides: Partial<IamUsersPort> = {}): IamUsersPort {
  return {
    listUsers: vi.fn().mockResolvedValue({ records: USERS, total: USERS.length }),
    listRoles: vi.fn().mockResolvedValue(ROLES),
    createUser: vi.fn().mockResolvedValue(undefined),
    updateUser: vi.fn().mockResolvedValue(undefined),
    approveUser: vi.fn().mockResolvedValue(undefined),
    deleteUser: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function rolesPort(overrides: Partial<IamRolesPort> = {}): IamRolesPort {
  return {
    listRoles: vi.fn().mockResolvedValue(ROLES),
    getRole: vi.fn().mockResolvedValue(MEMBER_DETAIL),
    listPermissionGroups: vi.fn().mockResolvedValue(GROUPS),
    createRole: vi.fn().mockResolvedValue(undefined),
    updateRole: vi.fn().mockResolvedValue(undefined),
    deleteRole: vi.fn().mockResolvedValue(undefined),
    replaceRoleGroups: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function setupUsers(port: IamUsersPort, options: { pageSize?: number } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const user = userEvent.setup();
  const view = render(
    <QueryClientProvider client={client}>
      <IamUsersPage
        labels={USERS_LABELS}
        port={port}
        formatDateTime={(iso) => `t:${iso}`}
        pageSize={options.pageSize}
      />
    </QueryClientProvider>,
  );
  return { ...view, user, client };
}

function setupRoles(port: IamRolesPort) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const user = userEvent.setup();
  const view = render(
    <QueryClientProvider client={client}>
      <IamRolesPage labels={ROLES_LABELS} port={port} />
    </QueryClientProvider>,
  );
  return { ...view, user, client };
}

describe("console-iam users conformance", () => {
  it("renders one row per account with roles, status and last login", async () => {
    setupUsers(usersPort());

    expect(await screen.findByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("bob@example.com")).toBeInTheDocument();
    expect(screen.getByText("ADMIN")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByText(USERS_LABELS.usersStatusPending)).toBeInTheDocument();
    expect(screen.getByText("t:2026-01-01T00:00:00.000Z")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 1")).toBeInTheDocument();
    expect(screen.getByText("2 accounts")).toBeInTheDocument();
  });

  it("shows the empty state when no account matches", async () => {
    setupUsers(usersPort({ listUsers: vi.fn().mockResolvedValue({ records: [], total: 0 }) }));

    expect(await screen.findByText(USERS_LABELS.usersEmptyTitle)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows the error state and refetches on retry", async () => {
    const listUsers = vi
      .fn<IamUsersPort["listUsers"]>()
      .mockRejectedValueOnce(new Error("iam down"))
      .mockResolvedValue({ records: USERS, total: USERS.length });
    const { user } = setupUsers(usersPort({ listUsers }));

    expect(await screen.findByText(USERS_LABELS.usersErrorTitle)).toBeInTheDocument();
    expect(screen.getByText("iam down")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: USERS_LABELS.usersRetry }));

    await waitFor(() => expect(listUsers).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Alice")).toBeInTheDocument();
  });

  it("requests the next page from the pager", async () => {
    const listUsers = vi.fn<IamUsersPort["listUsers"]>().mockResolvedValue({ records: USERS, total: 4 });
    const { user } = setupUsers(usersPort({ listUsers }), { pageSize: 1 });

    await screen.findByText("Alice");
    await user.click(screen.getByRole("button", { name: new RegExp(USERS_LABELS.usersNext) }));

    await waitFor(() => expect(listUsers).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 })));
  });

  it("creates an account from the dialog", async () => {
    const createUser = vi.fn<IamUsersPort["createUser"]>().mockResolvedValue(undefined);
    const { user } = setupUsers(usersPort({ createUser }));

    await screen.findByText("Alice");
    await user.click(screen.getByRole("button", { name: USERS_LABELS.usersCreate }));
    const dialog = screen.getByRole("dialog");

    await user.type(within(dialog).getByLabelText(USERS_LABELS.usersName), "Carol");
    await user.type(within(dialog).getByLabelText(USERS_LABELS.usersEmail), "carol@example.com");
    await user.click(within(dialog).getByRole("button", { name: USERS_LABELS.usersCreate }));

    await waitFor(() =>
      expect(createUser).toHaveBeenCalledWith(expect.objectContaining({ name: "Carol", email: "carol@example.com" })),
    );
  });

  it("saves an edited account", async () => {
    const updateUser = vi.fn<IamUsersPort["updateUser"]>().mockResolvedValue(undefined);
    const { user } = setupUsers(usersPort({ updateUser }));

    await screen.findByText("Alice");
    await user.click(screen.getAllByRole("button", { name: USERS_LABELS.usersEdit })[0]);
    const dialog = screen.getByRole("dialog");

    await user.click(within(dialog).getByRole("button", { name: USERS_LABELS.usersSave }));

    await waitFor(() => expect(updateUser).toHaveBeenCalledWith("u-1", expect.objectContaining({ name: "Alice" })));
  });

  it("approves a pending account with the default role", async () => {
    const approveUser = vi.fn<IamUsersPort["approveUser"]>().mockResolvedValue(undefined);
    const { user } = setupUsers(usersPort({ approveUser }));

    await screen.findByText("bob@example.com");
    await user.click(screen.getByRole("button", { name: USERS_LABELS.usersApprove }));
    const dialog = screen.getByRole("dialog");

    await user.click(within(dialog).getByRole("button", { name: USERS_LABELS.usersApprove }));

    await waitFor(() => expect(approveUser).toHaveBeenCalledWith("u-2", ["MEMBER"]));
  });

  it("deletes an account after the confirmation resolves", async () => {
    const deleteUser = vi.fn<IamUsersPort["deleteUser"]>().mockResolvedValue(undefined);
    const { user } = setupUsers(usersPort({ deleteUser }));

    await screen.findByText("Alice");
    await user.click(screen.getAllByRole("button", { name: USERS_LABELS.usersDelete })[0]);

    await waitFor(() => expect(deleteUser).toHaveBeenCalledWith("u-1"));
  });

  it("has no accessibility violations in the ready state", async () => {
    const { container } = setupUsers(usersPort());

    await screen.findByText("Alice");
    await expectNoViolations(container);
  });
});

describe("console-iam roles conformance", () => {
  it("renders one row per role and disables deleting a builtin", async () => {
    setupRoles(rolesPort());

    expect(await screen.findByText("ADMIN")).toBeInTheDocument();
    expect(screen.getByText("MEMBER")).toBeInTheDocument();
    expect(screen.getByText(ROLES_LABELS.rolesRecordCount(2))).toBeInTheDocument();

    const deleteButtons = screen.getAllByRole("button", { name: ROLES_LABELS.rolesDelete });
    expect(deleteButtons[0]).toBeDisabled();
    expect(deleteButtons[1]).toBeEnabled();
  });

  it("shows the empty state when no role exists", async () => {
    setupRoles(rolesPort({ listRoles: vi.fn().mockResolvedValue([]) }));

    expect(await screen.findByText(ROLES_LABELS.rolesEmptyTitle)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("replaces the permission-group bindings of a custom role", async () => {
    const replaceRoleGroups = vi.fn<IamRolesPort["replaceRoleGroups"]>().mockResolvedValue(undefined);
    const { user } = setupRoles(rolesPort({ replaceRoleGroups }));

    await screen.findByText("MEMBER");
    await user.click(screen.getAllByRole("button", { name: ROLES_LABELS.rolesEdit })[1]);
    const dialog = screen.getByRole("dialog");

    expect(await within(dialog).findByText(ROLES_LABELS.rolesPermissionGroups)).toBeInTheDocument();
    await user.click(await within(dialog).findByRole("button", { name: "Audit" }));
    await user.click(within(dialog).getByRole("button", { name: ROLES_LABELS.rolesSaveGroups }));

    await waitFor(() => expect(replaceRoleGroups).toHaveBeenCalledWith(2, [10, 11]));
  });

  it("creates a role from the dialog", async () => {
    const createRole = vi.fn<IamRolesPort["createRole"]>().mockResolvedValue(undefined);
    const { user } = setupRoles(rolesPort({ createRole }));

    await screen.findByText("ADMIN");
    await user.click(screen.getByRole("button", { name: ROLES_LABELS.rolesCreate }));
    const dialog = screen.getByRole("dialog");

    await user.type(within(dialog).getByLabelText(ROLES_LABELS.rolesName), "REVIEWER");
    await user.click(within(dialog).getByRole("button", { name: ROLES_LABELS.rolesCreate }));

    await waitFor(() => expect(createRole).toHaveBeenCalledWith(expect.objectContaining({ name: "REVIEWER" })));
  });

  it("shows the current bindings of a builtin role read-only", async () => {
    const getRole = vi.fn<IamRolesPort["getRole"]>().mockResolvedValue({
      ...ROLES[0],
      permissionGroups: GROUPS,
    });
    const { user } = setupRoles(rolesPort({ getRole }));

    await screen.findByText("ADMIN");
    await user.click(screen.getAllByRole("button", { name: ROLES_LABELS.rolesEdit })[0]);
    const dialog = screen.getByRole("dialog");

    expect(await within(dialog).findByText(ROLES_LABELS.rolesBuiltinHint)).toBeInTheDocument();
    expect(await within(dialog).findByText("IAM")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: ROLES_LABELS.rolesSaveGroups })).not.toBeInTheDocument();
  });

  it("has no accessibility violations in the ready state", async () => {
    const { container } = setupRoles(rolesPort());

    await screen.findByText("ADMIN");
    await expectNoViolations(container);
  });
});
