import {
  UPSERT_APPLICATION_SQL,
  UPSERT_COMPANY_SQL,
  UPSERT_NOTE_SQL,
  UPSERT_STATUS_HISTORY_SQL,
  UPSERT_USER_SQL,
} from "./backupSql";

// Reuse the backup SQL as the allowlist: credentials are deliberately excluded.
export const SYNC_TABLES = [
  { table: "users", key: "users", sql: UPSERT_USER_SQL },
  { table: "companies", key: "companies", sql: UPSERT_COMPANY_SQL },
  { table: "applications", key: "applications", sql: UPSERT_APPLICATION_SQL },
  { table: "application_notes", key: "notes", sql: UPSERT_NOTE_SQL },
  { table: "application_status_history", key: "statusHistory", sql: UPSERT_STATUS_HISTORY_SQL },
] as const;
export type SyncTable = (typeof SYNC_TABLES)[number]["table"];
export type SyncCounts = Record<(typeof SYNC_TABLES)[number]["key"], number>;
export type SyncRow = Record<string, string | number | null>;
export type SyncOperation = { table: SyncTable; id: string; row: SyncRow | null };
export type SyncBatch = { expected: string | null; receipt: string; reset: boolean; operations: SyncOperation[] };
export type SyncTarget = {
  getSyncReceipt(): Promise<string | null>;
  applySyncBatch(batch: SyncBatch): Promise<void>;
};
export type IncrementalSyncResult = {
  mode: "baseline" | "incremental";
  imported: SyncCounts;
  deleted: SyncCounts;
  batches: number;
  payloadBytes: number;
  checkpoint: number;
  matches: true;
  differences: string[];
};
export function emptySyncCounts(): SyncCounts {
  return { applications: 0, notes: 0, users: 0, statusHistory: 0, companies: 0 };
}
export function syncColumns(sql: string): string[] {
  const columns = /^INSERT INTO \w+\s*\(([^)]+)\)/.exec(sql)?.[1];
  if (!columns) throw new Error("Invalid sync upsert SQL");
  return columns.split(",").map((column) => column.trim());
}
export const SYNC_RECEIPT_SCHEMA = `CREATE TABLE IF NOT EXISTS sync_receipt (
  id INTEGER PRIMARY KEY CHECK (id = 1), receipt TEXT NOT NULL
)`;
