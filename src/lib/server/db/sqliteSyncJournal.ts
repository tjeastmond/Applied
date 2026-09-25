import type Database from "better-sqlite3";
import { SYNC_TABLES, syncColumns } from "../services/syncProtocol";

export function installSyncJournal(db: Database.Database): void {
  db.transaction(() => {
    db.exec(`CREATE TABLE IF NOT EXISTS sync_changes (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL, record_id TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sync_destinations (
      destination TEXT PRIMARY KEY, checkpoint INTEGER NOT NULL DEFAULT 0,
      receipt TEXT, pending TEXT, pending_id TEXT, next_batch INTEGER NOT NULL DEFAULT 0
    );`);
    for (const { table, sql } of SYNC_TABLES) {
      const changed = syncColumns(sql)
        .map((column) => `OLD.${column} IS NOT NEW.${column}`)
        .join(" OR ");
      for (const event of ["INSERT", "UPDATE", "DELETE"] as const) {
        const row = event === "DELETE" ? "OLD" : "NEW";
        db.exec(`CREATE TRIGGER IF NOT EXISTS sync_${table}_${event.toLowerCase()}
          AFTER ${event} ON ${table} ${event === "UPDATE" ? `WHEN ${changed}` : ""}
          BEGIN
            INSERT INTO sync_changes (table_name, record_id) VALUES ('${table}', ${row}.id);
          END;`);
      }
    }
  })();
}
