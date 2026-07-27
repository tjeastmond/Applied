import type { ApplicationStatus } from "@/lib/applicationStatus";
import { DEFAULT_USER_ID } from "@/lib/server/defaultUser";
import type Database from "better-sqlite3";
import { buildStatusHistoryEntry, INSERT_STATUS_HISTORY_SQL } from "./applicationStatusHistoryRepositoryShared";
import { buildDefaultUserInsertArgs, INSERT_DEFAULT_USER_SQL } from "./userRepositoryShared";

export function ensureDefaultUserIdSync(db: Database.Database): string {
  db.prepare(INSERT_DEFAULT_USER_SQL).run(...buildDefaultUserInsertArgs());
  return DEFAULT_USER_ID;
}

export function insertStatusHistorySync(
  db: Database.Database,
  input: {
    applicationId: string;
    userId: string;
    fromStatus: ApplicationStatus | null;
    toStatus: ApplicationStatus;
    changedAt: string;
  },
): void {
  const entry = buildStatusHistoryEntry(input);
  db.prepare(INSERT_STATUS_HISTORY_SQL).run(
    entry.id,
    entry.applicationId,
    entry.userId,
    entry.fromStatus,
    entry.toStatus,
    entry.changedAt,
  );
}
