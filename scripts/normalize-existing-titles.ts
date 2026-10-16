#!/usr/bin/env node
/**
 * One-off: re-run normalizeJobTitle (with the company) over stored applications.
 *
 *   pnpm exec tsx scripts/normalize-existing-titles.ts           # dry run (default)
 *   pnpm exec tsx scripts/normalize-existing-titles.ts --apply   # backup, then update
 *
 * Local SQLite only (DATABASE_PATH, default data/applied.db). `updated_at` is left
 * unchanged so card order does not shift. For Turso, run Turso Sync afterward.
 */
import Database from "better-sqlite3";
import { existsSync } from "node:fs";
import { normalizeJobTitle } from "@/lib/normalizeJobTitle";

type Row = { id: string; title: string; company: string };

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const path = process.env.DATABASE_PATH ?? "data/applied.db";
  if (!existsSync(path)) throw new Error(`Database not found: ${path}`);

  const db = new Database(path, { readonly: !apply });
  const rows = db.prepare("SELECT id, title, company FROM applications").all() as Row[];
  const changes = rows
    .map((row) => ({ row, next: normalizeJobTitle(row.title, row.company) }))
    .filter((c): c is { row: Row; next: string } => c.next !== null && c.next !== "" && c.next !== c.row.title);

  for (const { row, next } of changes) {
    console.log(
      `${row.id.slice(0, 8)}  ${JSON.stringify(row.title)}\n          => ${JSON.stringify(next)}  (${row.company})`,
    );
  }
  console.log(`\n${changes.length} of ${rows.length} rows would change.`);

  if (!apply) {
    console.log("Dry run. Re-run with --apply to back up the database and update these rows.");
    db.close();
    return;
  }
  if (changes.length === 0) {
    db.close();
    return;
  }

  const backupPath = `${path}.before-title-normalize.${new Date().toISOString().replace(/[:.]/g, "-")}.db`;
  await db.backup(backupPath);
  console.log(`Backup written: ${backupPath}`);

  const update = db.prepare("UPDATE applications SET title = ? WHERE id = ?");
  db.transaction(() => {
    for (const { row, next } of changes) update.run(next, row.id);
  })();
  console.log(`Updated ${changes.length} rows.`);
  db.close();
}

void main();
