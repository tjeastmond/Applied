import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { openDatabase } from "./db/migrate";
import { SqliteJobApplicationRepository } from "./db/sqliteRepository";
import type { JobApplicationRepository } from "./repositories/jobApplicationRepository";

const globalForDb = globalThis as unknown as {
  db?: Database.Database;
  repository?: JobApplicationRepository;
};

function resolveDatabasePath(): string {
  return process.env.DATABASE_PATH ?? join(process.cwd(), "data", "applied.db");
}

function ensureDataDirectory(dbPath: string): void {
  const dataDir = dirname(dbPath);
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
}

export function getRepository(): JobApplicationRepository {
  if (!globalForDb.repository) {
    const dbPath = resolveDatabasePath();
    ensureDataDirectory(dbPath);
    globalForDb.db = openDatabase(dbPath);
    globalForDb.repository = new SqliteJobApplicationRepository(globalForDb.db);
  }
  return globalForDb.repository;
}
