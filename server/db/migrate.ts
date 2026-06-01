import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function columnExists(db: Database, table: string, column: string): boolean {
  const columns = db.query<{ name: string }, []>(`PRAGMA table_info(${table})`).all();
  return columns.some((col) => col.name === column);
}

export function migrate(db: Database): void {
  const schemaPath = join(import.meta.dir, "schema.sql");
  const schema = readFileSync(schemaPath, "utf-8");
  db.exec(schema);

  if (!columnExists(db, "applications", "full_jd")) {
    db.exec(`ALTER TABLE applications ADD COLUMN full_jd TEXT`);
  }
}

export function openDatabase(path = ":memory:"): Database {
  const db = new Database(path);
  migrate(db);
  return db;
}
