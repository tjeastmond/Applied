import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { openDatabase } from "./db/migrate";
import { SqliteApplicationNoteRepository } from "./db/sqliteApplicationNoteRepository";
import { SqliteJobApplicationRepository } from "./db/sqliteRepository";
import type { ApplicationNoteRepository } from "./repositories/applicationNoteRepository";
import type { JobApplicationRepository } from "./repositories/jobApplicationRepository";

const globalForDb = globalThis as unknown as {
  db?: Database.Database;
  repository?: JobApplicationRepository;
  noteRepository?: ApplicationNoteRepository;
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

function getDb(): Database.Database {
  if (!globalForDb.db) {
    const dbPath = resolveDatabasePath();
    ensureDataDirectory(dbPath);
    globalForDb.db = openDatabase(dbPath);
  }
  return globalForDb.db;
}

export function getRepository(): JobApplicationRepository {
  if (!globalForDb.repository) {
    globalForDb.repository = new SqliteJobApplicationRepository(getDb());
  }
  return globalForDb.repository;
}

export function getNoteRepository(): ApplicationNoteRepository {
  if (!globalForDb.noteRepository) {
    globalForDb.noteRepository = new SqliteApplicationNoteRepository(getDb());
  }
  return globalForDb.noteRepository;
}

/** Point route handlers at an in-memory DB during tests. */
export function useTestDatabase(db: Database.Database): void {
  globalForDb.db = db;
  globalForDb.repository = new SqliteJobApplicationRepository(db);
  globalForDb.noteRepository = new SqliteApplicationNoteRepository(db);
}
