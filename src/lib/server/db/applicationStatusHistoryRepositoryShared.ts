import type { ApplicationStatus } from "@/lib/applicationStatus";
import type { ApplicationStatusHistoryEntry } from "@/types";
import type { RecordStatusHistoryInput } from "../repositories/applicationStatusHistoryRepository";
import { nowIso } from "./applicationRepositoryShared";

export type StatusHistoryRow = {
  id: string;
  application_id: string;
  user_id: string;
  from_status: ApplicationStatus | null;
  to_status: ApplicationStatus;
  changed_at: string;
  user_display_name: string;
};

export const LIST_STATUS_HISTORY_BY_APPLICATION_SQL = `SELECT
  h.id,
  h.application_id,
  h.user_id,
  h.from_status,
  h.to_status,
  h.changed_at,
  u.display_name AS user_display_name
FROM application_status_history h
INNER JOIN users u ON u.id = h.user_id
WHERE h.application_id = ?
ORDER BY h.changed_at DESC, h.rowid DESC`;

export const INSERT_STATUS_HISTORY_SQL = `INSERT INTO application_status_history (
  id, application_id, user_id, from_status, to_status, changed_at
) VALUES (?, ?, ?, ?, ?, ?)`;

export const HAS_STATUS_HISTORY_FOR_APPLICATION_SQL = `SELECT 1 FROM application_status_history WHERE application_id = ? LIMIT 1`;

export function rowToStatusHistoryEntry(row: StatusHistoryRow): ApplicationStatusHistoryEntry {
  return {
    id: row.id,
    applicationId: row.application_id,
    userId: row.user_id,
    userDisplayName: row.user_display_name,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    changedAt: row.changed_at,
  };
}

export function buildStatusHistoryEntry(
  input: RecordStatusHistoryInput,
): Omit<ApplicationStatusHistoryEntry, "userDisplayName"> {
  return {
    id: crypto.randomUUID(),
    applicationId: input.applicationId,
    userId: input.userId,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    changedAt: input.changedAt ?? nowIso(),
  };
}
