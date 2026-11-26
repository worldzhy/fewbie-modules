import type {
  IamGroupPermission,
  IamGroupPermissionInput,
  IamPermission,
  IamPermissionGroup,
  IamPermissionGroupDetail,
  IamPermissionGroupInput,
  IamPermissionGroupOption,
  IamPermissionInput,
  IamRole,
  IamRoleDetail,
  IamRoleInput,
  IamUser,
  IamUserInput,
} from "./iam-types";

/**
 * DTO ↔ module-type mapping helpers shared by every console-iam host.
 *
 * All helpers here take `any` on the input side so the module does not
 * need to know the host's generated DTO type names (CreateUserDto,
 * RoleDetailResponseDto, …). Hosts still own the transport calls; this
 * file only owns pure shape transforms. ADR-084.
 */

// ---------------------------------------------------------------------------
// Output: host row → module type
// ---------------------------------------------------------------------------

export function fromUserRow(row: any): IamUser {
  return {
    id: row.id,
    name: row.name ?? null,
    firstName: row.firstName ?? null,
    middleName: row.middleName ?? null,
    lastName: row.lastName ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    roles: row.roles ?? [],
    status: row.status,
    lastLoginAt: row.lastLoginAt ?? null,
  };
}

export function fromRoleRow(row: any): IamRole {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    isBuiltin: row.isBuiltin,
    userCount: row.userCount,
  };
}

export function fromRoleDetailRow(row: any): IamRoleDetail {
  return {
    ...fromRoleRow(row),
    // The role detail carries a lighter group summary than the group list.
    permissionGroups: (row.permissionGroups ?? []).map((group: any) => ({
      id: group.id,
      name: group.name,
      routePath: group.routePath,
      navLabel: group.navLabel,
    })),
  };
}

export function fromGroupOptionRow(row: any): IamPermissionGroupOption {
  return { id: row.id, name: row.name, routePath: row.routePath, navLabel: row.navLabel };
}

export function fromPermissionRow(row: any): IamPermission {
  return {
    id: row.id,
    resource: row.resource,
    action: row.action,
    roleId: row.roleId ?? null,
    trustedUserId: row.trustedUserId ?? null,
    createdAt: row.createdAt,
  };
}

export function fromGroupPermissionRow(row: any): IamGroupPermission {
  return { id: row.id, resource: row.resource, action: row.action };
}

export function fromPermissionGroupRow(row: any): IamPermissionGroup {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    routePath: row.routePath,
    navPlacement: row.navPlacement,
    navOrder: row.navOrder,
    navLabel: row.navLabel,
    navIcon: row.navIcon ?? null,
    isBuiltin: row.isBuiltin,
  };
}

export function fromPermissionGroupDetailRow(row: any): IamPermissionGroupDetail {
  return {
    ...fromPermissionGroupRow(row),
    permissions: (row.permissions ?? []).map(fromGroupPermissionRow),
  };
}

// ---------------------------------------------------------------------------
// Input: module type → host DTO payload
// ---------------------------------------------------------------------------

export function toCreateUserInput(input: IamUserInput) {
  return {
    name: input.name,
    firstName: input.firstName,
    middleName: input.middleName ?? undefined,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone ?? undefined,
    password: input.password,
    roles: input.roles,
    status: input.status,
  };
}

export function toUpdateUserInput(input: IamUserInput) {
  return {
    name: input.name,
    firstName: input.firstName,
    middleName: input.middleName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
    roles: input.roles,
    status: input.status,
  };
}

export function toCreateRoleInput(input: IamRoleInput) {
  return { name: input.name, description: input.description };
}

export function toUpdateRoleInput(input: IamRoleInput) {
  return { name: input.name, description: input.description };
}

export function toCreatePermissionInput(input: IamPermissionInput) {
  const payload: Record<string, unknown> = {
    resource: input.resource,
    action: input.action,
  };
  if (input.roleId !== undefined) payload.roleId = input.roleId;
  if (input.trustedUserId) payload.trustedUserId = input.trustedUserId;
  return payload;
}

export function toCreatePermissionGroupInput(input: IamPermissionGroupInput) {
  // A group made in the console is always user-owned (not builtin).
  return { ...input, isBuiltin: false };
}

export function toUpdatePermissionGroupInput(input: IamPermissionGroupInput) {
  return { ...input };
}

export function toReplaceRoleGroupsPayload(groupIds: number[]) {
  return { permissionGroupIds: groupIds };
}

export function toReplaceGroupPermissionsPayload(permissions: IamGroupPermissionInput[]) {
  return { permissions };
}
