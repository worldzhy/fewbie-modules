import type { AuditLogPageResult, AuditLogQuery } from "../../features/audit-log";
import type { AuditLogRecord } from "./types";

/**
 * Pure transforms shared by every console-audit-log host. Sinks DTO ↔
 * module-type mapping plus query sanitization — two host repos had
 * drifted (crewbie extracted helpers + stricter query validation,
 * nightwatch inlined + raw pass-through). Backend audit-log DTO validates
 * identically across both hosts (IsIn on result, no IsNotEmpty on strings),
 * so the stricter crewbie behaviour becomes the single source of truth.
 *
 * Round 2 follow-up to ADR-084.
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

/**
 * Build the backend query payload from the module's query shape.
 *
 * Sanitization rules (verified against both backends' AuditLogQueryDto):
 *   - keyword/event/action/resourceType/resourceId/actorId — trim whitespace;
 *     empty-after-trim becomes undefined so the backend's falsy-skip clause
 *     drops the filter (Prisma `where: { ...(query.keyword ? ... : {}) }`).
 *   - result — only passes "success" or "failure"; anything else becomes
 *     undefined (matches the backend's `@IsIn(RESULT_VALUES)` validation).
 *   - startTime/endTime — ISO string conversion via toAuditIso.
 */
export function toAuditQueryPayload(query: AuditLogQuery): Record<string, unknown> {
  return {
    page: query.page,
    pageSize: query.pageSize,
    keyword: query.keyword?.trim() || undefined,
    event: query.event?.trim() || undefined,
    action: query.action?.trim() || undefined,
    resourceType: query.resourceType?.trim() || undefined,
    resourceId: query.resourceId?.trim() || undefined,
    actorId: query.actorId?.trim() || undefined,
    result: query.result === "success" || query.result === "failure" ? query.result : undefined,
    startTime: toAuditIso(query.startTime),
    endTime: toAuditIso(query.endTime),
  };
}

/** Build the page result envelope (records + total). */
export function fromAuditPageEnvelope(data: {
  records: any[];
  pagination: { countOfTotal: number };
}): AuditLogPageResult {
  return {
    records: data.records.map(fromAuditLogRow),
    total: data.pagination.countOfTotal,
  };
}
