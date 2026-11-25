/** Account status the backend reports; PENDING_APPROVAL is the application queue. */
export type IamUserStatus = "ACTIVE" | "INACTIVE" | "PENDING_APPROVAL";

/**
 * One account row as the host's backend returns it. Structural on purpose: a
 * host can pass its generated user DTO without a mapping layer.
 */
export interface IamUser {
  id: string;
  name?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  roles: string[];
  status: IamUserStatus;
  /** ISO timestamp; the host supplies the formatter. */
  lastLoginAt?: string | null;
}

/** One platform role. */
export interface IamRole {
  id: number;
  name: string;
  description?: string | null;
  /** Builtin roles cannot be renamed or deleted. */
  isBuiltin: boolean;
  /** Number of accounts holding this role. */
  userCount: number;
}

/** One permission group a role or account can be bound to. */
export interface IamPermissionGroupOption {
  id: number;
  name: string;
  routePath: string;
  navLabel: string;
}

/** A role with the permission groups currently bound to it. */
export interface IamRoleDetail extends IamRole {
  permissionGroups: IamPermissionGroupOption[];
}

/** One user-list request; an absent filter means "no constraint". */
export interface IamUserQuery {
  page: number;
  pageSize: number;
  name?: string;
  status?: IamUserStatus;
}

/** One page of accounts plus the total behind it. */
export interface IamUserPage {
  records: IamUser[];
  total: number;
}

/**
 * Writable account fields. Every field is optional so create and update share
 * one shape; the port decides which subset its endpoint accepts.
 */
export interface IamUserInput {
  name?: string;
  firstName?: string;
  middleName?: string | null;
  lastName?: string;
  email?: string;
  phone?: string | null;
  /** Create only; hashed by the backend. */
  password?: string;
  roles?: string[];
  status?: IamUserStatus;
}

/** Writable role fields. */
export interface IamRoleInput {
  name: string;
  description?: string;
}

/** Best display label for an account, mirroring the backend's own fallback order. */
export function userDisplayName(user: IamUser): string {
  const joined = [user.firstName, user.lastName].filter((part) => part && part.trim()).join(" ");
  return user.name?.trim() || joined || user.email?.trim() || user.phone?.trim() || user.id;
}
