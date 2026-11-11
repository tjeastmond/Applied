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
import { bindNamed } from "@/lib/server/db/tursoRowHelpers";
import type { TursoDatabaseBackend } from "@/lib/server/db/tursoBackend";

// Optimistic guard: the write only lands if the row is still the one `existing` was read from.
const GUARDED_UPDATE_SQL = `${UPDATE_APPLICATION_SQL} AND status = @expected_status AND updated_at = @expected_updated_at`;

function guardedUpdateArgs(updated: ReturnType<typeof buildApplicationUpdateRow>, existing: JobApplication) {
  return {
    ...applicationRowToUpdateArgs(updated),
    expected_status: existing.status,
    expected_updated_at: existing.updatedAt,
  };
}

export class ApplicationConflictError extends Error {
  constructor() {
    super("Application was modified concurrently; please retry");
  }
}

export async function patchApplicationWithSideEffects(
  id: string,
  data: PatchJobApplicationInput,
  existing: JobApplication,
  retried = false,
): Promise<JobApplication | null> {
  const sanitized = sanitizeApplicationInput(data);
  const statusChanging = sanitized.status !== undefined && sanitized.status !== existing.status;

  if (!statusChanging || !sanitized.status) {
    return getRepository().update(id, sanitized);
  }

  let result: JobApplication | null | "conflict";
  const backend = getDatabaseBackend();
  if (backend.provider === "sqlite") {
    const db = backend.getSqliteDatabase?.();
    if (!db) {
      throw new Error("SQLite database is unavailable");
    }
    result = patchApplicationStatusChangeSqlite(db, id, sanitized, existing, sanitized.status);
  } else {
    const client = (backend as TursoDatabaseBackend).getTursoClient();
    result = await patchApplicationStatusChangeTurso(client, id, sanitized, existing, sanitized.status);
  }
  if (result !== "conflict") return result;

  // Row changed since the caller read it: re-read and retry once, then surface the conflict.
  if (retried) throw new ApplicationConflictError();
  const fresh = await getRepository().getById(id);
  return fresh ? patchApplicationWithSideEffects(id, data, fresh, true) : null;
}

function patchApplicationStatusChangeSqlite(
  db: import("better-sqlite3").Database,
  id: string,
  sanitized: ReturnType<typeof sanitizeApplicationInput>,
  existing: JobApplication,
  nextStatus: ApplicationStatus,
): JobApplication | null | "conflict" {
  if (existing.id !== id) {
    return null;
  }

  const updated = buildApplicationUpdateRow(jobApplicationToApplicationRow(existing), sanitized);
  const note = buildNote(id, statusUpdateNoteContent(nextStatus));

  const run = db.transaction(() => {
    const userId = ensureDefaultUserIdSync(db);
    if (db.prepare(GUARDED_UPDATE_SQL).run(guardedUpdateArgs(updated, existing)).changes === 0) return false;
    db.prepare(INSERT_NOTE_SQL).run(note.id, note.applicationId, note.content, note.createdAt);
    insertStatusHistorySync(db, {
      applicationId: id,
      userId,
      fromStatus: existing.status,
      toStatus: nextStatus,
      changedAt: note.createdAt,
    });
    return true;
  });

  return run() ? rowToApplication(updated) : "conflict";
}

async function patchApplicationStatusChangeTurso(
  client: Client,
  id: string,
  sanitized: ReturnType<typeof sanitizeApplicationInput>,
  existing: JobApplication,
  nextStatus: ApplicationStatus,
): Promise<JobApplication | null | "conflict"> {
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

  const tx = await client.transaction("write");
  try {
    await tx.execute({ sql: INSERT_DEFAULT_USER_SQL, args: buildDefaultUserInsertArgs() });
    const result = await tx.execute(bindNamed(GUARDED_UPDATE_SQL, guardedUpdateArgs(updated, existing)));
    if (result.rowsAffected === 0) {
      await tx.rollback();
      return "conflict";
    }
    await tx.execute({ sql: INSERT_NOTE_SQL, args: [note.id, note.applicationId, note.content, note.createdAt] });
    await tx.execute({
      sql: INSERT_STATUS_HISTORY_SQL,
      args: [
        history.id,
        history.applicationId,
        history.userId,
        history.fromStatus,
        history.toStatus,
        history.changedAt,
      ],
    });
    await tx.commit();
  } catch (error) {
    if (!tx.closed) await tx.rollback().catch(() => undefined);
    throw error;
  } finally {
    tx.close();
  }

  return rowToApplication(updated);
}
