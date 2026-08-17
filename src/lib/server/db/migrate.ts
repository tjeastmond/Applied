import Database from "better-sqlite3";
import { CLEAR_PINNED_ON_ARCHIVED_SQL } from "./applicationRepositoryShared";
import { APPLICATION_LEGACY_COLUMNS, readSchemaSql } from "./schema";

import { DEFAULT_USER_ID } from "@/lib/server/defaultUser";
import { buildDefaultUserInsertArgs } from "./userRepositoryShared";
import { INSERT_STATUS_HISTORY_SQL } from "./applicationStatusHistoryRepositoryShared";

function columnExists(db: Database.Database, column: string): boolean {
  const columns = db.prepare("PRAGMA table_info(applications)").all() as { name: string }[];
  return columns.some((col) => col.name === column);
}

function tableExists(db: Database.Database, table: string): boolean {
  const row = db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`).get(table) as
    | { 1: number }
    | undefined;
  return row !== undefined;
}

function agentApiTokenColumnExists(db: Database.Database, column: string): boolean {
  if (!tableExists(db, "agent_api_tokens")) {
    return false;
  }
  const columns = db.prepare("PRAGMA table_info(agent_api_tokens)").all() as { name: string }[];
  return columns.some((col) => col.name === column);
}

function userColumnExists(db: Database.Database, column: string): boolean {
  if (!tableExists(db, "users")) {
    return false;
  }
  const columns = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
  return columns.some((col) => col.name === column);
}

function migrateUserCredentials(db: Database.Database): void {
  if (!tableExists(db, "users")) {
    return;
  }

  if (!userColumnExists(db, "password_hash")) {
    db.exec(`ALTER TABLE users ADD COLUMN password_hash TEXT`);
  }

  db.exec(`UPDATE users SET email = lower(trim(email)) WHERE email IS NOT NULL AND email <> lower(trim(email))`);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users (email) WHERE email IS NOT NULL`);
}

export function migrateLegacyApplicationNotes(db: Database.Database): void {
  if (!tableExists(db, "application_notes")) {
    return;
  }

  const apps = db
    .prepare(`SELECT id, notes, updated_at FROM applications WHERE notes IS NOT NULL AND trim(notes) <> ''`)
    .all() as { id: string; notes: string; updated_at: string }[];

  const hasNoteForApp = db.prepare(`SELECT 1 FROM application_notes WHERE application_id = ? LIMIT 1`);
  const insert = db.prepare(
    `INSERT INTO application_notes (id, application_id, content, created_at) VALUES (?, ?, ?, ?)`,
  );

  for (const app of apps) {
    if (hasNoteForApp.get(app.id)) {
      continue;
    }
    insert.run(crypto.randomUUID(), app.id, app.notes.trim(), app.updated_at);
  }

  db.exec(`UPDATE applications SET notes = NULL WHERE notes IS NOT NULL`);
}

function migrateDefaultUser(db: Database.Database): void {
  if (!tableExists(db, "users")) {
    return;
  }

  db.prepare(
    `INSERT OR IGNORE INTO users (id, display_name, email, created_at, updated_at) VALUES (?, ?, NULL, ?, ?)`,
  ).run(...buildDefaultUserInsertArgs());
}

export function backfillMissingStatusHistory(db: Database.Database): void {
  migrateInitialStatusHistory(db);
}

function migrateInitialStatusHistory(db: Database.Database): void {
  if (!tableExists(db, "application_status_history") || !tableExists(db, "users")) {
    return;
  }

  migrateDefaultUser(db);

  const missingCount = db
    .prepare(
      `SELECT COUNT(*) AS count FROM applications a
       WHERE NOT EXISTS (
         SELECT 1 FROM application_status_history h WHERE h.application_id = a.id
       )`,
    )
    .get() as { count: number };

  if (missingCount.count === 0) {
    return;
  }

  const apps = db
    .prepare(
      `SELECT a.id, a.status, a.created_at FROM applications a
       WHERE NOT EXISTS (
         SELECT 1 FROM application_status_history h WHERE h.application_id = a.id
       )`,
    )
    .all() as {
    id: string;
    status: string;
    created_at: string;
  }[];

  const insert = db.prepare(INSERT_STATUS_HISTORY_SQL);

  for (const app of apps) {
    insert.run(crypto.randomUUID(), app.id, DEFAULT_USER_ID, null, app.status, app.created_at);
  }
}

export function migrate(db: Database.Database): void {
  db.pragma("foreign_keys = ON");

  db.exec(readSchemaSql());

  for (const column of APPLICATION_LEGACY_COLUMNS) {
    if (!columnExists(db, column)) {
      db.exec(`ALTER TABLE applications ADD COLUMN ${column} TEXT`);
    }
  }

  if (!columnExists(db, "archived")) {
    db.exec(`ALTER TABLE applications ADD COLUMN archived INTEGER NOT NULL DEFAULT 0`);
  }

  if (!columnExists(db, "pinned")) {
    db.exec(`ALTER TABLE applications ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0`);
  }

  db.exec(CLEAR_PINNED_ON_ARCHIVED_SQL);

  migrateLegacyApplicationNotes(db);

  if (!agentApiTokenColumnExists(db, "last_used_at")) {
    db.exec(`ALTER TABLE agent_api_tokens ADD COLUMN last_used_at TEXT`);
  }

  migrateUserCredentials(db);
  migrateDefaultUser(db);
  migrateInitialStatusHistory(db);
}

export function openDatabase(path = ":memory:"): Database.Database {
  const db = new Database(path);
  migrate(db);
  return db;
}
