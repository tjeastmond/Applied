import { statusUpdateNoteContent, type ApplicationStatus } from "@/lib/applicationStatus";
import { getDatabaseBackend, getRepository } from "@/lib/server/db";
import { buildNote, INSERT_NOTE_SQL } from "@/lib/server/db/applicationNoteRepositoryShared";
import {
  applicationRowToUpdateArgs,
  buildApplicationUpdateRow,
  jobApplicationToApplicationRow,
  rowToApplication,
  UPDATE_APPLICATION_SQL,
} from "@/lib/server/db/applicationRepositoryShared";
import { ensureDefaultUserIdSync, insertStatusHistorySync } from "@/lib/server/db/statusHistoryWriteShared";
import { sanitizeApplicationInput } from "@/lib/server/sanitizeApplicationInput";
import type { PatchJobApplicationInput } from "@/lib/schemas/application";
import type { JobApplication } from "@/types";
import type { Client } from "@tursodatabase/serverless/compat";
import {
  buildStatusHistoryEntry,
  INSERT_STATUS_HISTORY_SQL,
} from "@/lib/server/db/applicationStatusHistoryRepositoryShared";
import { buildDefaultUserInsertArgs, INSERT_DEFAULT_USER_SQL } from "@/lib/server/db/userRepositoryShared";
import { DEFAULT_USER_ID } from "@/lib/server/defaultUser";
import type { TursoDatabaseBackend } from "@/lib/server/db/tursoBackend";

export async function patchApplicationWithSideEffects(
  id: string,
  data: PatchJobApplicationInput,
  existing: JobApplication,
): Promise<JobApplication | null> {
  const sanitized = sanitizeApplicationInput(data);
  const statusChanging = sanitized.status !== undefined && sanitized.status !== existing.status;

  if (!statusChanging || !sanitized.status) {
    return getRepository().update(id, sanitized);
  }

  const backend = getDatabaseBackend();
  if (backend.provider === "sqlite") {
    const db = backend.getSqliteDatabase?.();
    if (!db) {
      throw new Error("SQLite database is unavailable");
    }
    return patchApplicationStatusChangeSqlite(db, id, sanitized, existing, sanitized.status);
  }

  const client = (backend as TursoDatabaseBackend).getTursoClient();
  return patchApplicationStatusChangeTurso(client, id, sanitized, existing, sanitized.status);
}

function patchApplicationStatusChangeSqlite(
  db: import("better-sqlite3").Database,
  id: string,
  sanitized: ReturnType<typeof sanitizeApplicationInput>,
  existing: JobApplication,
  nextStatus: ApplicationStatus,
): JobApplication | null {
  if (existing.id !== id) {
    return null;
  }

  const updated = buildApplicationUpdateRow(jobApplicationToApplicationRow(existing), sanitized);
  const note = buildNote(id, statusUpdateNoteContent(nextStatus));

  const run = db.transaction(() => {
    const userId = ensureDefaultUserIdSync(db);
    db.prepare(UPDATE_APPLICATION_SQL).run(applicationRowToUpdateArgs(updated));
    db.prepare(INSERT_NOTE_SQL).run(note.id, note.applicationId, note.content, note.createdAt);
    insertStatusHistorySync(db, {
      applicationId: id,
      userId,
      fromStatus: existing.status,
      toStatus: nextStatus,
      changedAt: note.createdAt,
    });
  });

  run();
  return rowToApplication(updated);
}

async function patchApplicationStatusChangeTurso(
  client: Client,
  id: string,
  sanitized: ReturnType<typeof sanitizeApplicationInput>,
  existing: JobApplication,
  nextStatus: ApplicationStatus,
): Promise<JobApplication | null> {
  if (existing.id !== id) {
    return null;
  }

  const updated = buildApplicationUpdateRow(jobApplicationToApplicationRow(existing), sanitized);
  const note = buildNote(id, statusUpdateNoteContent(nextStatus));
  const history = buildStatusHistoryEntry({
    applicationId: id,
    userId: DEFAULT_USER_ID,
    fromStatus: existing.status,
    toStatus: nextStatus,
    changedAt: note.createdAt,
  });

  await client.execute({
    sql: INSERT_DEFAULT_USER_SQL,
    args: buildDefaultUserInsertArgs(),
  });
  await client.execute({
    sql: UPDATE_APPLICATION_SQL,
    args: applicationRowToUpdateArgs(updated),
  });
  await client.execute({
    sql: INSERT_NOTE_SQL,
    args: [note.id, note.applicationId, note.content, note.createdAt],
  });
  await client.execute({
    sql: INSERT_STATUS_HISTORY_SQL,
    args: [history.id, history.applicationId, history.userId, history.fromStatus, history.toStatus, history.changedAt],
  });

  return rowToApplication(updated);
}
