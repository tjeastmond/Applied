import type Database from "better-sqlite3";
import type { DatabaseProvider } from "./databaseConfig";
import type { ApplicationNoteRepository } from "./repositories/applicationNoteRepository";
import type { AppAccessConfigRepository } from "./repositories/appAccessConfigRepository";
import type { JobApplicationRepository } from "./repositories/jobApplicationRepository";
import type { ImportMode, BackupJson } from "@/lib/schemas/backup";
import type { DatabaseBackupPayload } from "./services/databaseBackupService";
import type { ImportResult } from "./services/backupService";

export type DatabaseBackend = {
  provider: DatabaseProvider;
  applications: JobApplicationRepository;
  notes: ApplicationNoteRepository;
  appAccessConfig?: AppAccessConfigRepository;
  exportJson(): Promise<BackupJson>;
  exportSql(): Promise<string>;
  importJson(raw: unknown, mode: ImportMode): Promise<ImportResult>;
  importSql(sql: string, mode: ImportMode): Promise<ImportResult>;
  createDatabaseBackup(): Promise<DatabaseBackupPayload>;
  reset(): void;
  getSqliteDatabase?(): Database.Database;
  getSqliteDatabasePath?(): string;
};
