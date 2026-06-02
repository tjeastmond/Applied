import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

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

/** Moves non-empty `applications.notes` into `application_notes` (idempotent). */
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

export function migrate(db: Database.Database): void {
  db.pragma("foreign_keys = ON");

  const schemaPath = join(__dirname, "schema.sql");
  const schema = readFileSync(schemaPath, "utf-8");
  db.exec(schema);

  if (!columnExists(db, "full_jd")) {
    db.exec(`ALTER TABLE applications ADD COLUMN full_jd TEXT`);
  }

  migrateLegacyApplicationNotes(db);
}

export function openDatabase(path = ":memory:"): Database.Database {
  const db = new Database(path);
  migrate(db);
  return db;
}
