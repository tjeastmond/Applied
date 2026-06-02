import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function columnExists(db: Database.Database, column: string): boolean {
  const columns = db.prepare("PRAGMA table_info(applications)").all() as { name: string }[];
  return columns.some((col) => col.name === column);
}

export function migrate(db: Database.Database): void {
  const schemaPath = join(__dirname, "schema.sql");
  const schema = readFileSync(schemaPath, "utf-8");
  db.exec(schema);

  if (!columnExists(db, "full_jd")) {
    db.exec(`ALTER TABLE applications ADD COLUMN full_jd TEXT`);
  }
}

export function openDatabase(path = ":memory:"): Database.Database {
  const db = new Database(path);
  migrate(db);
  return db;
}
