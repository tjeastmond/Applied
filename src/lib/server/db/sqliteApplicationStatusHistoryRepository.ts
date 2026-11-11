import type Database from "better-sqlite3";
import type { ApplicationStatusHistoryEntry } from "@/types";
import type {
  ApplicationStatusHistoryRepository,
  RecordStatusHistoryInput,
} from "../repositories/applicationStatusHistoryRepository";
import type { UserRepository } from "../repositories/userRepository";
import {
  buildStatusHistoryEntry,
  INSERT_STATUS_HISTORY_SQL,
  LIST_STATUS_HISTORY_BY_APPLICATION_SQL,
  rowToStatusHistoryEntry,
  type StatusHistoryRow,
} from "./applicationStatusHistoryRepositoryShared";

export class SqliteApplicationStatusHistoryRepository implements ApplicationStatusHistoryRepository {
  private readonly listByApplicationStmt;
  private readonly insertStmt;
  private readonly users: UserRepository;

  constructor(db: Database.Database, users: UserRepository) {
    this.listByApplicationStmt = db.prepare(LIST_STATUS_HISTORY_BY_APPLICATION_SQL);
    this.insertStmt = db.prepare(INSERT_STATUS_HISTORY_SQL);
    this.users = users;
  }

  listByApplicationId(applicationId: string): Promise<ApplicationStatusHistoryEntry[]> {
    const rows = this.listByApplicationStmt.all(applicationId) as StatusHistoryRow[];
    return Promise.resolve(rows.map(rowToStatusHistoryEntry));
  }

  async record(input: RecordStatusHistoryInput): Promise<ApplicationStatusHistoryEntry> {
    const entry = buildStatusHistoryEntry(input);

    this.insertStmt.run(entry.id, entry.applicationId, entry.userId, entry.fromStatus, entry.toStatus, entry.changedAt);

    const user = await this.users.getById(entry.userId);
    return {
      ...entry,
      userDisplayName: user?.displayName ?? "Unknown",
    };
  }
}
