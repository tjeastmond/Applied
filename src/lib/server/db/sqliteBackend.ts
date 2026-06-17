import type Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { ImportMode } from "@/lib/schemas/backup";
import type { DatabaseBackend } from "../databaseBackend";
import type { SqliteDatabaseConfig } from "../databaseConfig";
import { createDatabaseBackup } from "../services/databaseBackupService";
import { exportJson, exportSql, importJson, importSql } from "../services/backupService";
import { hydrateAppAccessTokenFromDatabase } from "../appAccessToken";
import { openDatabase } from "./migrate";
import { SqliteAppAccessConfigRepository } from "./sqliteAppAccessConfigRepository";
import { SqliteApplicationNoteRepository } from "./sqliteApplicationNoteRepository";
import { SqliteJobApplicationRepository } from "./sqliteRepository";

function ensureDataDirectory(dbPath: string): void {
  const dataDir = dirname(dbPath);
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
}

export class SqliteDatabaseBackend implements DatabaseBackend {
  readonly provider = "sqlite";
  readonly applications;
  readonly notes;
  readonly appAccessConfig;

  private readonly db: Database.Database;
  private readonly path: string;

  constructor(config: SqliteDatabaseConfig, db?: Database.Database) {
    this.path = config.path;
    if (!db) {
      ensureDataDirectory(this.path);
    }

    this.db = db ?? openDatabase(this.path);
    this.appAccessConfig = new SqliteAppAccessConfigRepository(this.db);
    hydrateAppAccessTokenFromDatabase(this.appAccessConfig.getToken());
    this.applications = new SqliteJobApplicationRepository(this.db);
    this.notes = new SqliteApplicationNoteRepository(this.db);
  }

  exportJson() {
    return Promise.resolve(exportJson(this.db));
  }

  exportSql() {
    return Promise.resolve(exportSql(this.db));
  }

  importJson(raw: unknown, mode: ImportMode) {
    return Promise.resolve(importJson(this.db, raw, mode));
  }

  importSql(sql: string, mode: ImportMode) {
    return Promise.resolve(importSql(this.db, sql, mode));
  }

  async createDatabaseBackup() {
    return createDatabaseBackup(this.db, { databasePath: this.path });
  }

  reset(): void {
    // Local SQLite repositories are recreated by replacing the backend singleton.
  }

  getSqliteDatabase(): Database.Database {
    return this.db;
  }

  getSqliteDatabasePath(): string {
    return this.path;
  }
}
