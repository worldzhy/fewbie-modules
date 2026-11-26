import type { AuditLogRecord } from "./types";

/**
 * Pure transforms shared by every console-audit-log host. ADR-084/round2 —
 * sink the host/api.ts DTO mapping so the backend schema change lands in one
 * place. Inputs use `any` so the module does not need to know the host's
 * generated DTO type names.
 */

/** Turn a raw `datetime-local` value into the ISO instant the endpoint expects. */
export function toAuditIso(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/** Map the generated host DTO onto the module's own record shape. */
export function fromAuditLogRow(row: any): AuditLogRecord {
  return {
    id: row.id,
    event: row.event,
    action: row.action ?? "",
    resourceType: row.resourceType ?? "",
    resourceId: row.resourceId ?? "",
    actorId: row.actorId ?? null,
    result: row.result === "failure" ? "failure" : "success",
    createdAt: row.createdAt,
    detail: row.detail,
  };
}
